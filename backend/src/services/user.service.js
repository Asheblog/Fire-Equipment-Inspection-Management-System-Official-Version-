/**
 * 消防器材点检系统 - 用户管理服务
 * 处理用户和厂区管理相关的业务逻辑
 */

const { PrismaClient } = require('@prisma/client');
const AuthService = require('../auth/auth.service');

class UserService {
  constructor() {
    this.prisma = new PrismaClient();
    this.authService = new AuthService();
  }

  /**
   * 获取用户列表
   * @param {Object} filters - 筛选条件
   * @param {Object} pagination - 分页参数
   * @param {number} userFactoryId - 当前用户厂区ID
   * @param {string} userRole - 当前用户角色
   * @returns {Promise<Object>} 用户列表
   */
  async getUserList(filters = {}, pagination = {}, userFactoryId = null, userRole = null) {
    try {
      const {
        factoryId,
        role,
        isActive,
        search
      } = filters;

      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = pagination;

      // 构建查询条件
      const where = {};

      // 数据隔离：厂区管理员只能管理自己授权厂区的用户（支持多厂区）
      if (userRole === 'FACTORY_ADMIN' && Array.isArray(userFactoryId) && userFactoryId.length > 0) {
        where.factoryId = { in: userFactoryId };
      } else if (userRole === 'FACTORY_ADMIN' && userFactoryId) {
        where.factoryId = userFactoryId;
      } else if (factoryId) {
        where.factoryId = factoryId;
      }

      // 角色筛选
      if (role) {
        where.role = role;
      }

      // 状态筛选
      if (isActive !== undefined) {
        where.isActive = isActive;
      }

      // 关键词搜索（用户名或姓名）
      if (search) {
        where.OR = [
          { username: { contains: search } },
          { fullName: { contains: search } }
        ];
      }

      const skip = (page - 1) * limit;
      const orderBy = {};
      orderBy[sortBy] = sortOrder;

      const [users, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          select: {
            id: true,
            username: true,
            fullName: true,
            role: true,
            factoryId: true,
            isActive: true,
            createdAt: true,
            factory: {
              select: { id: true, name: true }
            },
            factoryAssignments: {
              include: {
                factory: { select: { id: true, name: true } }
              }
            },
            _count: {
              select: {
                inspectionLogs: true,
                reportedIssues: true,
                handledIssues: true
              }
            }
          }
        }),
        this.prisma.user.count({ where })
      ]);

      const pages = Math.ceil(total / limit);

      const usersMapped = users.map(u => {
        const factories = (u.factoryAssignments || []).map(a => a.factory).filter(Boolean);
        const factoryIds = factories.map(f => f.id);
        const { factoryAssignments, ...rest } = u;
        return { ...rest, factories, factoryIds };
      });

      return {
        users: usersMapped,
        pagination: {
          total,
          page,
          limit,
          pages,
          hasNext: page < pages,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      console.error('获取用户列表失败:', error);
      throw new Error('获取用户列表失败');
    }
  }

  /**
   * 获取用户详情
   * @param {number} id - 用户ID
   * @param {number} userFactoryId - 当前用户厂区ID
   * @param {string} userRole - 当前用户角色
   * @returns {Promise<Object>} 用户详情
   */
  async getUserById(id, userFactoryId = null, userRole = null) {
    try {
      const where = { id };

      const user = await this.prisma.user.findFirst({
        where,
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
          factoryId: true,
          isActive: true,
          createdAt: true,
          factory: {
            select: { id: true, name: true, address: true }
          },
          factoryAssignments: {
            include: {
              factory: { select: { id: true, name: true } }
            }
          },
          _count: {
            select: {
              inspectionLogs: true,
              reportedIssues: true,
              handledIssues: true,
              auditedIssues: true
            }
          }
        }
      });

      if (!user) {
        throw new Error('用户不存在');
      }

      // 数据权限检查：厂区管理员只能查看自己授权厂区的用户（支持多厂区）
      if (userRole === 'FACTORY_ADMIN') {
        if (Array.isArray(userFactoryId) && userFactoryId.length > 0) {
          if (!userFactoryId.includes(user.factoryId)) {
            throw new Error('无权查看该用户');
          }
        } else if (userFactoryId && user.factoryId !== userFactoryId) {
          throw new Error('无权查看该用户');
        }
      }

      const factories = (user.factoryAssignments || []).map(a => a.factory).filter(Boolean);
      const factoryIds = factories.map(f => f.id);
      const { factoryAssignments, ...rest } = user;
      return { ...rest, factories, factoryIds };
    } catch (error) {
      console.error('获取用户详情失败:', error);
      throw error;
    }
  }

  /**
   * 创建用户
   * @param {Object} userData - 用户数据
   * @param {number} userFactoryId - 当前用户厂区ID
   * @param {string} userRole - 当前用户角色
   * @returns {Promise<Object>} 创建的用户
   */
  async createUser(userData, userFactoryId = null, userRole = null) {
    try {
      const { username, password, fullName, role } = userData;
      // 兼容：既支持 factoryId，也支持 factoryIds 数组
      const inputFactoryIds = Array.isArray(userData.factoryIds) && userData.factoryIds.length > 0
        ? userData.factoryIds
        : (userData.factoryId ? [userData.factoryId] : []);

      // 权限检查：厂区管理员只能在自己厂区创建用户，且不能创建超级管理员
      if (userRole === 'FACTORY_ADMIN') {
        if (role === 'SUPER_ADMIN') {
          throw new Error('无权创建超级管理员');
        }
        if (userFactoryId) {
          const allowed = Array.isArray(userFactoryId) ? userFactoryId : [userFactoryId];
          const allInAllowed = inputFactoryIds.every(fid => allowed.includes(fid));
          if (!allInAllowed) {
            throw new Error('只能在自己的厂区创建用户');
          }
        }
      }

      // 主厂区取首个
      const primaryFactoryId = (Array.isArray(userFactoryId) && userFactoryId.length > 0)
        ? userFactoryId[0]
        : (userFactoryId || inputFactoryIds[0]);

      // 用户名唯一性检查
      const duplicateUser = await this.prisma.user.findUnique({ where: { username } });
      if (duplicateUser) {
        throw new Error('用户名已存在');
      }

      // 密码强度校验
      if (this.authService && typeof this.authService.validatePasswordStrength === 'function') {
        this.authService.validatePasswordStrength(password)
      }

      // 加密密码
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(password, 12);

      // 创建用户
      const created = await this.prisma.user.create({
        data: {
          username,
          passwordHash,
          fullName,
          role,
          factoryId: primaryFactoryId
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
          factoryId: true,
          isActive: true,
          createdAt: true
        }
      });

      // 同步多厂区映射
      const factoriesToAssign = inputFactoryIds.length > 0 ? inputFactoryIds : (primaryFactoryId ? [primaryFactoryId] : []);
      await this.syncUserFactories(created.id, factoriesToAssign);

      return created;
    } catch (error) {
      console.error('创建用户失败:', error);
      throw error;
    }
  }

  /**
   * 更新用户信息
   * @param {number} id - 用户ID
   * @param {Object} updateData - 更新数据
   * @param {number} userFactoryId - 当前用户厂区ID
   * @param {string} userRole - 当前用户角色
   * @returns {Promise<Object>} 更新后的用户
   */
  async updateUser(id, updateData, userFactoryId = null, userRole = null) {
    try {
      // 检查用户是否存在
      const existingUser = await this.prisma.user.findUnique({
        where: { id }
      });

      if (!existingUser) {
        throw new Error('用户不存在');
      }

      // 权限检查
      if (userRole === 'FACTORY_ADMIN') {
        // 厂区管理员只能管理自己厂区的用户
        if (userFactoryId && existingUser.factoryId !== userFactoryId) {
          throw new Error('无权修改该用户');
        }
        // 不能修改用户为超级管理员
        if (updateData.role === 'SUPER_ADMIN') {
          throw new Error('无权设置超级管理员角色');
        }
        // 不能将用户分配到不属于自己的厂区
        if (updateData.factoryIds || updateData.factoryId) {
          const allowed = Array.isArray(userFactoryId) ? userFactoryId : (userFactoryId ? [userFactoryId] : []);
          const requested = Array.isArray(updateData.factoryIds) && updateData.factoryIds.length > 0
            ? updateData.factoryIds
            : (updateData.factoryId ? [updateData.factoryId] : []);
          if (allowed.length > 0 && !requested.every(fid => allowed.includes(fid))) {
            throw new Error('无权修改为该厂区');
          }
        }
      }

      // 如果包含用户名，检查是否重复
      if (updateData.username && updateData.username !== existingUser.username) {
        const duplicateUser = await this.prisma.user.findUnique({
          where: { username: updateData.username }
        });
        if (duplicateUser) {
          throw new Error('用户名已存在');
        }
      }

      // 计算主厂区（如果传了 factoryIds/factoryId 则使用首个）
      let primaryFactoryId = undefined;
      if (Array.isArray(updateData.factoryIds) && updateData.factoryIds.length > 0) {
        primaryFactoryId = updateData.factoryIds[0];
      } else if (updateData.factoryId) {
        primaryFactoryId = updateData.factoryId;
      }

      // 更新用户
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          username: updateData.username ?? undefined,
          fullName: updateData.fullName ?? undefined,
          role: updateData.role ?? undefined,
          factoryId: primaryFactoryId ?? undefined
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
          factoryId: true,
          isActive: true,
          createdAt: true,
          factory: {
            select: { id: true, name: true }
          }
        }
      });

      // 同步多厂区映射（如提供）
      if ((Array.isArray(updateData.factoryIds) && updateData.factoryIds.length > 0) || updateData.factoryId) {
        const list = Array.isArray(updateData.factoryIds) && updateData.factoryIds.length > 0
          ? updateData.factoryIds
          : [updateData.factoryId];
        await this.syncUserFactories(id, list);
      }

      return user;
    } catch (error) {
      console.error('更新用户失败:', error);
      throw error;
    }
  }

  /**
   * 同步用户的多厂区映射
   */
  async syncUserFactories(userId, factoryIds = []) {
    // 查询现有
    const existing = await this.prisma.userFactory.findMany({ where: { userId } });
    const existingIds = new Set(existing.map(x => x.factoryId));
    const targetIds = new Set(factoryIds);

    // 需要新增的
    const toAdd = factoryIds.filter(id => !existingIds.has(id)).map(fid => ({ userId, factoryId: fid }));
    // 需要删除的
    const toDelete = existing.filter(x => !targetIds.has(x.factoryId)).map(x => x.id);

    if (toAdd.length > 0) {
      // SQLite 不支持 skipDuplicates；非 SQLite 可启用以防并发重复
      const dbUrl = process.env.DATABASE_URL || '';
      const isSQLite = dbUrl.startsWith('file:') || dbUrl.startsWith('sqlite:');
      if (isSQLite) {
        await this.prisma.userFactory.createMany({ data: toAdd });
      } else {
        await this.prisma.userFactory.createMany({ data: toAdd, skipDuplicates: true });
      }
    }
    if (toDelete.length > 0) {
      await this.prisma.userFactory.deleteMany({ where: { id: { in: toDelete } } });
    }
  }

  /**
   * 更新当前用户个人资料
   * @param {number} userId - 用户ID
   * @param {Object} updateData - 更新数据（只允许更新姓名和用户名）
   * @returns {Promise<Object>} 更新后的用户
   */
  async updateOwnProfile(userId, updateData) {
    try {
      // 检查用户是否存在
      const existingUser = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          factory: true
        }
      });

      if (!existingUser) {
        throw new Error('用户不存在');
      }

      // 如果包含用户名，检查是否重复
      if (updateData.username && updateData.username !== existingUser.username) {
        const duplicateUser = await this.prisma.user.findUnique({
          where: { username: updateData.username }
        });
        if (duplicateUser) {
          throw new Error('用户名已存在');
        }
      }

      // 只允许更新特定字段
      const allowedUpdates = {};
      if (updateData.fullName !== undefined) {
        allowedUpdates.fullName = updateData.fullName;
      }
      if (updateData.username !== undefined) {
        allowedUpdates.username = updateData.username;
      }

      // 更新用户信息
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: allowedUpdates,
        include: {
          factory: true
        }
      });

      return {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        factoryId: user.factoryId,
        factory: user.factory,
        isActive: user.isActive,
        createdAt: user.createdAt
      };
    } catch (error) {
      console.error('更新个人资料失败:', error);
      throw error;
    }
  }

  /**
   * 停用/启用用户
   * @param {number} id - 用户ID
   * @param {boolean} isActive - 是否启用
   * @param {number} userFactoryId - 当前用户厂区ID
   * @param {string} userRole - 当前用户角色
   * @returns {Promise<Object>} 更新后的用户
   */
  async toggleUserStatus(id, isActive, userFactoryId = null, userRole = null) {
    try {
      // 检查用户是否存在
      const existingUser = await this.prisma.user.findUnique({
        where: { id }
      });

      if (!existingUser) {
        throw new Error('用户不存在');
      }

      // 权限检查
      if (userRole === 'FACTORY_ADMIN') {
        if (Array.isArray(userFactoryId) && userFactoryId.length > 0) {
          if (!userFactoryId.includes(existingUser.factoryId)) {
            throw new Error('无权修改该用户状态');
          }
        } else if (userFactoryId && existingUser.factoryId !== userFactoryId) {
          throw new Error('无权修改该用户状态');
        }
        // 不能停用超级管理员
        if (existingUser.role === 'SUPER_ADMIN') {
          throw new Error('无权修改超级管理员状态');
        }
      }

      // 更新用户状态
      const user = await this.prisma.user.update({
        where: { id },
        data: { isActive },
        select: {
          id: true,
          username: true,
          fullName: true,
          role: true,
          isActive: true
        }
      });

      return user;
    } catch (error) {
      console.error('修改用户状态失败:', error);
      throw error;
    }
  }

  /**
   * 重置用户密码
   * @param {number} id - 用户ID
   * @param {string} newPassword - 新密码
   * @param {number} userFactoryId - 当前用户厂区ID
   * @param {string} userRole - 当前用户角色
   * @returns {Promise<Object>} 操作结果
   */
  async resetUserPassword(id, newPassword, userFactoryId = null, userRole = null) {
    try {
      // 检查用户是否存在
      const existingUser = await this.prisma.user.findUnique({
        where: { id }
      });

      if (!existingUser) {
        throw new Error('用户不存在');
      }

      // 权限检查
      if (userRole === 'FACTORY_ADMIN') {
        if (Array.isArray(userFactoryId) && userFactoryId.length > 0) {
          if (!userFactoryId.includes(existingUser.factoryId)) {
            throw new Error('无权重置该用户密码');
          }
        } else if (userFactoryId && existingUser.factoryId !== userFactoryId) {
          throw new Error('无权重置该用户密码');
        }
        // 不能重置超级管理员密码
        if (existingUser.role === 'SUPER_ADMIN') {
          throw new Error('无权重置超级管理员密码');
        }
      }

      // 验证密码强度
      this.authService.validatePasswordStrength(newPassword);

      // 加密新密码
      const bcrypt = require('bcryptjs');
      const passwordHash = await bcrypt.hash(newPassword, 12);

      // 更新密码
      await this.prisma.user.update({
        where: { id },
        data: { passwordHash }
      });

      return {
        success: true,
        message: '密码重置成功'
      };
    } catch (error) {
      console.error('重置密码失败:', error);
      throw error;
    }
  }

  /**
   * 获取厂区列表
   * @returns {Promise<Array>} 厂区列表
   */
  async getFactoryList() {
    try {
      const factories = await this.prisma.factory.findMany({
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              users: true,
              equipments: true
            }
          }
        }
      });

      return factories.map(factory => ({
        ...factory,
        userCount: factory._count.users,
        equipmentCount: factory._count.equipments
      }));
    } catch (error) {
      console.error('获取厂区列表失败:', error);
      throw new Error('获取厂区列表失败');
    }
  }

  /**
   * 创建厂区
   * @param {Object} factoryData - 厂区数据
   * @returns {Promise<Object>} 创建的厂区
   */
  async createFactory(factoryData) {
    try {
      const { name, address } = factoryData;

      // 检查厂区名称是否重复
      const existingFactory = await this.prisma.factory.findUnique({
        where: { name }
      });

      if (existingFactory) {
        throw new Error('厂区名称已存在');
      }

      const factory = await this.prisma.factory.create({
        data: { name, address }
      });

      return factory;
    } catch (error) {
      console.error('创建厂区失败:', error);
      throw error;
    }
  }

  /**
   * 获取厂区详情
   * @param {number} factoryId - 厂区ID
   * @returns {Promise<Object>} 厂区详情
   */
  async getFactoryById(factoryId) {
    try {
      const factory = await this.prisma.factory.findUnique({
        where: { id: factoryId },
        include: {
          _count: {
            select: {
              users: true,
              equipments: true
            }
          },
          users: {
            select: {
              id: true,
              fullName: true,
              role: true,
              isActive: true
            }
          }
        }
      });

      if (!factory) {
        throw new Error('厂区不存在');
      }

      return {
        ...factory,
        userCount: factory._count.users,
        equipmentCount: factory._count.equipments
      };
    } catch (error) {
      console.error('获取厂区详情失败:', error);
      throw error;
    }
  }

  /**
   * 更新厂区信息
   * @param {number} factoryId - 厂区ID
   * @param {Object} updateData - 更新数据
   * @returns {Promise<Object>} 更新后的厂区
   */
  async updateFactory(factoryId, updateData) {
    try {
      const { name, address } = updateData;

      // 检查厂区是否存在
      const existingFactory = await this.prisma.factory.findUnique({
        where: { id: factoryId }
      });

      if (!existingFactory) {
        throw new Error('厂区不存在');
      }

      // 检查新名称是否与其他厂区重复
      if (name && name !== existingFactory.name) {
        const duplicateFactory = await this.prisma.factory.findUnique({
          where: { name }
        });

        if (duplicateFactory) {
          throw new Error('厂区名称已存在');
        }
      }

      const factory = await this.prisma.factory.update({
        where: { id: factoryId },
        data: { name, address },
        include: {
          _count: {
            select: {
              users: true,
              equipments: true
            }
          }
        }
      });

      return {
        ...factory,
        userCount: factory._count.users,
        equipmentCount: factory._count.equipments
      };
    } catch (error) {
      console.error('更新厂区失败:', error);
      throw error;
    }
  }

  /**
   * 删除厂区
   * @param {number} factoryId - 厂区ID
   * @returns {Promise<void>}
   */
  async deleteFactory(factoryId) {
    try {
      // 检查厂区是否存在
      const factory = await this.prisma.factory.findUnique({
        where: { id: factoryId },
        include: {
          _count: {
            select: {
              users: true,
              equipments: true
            }
          }
        }
      });

      if (!factory) {
        throw new Error('厂区不存在');
      }

      // 检查是否存在关联数据
      if (factory._count.users > 0 || factory._count.equipments > 0) {
        throw new Error('厂区存在关联数据，无法删除。请先移除关联的用户和器材。');
      }

      await this.prisma.factory.delete({
        where: { id: factoryId }
      });
    } catch (error) {
      console.error('删除厂区失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户统计信息
   * @param {number} factoryId - 厂区ID
   * @returns {Promise<Object>} 统计信息
   */
  async getUserStats(factoryId = null) {
    try {
      const where = factoryId ? { factoryId } : {};

      const [
        totalUsers,
        activeUsers,
        inspectorCount,
        factoryAdminCount,
        superAdminCount
      ] = await Promise.all([
        // 总用户数
        this.prisma.user.count({ where }),
        // 活跃用户数
        this.prisma.user.count({ where: { ...where, isActive: true } }),
        // 点检员数量
        this.prisma.user.count({ where: { ...where, role: 'INSPECTOR' } }),
        // 厂区管理员数量
        this.prisma.user.count({ where: { ...where, role: 'FACTORY_ADMIN' } }),
        // 超级管理员数量
        this.prisma.user.count({ where: { role: 'SUPER_ADMIN' } })
      ]);

      return {
        total: totalUsers,
        active: activeUsers,
        byRole: {
          inspector: inspectorCount,
          factoryAdmin: factoryAdminCount,
          superAdmin: superAdminCount
        },
        activeRate: totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0
      };
    } catch (error) {
      console.error('获取用户统计失败:', error);
      throw new Error('获取用户统计失败');
    }
  }

  /**
   * 删除用户
   * @param {number} userId - 用户ID
   * @param {number} userFactoryId - 操作者厂区ID
   * @param {string} userRole - 操作者角色
   * @returns {Promise<Object>} 删除结果
   */
  async deleteUser(userId, userFactoryId = null, userRole = null) {
    try {
      // 检查用户是否存在
      const targetUser = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          factory: true,
          _count: {
            select: {
              inspectionLogs: true,
              reportedIssues: true,
              handledIssues: true,
              auditedIssues: true,
              auditLogs: true,
              securityLogs: true,
              errorLogs: true,
              roles: true,
              userPermissions: true
            }
          }
        }
      });

      if (!targetUser) {
        throw new Error('用户不存在');
      }

      // 数据隔离检查：厂区管理员只能删除自己授权厂区的用户（支持多厂区）
      if (userRole === 'FACTORY_ADMIN') {
        if (Array.isArray(userFactoryId) && userFactoryId.length > 0) {
          if (!userFactoryId.includes(targetUser.factoryId)) {
            throw new Error('无权删除此用户');
          }
        } else if (userFactoryId && targetUser.factoryId !== userFactoryId) {
          throw new Error('无权删除此用户');
        }
      }

      // 检查是否存在业务关联数据
      const businessDataCount = 
        targetUser._count.inspectionLogs + 
        targetUser._count.reportedIssues + 
        targetUser._count.handledIssues + 
        targetUser._count.auditedIssues;

      if (businessDataCount > 0) {
        throw new Error(`该用户存在关联的业务数据（点检记录: ${targetUser._count.inspectionLogs}，隐患报告: ${targetUser._count.reportedIssues}，处理隐患: ${targetUser._count.handledIssues}，审核隐患: ${targetUser._count.auditedIssues}），不能直接删除`);
      }

      // 开启事务删除用户及其相关数据
      const result = await this.prisma.$transaction(async (prisma) => {
        // 删除用户权限数据
        await prisma.userPermission.deleteMany({
          where: { userId }
        });

        await prisma.userRole.deleteMany({
          where: { userId }
        });

        await prisma.permissionLog.deleteMany({
          where: { 
            OR: [
              { targetUserId: userId },
              { operatorId: userId }
            ]
          }
        });

        // 删除用户令牌黑名单
        await prisma.tokenBlacklist.deleteMany({
          where: { userId }
        });

        // 删除审计和日志记录（非业务数据）
        await prisma.auditLog.deleteMany({
          where: { userId }
        });

        await prisma.securityLog.deleteMany({
          where: { userId }
        });

        await prisma.errorLog.deleteMany({
          where: { userId }
        });

        // 最后删除用户
        const deletedUser = await prisma.user.delete({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            fullName: true,
            role: true,
            factory: {
              select: { name: true }
            }
          }
        });

        return deletedUser;
      });

      console.log(`用户删除成功: ${result.username} (${result.fullName})`);
      
      return {
        success: true,
        deletedUser: result,
        message: '用户及其相关数据已成功删除'
      };

    } catch (error) {
      console.error('删除用户失败:', error);
      throw error;
    }
  }
}

module.exports = UserService;
