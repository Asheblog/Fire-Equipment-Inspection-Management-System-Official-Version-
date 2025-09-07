/**
 * 消防器材点检系统 - 主应用服务器
 * 集成完整的安全和认证模块
 */

const express = require('express');
const path = require('path');
const compression = require('compression');
const morgan = require('morgan');
require('dotenv').config();

// 运行期文件日志（生产环境启用）
const runtimeLogger = require('./src/utils/runtime.logger');
runtimeLogger.init();

// 安全模块导入
const SecurityConfig = require('./src/security/security-config');
const FileUploadSecurity = require('./src/security/file-upload');

// 路由导入
const apiRoutes = require('./src/routes/index');

// 创建Express应用
const app = express();
const PORT = process.env.PORT || 3001;

// 初始化安全配置
const securityConfig = new SecurityConfig();
const fileUpload = new FileUploadSecurity();

// ===== 基础中间件配置 =====

/**
 * 响应压缩
 * Phase1 调整：对 multipart/form-data（文件上传）请求跳过 compression，
 * 避免在生产环境中压缩中间件提前干预原始请求流导致 Multer 得到空文件。
 */
app.use((req, res, next) => {
  const ct = req.headers['content-type'] || '';
  if (ct.startsWith('multipart/form-data')) {
    // 跳过压缩
    return next();
  }
  return compression()(req, res, next);
});

// HTTP请求日志（写入文件 + 控制台）
app.use(morgan('combined', { stream: runtimeLogger.httpStream() }));

// 解析JSON请求体
app.use(express.json({ limit: '10mb' }));

// 解析URL编码请求体
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trace ID (请求跟踪) 中间件
app.use(require('./src/middleware/trace-id'));

// ===== 应用安全中间件 =====
securityConfig.applySecurityMiddleware(app);

// ===== 静态文件服务 =====

// 上传文件静态服务（需要认证）
app.use('/uploads', 
  securityConfig.getAuthMiddleware().authenticate,
  express.static(path.join(__dirname, 'uploads'))
);

// 前端静态文件服务 - 直接服务到根路径
app.use(express.static(path.join(__dirname, 'public')));

// ===== API路由配置 =====

// 主API路由 (包含认证、权限控制等完整功能)
app.use('/api', apiRoutes);

// 客户端日志上报接口 (生产环境使用)
app.post('/client-logs', (req, res) => {
  try {
    const tokenEnv = process.env.CLIENT_LOG_TOKEN;
    if (tokenEnv) {
      const provided = req.header('x-log-token');
      if (!provided || provided !== tokenEnv) {
        return res.status(401).json({ success: false, message: 'log token invalid' });
      }
    }

    const body = req.body || {};
    if (!body.logs || !Array.isArray(body.logs)) {
      return res.status(400).json({ success: false, message: 'logs array required' });
    }

    const MAX_BATCH = 100;
    const allowedLevels = new Set(['info', 'warn', 'error', 'debug', 'log']);
    let stored = 0;
    for (const entry of body.logs.slice(0, MAX_BATCH)) {
      if (!entry || typeof entry !== 'object') continue;
      const level = allowedLevels.has(entry.level) ? entry.level : 'info';
      let msg = entry.msg;
      if (typeof msg !== 'string') {
        msg = util.inspect(msg, { depth: 3 });
      }
      if (msg.length > 8000) msg = msg.slice(0, 8000) + ' [TRUNCATED]';
      runtimeLogger.writeClient(level, msg, { url: entry.url, extra: entry.ts });
      stored++;
    }
    return res.json({ success: true, stored });
  } catch (e) {
    console.error('客户端日志写入失败:', e);
    return res.status(500).json({ success: false, message: 'internal error' });
  }
});

// 系统状态路由 (独立于主API路由)
app.get('/status', (req, res) => {
  const uploadStats = fileUpload.getUploadStats();
  
  res.json({
    success: true,
    data: {
      server: {
        status: 'running',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: require('./package.json').version,
        environment: process.env.NODE_ENV || 'development'
      },
      upload: uploadStats,
      security: {
        authEnabled: true,
        rateLimitEnabled: true,
        auditLogEnabled: true
      }
    }
  });
});

// ===== 根路由和SPA回退 =====

// 系统API信息路由 (移动到特定路径)
app.get('/api-info', (req, res) => {
  res.json({
    name: '消防器材点检管理系统',
    version: '1.0.0',
    description: '企业级消防器材点检管理平台，提供完整的安全认证和权限控制',
    apis: {
      auth: '/api/auth',
      equipments: '/api/equipments',
      inspections: '/api/inspections', 
      issues: '/api/issues',
      users: '/api/users',
      factories: '/api/factories',
      reports: '/api/reports',
      upload: '/api/upload',
      health: '/api/health',
      status: '/status'
    },
    docs: {
      security: '/docs/security',
      api: '/docs/api'
    }
  });
});

// SPA回退路由 - 所有非API路径都返回React应用
app.get('*', (req, res) => {
  // 检查是否是API路径或状态路径，如果是则不处理（让其404）
  if (req.path.startsWith('/api') || req.path.startsWith('/status') || req.path.startsWith('/uploads')) {
    return res.status(404).json({ 
      success: false, 
      message: 'API endpoint not found',
      path: req.path 
    });
  }
  
  // 对于所有其他路径，返回React应用的index.html
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===== 应用错误处理中间件 =====
securityConfig.applyErrorHandlers(app);

// ===== 定时任务 =====

// 清理旧文件（每天凌晨2点执行）
if (process.env.NODE_ENV === 'production') {
  const cleanupInterval = 24 * 60 * 60 * 1000; // 24小时
  setInterval(() => {
    fileUpload.cleanupOldFiles(30); // 清理30天前的文件
    securityConfig.getAuditLogger().cleanupOldLogs(90); // 清理90天前的日志
  }, cleanupInterval);
}

// ===== 服务器启动 =====

// 优雅关闭处理
const gracefulShutdown = (signal) => {
  console.log(`\n收到 ${signal} 信号，开始优雅关闭...`);
  
  server.close(() => {
    console.log('HTTP服务器已关闭');
    
    // 关闭数据库连接等清理工作
    process.exit(0);
  });
  
  // 强制退出（10秒超时）
  setTimeout(() => {
    console.log('强制退出服务器');
    process.exit(1);
  }, 10000);
};

// 监听退出信号
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 监听未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  securityConfig.getAuditLogger().logSystemError(error, null, {
    type: 'uncaughtException'
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('未处理的Promise拒绝:', reason);
  securityConfig.getAuditLogger().logSystemError(new Error(reason), null, {
    type: 'unhandledRejection',
    promise: promise
  });
});

// 启动服务器
const server = app.listen(PORT, () => {
  console.log('\n🚀 消防器材点检管理系统启动成功');
  console.log(`📍 服务器地址: http://localhost:${PORT}`);
  console.log(`🔒 安全模块: 已启用`);
  console.log(`📊 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ 启动时间: ${new Date().toISOString()}`);
  
  // 二维码URL配置检查
  console.log('\n🔗 二维码配置检查:');
  try {
    const QRCodeGenerator = require('./src/utils/qrcode.generator');
    const urlValidation = QRCodeGenerator.validateURLConfig();
    
    console.log(`  ✅ 当前二维码URL: ${urlValidation.baseUrl}`);
    console.log(`  🌐 服务器局域网IP: ${urlValidation.serverIP}`);
    
    if (urlValidation.warnings.length > 0) {
      console.log('\n  ⚠️  配置警告:');
      urlValidation.warnings.forEach(warning => {
        console.log(`     - ${warning}`);
      });
    }
    
    if (urlValidation.suggestions.length > 0) {
      console.log('\n  💡 优化建议:');
      urlValidation.suggestions.forEach(suggestion => {
        console.log(`     - ${suggestion}`);
      });
    }
    
    // 显示示例二维码URL
    console.log(`\n  📱 二维码示例: ${urlValidation.baseUrl}/m/inspection/FIRE-001-01-EXAMPLE-ABCD`);
    
    if (!urlValidation.baseUrl.includes('localhost')) {
      console.log('  ✅ 手机扫码可以正常访问');
    } else {
      console.log('  ❌ 手机扫码无法访问（仅限本机）');
    }
    
  } catch (error) {
    console.log('  ❌ 二维码配置检查失败:', error.message);
  }
  
  console.log('\n📱 前端应用:');
  console.log(`  - React应用: http://localhost:${PORT}/`);
  console.log(`  - 支持前端路由，自动回退到SPA`);
  console.log('\n🔗 可用的API端点:');
  console.log(`  - 完整API文档: http://localhost:${PORT}/api`);
  console.log(`  - 系统API信息: http://localhost:${PORT}/api-info`);
  console.log(`  - 认证: http://localhost:${PORT}/api/auth`);
  console.log(`  - 器材管理: http://localhost:${PORT}/api/equipments`);
  console.log(`  - 点检管理: http://localhost:${PORT}/api/inspections`);
  console.log(`  - 隐患管理: http://localhost:${PORT}/api/issues`);
  console.log(`  - 用户管理: http://localhost:${PORT}/api/users`);
  console.log(`  - 报表看板: http://localhost:${PORT}/api/reports`);
  console.log(`  - 健康检查: http://localhost:${PORT}/api/health`);
  console.log(`  - 系统状态: http://localhost:${PORT}/status`);
  console.log('\n🔐 安全功能:');
  console.log('  ✅ JWT认证系统');
  console.log('  ✅ RBAC权限控制');
  console.log('  ✅ 速率限制保护');
  console.log('  ✅ 输入验证过滤');
  console.log('  ✅ 文件上传安全');
  console.log('  ✅ 审计日志记录');
  console.log('  ✅ 安全头配置');
  console.log('  ✅ CORS跨域保护');
  console.log('\n📂 静态文件服务:');
  console.log('  ✅ 前端React应用 (根路径)');
  console.log('  ✅ SPA路由回退支持');
  console.log('  ✅ 上传文件服务 (/uploads - 需认证)');
  console.log('\n系统就绪，等待请求...\n');
});

module.exports = app;
