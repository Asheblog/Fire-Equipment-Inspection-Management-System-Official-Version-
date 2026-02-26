#!/usr/bin/env node
/**
 * 生产启动脚本（跨平台）
 *
 * 关键策略：
 * - 镜像内依赖与前端产物必须在构建阶段完成，不在运行时安装/构建。
 * - 启动时仅执行：持久化目录检查、数据库迁移/初始化、后端进程启动。
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const rootDir = process.cwd();
const backendDir = path.join(rootDir, 'backend');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

function log(msg, level = 'info') {
  const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m'
  };
  const map = { info: 'blue', ok: 'green', warn: 'yellow', err: 'red' };
  const c = colors[map[level] || 'reset'];
  console.log(`${c}%s${colors.reset}`, msg);
}

function run(cmd, args, options = {}, timeoutMs = 0) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', ...options });
    let killedByTimeout = false;
    let timer;

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        killedByTimeout = true;
        try {
          child.kill('SIGKILL');
        } catch {
          // ignore
        }
      }, timeoutMs);
    }

    child.on('error', reject);
    child.on('close', (code) => {
      if (timer) clearTimeout(timer);
      if (killedByTimeout) {
        reject(new Error(`命令超时: ${cmd} ${args.join(' ')}`));
        return;
      }
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`命令失败(${code}): ${cmd} ${args.join(' ')}`));
    });
  });
}

function yes(v) {
  return ['1', 'true', 'yes', 'on'].includes(String(v || '').toLowerCase());
}

function readText(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

function readEnvKV(p) {
  const out = {};
  const txt = readText(p);
  txt.split(/\r?\n/).forEach((line) => {
    const s = line.trim();
    if (!s || s.startsWith('#')) return;
    const i = s.indexOf('=');
    if (i <= 0) return;
    const k = s.slice(0, i).trim();
    let v = s.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  });
  return out;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    log(`📁 创建目录: ${dirPath}`, 'info');
  }
}

function ensurePersistentDirs() {
  ensureDir(path.join(backendDir, 'data'));
  ensureDir(path.join(backendDir, 'uploads'));
  ensureDir(path.join(backendDir, 'logs'));
}

function ensurePrebuiltFrontend() {
  const builtIndex = path.join(backendDir, 'public', 'index.html');
  if (!fs.existsSync(builtIndex)) {
    throw new Error(
      '缺少前端构建产物 backend/public/index.html。请先通过 CI 构建镜像，或在本地手动执行 frontend 构建。'
    );
  }
}

function detectSQLiteInfo() {
  const schemaPath = path.join(backendDir, 'prisma', 'schema.prisma');
  const schema = readText(schemaPath);
  const isSQLite = /provider\s*=\s*"sqlite"/i.test(schema);

  if (!isSQLite) {
    return { isSQLite: false, dbFileExisted: false };
  }

  const envKV = readEnvKV(path.join(backendDir, '.env'));
  const dbUrl = process.env.DATABASE_URL || envKV.DATABASE_URL || 'file:../data/fire_safety.db';
  const m = /^file:(.+)$/.exec(dbUrl);
  if (!m) {
    return { isSQLite: true, dbFileExisted: false };
  }

  // Prisma 的 file: 相对路径以 schema.prisma 所在目录（backend/prisma）为基准
  const dbFilePath = path.resolve(backendDir, 'prisma', m[1]);
  return {
    isSQLite: true,
    dbFileExisted: fs.existsSync(dbFilePath)
  };
}

async function initDatabase(baseEnv) {
  log('🗄️ 数据库初始化与迁移', 'info');

  const sqliteInfo = detectSQLiteInfo();
  const skipDbSync = yes(process.env.SKIP_DB_SYNC);
  const skipDbSeed = yes(process.env.SKIP_DB_SEED);
  const forceDbSeed = yes(process.env.FORCE_DB_SEED);

  await run(npmCmd, ['run', 'db:generate'], { cwd: backendDir, env: baseEnv }, 5 * 60 * 1000);

  if (!skipDbSync) {
    const migrationsDir = path.join(backendDir, 'prisma', 'migrations');
    const migrationDirs = fs.existsSync(migrationsDir)
      ? fs.readdirSync(migrationsDir, { withFileTypes: true }).filter((d) => d.isDirectory())
      : [];
    const hasMigrations = migrationDirs.length > 0;
    const needPushAfterDeploy = migrationDirs.length <= 1;

    if (hasMigrations) {
      log('📋 执行 prisma migrate deploy', 'info');
      await run(npmCmd, ['run', 'db:migrate:deploy'], { cwd: backendDir, env: baseEnv }, 10 * 60 * 1000);

      if (needPushAfterDeploy) {
        log('🧩 迁移目录较少，追加 prisma db push 兜底', 'warn');
        await run(npmCmd, ['run', 'db:push'], { cwd: backendDir, env: baseEnv }, 10 * 60 * 1000);
      }
    } else {
      log('📋 未发现迁移目录，执行 prisma db push', 'warn');
      await run(npmCmd, ['run', 'db:push'], { cwd: backendDir, env: baseEnv }, 10 * 60 * 1000);
    }
  } else {
    log('⏭️  跳过数据库结构同步（SKIP_DB_SYNC=1）', 'warn');
  }

  if (skipDbSeed) {
    log('⏭️  跳过种子数据（SKIP_DB_SEED=1）', 'warn');
    return;
  }

  if (forceDbSeed) {
    log('🌱 强制执行种子数据（FORCE_DB_SEED=1）', 'warn');
    try {
      await run(npmCmd, ['run', 'db:seed'], { cwd: backendDir, env: baseEnv }, 5 * 60 * 1000);
    } catch (e) {
      log(`⚠️  种子执行失败（忽略）: ${e.message}`, 'warn');
    }
    return;
  }

  if (sqliteInfo.isSQLite && !sqliteInfo.dbFileExisted) {
    log('🌱 检测到全新 SQLite 数据库，执行初始种子', 'info');
    try {
      await run(npmCmd, ['run', 'db:seed'], { cwd: backendDir, env: baseEnv }, 5 * 60 * 1000);
    } catch (e) {
      log(`⚠️  种子执行失败（忽略）: ${e.message}`, 'warn');
    }
    return;
  }

  log('⏭️  跳过种子数据（非首次且未强制）', 'warn');
}

async function startBackend(baseEnv) {
  log('🚀 启动后端服务（生产）', 'info');
  await run(npmCmd, ['start'], { cwd: backendDir, env: baseEnv }, 7 * 24 * 60 * 60 * 1000);
}

async function main() {
  if (!fs.existsSync(backendDir)) {
    throw new Error('未找到 backend/ 目录，请在项目根目录运行');
  }

  ensurePersistentDirs();
  ensurePrebuiltFrontend();

  const baseEnv = { ...process.env, NODE_ENV: 'production' };
  await initDatabase(baseEnv);
  await startBackend(baseEnv);
}

main()
  .then(() => log('✅ 生产环境启动完成', 'ok'))
  .catch((e) => {
    log(`❌ 启动失败: ${e.message}`, 'err');
    process.exit(1);
  });
