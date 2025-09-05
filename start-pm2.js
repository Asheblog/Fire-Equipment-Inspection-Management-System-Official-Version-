#!/usr/bin/env node
/**
 * PM2 启动脚本 (start-pm2.js)
 * 目标：一键重新构建前端并启动/重启PM2应用
 * 特性：
 *  - 清空前端构建目录，确保构建产物最新
 *  - 重新构建前端项目
 *  - 智能PM2应用管理（新启动/重启已有应用）
 *  - 从 .env 文件自动读取应用配置
 *  - 详细的状态反馈和错误处理
 *
 * 使用：
 *  node start-pm2.js                 # 标准启动模式
 *  node start-pm2.js --force-new     # 强制创建新应用（删除已有应用）
 *  node start-pm2.js --no-build      # 跳过前端构建直接启动
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

function color(c, msg) {
  const map = { 
    red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', 
    blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m', 
    gray: '\x1b[90m', white: '\x1b[37m', reset: '\x1b[0m' 
  };
  return `${map[c] || ''}${msg}${map.reset}`;
}

function log(msg, c = 'reset') { 
  console.log(color(c, msg)); 
}

function parseArgs() {
  const args = process.argv.slice(2);
  const flags = { _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.replace(/^--/, '');
      flags[key] = true;
    } else {
      flags._.push(a);
    }
  }
  return flags;
}

function safeExec(cmd, opts = {}) {
  log(`➡️  执行: ${cmd}`, 'gray');
  try {
    return execSync(cmd, { stdio: 'inherit', ...opts });
  } catch (error) {
    log(`❌ 命令执行失败: ${cmd}`, 'red');
    throw error;
  }
}

function commandExists(cmd) {
  try { 
    execSync(process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`, { stdio: 'ignore' }); 
    return true; 
  } catch { 
    return false; 
  }
}

function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function clearDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    log(`📁 目录不存在，创建: ${dirPath}`, 'blue');
    fs.mkdirSync(dirPath, { recursive: true });
    return;
  }
  
  log(`🗑️  清空构建目录: ${dirPath}`, 'yellow');
  const entries = fs.readdirSync(dirPath);
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    fs.rmSync(fullPath, { recursive: true, force: true });
  }
  log(`✅ 构建目录已清空`, 'green');
}

function getPM2AppStatus(appName) {
  try {
    const listResult = spawnSync('pm2', ['ls'], { encoding: 'utf8' });
    if (listResult.error) {
      throw listResult.error;
    }
    return listResult.stdout && listResult.stdout.includes(appName);
  } catch (error) {
    log(`⚠️  无法检查PM2应用状态: ${error.message}`, 'yellow');
    return false;
  }
}

async function main() {
  log('\n🚀 PM2 启动脚本 - Fire Safety System', 'magenta');
  log('---------------------------------------------', 'magenta');

  const flags = parseArgs();
  const forceNew = flags['force-new'];
  const noBuild = flags['no-build'];

  const rootDir = process.cwd();
  const backendDir = path.join(rootDir, 'backend');
  const frontendDir = path.join(rootDir, 'frontend');
  const envPath = path.join(backendDir, '.env');
  const publicDir = path.join(backendDir, 'public');

  // 检查目录结构
  if (!fs.existsSync(backendDir) || !fs.existsSync(frontendDir)) {
    log('❌ 找不到 backend/ 或 frontend/ 目录。请在项目根目录运行。', 'red');
    process.exit(1);
  }

  // 检查 PM2 是否安装
  if (!commandExists('pm2')) {
    log('❌ 未检测到 PM2，请先安装: npm install -g pm2', 'red');
    process.exit(1);
  }

  // 读取配置
  const envConfig = readEnvFile(envPath);
  const appName = envConfig.PM2_APP_NAME || 'fire-safety-system';
  const port = envConfig.PORT || '3001';

  log(`📋 配置信息:`, 'cyan');
  log(`   - PM2应用名: ${appName}`, 'white');
  log(`   - 服务端口: ${port}`, 'white');
  log(`   - 后端目录: ${backendDir}`, 'white');
  log(`   - 前端目录: ${frontendDir}`, 'white');

  // 前端构建流程
  if (!noBuild) {
    log('\n🏗️  开始前端重新构建...', 'blue');

    // 清空构建目录
    clearDirectory(publicDir);

    // 安装前端依赖（确保最新）
    log('\n📦 检查前端依赖...', 'blue');
    safeExec('npm install', { cwd: frontendDir });

    // 构建前端
    log('\n🎨 构建前端项目...', 'blue');
    safeExec('npm run build', { cwd: frontendDir });

    // 验证构建结果
    const indexPath = path.join(publicDir, 'index.html');
    if (fs.existsSync(indexPath)) {
      log('✅ 前端构建完成，文件已输出到 backend/public', 'green');
    } else {
      log('❌ 前端构建失败，未发现 index.html 文件', 'red');
      process.exit(1);
    }
  } else {
    log('\n⏭️  跳过前端构建（--no-build 参数）', 'gray');
  }

  // PM2 应用管理
  log('\n🌀 PM2 应用管理...', 'blue');

  const appExists = getPM2AppStatus(appName);
  
  if (forceNew && appExists) {
    log(`🗑️  强制删除已有应用: ${appName}`, 'yellow');
    try {
      safeExec(`pm2 delete ${appName}`);
      log(`✅ 应用 ${appName} 已删除`, 'green');
    } catch (error) {
      log(`⚠️  删除应用失败，继续执行: ${error.message}`, 'yellow');
    }
  }

  // 启动或重启应用
  try {
    if (appExists && !forceNew) {
      log(`🔄 重启已有应用: ${appName}`, 'blue');
      safeExec(`pm2 restart ${appName}`);
      log(`✅ 应用 ${appName} 重启成功`, 'green');
    } else {
      log(`🚀 启动新应用: ${appName}`, 'blue');
      safeExec(`pm2 start app.js --name ${appName} --time`, { cwd: backendDir });
      log(`✅ 应用 ${appName} 启动成功`, 'green');
    }

    // 保存PM2配置
    safeExec('pm2 save');
    log('✅ PM2配置已保存', 'green');

    // 显示应用状态
    log('\n📊 当前PM2应用状态:', 'cyan');
    safeExec('pm2 status');

  } catch (error) {
    log(`❌ PM2操作失败: ${error.message}`, 'red');
    log('💡 建议检查：', 'cyan');
    log('   1. backend/app.js 文件是否存在', 'white');
    log('   2. 端口是否被占用', 'white');
    log('   3. 环境配置是否正确', 'white');
    process.exit(1);
  }

  // 完成信息
  log('\n✅ PM2 启动流程完成', 'green');
  log('---------------------------------------------', 'green');
  log('访问信息:', 'cyan');
  log(`  - 应用地址: http://localhost:${port}`, 'white');
  log(`  - PM2 状态: pm2 status`, 'white');
  log(`  - 查看日志: pm2 logs ${appName}`, 'white');
  log(`  - 重启应用: pm2 restart ${appName}`, 'white');
  log(`  - 停止应用: pm2 stop ${appName}`, 'white');
  
  if (envConfig.ENABLE_HTTPS === 'true') {
    const httpsPort = envConfig.HTTPS_PORT || '3443';
    const domain = envConfig.DOMAIN || 'localhost';
    log(`  - HTTPS地址: https://${domain}:${httpsPort}`, 'white');
  }
  
  log('\n🎉 应用已成功启动，可以开始使用！', 'cyan');
}

main().catch(e => {
  log('❌ 脚本异常: ' + e.stack, 'red');
  process.exit(1);
});

module.exports = { main };