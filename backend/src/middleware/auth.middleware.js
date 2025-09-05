const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const TokenBlacklistService = require('../services/token-blacklist.service');

/**
 * 消防器材点检系统 - 认证中间件
 * 
 * 提供完整的JWT认证和RBAC权限控制中间件
 * 支持细粒度的权限检查和数据权限隔离
 */

class AuthMiddleware {
  constructor() {
    this.prisma = new PrismaClient();
    this.jwtSecret = process.env.JWT_SECRET || 'fire-safety-jwt-secret-2024';
    
    // 数据权限范围配置
    this.DATA_SCOPE = {
      INSPECTOR: {
        factory: 'own',          // 只能访问所属厂区
        user: 'self',            // 只能访问自己的数据
        equipment: 'factory',    // 厂区内器材
        inspection: 'own'        // 自己的点检记录
      },
      
      FACTORY_ADMIN: {
        factory: 'own',          // 管理所属厂区
        user: 'factory',         // 厂区内用户
        equipment: 'factory',    // 厂区内器材
        inspection: 'factory',   // 厂区内点检记录
        issue: 'factory'         // 厂区内隐患
      },
      
      SUPER_ADMIN: {
        factory: 'all',          // 所有厂区
        user: 'all',             // 所有用户
        equipment: 'all',        // 所有器材
        inspection: 'all',       // 所有记录
        issue: 'all'             // 所有隐患
      }
    };

    // 角色权限配置
    this.ROLE_PERMISSIONS = {
      INSPECTOR: [
        'equipment:read',        
        'inspection:create',     
        'inspection:read:own',   
        'issue:create',          
        'profile:read:own'       
      ],
      
      FACTORY_ADMIN: [
        'equipment:*',           
        'inspection:read',       
        'issue:read',            
        'issue:handle',          
        'user:read',             
        'user:create',           
        'report:read:factory',   
        'dashboard:factory'      
      ],
      
      SUPER_ADMIN: [
        '*:*'                   
      ]
    };
  }

  /**
   * 主要认证中间件
   * 验证JWT Token并设置用户信息
   */
  authenticate = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return this.sendAuthError(res, 'UNAUTHORIZED', '缺少认证令牌', 401);
      }

      const token = authHeader.substring(7);
      console.log('=== JWT认证调试 ===');
      console.log('请求路径:', req.method, req.path);
      console.log('Token长度:', token.length);
      console.log('Token前50字符:', token.substring(0, 50));
      console.log('JWT Secret长度:', this.jwtSecret.length);
      
      // JWT Token验证
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'fire-safety-system',
        audience: 'fire-safety-client'
      });

      console.log('JWT解码成功:', {
        userId: decoded.userId,
        username: decoded.username,
        type: decoded.type,
        exp: decoded.exp,
        iat: decoded.iat
      });

      // 验证Token类型
      if (decoded.type !== 'access') {
        return this.sendAuthError(res, 'INVALID_TOKEN_TYPE', '令牌类型错误', 401);
      }

      // 检查令牌是否在黑名单中
      const isBlacklisted = await TokenBlacklistService.isTokenBlacklisted(token, decoded.jti);
      if (isBlacklisted) {
        console.log('令牌已被加入黑名单:', {
          userId: decoded.userId,
          jti: decoded.jti
        });
        return this.sendAuthError(res, 'TOKEN_BLACKLISTED', '令牌已失效，请重新登录', 401);
      }

      // 检查用户是否存在且激活
      const user = await this.prisma.user.findFirst({
        where: {
          id: decoded.userId,
          isActive: true
        },
        include: {
          factory: true
        }
      });

      if (!user) {
        return this.sendAuthError(res, 'USER_INVALID', '用户不存在或已被禁用', 401);
      }

      console.log('用户验证成功:', user.username);

      // 将用户信息附加到请求对象
      req.user = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        factoryId: user.factoryId,
        factory: user.factory,
        permissions: this.getUserPermissions(user.role),
        tokenId: decoded.jti
      };

      console.log('=== JWT认证成功 ===');
      next();
    } catch (error) {
      console.error('=== JWT认证失败 ===');
      console.error('认证中间件错误:', error);
      console.error('错误名称:', error.name);
      console.error('错误消息:', error.message);
      console.error('请求路径:', req.method, req.path);
      
      if (error.name === 'TokenExpiredError') {
        return this.sendAuthError(res, 'TOKEN_EXPIRED', '令牌已过期，请重新登录', 401);
      }
      
      if (error.name === 'JsonWebTokenError') {
        return this.sendAuthError(res, 'TOKEN_INVALID', '无效的令牌', 401);
      }

      return this.sendAuthError(res, 'AUTH_ERROR', '认证服务异常', 500);
    }
  };

  /**
   * 权限检查中间件
   * @param {string} requiredPermission - 需要的权限
   * @returns {Function} Express中间件函数
   */
  authorize = (requiredPermission) => {
    return (req, res, next) => {
      const user = req.user;
      
      if (!user) {
        return this.sendAuthError(res, 'UNAUTHORIZED', '用户未认证', 401);
      }

      // 超级管理员拥有所有权限
      if (user.role === 'SUPER_ADMIN') {
        return next();
      }

      // 检查具体权限
      const hasPermission = this.checkPermission(user.permissions, requiredPermission);
      
      if (!hasPermission) {
        return this.sendAuthError(res, 'FORBIDDEN', '权限不足', 403);
      }

      next();
    };
  };

  /**
   * 数据权限过滤中间件
   * @param {string} resource - 资源类型
   * @returns {Function} Express中间件函数
   */
  dataScope = (resource) => {
    return (req, res, next) => {
      const user = req.user;
      
      if (!user) {
        return this.sendAuthError(res, 'UNAUTHORIZED', '用户未认证', 401);
      }

      const scope = this.DATA_SCOPE[user.role];
      
      // 根据用户角色添加数据过滤条件
      req.dataFilter = this.buildDataFilter(user, resource, scope);
      next();
    };
  };

  /**
   * 组合认证和权限检查中间件
   * @param {string} requiredPermission - 需要的权限
   * @param {string} resource - 资源类型（可选）
   * @returns {Array<Function>} 中间件数组
   */
  requireAuth = (requiredPermission, resource = null) => {
    const middlewares = [
      this.authenticate,
      this.authorize(requiredPermission)
    ];

    if (resource) {
      middlewares.push(this.dataScope(resource));
    }

    return middlewares;
  };

  /**
   * 角色检查中间件
   * @param {Array<string>} allowedRoles - 允许的角色列表
   * @returns {Function} Express中间件函数
   */
  requireRole = (allowedRoles) => {
    return (req, res, next) => {
      const user = req.user;
      
      if (!user) {
        return this.sendAuthError(res, 'UNAUTHORIZED', '用户未认证', 401);
      }

      if (!allowedRoles.includes(user.role)) {
        return this.sendAuthError(res, 'FORBIDDEN', '角色权限不足', 403);
      }

      next();
    };
  };

  /**
   * 检查用户是否有指定权限
   * @param {Array<string>} userPermissions - 用户权限列表
   * @param {string} requiredPermission - 需要的权限
   * @returns {boolean} 是否有权限
   */
  checkPermission(userPermissions, requiredPermission) {
    // 支持通配符权限检查
    if (userPermissions.includes('*:*')) return true;
    if (userPermissions.includes(requiredPermission)) return true;
    
    // 检查模块级通配符
    const [module, action] = requiredPermission.split(':');
    if (userPermissions.includes(`${module}:*`)) return true;
    
    return false;
  }

  /**
   * 构建数据过滤条件
   * @param {Object} user - 用户信息
   * @param {string} resource - 资源类型
   * @param {Object} scope - 权限范围配置
   * @returns {Object} 数据过滤条件
   */
  buildDataFilter(user, resource, scope) {
    const filter = {};
    
    if (!scope || !scope[resource]) {
      return filter;
    }

    switch (scope[resource]) {
      case 'own':
        filter.userId = user.id;
        break;
      case 'factory':
        filter.factoryId = user.factoryId;
        break;
      case 'self':
        filter.id = user.id;
        break;
      case 'all':
        // 无额外过滤条件
        break;
      default:
        // 默认限制为用户所属厂区
        filter.factoryId = user.factoryId;
        break;
    }
    
    return filter;
  }

  /**
   * 根据角色获取权限列表
   * @param {string} role - 用户角色
   * @returns {Array<string>} 权限列表
   */
  getUserPermissions(role) {
    return this.ROLE_PERMISSIONS[role] || [];
  }

  /**
   * 发送认证错误响应
   * @param {Object} res - Express响应对象
   * @param {string} error - 错误码
   * @param {string} message - 错误消息
   * @param {number} statusCode - HTTP状态码
   */
  sendAuthError(res, error, message, statusCode = 401) {
    return res.status(statusCode).json({
      error,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 可选的认证中间件
   * 不强制要求认证，但如果有token会解析用户信息
   */
  optionalAuth = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        // 没有token，继续处理但不设置用户信息
        return next();
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'fire-safety-system',
        audience: 'fire-safety-client'
      });

      // 检查令牌是否在黑名单中
      const isBlacklisted = await TokenBlacklistService.isTokenBlacklisted(token, decoded.jti);
      if (isBlacklisted) {
        console.log('可选认证：令牌已被加入黑名单，跳过用户信息设置');
        return next();
      }

      if (decoded.type === 'access') {
        const user = await this.prisma.user.findFirst({
          where: {
            id: decoded.userId,
            isActive: true
          },
          include: {
            factory: true
          }
        });

        if (user) {
          req.user = {
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            role: user.role,
            factoryId: user.factoryId,
            factory: user.factory,
            permissions: this.getUserPermissions(user.role),
            tokenId: decoded.jti
          };
        }
      }
    } catch (error) {
      // 忽略token解析错误，继续处理请求
      console.warn('可选认证解析失败:', error.message);
    }
    
    next();
  };

  /**
   * 检查是否为资源所有者
   * @param {string} resourceField - 资源所有者字段名
   * @returns {Function} Express中间件函数
   */
  requireOwnership = (resourceField = 'userId') => {
    return (req, res, next) => {
      const user = req.user;
      
      if (!user) {
        return this.sendAuthError(res, 'UNAUTHORIZED', '用户未认证', 401);
      }

      // 超级管理员跳过所有权检查
      if (user.role === 'SUPER_ADMIN') {
        return next();
      }

      // 从请求中获取资源ID进行所有权检查
      const resourceUserId = req.body[resourceField] || req.params[resourceField] || req.query[resourceField];
      
      if (resourceUserId && resourceUserId !== user.id) {
        return this.sendAuthError(res, 'FORBIDDEN', '只能操作自己的资源', 403);
      }

      next();
    };
  };

  /**
   * 厂区级权限检查中间件
   * 确保用户只能访问自己厂区的资源
   */
  requireSameFactory = () => {
    return (req, res, next) => {
      const user = req.user;
      
      if (!user) {
        return this.sendAuthError(res, 'UNAUTHORIZED', '用户未认证', 401);
      }

      // 超级管理员跳过厂区检查
      if (user.role === 'SUPER_ADMIN') {
        return next();
      }

      // 从请求中获取厂区ID进行检查
      const resourceFactoryId = req.body.factoryId || req.params.factoryId || req.query.factoryId;
      
      if (resourceFactoryId && resourceFactoryId !== user.factoryId) {
        return this.sendAuthError(res, 'FORBIDDEN', '只能操作本厂区的资源', 403);
      }

      next();
    };
  };
}

module.exports = AuthMiddleware;