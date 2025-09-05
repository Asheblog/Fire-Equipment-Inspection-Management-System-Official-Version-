#!/usr/bin/env node
/**
 * 简化部署脚本 (deploy-simple.js)
 * 生产一键部署（单端口 + 反向代理 HTTPS 策略）
 * 变更：去除 ENABLE_HTTPS / HTTPS_PORT / 证书路径写入，统一单一 PORT。
 * 强制要求 DOMAIN（不得为 localhost / 127.*）。
 *
 * 特性：
 *  - 幂等：多次执行仅增量更新 .env（保留非受控变量）
 *  - Prisma 迁移安全执行 (migrate deploy / db push)
 *  - 可选种子（新库自动 / 旧库经确认或参数）
 *  - CORS 自动加入生产域名（https://DOMAIN）
 *  - PM2 可选管理（存在即 reload，不重复 start）
 *  - 单端口部署，HTTPS 建议由 Nginx/Caddy 等反代终止
 *
 * 使用示例：
 *   交互：   node deploy-simple.js
 *   非交互： node deploy-simple.js --non-interactive --domain example.com --port 3001 --pm2 true --seed false
 *
 * CLI/ENV 参数（优先级：CLI > ENV > 交互 > 默认）
 *   --domain / DEPLOY_DOMAIN              生产域名 (必填，禁止 localhost)
 *   --port / DEPLOY_PORT                  单一服务端口 (默认 3001)
 *   --db-path / DEPLOY_DB_PATH            SQLite 相对路径（file: 之后部分）
 *   --pm2 / DEPLOY_PM2                    是否使用 PM2 (true/false)
 *   --pm2-name / DEPLOY_PM2_NAME          PM2 名称
 *   --seed / DEPLOY_RUN_SEED              是否执行种子
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const crypto = require('crypto');
const { readEnvFile, writeEnvFile, ensureDefaults } = require('./scripts/shared-env');

// 延迟创建 readline（非交互模式不创建）
let rlInterface;
async function getReadline() {
  if (!rlInterface) {
    const readline = await import('readline/promises');
    rlInterface = readline.createInterface({ input: process.stdin, output: process.stdout });
  }
  return rlInterface;
}

function color(c, msg) {
  const map = { red:'\x1b[31m', green:'\x1b[32m', yellow:'\x1b[33m', blue:'\x1b[34m', magenta:'\x1b[35m', cyan:'\x1b[36m', gray:'\x1b[90m', reset:'\x1b[0m' };
  return `${map[c] || ''}${msg}${map.reset}`;
}
function log(msg, c='reset') { console.log(color(c, msg)); }

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = { _:[ ] };
  for (let i=0;i<args.length;i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.replace(/^--/, '');
      const next = args[i+1];
      if (!next || next.startsWith('--')) { flags[key] = true; } else { flags[key] = next; i++; }
    } else { flags._.push(a); }
  }
  return flags;
}

const flags = parseArgs();
const nonInteractive = !!flags['non-interactive'];
const acceptDefaults = !!flags.yes;

function getFlagOrEnv(name, envName, defaultValue) {
  if (flags[name] !== undefined) return flags[name];
  if (process.env[envName] !== undefined) return process.env[envName];
  return defaultValue;
}

function commandExists(cmd) {
  try { execSync(process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`, { stdio:'ignore' }); return true; } catch { return false; }
}

async function prompt(question, def) {
  if (nonInteractive) return def;
  const rl = await getReadline();
  const suffix = def !== undefined ? color('gray', ' (默认: '+def+')') : '';
  const answer = await rl.question(color('cyan', `${question}${suffix} `));
  return answer.trim() || def;
}

function safeExec(cmd, opts={}) {
  log(`➡️  执行: ${cmd}`, 'gray');
  return execSync(cmd, { stdio:'inherit', ...opts });
}

// 采用 shared-env.js 的读写与排序；旧 HTTPS 相关变量已废弃。

async function main() {
  log('\n🔥 简化部署 - Fire Safety System', 'magenta');
  log('---------------------------------------------','magenta');

  const rootDir = process.cwd();
  const backendDir = path.join(rootDir, 'backend');
  const frontendDir = path.join(rootDir, 'frontend');
  const envPath = path.join(backendDir, '.env');

  if (!fs.existsSync(backendDir) || !fs.existsSync(frontendDir)) {
    log('❌ 找不到 backend/ 或 frontend/ 目录。请在项目根目录运行。','red');
    process.exit(1);
  }

  const major = parseInt(process.versions.node.split('.')[0],10);
  if (major < 18) {
    log(`❌ Node.js 版本过低: ${process.version}，需要 >= 18`, 'red');
    process.exit(1);
  }

  const currentEnv = readEnvFile(envPath);

  const defaultPort = currentEnv.PORT || getFlagOrEnv('port','DEPLOY_PORT','3001');
  const httpPort = await prompt('服务端口 (单端口)', defaultPort);

  // 强制要求域名（禁止 localhost / 127.*）
  let domain = getFlagOrEnv('domain','DEPLOY_DOMAIN', currentEnv.DOMAIN || '');
  if (!nonInteractive) {
    domain = await prompt('生产域名 (不可为 localhost)', domain);
  }
  const invalidDomain = !domain || /^(localhost|127\.)/i.test(domain);
  if (invalidDomain) {
    if (nonInteractive) {
      throw new Error('域名无效：必须提供非 localhost 的 DOMAIN');
    }
    while (true) {
      const retry = await prompt('请输入合法生产域名 (例如 example.com):', '');
      if (retry && !/^(localhost|127\.)/i.test(retry)) { domain = retry; break; }
      log('❌ 域名无效，重新输入。', 'red');
    }
  }

  // 生产 CORS 策略：自动加入 https://DOMAIN
  const addDomainToCors = true;

  // HTTPS/证书逻辑已移除（交由反向代理处理）。

  // 数据库路径（与 setup-and-run.js 保持：默认 ../data）
  const defaultDbRelative = currentEnv.DATABASE_URL?.replace(/^file:/,'') || getFlagOrEnv('db-path','DEPLOY_DB_PATH','../data/fire_safety.db');
  const dbRelative = await prompt('数据库文件路径 (相对于 backend/.env 的 file: 之后部分)', defaultDbRelative);
  const dbAbsolute = path.resolve(backendDir, dbRelative);
  const dbExists = fs.existsSync(dbAbsolute);
  log(`数据库绝对路径: ${dbAbsolute} ${dbExists ? '(已存在)' : '(将创建)'}`,'blue');

  // 是否运行种子
  let runSeed = false;
  const seedFlag = getFlagOrEnv('seed','DEPLOY_RUN_SEED', undefined);
  if (!dbExists) {
    runSeed = true; // 新库执行种子
  } else if (seedFlag !== undefined) {
    runSeed = /^(true|y|yes|1)$/i.test(seedFlag);
  } else if (!nonInteractive) {
    const ans = await prompt('检测到已有数据库，是否仍然执行种子数据? (y/N)', 'n');
    runSeed = /^(y|yes)$/i.test(ans);
  }

  // PM2
  let usePm2 = /^(true|y|yes|1)$/i.test(getFlagOrEnv('pm2','DEPLOY_PM2', currentEnv.PM2_ENABLED || 'true'));
  if (!nonInteractive && !acceptDefaults) {
    const ans = await prompt('是否使用 PM2 进程管理? (Y/n)', usePm2 ? 'y':'n');
    usePm2 = /^(y|yes)$/i.test(ans || 'y');
  }
  const pm2AppName = getFlagOrEnv('pm2-name','DEPLOY_PM2_NAME', currentEnv.PM2_APP_NAME || 'fire-safety-system');

  function randomSecret(bytes=32) { return crypto.randomBytes(bytes).toString('hex'); }
  const jwtSecret = currentEnv.JWT_SECRET || randomSecret(32);
  const jwtRefresh = currentEnv.JWT_REFRESH_SECRET || randomSecret(32);

  // 合并 env
  // 基础合并 + 默认生产覆盖
  let mergedEnv = ensureDefaults(currentEnv, { NODE_ENV: 'production', PORT: httpPort, DOMAIN: domain });
  mergedEnv.NODE_ENV = 'production';
  mergedEnv.PORT = httpPort;
  mergedEnv.DOMAIN = domain;
  mergedEnv.DATABASE_URL = `file:${dbRelative}`;
  mergedEnv.JWT_SECRET = jwtSecret;
  mergedEnv.JWT_REFRESH_SECRET = jwtRefresh;
  
  // ===== CORS 配置自动合并 =====
  // 目标：减少生产部署忘记配置 CORS_ORIGIN 导致前端静态资源 / API 被拦截的问题
  // 策略：
  //  1) 若已有 CORS_ORIGIN，保留并尝试追加当前 domain 对应来源(协议依据 enableHttps)
  //  2) 若没有 CORS_ORIGIN 且存在 domain，则写入该 domain 对应来源
  //  3) 若仍无 domain -> 留空，运行期 security-config 会 fallback 到默认 localhost 列表
  //  4) 去重
  try {
    const existing = (mergedEnv.CORS_ORIGIN || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const set = new Set(existing);
    if (addDomainToCors && domain) {
      set.add(`https://${domain}`);
    }
    if (set.size > 0) {
      mergedEnv.CORS_ORIGIN = Array.from(set).join(',');
    }
    if (mergedEnv.CORS_ALLOW_LOCAL_NETWORK === undefined) {
      // 默认关闭局域网自动放行（可手动改 true）
      mergedEnv.CORS_ALLOW_LOCAL_NETWORK = currentEnv.CORS_ALLOW_LOCAL_NETWORK || 'false';
    }
    // 记录用户选择（仅供参考，可不使用）
    // 废弃行为记录变量不再写入
  } catch (e) {
    log('⚠️  生成 CORS_ORIGIN 配置失败: ' + e.message, 'yellow');
  }

  writeEnvFile(envPath, mergedEnv);
  log(`✅ 已更新环境文件: ${envPath}`,'green');

  // 依赖安装
  log('\n📦 安装后端依赖', 'blue');
  safeExec('npm install', { cwd: backendDir });

  log('\n📦 安装前端依赖', 'blue');
  safeExec('npm install', { cwd: frontendDir });

  // 数据库迁移（非破坏）
  log('\n🗄️  初始化数据库结构', 'blue');
  try {
    safeExec('npx prisma generate', { cwd: backendDir });
    
    // 检查是否存在标准格式的 Prisma 迁移文件
    const migrationsDir = path.join(backendDir, 'prisma', 'migrations');
    const migrationDirs = fs.existsSync(migrationsDir) 
      ? fs.readdirSync(migrationsDir, { withFileTypes: true })
          .filter(dirent => dirent.isDirectory())
      : [];
    
    if (migrationDirs.length > 0) {
      log('📋 使用 Prisma 迁移文件同步数据库...', 'blue');
      safeExec('npx prisma migrate deploy', { cwd: backendDir });
    } else {
      log('📋 未发现标准 Prisma 迁移文件，使用 db push 同步结构...', 'yellow');
      safeExec('npx prisma db push', { cwd: backendDir });
    }
    
    log('✅ 数据库结构同步完成', 'green');
  } catch (e) {
    log('❌ 数据库初始化失败: ' + e.message, 'red');
    log('💡 建议检查：', 'cyan');
    log('   1. 数据库连接配置是否正确', 'white');
    log('   2. 数据库文件路径是否可访问', 'white');
    log('   3. schema.prisma 文件是否有语法错误', 'white');
    throw e; // 重新抛出错误，阻止后续执行
  }

  if (runSeed) {
    log('\n🌱  执行种子数据 ...', 'blue');
    try { safeExec('npm run db:seed', { cwd: backendDir }); }
    catch { log('⚠️  种子执行失败（忽略）。','yellow'); }
  } else {
    log('⏭️  跳过种子数据。','gray');
  }

  // 前端构建
  log('\n🎨 构建前端 (vite build)', 'blue');
  safeExec('npm run build', { cwd: frontendDir });

  // 检查前端构建结果
  log('\n📁 检查前端构建结果', 'blue');
  const publicDir = path.join(backendDir, 'public');
  const indexPath = path.join(publicDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    log('✅ 前端构建成功，文件已直接输出到 backend/public','green');
  } else {
    log('❌ 前端构建结果检查失败，请确认构建是否成功','red');
  }

  // 目录保证
  for (const d of ['uploads','logs']) {
    const target = path.join(backendDir, d);
    if (!fs.existsSync(target)) fs.mkdirSync(target, { recursive:true });
  }
  const dbDir = path.dirname(dbAbsolute);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive:true });

  // PM2 管理
  if (usePm2) {
    log('\n🌀 配置 / 启动 PM2', 'blue');
    if (!commandExists('pm2')) {
      log('⚠️  未检测到全局 pm2，请先安装: npm install -g pm2','yellow');
    } else {
      try {
        const listResult = spawnSync('pm2',['ls'], { encoding:'utf8' });
        const exists = listResult.stdout && listResult.stdout.includes(pm2AppName);
        if (exists) {
          log(`🔁 已存在 PM2 应用 ${pm2AppName} → reload`, 'blue');
          safeExec(`pm2 reload ${pm2AppName}`);
        } else {
          log(`🚀 启动 PM2 应用: ${pm2AppName}`, 'blue');
          safeExec(`pm2 start app.js --name ${pm2AppName} --time`, { cwd: backendDir });
        }
        safeExec('pm2 save');
      } catch (e) {
        log('⚠️  PM2 操作失败（继续执行）：' + e.message, 'yellow');
      }
    }
  } else {
    log('⏭️  跳过 PM2。','gray');
  }

  // 摘要
  log('\n✅ 部署流程完成 (deploy-simple)', 'green');
  log('---------------------------------------------','green');
  log('访问信息:','cyan');
  log(`  - 应用端口: ${httpPort}`,'white');
  log(`  - 生产域名 (通过反代访问): https://${domain}`,'white');
  log('\n后续建议:','cyan');
  log('  1) 使用 Nginx / Caddy 终止 HTTPS 并反向代理到此端口。','white');
  log('  2) 确保只开放 80/443 对外；应用端口内网可控。','white');
  log('  3) 定期备份 .env 与数据库文件。','white');
  log('  4) 监控 PM2 状态: pm2 status / pm2 logs','white');
  log('\n完成。','cyan');
}

main().catch(e => { log('❌ 脚本异常: ' + e.stack,'red'); process.exit(1); }).finally(()=> { if (rlInterface) rlInterface.close(); });

module.exports = { main };
