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

/**
 * 保守依赖安装策略（跨平台、可跳过）
 * - 若检测到 node_modules 已存在且非空，则默认跳过安装，加速重启场景（如 1Panel 挂载持久目录）。
 * - 如需强制重新安装，可设置环境变量 FORCE_INSTALL=1。
 * - 若需严格对齐 lock，可自行删除 node_modules 触发重新安装，或设置 FORCE_INSTALL。
 */
async function ensureInstall(cwd) {
  const pkgPath = path.join(cwd, 'package.json');
  const lockPath = path.join(cwd, 'package-lock.json');
  const modulesDir = path.join(cwd, 'node_modules');
  const hasPkg = fs.existsSync(pkgPath);
  const hasLock = fs.existsSync(lockPath);
  const hasModules = fs.existsSync(modulesDir);
  let modulesNonEmpty = false;
  try {
    modulesNonEmpty = hasModules && fs.readdirSync(modulesDir).length > 0;
  } catch {
    modulesNonEmpty = false;
  }

  // 允许通过环境变量强制安装
  const forceInstall = ['1', 'true', 'yes'].includes(String(process.env.FORCE_INSTALL || '').toLowerCase());

  // 若 node_modules 已存在且非空，且未强制安装，则跳过
  if (hasPkg && modulesNonEmpty && !forceInstall) {
    log(`⏭️  检测到已存在 node_modules，跳过依赖安装 @ ${cwd}`, 'warn');
    return;
  }

  // 优先使用 npm ci（若存在 package-lock.json），失败则回退 npm install
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

  // 运行控制开关（Windows/Linux 通用）
  const yes = (v) => ['1', 'true', 'yes', 'on'].includes(String(v || '').toLowerCase());
  const skipDbSync = yes(process.env.SKIP_DB_SYNC);   // 跳过 migrate deploy / db push
  const skipDbSeed = yes(process.env.SKIP_DB_SEED);   // 跳过 db:seed
  const forceDbSeed = yes(process.env.FORCE_DB_SEED); // 强制执行 db:seed（谨慎使用，会改动数据）

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

  // 迁移/结构同步（可通过 SKIP_DB_SYNC 跳过）
  if (!skipDbSync) {
    const migrationsDir = path.join(backendDir, 'prisma', 'migrations');
    const migrationDirs = fs.existsSync(migrationsDir)
      ? fs.readdirSync(migrationsDir, { withFileTypes: true }).filter(d => d.isDirectory())
      : [];
    const hasMigrations = migrationDirs.length > 0;
    const needPushAfterDeploy = migrationDirs.length <= 1; // 早期项目仅有极少迁移的兜底

    if (hasMigrations) {
      log('📋 发现迁移目录，执行 prisma migrate deploy', 'info');
      await run(npmCmd, ['run', 'db:migrate:deploy'], { cwd: backendDir, env: baseEnv }, 10 * 60 * 1000);
      if (needPushAfterDeploy) {
        log('🧩 迁移目录较少，追加一次 prisma db push 以补齐表结构', 'warn');
        await run(npmCmd, ['run', 'db:push'], { cwd: backendDir, env: baseEnv }, 10 * 60 * 1000);
      }
    } else {
      log('📋 未发现迁移目录，执行 prisma db push', 'warn');
      await run(npmCmd, ['run', 'db:push'], { cwd: backendDir, env: baseEnv }, 10 * 60 * 1000);
    }
  } else {
    log('⏭️  跳过数据库结构同步（SKIP_DB_SYNC=1）', 'warn');
  }

  // 数据种子执行策略（默认仅首次：SQLite 且 DB 文件不存在）
  if (skipDbSeed) {
    log('⏭️  跳过种子数据（SKIP_DB_SEED=1）', 'warn');
  } else if (forceDbSeed) {
    log('🌱 强制执行种子数据（FORCE_DB_SEED=1）', 'warn');
    try { await run(npmCmd, ['run', 'db:seed'], { cwd: backendDir, env: baseEnv }, 5 * 60 * 1000); } catch (e) { log(`⚠️  种子执行失败（忽略）：${e.message}`, 'warn'); }
  } else if (isSQLite && !dbFileExisted) {
    log('🌱 首次部署，执行种子数据（检测到新的 SQLite 数据库文件）', 'info');
    try { await run(npmCmd, ['run', 'db:seed'], { cwd: backendDir, env: baseEnv }, 5 * 60 * 1000); } catch (e) { log(`⚠️  种子执行失败（忽略）：${e.message}`, 'warn'); }
  } else {
    log('⏭️  跳过种子数据（非首次且未强制）', 'warn');
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
  // 构建产物健全性检查
  const builtIndex = path.join(backendDir, 'public', 'index.html');
  if (!fs.existsSync(builtIndex)) {
    throw new Error('前端构建产物缺失：backend/public/index.html 不存在。请检查前端构建日志与写入权限。');
  }

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
