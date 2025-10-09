#!/usr/bin/env node
/**
 * 生产一键启动脚本（跨平台）
 * 功能：
 *  - 安装前后端依赖（优先 npm ci，失败回退 npm install）
 *  - 构建前端（Vite）输出到 backend/public
 *  - 启动后端（Express）
 * 兼容：Windows / Linux（WSL/原生）
 * 说明：默认监听 0.0.0.0（后端已显式绑定），无需额外配置
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = process.cwd();
const backendDir = path.join(rootDir, 'backend');
const frontendDir = path.join(rootDir, 'frontend');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

function log(msg, level = 'info') {
  const colors = { reset:'\x1b[0m', gray:'\x1b[90m', red:'\x1b[31m', green:'\x1b[32m', yellow:'\x1b[33m', blue:'\x1b[34m' };
  const map = { info:'blue', ok:'green', warn:'yellow', err:'red' };
  const c = colors[map[level] || 'reset'];
  console.log(`${c}%s${colors.reset}`, msg);
}

function run(cmd, args, options = {}, timeoutMs = 0) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...options });
    let killedByTimeout = false;
    let timer;
    if (timeoutMs && timeoutMs > 0) {
      timer = setTimeout(() => {
        killedByTimeout = true;
        try { child.kill('SIGKILL'); } catch {}
      }, timeoutMs);
    }
    child.on('error', reject);
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (killedByTimeout) {
        return reject(new Error(`命令超时: ${cmd} ${args.join(' ')}`));
      }
      if (code === 0) return resolve();
      reject(new Error(`命令失败(${code}): ${cmd} ${args.join(' ')}`));
    });
  });
}

async function ensureInstall(cwd) {
  const hasLock = fs.existsSync(path.join(cwd, 'package-lock.json'));
  if (hasLock) {
    try {
      log(`📦 npm ci @ ${cwd}`, 'info');
      await run(npmCmd, ['ci', '--no-fund', '--audit=false'], { cwd }, 10 * 60 * 1000);
      return;
    } catch (e) {
      log(`⚠️  npm ci 失败，回退 npm install: ${e.message}`, 'warn');
    }
  }
  log(`📦 npm install @ ${cwd}`, 'info');
  await run(npmCmd, ['install', '--no-fund', '--audit=false'], { cwd }, 15 * 60 * 1000);
}

function readText(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

function readEnvKV(p) {
  const out = {};
  const txt = readText(p);
  txt.split(/\r?\n/).forEach(line => {
    const s = line.trim();
    if (!s || s.startsWith('#')) return;
    const i = s.indexOf('=');
    if (i <= 0) return;
    const k = s.slice(0, i).trim();
    let v = s.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[k] = v;
  });
  return out;
}

async function initDatabase(baseEnv) {
  log('🗄️ 数据库初始化与迁移', 'info');

  // 读取 provider
  const schemaPath = path.join(backendDir, 'prisma', 'schema.prisma');
  const schema = readText(schemaPath);
  const isSQLite = /provider\s*=\s*"sqlite"/i.test(schema);

  // 计算 SQLite DB 文件是否已存在（首次部署用于是否执行种子）
  let dbFileExisted = false;
  if (isSQLite) {
    const envKV = readEnvKV(path.join(backendDir, '.env'));
    let dbUrl = envKV.DATABASE_URL || 'file:../data/fire_safety.db';
    const m = /^file:(.+)$/.exec(dbUrl);
    if (m) {
      const rel = m[1];
      const dbAbs = path.resolve(backendDir, 'prisma', rel);
      dbFileExisted = fs.existsSync(dbAbs);
    }
  }

  // 生成 Prisma Client
  await run(npmCmd, ['run', 'db:generate'], { cwd: backendDir, env: baseEnv }, 5 * 60 * 1000);

  // 存在迁移目录则 migrate deploy；否则 db push
  const migrationsDir = path.join(backendDir, 'prisma', 'migrations');
  const hasMigrations = fs.existsSync(migrationsDir)
    && fs.readdirSync(migrationsDir, { withFileTypes: true }).some(d => d.isDirectory());

  if (hasMigrations) {
    log('📋 发现迁移目录，执行 prisma migrate deploy', 'info');
    await run(npmCmd, ['run', 'db:migrate:deploy'], { cwd: backendDir, env: baseEnv }, 10 * 60 * 1000);
  } else {
    log('📋 未发现迁移目录，执行 prisma db push', 'warn');
    await run(npmCmd, ['run', 'db:push'], { cwd: backendDir, env: baseEnv }, 10 * 60 * 1000);
  }

  // 首次部署（SQLite 且之前不存在 DB 文件）执行种子
  if (isSQLite && !dbFileExisted) {
    log('🌱 首次部署，执行种子数据', 'info');
    try {
      await run(npmCmd, ['run', 'db:seed'], { cwd: backendDir, env: baseEnv }, 5 * 60 * 1000);
    } catch (e) {
      log(`⚠️  种子执行失败（忽略）：${e.message}`, 'warn');
    }
  } else {
    log('⏭️  跳过种子数据（非首次或非 SQLite）', 'warn');
  }
}

async function main() {
  // 基础检查
  if (!fs.existsSync(backendDir) || !fs.existsSync(frontendDir)) {
    throw new Error('未找到 backend/ 或 frontend/ 目录，请在项目根目录运行');
  }

  // 环境变量：生产
  const baseEnv = { ...process.env, NODE_ENV: 'production' };

  // 1) 安装依赖
  await ensureInstall(backendDir);
  await ensureInstall(frontendDir);

  // 2) 数据库初始化（迁移/推送 + 首次种子）
  await initDatabase(baseEnv);

  // 3) 构建前端
  log('🎨 前端构建（vite build）', 'info');
  await run(npmCmd, ['run', 'build'], { cwd: frontendDir, env: baseEnv }, 10 * 60 * 1000);

  // 4) 后端启动（长时运行，设置超长超时避免卡死）
  log('🚀 启动后端服务（生产）', 'info');
  await run(npmCmd, ['start'], { cwd: backendDir, env: baseEnv }, 7 * 24 * 60 * 60 * 1000);
}

main()
  .then(() => log('✅ 生产环境启动完成', 'ok'))
  .catch((e) => {
    log(`❌ 启动失败: ${e.message}`,'err');
    process.exit(1);
  });
