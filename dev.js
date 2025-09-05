#!/usr/bin/env node

/**
 * 消防器材点检管理系统 - 开发环境启动脚本
 * 功能：自动检测局域网IP，智能更新HTTPS证书，启动开发服务器
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const os = require('os');
const { readEnvFile, writeEnvFile, ensureDefaults } = require('./scripts/shared-env');

// 强制在开发脚本层面开启 HTTPS（同时影响后端二维码 URL 强制 https 逻辑）
process.env.FORCE_HTTPS = 'true';
// 兼容备用命名（如果代码里未来支持 ALWAYS_HTTPS）
process.env.ALWAYS_HTTPS = 'true';

// 尝试加载 selfsigned 包，如果未安装则设为 null
let selfsigned = null;
try {
  selfsigned = require('selfsigned');
} catch (error) {
  // selfsigned 包未安装，将在后续代码中处理
}

// 颜色输出函数
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

function log(message, color = 'white') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logBox(title) {
  console.log('');
  log(`🚀 ${title}`, 'cyan');
  log('==================================================', 'cyan');
}

// 确保数据库已初始化（仅开发环境使用）
function ensureDatabaseInitialized() {
  try {
    const backendDir = path.join(process.cwd(), 'backend');
    const backendEnvPath = path.join(backendDir, '.env');
    const envData = readEnvFile(backendEnvPath);
    const dbUrl = envData.DATABASE_URL || 'file:../data/fire_safety.db';

    // 仅处理 SQLite file: 协议
    if (!dbUrl.startsWith('file:')) {
      log('🗄️ 非 file: 协议数据库，跳过自动初始化', 'yellow');
      return;
    }

    const relativePath = dbUrl.replace('file:', ''); // ../data/fire_safety.db
    const dbFilePath = path.resolve(backendDir, 'prisma', relativePath); // -> backend/data/fire_safety.db

    const needForceSync = process.env.DEV_FORCE_DB_SYNC === 'true';
    const exists = fs.existsSync(dbFilePath);

    if (!exists) {
      log(`🗃️ 未发现数据库文件: ${dbFilePath}`, 'yellow');
      log('🔧 执行数据库初始化 (generate + push + seed)...', 'blue');
      execSync('npm run db:setup', { cwd: backendDir, stdio: 'inherit', env: process.env });
      log('✅ 数据库初始化完成', 'green');
    } else if (needForceSync) {
      log('🔄 DEV_FORCE_DB_SYNC=true，执行 schema 同步 (db push)...', 'yellow');
      execSync('npm run db:generate', { cwd: backendDir, stdio: 'inherit', env: process.env });
      execSync('npx prisma db push', { cwd: backendDir, stdio: 'inherit', env: process.env });
      log('✅ 数据库结构同步完成', 'green');
    } else {
      log('🗄️ 检测到数据库文件，跳过初始化 (设 DEV_FORCE_DB_SYNC=true 可强制同步)', 'green');
    }
  } catch (e) {
    log(`❌ 数据库初始化检查失败: ${e.message}`, 'red');
  }
}

// 获取当前局域网IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      // 跳过内部地址和IPv6地址
      if (!interface.internal && interface.family === 'IPv4') {
        // 检查是否为局域网IP
        if (interface.address.startsWith('192.168.') || 
            interface.address.startsWith('10.') || 
            /^172\.(1[6-9]|2[0-9]|3[01])\./.test(interface.address)) {
          return interface.address;
        }
      }
    }
  }
  return null;
}

// 检查命令是否存在
function commandExists(command) {
  try {
    execSync(`${process.platform === 'win32' ? 'where' : 'which'} ${command}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// 检查进程是否运行
function isProcessRunning(processName) {
  try {
    if (process.platform === 'win32') {
      execSync(`tasklist /fi "imagename eq ${processName}" | findstr "${processName}"`, { stdio: 'ignore' });
    } else {
      execSync(`pgrep -f "${processName}"`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

// 使用 Node.js selfsigned 包生成SSL证书
function generateSSLCertificateWithNode(currentIP) {
  log('🔐 正在使用 Node.js 生成SSL证书...', 'yellow');
  
  if (!selfsigned) {
    log('❌ selfsigned 包未安装，请运行: npm install', 'red');
    return false;
  }
  
  const certDir = path.join('frontend', 'certs');
  const keyFile = path.join(certDir, 'localhost-key.pem');
  const certFile = path.join(certDir, 'localhost.pem');
  
  // 创建证书目录
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }
  
  try {
    // 准备证书配置
    const attrs = [
      { name: 'countryName', value: 'CN' },
      { name: 'stateOrProvinceName', value: 'Beijing' },
      { name: 'localityName', value: 'Beijing' },
      { name: 'organizationName', value: 'FireSafety' },
      { name: 'organizationalUnitName', value: 'Development' },
      { name: 'commonName', value: 'localhost' }
    ];

    // 准备 SAN (Subject Alternative Names)
    const altNames = [
      { type: 2, value: 'localhost' },
      { type: 2, value: '*.localhost' },
      { type: 2, value: '*.local' },
      { type: 7, ip: '127.0.0.1' },
      { type: 7, ip: '::1' }
    ];

    // 添加当前IP
    if (currentIP) {
      altNames.push({ type: 7, ip: currentIP });
    }

    // 添加常见局域网IP
    const commonIPs = [
      '192.168.0.1', '192.168.1.1', '192.168.2.1', '192.168.10.1',
      '192.168.50.1', '192.168.100.1', '192.168.1.100', '192.168.0.100',
      '10.0.0.1', '10.0.1.1', '10.1.1.1', '172.16.0.1'
    ];
    
    commonIPs.forEach(ip => {
      altNames.push({ type: 7, ip: ip });
    });

    const options = {
      keySize: 2048,
      days: 365,
      algorithm: 'sha256',
      extensions: [
        {
          name: 'basicConstraints',
          cA: false
        },
        {
          name: 'keyUsage',
          keyCertSign: false,
          digitalSignature: true,
          nonRepudiation: true,
          keyEncipherment: true,
          dataEncipherment: false
        },
        {
          name: 'extKeyUsage',
          serverAuth: true,
          clientAuth: false,
          codeSigning: false,
          emailProtection: false,
          timeStamping: false
        },
        {
          name: 'subjectAltName',
          altNames: altNames
        }
      ]
    };

    // 生成证书
    const pems = selfsigned.generate(attrs, options);

    // 写入文件
    fs.writeFileSync(keyFile, pems.private);
    fs.writeFileSync(certFile, pems.cert);

    log('✅ SSL证书生成完成 (使用 Node.js)', 'green');
    return true;
  } catch (error) {
    log(`❌ SSL证书生成失败: ${error.message}`, 'red');
    return false;
  }
}

// 生成SSL证书
function generateSSLCertificate(currentIP) {
  log('🔐 正在生成SSL证书...', 'yellow');
  
  const certDir = path.join('frontend', 'certs');
  const configFile = path.join('frontend', 'ssl.conf');
  const keyFile = path.join(certDir, 'localhost-key.pem');
  const certFile = path.join(certDir, 'localhost.pem');
  
  // 创建证书目录
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }
  
  // 准备IP列表
  const ips = [];
  if (currentIP) {
    ips.push(currentIP);
  }
  
  // 添加常见局域网网段
  const commonIPs = [
    '192.168.0.1', '192.168.1.1', '192.168.2.1', '192.168.10.1', 
    '192.168.50.1', '192.168.100.1', '192.168.1.100', '192.168.0.100',
    '10.0.0.1', '10.0.1.1', '10.1.1.1', '172.16.0.1'
  ];
  
  ips.push(...commonIPs);
  
  // 生成IP配置
  let ipConfig = '';
  ips.forEach((ip, index) => {
    ipConfig += `IP.${index + 3} = ${ip}\n`;
  });
  
  // 生成SSL配置文件
  const sslConfig = `[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
C = CN
ST = Beijing
L = Beijing
O = FireSafety
OU = Development
CN = localhost

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = *.localhost
DNS.3 = *.local
IP.1 = 127.0.0.1
IP.2 = ::1
${ipConfig}`;
  
  fs.writeFileSync(configFile, sslConfig);
  
  try {
    // 生成私钥
    execSync(`openssl genrsa -out "${keyFile}" 2048`, { stdio: 'ignore' });
    
    // 生成证书
    execSync(`openssl req -new -x509 -key "${keyFile}" -out "${certFile}" -days 365 -config "${configFile}"`, { stdio: 'ignore' });
    
    log('✅ SSL证书生成完成', 'green');
    return true;
  } catch (error) {
    log(`❌ SSL证书生成失败: ${error.message}`, 'red');
    return false;
  }
}

// 智能证书管理
function manageSSLCertificate() {
  const currentIP = getLocalIP();
  const certFile = path.join('frontend', 'certs', 'localhost.pem');
  const keyFile = path.join('frontend', 'certs', 'localhost-key.pem');
  
  log(`🌐 当前局域网IP: ${currentIP || '未检测到'}`, 'blue');
  
  let needUpdate = false;
  
  // 检查证书文件是否存在
  if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
    log('📜 SSL证书不存在，需要生成', 'yellow');
    needUpdate = true;
  } else if (currentIP) {
    // 检查证书是否包含当前IP
    try {
      // 尝试使用 OpenSSL 检查证书，如果失败则假设需要更新
      if (commandExists('openssl')) {
        const certContent = execSync(`openssl x509 -in "${certFile}" -text -noout`, { encoding: 'utf8' });
        if (!certContent.includes(currentIP)) {
          log(`🔄 证书不包含当前IP ${currentIP}，需要更新`, 'yellow');
          needUpdate = true;
        } else {
          log('✅ SSL证书检查通过', 'green');
        }
      } else {
        // 没有 OpenSSL，简化检查逻辑
        const certContent = fs.readFileSync(certFile, 'utf8');
        // 简单检查证书是否过期（检查文件修改时间）
        const certStats = fs.statSync(certFile);
        const daysSinceCreated = (Date.now() - certStats.mtime.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceCreated > 30) {
          log('🔄 证书超过30天，建议更新', 'yellow');
          needUpdate = true;
        } else {
          log('✅ SSL证书检查通过', 'green');
        }
      }
    } catch (error) {
      log('⚠️ 证书检查失败，重新生成', 'yellow');
      needUpdate = true;
    }
  }
  
  if (needUpdate) {
    // 智能选择证书生成方法
    if (commandExists('openssl')) {
      log('📋 使用 OpenSSL 生成证书', 'blue');
      return generateSSLCertificate(currentIP);
    } else if (selfsigned) {
      log('📋 使用 Node.js 生成证书 (OpenSSL 不可用)', 'blue');
      return generateSSLCertificateWithNode(currentIP);
    } else {
      log('❌ 无法生成SSL证书:', 'red');
      log('   - Windows: 请安装 OpenSSL 或运行 "npm install" 安装依赖', 'yellow');
      log('   - 或者在 Git Bash 中运行此脚本', 'yellow');
      log('   - 或者使用 HTTP 模式访问 http://localhost:5173', 'yellow');
      return false;
    }
  }
  
  return true;
}

// 启动后端服务
function startBackend() {
  if (isProcessRunning('node.*app.js')) {
    log('✅ 后端服务器已在运行', 'green');
    return Promise.resolve();
  }
  
  log('🚀 启动后端服务器...', 'blue');
  
  return new Promise((resolve) => {
    const backend = spawn('npm', ['run', 'dev'], {
      cwd: path.join(process.cwd(), 'backend'),
      stdio: 'inherit',
      shell: true,
      env: { ...process.env, FORCE_HTTPS: 'true', ALWAYS_HTTPS: 'true' }
    });
    
    // 等待3秒让后端启动
    setTimeout(() => {
      log('✅ 后端服务器已启动', 'green');
      resolve();
    }, 3000);
  });
}

// 启动前端服务
function startFrontend() {
  log('🌐 启动前端HTTPS开发服务器...', 'blue');
  
  const frontend = spawn('npm', ['run', 'dev'], {
    cwd: path.join(process.cwd(), 'frontend'),
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, HTTPS: 'true', FORCE_HTTPS: 'true', ALWAYS_HTTPS: 'true' }
  });
  
  return frontend;
}

// 显示访问信息
function showAccessInfo() {
  const currentIP = getLocalIP();
  
  console.log('');
  log('✅ 开发环境启动完成！', 'green');
  log('==================================================', 'green');
  log('🔒 本机访问: https://localhost:5173', 'cyan');
  
  if (currentIP) {
    log(`📱 移动设备访问: https://${currentIP}:5173`, 'cyan');
  }
  
  console.log('');
  log('💡 提示:', 'yellow');
  log('   - 首次访问需要信任自签名证书', 'white');
  log('   - IP变化时重新运行此脚本即可', 'white');
  log('   - Ctrl+C 停止服务', 'white');
  console.log('');
}

// 主函数
async function main() {
  logBox('启动开发环境（支持HTTPS + 自动IP检测）');
  // 统一开发环境 .env（填充缺失 + 移除废弃）
  try {
    const backendEnvPath = path.join(process.cwd(), 'backend', '.env');
    const existing = readEnvFile(backendEnvPath);
    const merged = ensureDefaults(existing, { NODE_ENV: 'development' });
    writeEnvFile(backendEnvPath, merged);
    log('✅ 已同步 backend/.env (开发环境变量)', 'green');
  } catch (e) {
    log(`⚠️ 同步开发环境 .env 失败: ${e.message}`, 'yellow');
  }

  // 数据库存在性 / 初始化检查
  ensureDatabaseInitialized();
  
  // 检查证书生成能力
  const hasOpenSSL = commandExists('openssl');
  const hasSelfsigned = selfsigned !== null;
  
  if (!hasOpenSSL && !hasSelfsigned) {
    log('⚠️ 警告: 缺少SSL证书生成工具', 'yellow');
    log('   建议安装以下任一工具:', 'yellow');
    log('   1. OpenSSL - 通过 Git Bash 或 WSL 运行', 'yellow');
    log('   2. 运行 "npm install" 安装 selfsigned 包', 'yellow');
    log('', 'white');
    log('🔄 继续启动，如果证书生成失败将提供备选方案...', 'cyan');
  } else if (!hasOpenSSL && hasSelfsigned) {
    log('📋 将使用 Node.js selfsigned 包生成证书', 'blue');
  } else if (hasOpenSSL) {
    log('📋 将使用 OpenSSL 生成证书', 'blue');
  }
  
  // 智能证书管理
  if (!manageSSLCertificate()) {
    log('⚠️ SSL证书处理失败，将使用备选方案', 'yellow');
    log('💡 你可以:', 'cyan');
    log('   1. 安装依赖: npm install', 'white');
    log('   2. 在 Git Bash 中运行此脚本', 'white');
    log('   3. 手动启动前后端服务', 'white');
    process.exit(1);
  }
  
  try {
    // 启动后端
    await startBackend();
    
    // 启动前端
    const frontend = startFrontend();
    
    // 显示访问信息
    setTimeout(showAccessInfo, 2000);
    
    // 处理退出信号
    process.on('SIGINT', () => {
      log('\n🛑 正在停止服务...', 'yellow');
      frontend.kill();
      process.exit(0);
    });
    
    // 等待前端进程
    frontend.on('close', (code) => {
      log(`前端服务器已停止 (退出码: ${code})`, 'yellow');
      process.exit(code);
    });
    
  } catch (error) {
    log(`❌ 启动失败: ${error.message}`, 'red');
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main().catch(error => {
    log(`❌ 未知错误: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { main, getLocalIP, manageSSLCertificate };
