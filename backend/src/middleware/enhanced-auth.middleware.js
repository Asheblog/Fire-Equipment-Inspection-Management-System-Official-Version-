const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

/**
 * 消防器材点检系统 - 增强版权限中间件
 * 
 * 支持多层次权限管理：
 * 1. 基于角色的权限控制 (RBAC)
 * 2. 基于用户的个人权限控制
 * 3. 权限继承和覆盖机制
 * 4. 细粒度功能权限控制
 */

class EnhancedAuthMiddleware {
  constructor() {
    this.prisma = new PrismaClient();
    this.jwtSecret = process.env.JWT_SECRET || 'fire-safety-jwt-secret-2024';
    
    // 权限缓存 - 减少数据库查询
    this.permissionCache = new Map();
    this.cacheExpiry = 5 * 60 * 1000; // 5分钟过期
  }

  /**
   * 主要认证中间件
   * 验证JWT Token并设置用户信息和权限
   */
  authenticate = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return this.sendAuthError(res, 'UNAUTHORIZED', '缺少认证令牌', 401);
      }

      const token = authHeader.substring(7);
      console.log('=== 增强版JWT认证 ===');
      console.log('请求路径:', req.method, req.path);
      
      // JWT Token验证
      const decoded = jwt.verify(token, this.jwtSecret, {
        issuer: 'fire-safety-system',
        audience: 'fire-safety-client'
      });

      if (decoded.type !== 'access') {
        return this.sendAuthError(res, 'INVALID_TOKEN_TYPE', '令牌类型错误', 401);
      }

      // 检查用户是否存在且激活
      const user = await this.prisma.user.findFirst({
        where: {
          id: decoded.userId,
          isActive: true
        },
        include: {
          factory: true,
          // 载入多厂区归属
          factoryAssignments: {
            include: {
              factory: true
            }
          },
          roles: {
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: {
                      permission: true
                    }
                  }
                }
              }
            }
          },
          userPermissions: {
            include: {
              permission: true
            }
          }
        }
      });

      if (!user) {
        return this.sendAuthError(res, 'USER_INVALID', '用户不存在或已被禁用', 401);
      }

      // 构建用户权限列表
      const userPermissions = await this.buildUserPermissions(user);

      // 组装多厂区可访问列表（含主厂区 + 额外归属）
      const assignmentFactoryIds = (user.factoryAssignments || []).map(a => a.factoryId);
      const assignmentFactories = (user.factoryAssignments || []).map(a => a.factory);
      const uniqueFactoryIds = Array.from(new Set([user.factoryId, ...assignmentFactoryIds]));

      // 将用户信息附加到请求对象
      req.user = {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role, // 保留原有角色字段以兼容现有代码
        factoryId: user.factoryId,
        factory: user.factory,
        // 多厂区：可访问厂区ID与详情
        factoryIds: uniqueFactoryIds,
        factories: [user.factory, ...assignmentFactories.filter(f => !!f)],
        permissions: userPermissions,
        roles: user.roles.map(ur => ur.role),
        tokenId: decoded.jti
      };

      console.log('用户权限加载完成:', user.username, `共${userPermissions.length}个权限`);
      console.log('=== 增强版JWT认证成功 ===');
      next();
    } catch (error) {
      console.error('=== 增强版JWT认证失败 ===');
      console.error('认证中间件错误:', error);
      
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
   * 细粒度权限检查中间件
   * @param {string|Array<string>} requiredPermissions - 需要的权限码
   * @param {string} operator - 权限操作符: 'AND'(需要全部权限) | 'OR'(需要任一权限)
   * @returns {Function} Express中间件函数
   */
  authorize = (requiredPermissions, operator = 'OR') => {
    return (req, res, next) => {
      const user = req.user;
      
      if (!user) {
        return this.sendAuthError(res, 'UNAUTHORIZED', '用户未认证', 401);
      }

      // 超级管理员拥有所有权限
      if (user.role === 'SUPER_ADMIN') {
        return next();
      }

      const permissions = Array.isArray(requiredPermissions) 
        ? requiredPermissions 
        : [requiredPermissions];

      const hasPermission = this.checkUserPermissions(user.permissions, permissions, operator);
      
      if (!hasPermission) {
        console.log('权限检查失败:', {
          user: user.username,
          required: permissions,
          userPermissions: user.permissions.map(p => p.code)
        });
        return this.sendAuthError(res, 'FORBIDDEN', '权限不足', 403);
      }

      next();
    };
  };

  /**
   * 角色检查中间件
   * @param {Array<string>} allowedRoles - 允许的角色编码列表
   * @returns {Function} Express中间件函数
   */
  requireRole = (allowedRoles) => {
    return (req, res, next) => {
      const user = req.user;
      
      if (!user) {
        return this.sendAuthError(res, 'UNAUTHORIZED', '用户未认证', 401);
      }

      // 检查传统角色字段（向后兼容）
      if (allowedRoles.includes(user.role)) {
        return next();
      }

      // 检查新的角色系统
      const userRoleCodes = user.roles.map(role => role.code);
      const hasRole = allowedRoles.some(role => userRoleCodes.includes(role));

      if (!hasRole) {
        return this.sendAuthError(res, 'FORBIDDEN', '角色权限不足', 403);
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

      // 为超级管理员保留现有逻辑
      if (user.role === 'SUPER_ADMIN') {
        req.dataFilter = {};
        return next();
      }

      // 基于权限的数据过滤逻辑
      req.dataFilter = this.buildDataFilter(user, resource);
      next();
    };
  };

  /**
   * 构建用户完整权限列表
   * 合并角色权限和个人权限，个人权限可覆盖角色权限
   */
  async buildUserPermissions(user) {
    const cacheKey = `user_permissions_${user.id}`;
    const cached = this.permissionCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
      return cached.permissions;
    }

    // 收集角色权限
    const rolePermissions = new Map();
    for (const userRole of user.roles) {
      for (const rolePermission of userRole.role.rolePermissions) {
        const permission = rolePermission.permission;
        if (permission.isActive) {
          rolePermissions.set(permission.code, {
            id: permission.id,
            code: permission.code,
            name: permission.name,
            module: permission.module,
            category: permission.category,
            level: permission.level,
            source: 'role',
            roleCode: userRole.role.code
          });
        }
      }
    }

    // 应用个人权限（覆盖角色权限）
    const finalPermissions = new Map(rolePermissions);
    
    for (const userPermission of user.userPermissions) {
      const permission = userPermission.permission;
      
      // 检查权限是否过期
      if (userPermission.expiresAt && new Date() > userPermission.expiresAt) {
        continue;
      }

      if (userPermission.isGranted) {
        // 授予权限
        finalPermissions.set(permission.code, {
          id: permission.id,
          code: permission.code,
          name: permission.name,
          module: permission.module,
          category: permission.category,
          level: permission.level,
          source: 'user',
          grantedAt: userPermission.grantedAt,
          expiresAt: userPermission.expiresAt
        });
      } else {
        // 撤销权限
        finalPermissions.delete(permission.code);
      }
    }

    const permissions = Array.from(finalPermissions.values());
    
    // 更新缓存
    this.permissionCache.set(cacheKey, {
      permissions,
      timestamp: Date.now()
    });

    return permissions;
  }

  /**
   * 检查用户是否有指定权限
   */
  checkUserPermissions(userPermissions, requiredPermissions, operator = 'OR') {
    const userPermissionCodes = userPermissions.map(p => p.code);
    
    if (operator === 'AND') {
      return requiredPermissions.every(permission => 
        this.matchPermission(userPermissionCodes, permission)
      );
    } else {
      return requiredPermissions.some(permission => 
        this.matchPermission(userPermissionCodes, permission)
      );
    }
  }

  /**
   * 权限匹配检查，支持通配符
   */
  matchPermission(userPermissions, requiredPermission) {
    // 精确匹配
    if (userPermissions.includes(requiredPermission)) {
      return true;
    }

    // 通配符匹配
    const [module, action] = requiredPermission.split(':');
    
    // 检查模块级通配符权限
    if (userPermissions.includes(`${module}:*`)) {
      return true;
    }

    // 检查全局通配符权限
    if (userPermissions.includes('*:*')) {
      return true;
    }

    return false;
  }

  /**
   * 构建数据过滤条件
   */
  buildDataFilter(user, resource) {
    const filter = {};
    
    // 基于厂区的数据隔离（保留现有逻辑）
    const factoryRestrictedResources = ['equipment', 'inspection', 'issue', 'user'];
    
    if (factoryRestrictedResources.includes(resource) && user.role !== 'SUPER_ADMIN') {
      const ids = Array.isArray(user.factoryIds) && user.factoryIds.length > 0
        ? user.factoryIds
        : (user.factoryId ? [user.factoryId] : []);
      // 为向后兼容，保留单值，同时提供数组
      if (ids.length === 1) {
        filter.factoryId = ids[0];
      }
      filter.factoryIds = ids;
    }

    // 基于权限的额外数据过滤逻辑可在此扩展
    
    return filter;
  }

  /**
   * 清除权限缓存
   */
  clearPermissionCache(userId = null) {
    if (userId) {
      this.permissionCache.delete(`user_permissions_${userId}`);
    } else {
      this.permissionCache.clear();
    }
  }

  /**
   * 记录权限变更日志
   */
  async logPermissionChange(actionType, targetUserId, operatorId, details) {
    try {
      await this.prisma.permissionLog.create({
        data: {
          actionType,
          targetUserId,
          operatorId,
          oldValue: details.oldValue ? JSON.stringify(details.oldValue) : null,
          newValue: details.newValue ? JSON.stringify(details.newValue) : null,
          reason: details.reason,
          ipAddress: details.ipAddress,
          userAgent: details.userAgent,
          factoryId: details.factoryId,
          roleId: details.roleId,
          permissionId: details.permissionId
        }
      });
    } catch (error) {
      console.error('权限变更日志记录失败:', error);
    }
  }

  /**
   * 发送认证错误响应
   */
  sendAuthError(res, error, message, statusCode = 401) {
    return res.status(statusCode).json({
      error,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * 组合认证和权限检查中间件
   */
  requireAuth = (requiredPermissions, resource = null, operator = 'OR') => {
    const middlewares = [this.authenticate];

    if (requiredPermissions) {
      middlewares.push(this.authorize(requiredPermissions, operator));
    }

    if (resource) {
      middlewares.push(this.dataScope(resource));
    }

    return middlewares;
  };

  /**
   * 可选的认证中间件（不强制要求认证）
   */
  optionalAuth = async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
      }

      // 尝试解析用户信息
      await this.authenticate(req, res, next);
    } catch (error) {
      console.warn('可选认证解析失败:', error.message);
      next();
    }
  };
}

module.exports = EnhancedAuthMiddleware;
