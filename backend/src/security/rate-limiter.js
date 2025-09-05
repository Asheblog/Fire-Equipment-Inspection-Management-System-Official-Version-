const rateLimit = require('express-rate-limit');

/**
 * 消防器材点检系统 - 速率限制配置
 * 
 * 提供多级速率限制保护：
 * - API接口通用限制
 * - 登录接口专用限制  
 * - 文件上传限制
 * - 密码重置限制
 */

class RateLimiter {
  constructor() {
    this.setupLimiters();
  }

  /**
   * 初始化各种速率限制器
   */
  setupLimiters() {
    // 根据环境设置不同的限制
    const isDevelopment = process.env.NODE_ENV === 'development';
    const windowMs = isDevelopment ? 1 * 60 * 1000 : parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 开发环境1分钟，生产环境15分钟
    const maxRequests = isDevelopment ? 1000 : parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100; // 开发环境1000次，生产环境100次

    // 通用API速率限制
    this.apiLimiter = rateLimit({
      windowMs: windowMs,
      limit: maxRequests,
      standardHeaders: 'draft-8', // 使用标准的RateLimit头
      legacyHeaders: false, // 禁用旧的X-RateLimit-*头
      message: {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'API调用过于频繁，请稍后再试',
        retryAfter: isDevelopment ? '1分钟' : '15分钟'
      },
      keyGenerator: (req) => {
        // 使用IP地址作为限制键，处理代理情况
        return req.ip || req.connection.remoteAddress;
      },
      skip: (req) => {
        // 开发环境跳过限流，或者跳过健康检查等无需限制的路径
        if (isDevelopment && req.path.startsWith('/api/')) {
          return false; // 开发环境仍然应用限流，但限制更宽松
        }
        const skipPaths = ['/health', '/api/health', '/ping'];
        return skipPaths.includes(req.path);
      },
      handler: (req, res) => {
        console.warn(`API速率限制触发 - IP: ${req.ip}, Path: ${req.path}, Time: ${new Date().toISOString()}`);
        res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'API调用过于频繁，请稍后再试',
          retryAfter: Math.round(req.rateLimit.resetTime.getTime() / 1000)
        });
      }
    });

    // 登录接口速率限制（更严格）
    this.authLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15分钟
      limit: 5, // 最多5次登录尝试
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: 'AUTH_RATE_LIMIT_EXCEEDED',
        message: '登录尝试过于频繁，请15分钟后再试'
      },
      keyGenerator: (req) => {
        // 结合IP和用户名进行限制
        const ip = req.ip || req.connection.remoteAddress;
        const username = req.body?.username || 'unknown';
        return `auth_${ip}_${username}`;
      },
      skipSuccessfulRequests: true, // 成功的请求不计入限制
      handler: (req, res) => {
        console.warn(`登录速率限制触发 - IP: ${req.ip}, Username: ${req.body?.username}, Time: ${new Date().toISOString()}`);
        res.status(429).json({
          error: 'AUTH_RATE_LIMIT_EXCEEDED',
          message: '登录尝试过于频繁，请15分钟后再试',
          retryAfter: Math.round(req.rateLimit.resetTime.getTime() / 1000),
          remainingAttempts: req.rateLimit.remaining
        });
      }
    });

    // 文件上传速率限制
    this.uploadLimiter = rateLimit({
      windowMs: 1 * 60 * 1000, // 1分钟
      limit: 10, // 最多10次上传
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: 'UPLOAD_RATE_LIMIT_EXCEEDED',
        message: '文件上传过于频繁，请稍后再试'
      },
      keyGenerator: (req) => {
        // 使用用户ID和IP的组合
        const userId = req.user?.id || 'anonymous';
        const ip = req.ip || req.connection.remoteAddress;
        return `upload_${userId}_${ip}`;
      },
      handler: (req, res) => {
        console.warn(`上传速率限制触发 - User: ${req.user?.id}, IP: ${req.ip}, Time: ${new Date().toISOString()}`);
        res.status(429).json({
          error: 'UPLOAD_RATE_LIMIT_EXCEEDED',
          message: '文件上传过于频繁，请稍后再试',
          retryAfter: Math.round(req.rateLimit.resetTime.getTime() / 1000)
        });
      }
    });

    // 密码重置速率限制
    this.passwordResetLimiter = rateLimit({
      windowMs: 60 * 60 * 1000, // 1小时
      limit: 3, // 最多3次密码重置尝试
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
        message: '密码重置尝试过于频繁，请1小时后再试'
      },
      keyGenerator: (req) => {
        const ip = req.ip || req.connection.remoteAddress;
        const username = req.body?.username || 'unknown';
        return `password_reset_${ip}_${username}`;
      },
      handler: (req, res) => {
        console.warn(`密码重置速率限制触发 - IP: ${req.ip}, Username: ${req.body?.username}, Time: ${new Date().toISOString()}`);
        res.status(429).json({
          error: 'PASSWORD_RESET_RATE_LIMIT_EXCEEDED',
          message: '密码重置尝试过于频繁，请1小时后再试',
          retryAfter: Math.round(req.rateLimit.resetTime.getTime() / 1000)
        });
      }
    });

    // 敏感操作速率限制（如删除、修改重要数据）
    this.sensitiveOpLimiter = rateLimit({
      windowMs: 5 * 60 * 1000, // 5分钟
      limit: 20, // 最多20次敏感操作
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: 'SENSITIVE_OP_RATE_LIMIT_EXCEEDED',
        message: '敏感操作过于频繁，请稍后再试'
      },
      keyGenerator: (req) => {
        const userId = req.user?.id || 'anonymous';
        const ip = req.ip || req.connection.remoteAddress;
        return `sensitive_${userId}_${ip}`;
      },
      handler: (req, res) => {
        console.warn(`敏感操作速率限制触发 - User: ${req.user?.id}, IP: ${req.ip}, Path: ${req.path}, Time: ${new Date().toISOString()}`);
        res.status(429).json({
          error: 'SENSITIVE_OP_RATE_LIMIT_EXCEEDED',
          message: '敏感操作过于频繁，请稍后再试',
          retryAfter: Math.round(req.rateLimit.resetTime.getTime() / 1000)
        });
      }
    });

    // 报表查询速率限制（防止大量查询影响性能）
    this.reportLimiter = rateLimit({
      windowMs: 1 * 60 * 1000, // 1分钟
      limit: 5, // 最多5次报表查询
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: {
        error: 'REPORT_RATE_LIMIT_EXCEEDED',
        message: '报表查询过于频繁，请稍后再试'
      },
      keyGenerator: (req) => {
        const userId = req.user?.id || 'anonymous';
        return `report_${userId}`;
      },
      handler: (req, res) => {
        console.warn(`报表查询速率限制触发 - User: ${req.user?.id}, IP: ${req.ip}, Time: ${new Date().toISOString()}`);
        res.status(429).json({
          error: 'REPORT_RATE_LIMIT_EXCEEDED',
          message: '报表查询过于频繁，请稍后再试',
          retryAfter: Math.round(req.rateLimit.resetTime.getTime() / 1000)
        });
      }
    });
  }

  /**
   * 获取API通用限制器
   * @returns {Function} Express中间件
   */
  getApiLimiter() {
    return this.apiLimiter;
  }

  /**
   * 获取认证限制器
   * @returns {Function} Express中间件
   */
  getAuthLimiter() {
    return this.authLimiter;
  }

  /**
   * 获取上传限制器
   * @returns {Function} Express中间件
   */
  getUploadLimiter() {
    return this.uploadLimiter;
  }

  /**
   * 获取密码重置限制器
   * @returns {Function} Express中间件
   */
  getPasswordResetLimiter() {
    return this.passwordResetLimiter;
  }

  /**
   * 获取敏感操作限制器
   * @returns {Function} Express中间件
   */
  getSensitiveOpLimiter() {
    return this.sensitiveOpLimiter;
  }

  /**
   * 获取报表查询限制器
   * @returns {Function} Express中间件
   */
  getReportLimiter() {
    return this.reportLimiter;
  }

  /**
   * 创建自定义限制器
   * @param {Object} options - 限制器选项
   * @returns {Function} Express中间件
   */
  createCustomLimiter(options) {
    const defaultOptions = {
      windowMs: 15 * 60 * 1000,
      limit: 100,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      keyGenerator: (req) => req.ip || req.connection.remoteAddress
    };

    return rateLimit({
      ...defaultOptions,
      ...options
    });
  }

  /**
   * 基于用户角色的动态限制器
   * @param {Object} roleLimits - 角色限制配置
   * @returns {Function} Express中间件
   */
  createRoleBasedLimiter(roleLimits) {
    return rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: async (req) => {
        const userRole = req.user?.role || 'GUEST';
        return roleLimits[userRole] || roleLimits.DEFAULT || 100;
      },
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      keyGenerator: (req) => {
        const userId = req.user?.id || 'anonymous';
        const ip = req.ip || req.connection.remoteAddress;
        return `role_based_${userId}_${ip}`;
      },
      message: {
        error: 'ROLE_RATE_LIMIT_EXCEEDED',
        message: '基于角色的速率限制超出'
      }
    });
  }

  /**
   * 组合多个限制器
   * @param {Array<Function>} limiters - 限制器数组
   * @returns {Function} Express中间件
   */
  combineLimiters(limiters) {
    return (req, res, next) => {
      let index = 0;
      
      const runNext = (err) => {
        if (err) return next(err);
        
        if (index >= limiters.length) {
          return next();
        }
        
        const limiter = limiters[index++];
        limiter(req, res, runNext);
      };
      
      runNext();
    };
  }

  /**
   * 为特定路径配置限制器
   * @param {string} path - 路径模式
   * @param {Function} limiter - 限制器
   * @returns {Function} Express中间件
   */
  forPath(path, limiter) {
    return (req, res, next) => {
      if (req.path.match(path)) {
        return limiter(req, res, next);
      }
      next();
    };
  }

  /**
   * 条件性应用限制器
   * @param {Function} condition - 条件判断函数
   * @param {Function} limiter - 限制器
   * @returns {Function} Express中间件
   */
  conditionalLimiter(condition, limiter) {
    return (req, res, next) => {
      if (condition(req)) {
        return limiter(req, res, next);
      }
      next();
    };
  }
}

module.exports = RateLimiter;