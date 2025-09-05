const helmet = require('helmet');
const cors = require('cors');
const os = require('os');
const AuthMiddleware = require('../middleware/auth.middleware');
const RateLimiter = require('../security/rate-limiter');
const InputValidator = require('../security/input-validator');
const AuditLogger = require('../security/audit-logger');

/**
 * 消防器材点检系统 - 安全中间件配置
 * 
 * 集成和配置所有安全相关的中间件：
 * - HTTP安全头设置
 * - CORS跨域配置
 * - 速率限制
 * - 认证授权
 * - 输入验证
 * - 审计日志
 */

class SecurityConfig {
  constructor() {
    this.authMiddleware = new AuthMiddleware();
    this.rateLimiter = new RateLimiter();
    this.inputValidator = new InputValidator();
    this.auditLogger = new AuditLogger();
  }

  /**
   * 检测是否为局域网IP
   * @param {string} origin - 请求来源
   * @returns {boolean} 是否为局域网IP
   */
  isLocalNetworkIP(origin) {
    try {
      const url = new URL(origin);
      const hostname = url.hostname;
      
      // 检查是否为IP地址格式
      const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
      const match = hostname.match(ipPattern);
      
      if (!match) return false;
      
      const [, a, b, c, d] = match.map(Number);
      
      // 检查是否为有效IP范围
      if (a > 255 || b > 255 || c > 255 || d > 255) return false;
      
      // 局域网IP范围:
      // 192.168.0.0/16
      if (a === 192 && b === 168) return true;
      
      // 10.0.0.0/8  
      if (a === 10) return true;
      
      // 172.16.0.0/12 (172.16.0.0 - 172.31.255.255)
      if (a === 172 && b >= 16 && b <= 31) return true;
      
      // 127.0.0.0/8 (localhost)
      if (a === 127) return true;
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取本机局域网IP地址
   * @returns {Array<string>} IP地址列表
   */
  getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    
    for (const interfaceName of Object.keys(interfaces)) {
      for (const iface of interfaces[interfaceName]) {
        // 跳过回环地址和非IPv4地址
        if (iface.family === 'IPv4' && !iface.internal) {
          ips.push(iface.address);
        }
      }
    }
    
    return ips;
  }

  /**
   * 配置安全头
   * @returns {Function} Helmet中间件
   */
  setupSecurityHeaders() {
    return helmet({
      // 内容安全策略
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:", "blob:"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          connectSrc: ["'self'"],
          mediaSrc: ["'self'"],
          objectSrc: ["'none'"],
          childSrc: ["'self'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: []
        }
      },
      
      // HTTP严格传输安全
      hsts: {
        maxAge: 31536000, // 1年
        includeSubDomains: true,
        preload: true
      },
      
      // 阻止MIME类型嗅探
      noSniff: true,
      
      // X-Frame-Options 防止点击劫持
      frameguard: {
        action: 'deny'
      },
      
      // X-XSS-Protection
      xssFilter: true,
      
      // 引用者策略
      referrerPolicy: {
        policy: 'strict-origin-when-cross-origin'
      },
      
      // 权限策略
      permittedCrossDomainPolicies: false,
      
      // 隐藏X-Powered-By头
      hidePoweredBy: true,
      
      // 不缓存敏感页面
      nocache: false, // 让静态资源可以缓存
      
      // 期望证书透明度
      expectCt: {
        maxAge: 86400,
        enforce: true
      }
    });
  }

  /**
   * 配置CORS跨域
   * @returns {Function} CORS中间件
   */
  setupCORS() {
    // 从环境变量获取允许的来源列表
    const corsOrigin = process.env.CORS_ORIGIN || '';
    const allowedOrigins = corsOrigin.split(',').map(origin => origin.trim()).filter(Boolean);
    
    // 局域网访问控制
    const allowLocalNetwork = process.env.CORS_ALLOW_LOCAL_NETWORK === 'true';
    
    // 开发环境默认配置
    const defaultDevOrigins = [
      'http://localhost:3000',
      'http://localhost:3001', 
      'http://localhost:5173'
    ];
    
    // 如果没有配置CORS_ORIGIN，使用默认开发配置
    if (allowedOrigins.length === 0) {
      allowedOrigins.push(...defaultDevOrigins);
      console.warn('⚠️  未配置CORS_ORIGIN环境变量，使用默认开发配置');
    }

    // 获取本机IP地址用于显示
    const localIPs = this.getLocalIPs();
    const port = process.env.PORT || 3001;

    // 启动时显示CORS配置
    console.log('🔐 CORS配置:');
    console.log(`   - 环境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   - 允许的来源: ${allowedOrigins.join(', ')}`);
    console.log(`   - 局域网访问: ${allowLocalNetwork ? '启用' : '禁用'}`);
    
    if (allowLocalNetwork && localIPs.length > 0) {
      console.log('🌐 可访问的URL:');
      console.log(`   - http://localhost:${port}`);
      localIPs.forEach(ip => {
        console.log(`   - http://${ip}:${port}`);
      });
      console.log('⚠️  局域网访问已启用，请注意安全风险');
    }

    return cors({
      origin: (origin, callback) => {
        // 允许同源请求（没有origin的请求，如移动应用或Postman）
        if (!origin) {
          console.log('✅ CORS: 允许无origin请求 (如移动应用/API工具)');
          return callback(null, true);
        }
        
        // 开发环境：允许localhost的任意端口
        if (process.env.NODE_ENV === 'development') {
          if (origin.startsWith('http://localhost:') || origin.startsWith('https://localhost:')) {
            console.log(`✅ CORS: 开发环境允许localhost请求 - ${origin}`);
            return callback(null, true);
          }
          
          // 开发环境 + 启用局域网访问：检查局域网IP
          if (allowLocalNetwork && this.isLocalNetworkIP(origin)) {
            console.log(`✅ CORS: 开发环境允许局域网请求 - ${origin}`);
            return callback(null, true);
          }
        }
        
        // 检查配置的允许列表
        if (allowedOrigins.includes(origin)) {
          console.log(`✅ CORS: 允许配置的来源 - ${origin}`);
          callback(null, true);
        } else {
          console.warn(`❌ CORS阻止的请求源: ${origin}`);
          console.warn(`   允许的来源列表: ${allowedOrigins.join(', ')}`);
          if (process.env.NODE_ENV === 'development' && !allowLocalNetwork) {
            console.warn(`   💡 提示: 可设置 CORS_ALLOW_LOCAL_NETWORK=true 启用局域网访问`);
          }
          callback(new Error('CORS policy violation'), false);
        }
      },
      
      credentials: true, // 允许发送Cookie
      
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      
      allowedHeaders: [
        'Origin',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Authorization',
        'X-Request-ID'
      ],
      
      exposedHeaders: [
        'X-Total-Count',
        'X-Page-Count',
        'RateLimit-Remaining',
        'RateLimit-Reset'
      ],
      
      maxAge: 86400 // 预检请求缓存24小时
    });
  }

  /**
   * 设置信任代理
   * @param {Object} app - Express应用实例
   */
  setupTrustProxy(app) {
    // 配置信任代理，用于正确获取客户端IP
    // 在生产环境中，需要根据实际的代理层数调整
    app.set('trust proxy', 1);
    
    // 在开发环境中可能需要不同的配置
    if (process.env.NODE_ENV === 'development') {
      app.set('trust proxy', true);
    }
  }

  /**
   * 请求ID中间件
   * 为每个请求生成唯一ID，便于追踪
   */
  requestIdMiddleware = (req, res, next) => {
    req.id = req.get('X-Request-ID') || this.generateRequestId();
    res.set('X-Request-ID', req.id);
    next();
  };

  /**
   * 请求日志中间件
   */
  requestLogger = (req, res, next) => {
    const startTime = Date.now();
    
    // 记录请求开始
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - IP: ${req.ip} - ID: ${req.id}`);
    
    // 监听响应完成
    res.on('finish', () => {
      const duration = Date.now() - startTime;
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms - IP: ${req.ip} - ID: ${req.id}`);
    });
    
    next();
  };

  /**
   * 错误处理中间件
   */
  errorHandler = (error, req, res, next) => {
    // 记录错误日志
    this.auditLogger.logSystemError(error, req, {
      requestId: req.id,
      body: req.body,
      query: req.query,
      params: req.params
    });

    // 不向客户端泄露详细错误信息
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: '服务器内部错误',
        requestId: req.id
      });
    }

    // 开发环境返回详细错误
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: error.message,
      stack: error.stack,
      requestId: req.id
    });
  };

  /**
   * 404处理中间件
   */
  notFoundHandler = (req, res) => {
    this.auditLogger.logUserAction(req, 'not_found', 'system', {
      requestedUrl: req.originalUrl,
      method: req.method
    });

    res.status(404).json({
      error: 'NOT_FOUND',
      message: '请求的资源不存在',
      path: req.originalUrl,
      requestId: req.id
    });
  };

  /**
   * API版本检查中间件
   */
  apiVersionCheck = (req, res, next) => {
    const apiVersion = req.get('API-Version') || '1.0';
    const supportedVersions = ['1.0'];
    
    if (!supportedVersions.includes(apiVersion)) {
      return res.status(400).json({
        error: 'UNSUPPORTED_API_VERSION',
        message: `不支持的API版本: ${apiVersion}`,
        supportedVersions
      });
    }
    
    req.apiVersion = apiVersion;
    next();
  };

  /**
   * 健康检查中间件
   */
  healthCheck = (req, res) => {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    };

    res.json(health);
  };

  /**
   * 安全响应头中间件
   */
  securityHeaders = (req, res, next) => {
    // 防止缓存敏感数据
    if (req.originalUrl.includes('/api/auth') || req.originalUrl.includes('/api/admin')) {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.set('Pragma', 'no-cache');
      res.set('Expires', '0');
    }
    
    // 添加自定义安全头
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('X-Download-Options', 'noopen');
    res.set('X-Permitted-Cross-Domain-Policies', 'none');
    
    next();
  };

  /**
   * 生成请求ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 应用所有安全中间件
   * @param {Object} app - Express应用实例
   */
  applySecurityMiddleware(app) {
    // 信任代理设置
    this.setupTrustProxy(app);
    
    // 安全头
    app.use(this.setupSecurityHeaders());
    
    // CORS
    app.use(this.setupCORS());
    
    // 请求ID
    app.use(this.requestIdMiddleware);
    
    // 请求日志
    app.use(this.requestLogger);
    
    // API版本检查
    app.use('/api', this.apiVersionCheck);
    
    // 安全响应头
    app.use(this.securityHeaders);
    
    // 通用速率限制
    app.use('/api', this.rateLimiter.getApiLimiter());
    
    // 输入验证（SQL注入和XSS防护）
    app.use('/api', this.inputValidator.preventSqlInjection());
    app.use('/api', this.inputValidator.preventXss());

    // 健康检查路由（无需认证）
    app.get('/health', this.healthCheck);
    app.get('/api/health', this.healthCheck);
    
    console.log('✅ 安全中间件配置完成');
  }

  /**
   * 应用错误处理中间件（必须在路由之后）
   * @param {Object} app - Express应用实例
   */
  applyErrorHandlers(app) {
    // 404处理
    app.use(this.notFoundHandler);
    
    // 错误处理
    app.use(this.errorHandler);
    
    console.log('✅ 错误处理中间件配置完成');
  }

  /**
   * 获取认证中间件实例
   */
  getAuthMiddleware() {
    return this.authMiddleware;
  }

  /**
   * 获取速率限制器实例
   */
  getRateLimiter() {
    return this.rateLimiter;
  }

  /**
   * 获取输入验证器实例
   */
  getInputValidator() {
    return this.inputValidator;
  }

  /**
   * 获取审计日志器实例
   */
  getAuditLogger() {
    return this.auditLogger;
  }
}

module.exports = SecurityConfig;