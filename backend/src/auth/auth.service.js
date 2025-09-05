const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const PermissionService = require('../services/permission.service');
const TokenBlacklistService = require('../services/token-blacklist.service');

/**
 * 消防器材点检系统 - 认证服务
 * 
 * 功能包括：
 * - JWT Token生成和验证
 * - 用户密码验证
 * - Refresh Token管理
 * - 用户认证和授权
 */

class AuthService {
  constructor() {
    this.prisma = new PrismaClient();
    this.permissionService = new PermissionService();
    this.jwtSecret = process.env.JWT_SECRET || 'fire-safety-jwt-secret-2024';
    this.jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'fire-safety-refresh-secret-2024';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.refreshTokenExpiresIn = process.env.REFRESH_TOKEN_EXPIRES_IN || '30d';
    // 记住我长期刷新令牌有效期（如 90d）
    this.longRefreshTokenExpiresIn = process.env.LONG_REFRESH_TOKEN_EXPIRES_IN || '90d';
    this.saltRounds = 12; // bcrypt salt rounds for password hashing
  }

  /**
   * 用户登录认证
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @returns {Promise<Object>} 包含token和用户信息的对象
   */
  async login(username, password, options = {}) {
    try {
      // 查找用户并包含厂区信息
      const user = await this.prisma.user.findFirst({
        where: {
          username,
          isActive: true
        },
        include: {
          factory: true
        }
      });

      if (!user) {
        throw new Error('用户名或密码错误');
      }

      // 验证密码
      const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
      if (!isPasswordValid) {
        throw new Error('用户名或密码错误');
      }

      // 从数据库获取用户实际权限
      console.log('🔍 [AuthService] 开始获取用户权限:', {
        userId: user.id,
        username: user.username,
        role: user.role
      });
      const userPermissions = await this.permissionService.getUserPermissions(user.id);
      console.log('📊 [AuthService] 权限服务返回数据:', userPermissions);
      
      // 确定有效角色：优先使用权限系统的主要角色，回退到基础角色
      const effectiveRole = userPermissions.roles.length > 0 
        ? userPermissions.roles[0].code  // 使用权限系统的主角色
        : user.role;                     // 回退到User表的基础role
      
      console.log('🎭 [AuthService] 角色确定逻辑:', {
        基础角色: user.role,
        权限系统角色数量: userPermissions.roles.length,
        权限系统主角色: userPermissions.roles.length > 0 ? userPermissions.roles[0].code : '无',
        最终有效角色: effectiveRole,
        角色来源: userPermissions.roles.length > 0 ? '权限系统' : '基础字段'
      });
      
      // 生成JWT Token
      const tokenData = {
        userId: user.id,
        username: user.username,
        role: effectiveRole,  // 使用有效角色而不是基础角色
        factoryId: user.factoryId,
        permissions: userPermissions.allPermissions
      };
      console.log('🎫 [AuthService] 生成JWT Token数据:', tokenData);

      const accessToken = this.generateAccessToken(tokenData);
      const rememberMe = !!options.rememberMe;
      const refreshToken = await this.generateRefreshToken(user.id, { rememberMe });

      // 返回用户信息（排除密码，使用有效角色）
      const { passwordHash, ...userInfo } = user;

      return {
        success: true,
        accessToken,
        refreshToken,
        expiresIn: this.jwtExpiresIn,
        user: {
          ...userInfo,
          role: effectiveRole  // 使用确定的有效角色，而不是数据库原始角色
        },
        factory: user.factory
      };
    } catch (error) {
      console.error('登录失败:', error);
      throw new Error(error.message || '登录服务异常');
    }
  }

  /**
   * 刷新访问令牌
   * @param {string} refreshToken - 刷新令牌
   * @returns {Promise<Object>} 新的访问令牌
   */
  async refreshAccessToken(refreshToken) {
    try {
      // 验证refresh token
      const decoded = jwt.verify(refreshToken, this.jwtRefreshSecret);
      
      // 查找用户
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
        throw new Error('用户不存在或已被禁用');
      }

      // 从数据库获取用户实际权限
      console.log('🔍 [AuthService] Refresh - 开始获取用户权限:', {
        userId: user.id,
        username: user.username,
        role: user.role
      });
      const userPermissions = await this.permissionService.getUserPermissions(user.id);
      console.log('📊 [AuthService] Refresh - 权限服务返回数据:', userPermissions);
      
      // 确定有效角色：优先使用权限系统的主要角色，回退到基础角色
      const effectiveRole = userPermissions.roles.length > 0 
        ? userPermissions.roles[0].code  // 使用权限系统的主角色
        : user.role;                     // 回退到User表的基础role
      
      console.log('🎭 [AuthService] Refresh - 角色确定逻辑:', {
        基础角色: user.role,
        权限系统角色数量: userPermissions.roles.length,
        权限系统主角色: userPermissions.roles.length > 0 ? userPermissions.roles[0].code : '无',
        最终有效角色: effectiveRole,
        角色来源: userPermissions.roles.length > 0 ? '权限系统' : '基础字段'
      });
      
      // 生成新的access token
      const tokenData = {
        userId: user.id,
        username: user.username,
        role: effectiveRole,  // 使用有效角色而不是基础角色
        factoryId: user.factoryId,
        permissions: userPermissions.allPermissions
      };
      console.log('🎫 [AuthService] Refresh - 生成JWT Token数据:', tokenData);

      const accessToken = this.generateAccessToken(tokenData);

      return {
        success: true,
        accessToken,
        expiresIn: this.jwtExpiresIn,
        user: {
          ...user,
          role: effectiveRole  // 也在刷新时返回有效角色
        }
      };
    } catch (error) {
      console.error('Token刷新失败:', error);
      throw new Error('无效的刷新令牌');
    }
  }

  /**
   * 用户登出
   * @param {string} refreshToken - 刷新令牌
   * @returns {Promise<Object>} 登出结果
   */
  async logout(refreshToken) {
    try {
      if (!refreshToken) {
        return {
          success: false,
          message: '缺少刷新令牌'
        };
      }

      // 解码refresh token以获取用户信息和过期时间
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, this.jwtSecret);
      } catch (jwtError) {
        // 即使令牌已过期或无效，也应该尝试将其加入黑名单
        try {
          decoded = jwt.decode(refreshToken);
        } catch (decodeError) {
          console.error('无法解码令牌:', decodeError);
          return {
            success: false,
            message: '无效的刷新令牌'
          };
        }
      }

      if (!decoded || !decoded.userId) {
        return {
          success: false,
          message: '无效的令牌格式'
        };
      }

      // 将refresh token添加到黑名单
      const expiresAt = decoded.exp ? new Date(decoded.exp * 1000) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 默认7天后过期
      
      await TokenBlacklistService.addToBlacklist(
        refreshToken,
        decoded.userId,
        'REFRESH',
        'LOGOUT',
        expiresAt,
        decoded.jti || null
      );

      console.log(`用户 ${decoded.userId} 成功登出，令牌已加入黑名单`);

      return {
        success: true,
        message: '登出成功'
      };

    } catch (error) {
      console.error('登出失败:', error);
      
      // 即使添加黑名单失败，也应该返回登出成功
      // 因为前端会清除本地存储的令牌
      return {
        success: true,
        message: '登出成功（黑名单更新异常）'
      };
    }
  }

  /**
   * 修改密码
   * @param {number} userId - 用户ID
   * @param {string} oldPassword - 旧密码
   * @param {string} newPassword - 新密码
   * @returns {Promise<Object>} 修改结果
   */
  async changePassword(userId, oldPassword, newPassword) {
    try {
      // 查找用户
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      // 验证旧密码
      const isOldPasswordValid = await bcrypt.compare(oldPassword, user.passwordHash);
      if (!isOldPasswordValid) {
        throw new Error('原密码错误');
      }

      // 验证新密码强度
      this.validatePasswordStrength(newPassword);

      // 加密新密码
      const newPasswordHash = await bcrypt.hash(newPassword, this.saltRounds);

      // 更新密码
      await this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash: newPasswordHash }
      });

      return {
        success: true,
        message: '密码修改成功'
      };
    } catch (error) {
      console.error('密码修改失败:', error);
      throw new Error(error.message || '密码修改服务异常');
    }
  }

  /**
   * 生成访问令牌
   * @param {Object} payload - Token载荷
   * @returns {string} JWT Token
   */
  generateAccessToken(payload) {
    return jwt.sign(
      {
        ...payload,
        type: 'access',
        iat: Math.floor(Date.now() / 1000),
        jti: this.generateTokenId()
      },
      this.jwtSecret,
      {
        expiresIn: this.jwtExpiresIn,
        issuer: 'fire-safety-system',
        audience: 'fire-safety-client'
      }
    );
  }

  /**
   * 生成刷新令牌
   * @param {number} userId - 用户ID
   * @returns {Promise<string>} Refresh Token
   */
  async generateRefreshToken(userId, { rememberMe = false } = {}) {
    const refreshTokenData = {
      userId,
      type: 'refresh',
      iat: Math.floor(Date.now() / 1000),
      jti: this.generateTokenId()
    };

    return jwt.sign(
      refreshTokenData,
      this.jwtRefreshSecret,
      {
        expiresIn: rememberMe ? this.longRefreshTokenExpiresIn : this.refreshTokenExpiresIn,
        issuer: 'fire-safety-system',
        audience: 'fire-safety-client'
      }
    );
  }

  /**
   * 验证JWT Token
   * @param {string} token - JWT Token
   * @param {string} type - Token类型 ('access' | 'refresh')
   * @returns {Object} 解码后的Token数据
   */
  verifyToken(token, type = 'access') {
    try {
      const secret = type === 'access' ? this.jwtSecret : this.jwtRefreshSecret;
      const decoded = jwt.verify(token, secret, {
        issuer: 'fire-safety-system',
        audience: 'fire-safety-client'
      });

      if (decoded.type !== type) {
        throw new Error(`Invalid token type. Expected: ${type}, Got: ${decoded.type}`);
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('令牌已过期');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('无效的令牌');
      } else {
        throw error;
      }
    }
  }

  /**
   * 根据角色获取权限列表
   * @param {string} role - 用户角色
   * @returns {Array<string>} 权限列表
   */
  getUserPermissions(role) {
    const ROLE_PERMISSIONS = {
      INSPECTOR: [
        'equipment:read',        // 查看器材信息
        'inspection:create',     // 创建点检记录
        'inspection:read:own',   // 查看自己的点检记录
        'issue:create',          // 上报隐患
        'profile:read:own'       // 查看个人信息
      ],
      
      FACTORY_ADMIN: [
        'equipment:*',           // 器材管理全权限
        'inspection:read',       // 查看所有点检记录
        'issue:read',            // 查看隐患列表
        'issue:handle',          // 处理隐患
        'user:read',             // 查看用户列表
        'user:create',           // 创建用户 (本厂区)
        'report:read:factory',   // 查看厂区报表
        'dashboard:factory'      // 厂区数据看板
      ],
      
      SUPER_ADMIN: [
        '*:*',                   // 全部权限
        'factory:*',             // 厂区管理
        'user:*',                // 用户管理
        'system:config',         // 系统配置
        'audit:read',            // 审计日志
        'report:read:global'     // 全局报表
      ]
    };

    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * 检查用户是否有指定权限
   * @param {Array<string>} userPermissions - 用户权限列表
   * @param {string} requiredPermission - 需要的权限
   * @returns {boolean} 是否有权限
   */
  hasPermission(userPermissions, requiredPermission) {
    // 超级管理员拥有所有权限
    if (userPermissions.includes('*:*')) {
      return true;
    }

    // 检查精确权限
    if (userPermissions.includes(requiredPermission)) {
      return true;
    }

    // 检查模块级通配符权限
    const [module, action] = requiredPermission.split(':');
    if (userPermissions.includes(`${module}:*`)) {
      return true;
    }

    return false;
  }

  /**
   * 密码强度验证
   * @param {string} password - 密码
   * @throws {Error} 密码不符合要求时抛出错误
   */
  validatePasswordStrength(password) {
    const errors = [];
    
    if (password.length < 8) {
      errors.push('密码长度不能少于8位');
    }
    
    if (password.length > 128) {
      errors.push('密码长度不能超过128位');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('密码必须包含大写字母');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('密码必须包含小写字母');
    }
    
    if (!/\d/.test(password)) {
      errors.push('密码必须包含数字');
    }
    
    if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
      errors.push('密码必须包含特殊字符');
    }
    
    if (errors.length > 0) {
      throw new Error(`密码不符合安全要求: ${errors.join(', ')}`);
    }
  }

  /**
   * 生成安全的Token ID
   * @returns {string} 唯一的Token ID
   */
  generateTokenId() {
    return require('crypto').randomBytes(16).toString('hex');
  }

  /**
   * 创建用户账户
   * @param {Object} userData - 用户数据
   * @returns {Promise<Object>} 创建结果
   */
  async createUser(userData) {
    try {
      const { username, password, fullName, role, factoryId } = userData;

      // 检查用户名是否已存在
      const existingUser = await this.prisma.user.findUnique({
        where: { username }
      });

      if (existingUser) {
        throw new Error('用户名已存在');
      }

      // 验证密码强度
      this.validatePasswordStrength(password);

      // 加密密码
      const passwordHash = await bcrypt.hash(password, this.saltRounds);

      // 使用数据库事务确保用户创建和权限分配的原子性
      const result = await this.prisma.$transaction(async (tx) => {
        // 创建用户
        const user = await tx.user.create({
          data: {
            username,
            passwordHash,
            fullName,
            role,
            factoryId,
            isActive: true
          },
          include: {
            factory: true
          }
        });

        // 自动分配对应的权限系统角色
        await this.assignUserRole(user, role, tx);

        // 返回用户信息（排除密码）
        const { passwordHash: _, ...userInfo } = user;

        return {
          success: true,
          message: '用户创建成功',
          user: userInfo
        };
      });

      return result;
    } catch (error) {
      console.error('用户创建失败:', error);
      throw new Error(error.message || '用户创建服务异常');
    }
  }

  /**
   * 为用户自动分配权限系统角色
   * @param {Object} user - 用户对象
   * @param {string} role - 基础角色
   * @param {Object} tx - 数据库事务对象
   * @private
   */
  async assignUserRole(user, role, tx) {
    try {
      console.log('🎭 [AuthService] 开始为用户分配权限系统角色:', {
        userId: user.id,
        username: user.username,
        baseRole: role,
        factoryId: user.factoryId
      });

      // 角色映射：基础角色 → 权限系统角色代码
      const roleMapping = {
        'SUPER_ADMIN': 'SUPER_ADMIN',
        'FACTORY_ADMIN': 'FACTORY_ADMIN', 
        'INSPECTOR': 'INSPECTOR'
      };

      const targetRoleCode = roleMapping[role];
      if (!targetRoleCode) {
        console.warn(`⚠️ [AuthService] 未知角色类型: ${role}，跳过权限系统角色分配`);
        return;
      }

      // 查找对应的权限系统角色
      const targetRole = await tx.role.findUnique({
        where: { 
          code: targetRoleCode,
          isActive: true 
        }
      });

      if (!targetRole) {
        console.warn(`⚠️ [AuthService] 权限系统中未找到角色: ${targetRoleCode}`);
        return;
      }

      // 检查用户是否已经拥有该角色
      const existingUserRole = await tx.userRole.findUnique({
        where: {
          userId_roleId: {
            userId: user.id,
            roleId: targetRole.id
          }
        }
      });

      if (existingUserRole) {
        console.log(`ℹ️ [AuthService] 用户已拥有角色 ${targetRole.name}，跳过分配`);
        return;
      }

      // 分配角色
      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: targetRole.id,
          grantedBy: user.id, // 系统创建时，设置为用户自己授予
          grantedAt: new Date()
        }
      });

      // 记录权限变更日志
      await tx.permissionLog.create({
        data: {
          actionType: 'GRANT_ROLE',
          targetUserId: user.id,
          operatorId: user.id, // 系统创建时，操作者设置为用户自己
          roleId: targetRole.id,
          factoryId: user.factoryId,
          reason: `用户创建时自动分配${targetRole.name}角色`,
          newValue: JSON.stringify({
            roleId: targetRole.id,
            roleName: targetRole.name,
            roleCode: targetRole.code,
            source: 'auto_assignment_on_user_creation'
          })
        }
      });

      console.log('✅ [AuthService] 权限系统角色分配成功:', {
        userId: user.id,
        username: user.username,
        assignedRole: targetRole.name,
        roleCode: targetRole.code,
        roleId: targetRole.id
      });

    } catch (error) {
      console.error('❌ [AuthService] 权限系统角色分配失败:', error);
      // 不抛出错误，避免影响用户创建流程
      // 用户仍然可以通过基础角色正常使用系统
      console.warn('⚠️ [AuthService] 权限分配失败，但用户创建继续进行（使用基础角色回退机制）');
    }
  }
}

module.exports = AuthService;
