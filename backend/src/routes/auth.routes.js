const express = require('express');
const AuthService = require('../auth/auth.service');
const AuthMiddleware = require('../middleware/auth.middleware');
const RateLimiter = require('../security/rate-limiter');
const InputValidator = require('../security/input-validator');
const AuditLogger = require('../security/audit-logger');

/**
 * 消防器材点检系统 - 认证路由
 * 
 * 提供完整的用户认证API：
 * - 用户登录/登出
 * - Token刷新
 * - 密码修改
 * - 用户信息获取
 */

const router = express.Router();

// 初始化服务和中间件
const authService = new AuthService();
const authMiddleware = new AuthMiddleware();
const rateLimiter = new RateLimiter();
const inputValidator = new InputValidator();
const auditLogger = new AuditLogger();

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post('/login',
  rateLimiter.getAuthLimiter(), // 登录速率限制
  inputValidator.validateAndSanitize('loginSchema'), // 输入验证和XSS防护
  auditLogger.createAuditMiddleware('login', 'user'), // 审计日志
  async (req, res) => {
    try {
      const { username, password } = req.validatedBody;
      // 读取可选 rememberMe 标记（未纳入严格校验，保持向后兼容）
      const rememberMe = !!req.body.rememberMe;
      
      console.log(`登录尝试 - 用户名: ${username}, IP: ${req.ip}`);
      
      const result = await authService.login(username, password, { rememberMe });
      
      // 记录成功登录
      await auditLogger.logUserAction(req, 'login', 'user', {
        username,
        factoryId: result.user.factoryId,
        factoryName: result.factory?.name
      });
      
      res.json({
        success: true,
        message: '登录成功',
        data: {
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          expiresIn: result.expiresIn,
            // 回显是否记住我，便于前端调试
          rememberMe,
          user: {
            id: result.user.id,
            username: result.user.username,
            fullName: result.user.fullName,
            role: result.user.role,
            factoryId: result.user.factoryId
          },
          factory: result.factory
        }
      });
    } catch (error) {
      console.error('登录失败:', error);
      
      // 记录登录失败的安全事件
      await auditLogger.logSecurityEvent('login_failed', {
        username: req.validatedBody?.username,
        reason: error.message,
        ip: req.ip
      }, req);
      
      res.status(401).json({
        error: 'LOGIN_FAILED',
        message: error.message || '登录失败'
      });
    }
  }
);

/**
 * POST /api/auth/refresh
 * 刷新访问令牌
 */
router.post('/refresh',
  rateLimiter.getApiLimiter(), // 通用API限制
  inputValidator.validate('refreshTokenSchema'), // Token验证
  async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({
          error: 'MISSING_REFRESH_TOKEN',
          message: '缺少刷新令牌'
        });
      }
      
      const result = await authService.refreshAccessToken(refreshToken);
      
      await auditLogger.logUserAction(req, 'token_refresh', 'user', {
        success: true
      });
      
      res.json({
        success: true,
        message: 'Token刷新成功',
        data: {
          accessToken: result.accessToken,
          expiresIn: result.expiresIn
        }
      });
    } catch (error) {
      console.error('Token刷新失败:', error);
      
      await auditLogger.logSecurityEvent('token_refresh_failed', {
        reason: error.message,
        ip: req.ip
      }, req);
      
      res.status(401).json({
        error: 'REFRESH_FAILED',
        message: error.message || 'Token刷新失败'
      });
    }
  }
);

/**
 * POST /api/auth/logout
 * 用户登出
 */
router.post('/logout',
  authMiddleware.optionalAuth, // 可选认证
  async (req, res) => {
    try {
      const { refreshToken } = req.body;
      
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
      
      await auditLogger.logUserAction(req, 'logout', 'user', {
        userId: req.user?.id,
        username: req.user?.username
      });
      
      res.json({
        success: true,
        message: '登出成功'
      });
    } catch (error) {
      console.error('登出失败:', error);
      
      res.status(500).json({
        error: 'LOGOUT_FAILED',
        message: '登出失败'
      });
    }
  }
);

/**
 * POST /api/auth/change-password
 * 修改密码
 */
router.post('/change-password',
  authMiddleware.authenticate, // 必须认证
  rateLimiter.getPasswordResetLimiter(), // 密码重置限制
  inputValidator.validateAndSanitize('changePasswordSchema'),
  async (req, res) => {
    try {
      const { oldPassword, newPassword } = req.validatedBody;
      const userId = req.user.id;
      
      const result = await authService.changePassword(userId, oldPassword, newPassword);
      
      await auditLogger.logUserAction(req, 'password_change', 'user', {
        userId,
        success: true
      });
      
      res.json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('密码修改失败:', error);
      
      await auditLogger.logUserAction(req, 'password_change', 'user', {
        userId: req.user?.id,
        success: false,
        reason: error.message
      });
      
      res.status(400).json({
        error: 'PASSWORD_CHANGE_FAILED',
        message: error.message || '密码修改失败'
      });
    }
  }
);

/**
 * GET /api/auth/profile
 * 获取用户信息
 */
router.get('/profile',
  authMiddleware.authenticate,
  async (req, res) => {
    try {
      const user = req.user;
      
      res.json({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          factoryId: user.factoryId,
          factory: user.factory,
          permissions: user.permissions
        }
      });
    } catch (error) {
      console.error('获取用户信息失败:', error);
      
      res.status(500).json({
        error: 'PROFILE_FETCH_FAILED',
        message: '获取用户信息失败'
      });
    }
  }
);

/**
 * POST /api/auth/register
 * 用户注册（仅限超级管理员和厂区管理员）
 */
router.post('/register',
  authMiddleware.requireAuth('user:create'),
  rateLimiter.getSensitiveOpLimiter(),
  inputValidator.validateAndSanitize('registerSchema'),
  async (req, res) => {
    try {
      const userData = req.validatedBody;
      const currentUser = req.user;
      
      // 权限检查：只能创建同级或下级用户
      if (currentUser.role === 'FACTORY_ADMIN') {
        // 厂区管理员只能创建本厂区的点检员
        if (userData.role !== 'INSPECTOR' || userData.factoryId !== currentUser.factoryId) {
          return res.status(403).json({
            error: 'INSUFFICIENT_PERMISSION',
            message: '厂区管理员只能创建本厂区的点检员账户'
          });
        }
      }
      
      const result = await authService.createUser(userData);
      
      await auditLogger.logUserAction(req, 'create', 'user', {
        newUserId: result.user.id,
        newUsername: result.user.username,
        newUserRole: result.user.role,
        newUserFactoryId: result.user.factoryId
      });
      
      res.status(201).json({
        success: true,
        message: result.message,
        data: {
          user: result.user
        }
      });
    } catch (error) {
      console.error('用户注册失败:', error);
      
      await auditLogger.logUserAction(req, 'create', 'user', {
        success: false,
        reason: error.message,
        attemptedData: {
          username: req.validatedBody?.username,
          role: req.validatedBody?.role,
          factoryId: req.validatedBody?.factoryId
        }
      });
      
      res.status(400).json({
        error: 'REGISTRATION_FAILED',
        message: error.message || '用户注册失败'
      });
    }
  }
);

/**
 * GET /api/auth/verify
 * 验证Token有效性
 */
router.get('/verify',
  authMiddleware.authenticate,
  async (req, res) => {
    try {
      const user = req.user;
      
      res.json({
        success: true,
        message: 'Token有效',
        data: {
          valid: true,
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            factoryId: user.factoryId
          }
        }
      });
    } catch (error) {
      console.error('Token验证失败:', error);
      
      res.status(401).json({
        error: 'TOKEN_INVALID',
        message: 'Token无效或已过期'
      });
    }
  }
);

/**
 * GET /api/auth/permissions
 * 获取用户权限列表
 */
router.get('/permissions',
  authMiddleware.authenticate,
  async (req, res) => {
    try {
      const user = req.user;
      
      res.json({
        success: true,
        data: {
          userId: user.id,
          role: user.role,
          permissions: user.permissions,
          factoryId: user.factoryId
        }
      });
    } catch (error) {
      console.error('获取权限失败:', error);
      
      res.status(500).json({
        error: 'PERMISSIONS_FETCH_FAILED',
        message: '获取权限信息失败'
      });
    }
  }
);

// 添加刷新令牌验证的简单schema
inputValidator.refreshTokenSchema = require('joi').object({
  refreshToken: require('joi').string().required().messages({
    'any.required': '刷新令牌是必填项'
  })
});

module.exports = router;
