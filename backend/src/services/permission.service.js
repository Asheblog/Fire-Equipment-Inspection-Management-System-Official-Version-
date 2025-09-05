const { PrismaClient } = require('@prisma/client');

/**
 * 权限管理服务
 * 处理角色、权限、用户权限的业务逻辑
 */

class PermissionService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * 获取所有权限列表
   */
  async getAllPermissions(filters = {}) {
    const where = {};
    
    if (filters.module) where.module = filters.module;
    if (filters.category) where.category = filters.category;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    return await this.prisma.permission.findMany({
      where,
      orderBy: [
        { module: 'asc' },
        { category: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' }
      ]
    });
  }

  /**
   * 获取权限分组信息
   */
  async getPermissionModules() {
    const permissions = await this.prisma.permission.findMany({
      where: { isActive: true },
      select: { module: true, category: true },
      distinct: ['module', 'category']
    });

    const modules = {};
    permissions.forEach(p => {
      if (!modules[p.module]) {
        modules[p.module] = new Set();
      }
      modules[p.module].add(p.category);
    });

    // 转换Set为Array
    Object.keys(modules).forEach(module => {
      modules[module] = Array.from(modules[module]);
    });

    return modules;
  }

  /**
   * 创建权限
   */
  async createPermission(permissionData) {
    return await this.prisma.permission.create({
      data: permissionData
    });
  }

  /**
   * 更新权限
   */
  async updatePermission(id, permissionData) {
    return await this.prisma.permission.update({
      where: { id },
      data: permissionData
    });
  }

  /**
   * 删除权限
   */
  async deletePermission(id) {
    return await this.prisma.permission.delete({
      where: { id }
    });
  }

  /**
   * 获取所有角色列表
   */
  async getAllRoles(filters = {}) {
    const where = {};
    
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.isSystem !== undefined) where.isSystem = filters.isSystem;

    return await this.prisma.role.findMany({
      where,
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        },
        userRoles: {
          include: {
            user: {
              select: { id: true, username: true, fullName: true }
            }
          }
        }
      },
      orderBy: [
        { level: 'desc' },
        { name: 'asc' }
      ]
    });
  }

  /**
   * 创建角色
   */
  async createRole(roleData) {
    return await this.prisma.role.create({
      data: roleData,
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        }
      }
    });
  }

  /**
   * 更新角色
   */
  async updateRole(id, roleData) {
    return await this.prisma.role.update({
      where: { id },
      data: roleData,
      include: {
        rolePermissions: {
          include: {
            permission: true
          }
        }
      }
    });
  }

  /**
   * 删除角色
   */
  async deleteRole(id) {
    // 检查角色是否被用户使用
    const userCount = await this.prisma.userRole.count({
      where: { roleId: id }
    });

    if (userCount > 0) {
      throw new Error('无法删除正在使用的角色');
    }

    return await this.prisma.role.delete({
      where: { id }
    });
  }

  /**
   * 设置角色权限
   */
  async setRolePermissions(roleId, permissionIds, operatorId) {
    return await this.prisma.$transaction(async (tx) => {
      // 获取角色当前权限
      const currentPermissions = await tx.rolePermission.findMany({
        where: { roleId },
        include: { permission: true }
      });

      // 删除旧的权限关联
      await tx.rolePermission.deleteMany({
        where: { roleId }
      });

      // 创建新的权限关联
      const rolePermissions = permissionIds.map(permissionId => ({
        roleId,
        permissionId
      }));

      await tx.rolePermission.createMany({
        data: rolePermissions
      });

      // 记录权限变更日志 - 为所有拥有该角色的用户创建日志记录
      const role = await tx.role.findUnique({ where: { id: roleId } });
      const newPermissions = await tx.permission.findMany({
        where: { id: { in: permissionIds } }
      });

      // 获取所有拥有该角色的用户
      const usersWithRole = await tx.userRole.findMany({
        where: { roleId },
        include: { user: true }
      });

      // 为每个拥有该角色的用户创建权限变更日志
      const permissionLogs = usersWithRole.map(userRole => ({
        actionType: 'UPDATE_ROLE_PERMISSIONS',
        targetUserId: userRole.userId,
        operatorId,
        roleId,
        oldValue: JSON.stringify(currentPermissions.map(p => ({
          id: p.permission.id,
          code: p.permission.code,
          name: p.permission.name
        }))),
        newValue: JSON.stringify(newPermissions.map(p => ({
          id: p.id,
          code: p.code,
          name: p.name
        }))),
        reason: `更新角色 ${role.name} 的权限，影响用户: ${userRole.user.username}`,
        factoryId: userRole.user.factoryId
      }));

      // 批量创建权限日志记录
      if (permissionLogs.length > 0) {
        await tx.permissionLog.createMany({
          data: permissionLogs
        });
        
        console.log(`为角色 ${role.name} 的权限更新创建了 ${permissionLogs.length} 条日志记录`);
      } else {
        // 如果没有用户拥有该角色，仍然需要创建一条系统级日志
        // 使用操作者作为目标，但在reason中说明这是角色级别的更改
        await tx.permissionLog.create({
          data: {
            actionType: 'UPDATE_ROLE_PERMISSIONS',
            targetUserId: operatorId,
            operatorId,
            roleId,
            oldValue: JSON.stringify(currentPermissions.map(p => ({
              id: p.permission.id,
              code: p.permission.code,
              name: p.permission.name
            }))),
            newValue: JSON.stringify(newPermissions.map(p => ({
              id: p.id,
              code: p.code,
              name: p.name
            }))),
            reason: `更新角色 ${role.name} 的权限（角色模板更新，当前无用户使用该角色）`
          }
        });
      }

      return await tx.role.findUnique({
        where: { id: roleId },
        include: {
          rolePermissions: {
            include: {
              permission: true
            }
          }
        }
      });
    });
  }

  /**
   * 获取用户权限信息
   */
  async getUserPermissions(userId) {
    console.log('🔍 [PermissionService] 开始查询用户权限:', { userId });
    
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
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

    console.log('📊 [PermissionService] 数据库查询结果:', {
      user: user ? {
        id: user.id,
        username: user.username,
        role: user.role,
        factoryId: user.factoryId,
        rolesCount: user.roles?.length || 0,
        userPermissionsCount: user.userPermissions?.length || 0
      } : null
    });

    if (!user) {
      console.log('❌ [PermissionService] 用户不存在');
      throw new Error('用户不存在');
    }

    // 构建权限继承关系
    const rolePermissions = new Map();
    if (user.roles && user.roles.length > 0) {
      console.log('👥 [PermissionService] 处理用户角色权限:', {
        rolesData: user.roles.map(ur => ({
          roleId: ur.role.id,
          roleName: ur.role.name,
          roleCode: ur.role.code,
          permissionsCount: ur.role.rolePermissions?.length || 0
        }))
      });

      user.roles.forEach(userRole => {
        userRole.role.rolePermissions.forEach(rolePermission => {
          const permission = rolePermission.permission;
          if (permission.isActive) {
            rolePermissions.set(permission.id, {
              ...permission,
              source: 'role',
              roleName: userRole.role.name,
              roleCode: userRole.role.code
            });
          }
        });
      });
    }

    // 应用个人权限覆盖
    const finalPermissions = new Map(rolePermissions);
    const personalPermissions = [];

    if (user.userPermissions && user.userPermissions.length > 0) {
      console.log('👤 [PermissionService] 处理用户个人权限:', {
        personalPermissionsData: user.userPermissions.map(up => ({
          permissionId: up.permission.id,
          permissionCode: up.permission.code,
          permissionName: up.permission.name,
          isGranted: up.isGranted,
          isActive: up.permission.isActive
        }))
      });

      user.userPermissions.forEach(userPermission => {
        const permission = userPermission.permission;
        
        // 检查是否过期
        if (userPermission.expiresAt && new Date() > userPermission.expiresAt) {
          return;
        }

        personalPermissions.push({
          ...permission,
          isGranted: userPermission.isGranted,
          grantedAt: userPermission.grantedAt,
          expiresAt: userPermission.expiresAt,
          reason: userPermission.reason,
          source: 'user'
        });

        if (userPermission.isGranted) {
          finalPermissions.set(permission.id, {
            ...permission,
            source: 'user',
            grantedAt: userPermission.grantedAt,
            expiresAt: userPermission.expiresAt
          });
        } else {
          finalPermissions.delete(permission.id);
        }
      });
    }

    const effectivePermissions = Array.from(finalPermissions.values());
    const allPermissions = effectivePermissions.map(p => p.code);

    const result = {
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role
      },
      roles: user.roles.map(ur => ur.role),
      effectivePermissions,
      personalPermissions,
      rolePermissions: Array.from(rolePermissions.values()),
      allPermissions // 添加这个字段供auth.service.js使用
    };

    console.log('✅ [PermissionService] 权限处理完成:', {
      totalRoles: result.roles.length,
      totalRolePermissions: result.rolePermissions.length,
      totalPersonalPermissions: result.personalPermissions.length,
      totalEffectivePermissions: result.effectivePermissions.length,
      allPermissionCodes: result.allPermissions,
      summary: `用户${user.username}(ID:${userId})拥有${result.allPermissions.length}个权限`
    });

    return result;
  }

  /**
   * 为用户分配角色
   */
  async assignUserRole(userId, roleId, operatorId, options = {}) {
    return await this.prisma.$transaction(async (tx) => {
      // 检查是否已存在
      const existing = await tx.userRole.findUnique({
        where: {
          userId_roleId: { userId, roleId }
        }
      });

      if (existing) {
        throw new Error('用户已拥有此角色');
      }

      // 创建用户角色关联
      const userRole = await tx.userRole.create({
        data: {
          userId,
          roleId,
          grantedBy: operatorId,
          expiresAt: options.expiresAt
        }
      });

      // 记录权限变更日志
      const role = await tx.role.findUnique({ where: { id: roleId } });
      await tx.permissionLog.create({
        data: {
          actionType: 'GRANT_ROLE',
          targetUserId: userId,
          operatorId,
          roleId,
          newValue: JSON.stringify({
            roleId,
            roleName: role.name,
            roleCode: role.code
          }),
          reason: options.reason || `分配角色: ${role.name}`
        }
      });

      return userRole;
    });
  }

  /**
   * 撤销用户角色
   */
  async revokeUserRole(userId, roleId, operatorId, reason) {
    return await this.prisma.$transaction(async (tx) => {
      // 删除用户角色关联
      const userRole = await tx.userRole.delete({
        where: {
          userId_roleId: { userId, roleId }
        }
      });

      // 记录权限变更日志
      const role = await tx.role.findUnique({ where: { id: roleId } });
      await tx.permissionLog.create({
        data: {
          actionType: 'REVOKE_ROLE',
          targetUserId: userId,
          operatorId,
          roleId,
          oldValue: JSON.stringify({
            roleId,
            roleName: role.name,
            roleCode: role.code
          }),
          reason: reason || `撤销角色: ${role.name}`
        }
      });

      return userRole;
    });
  }

  /**
   * 授予用户个人权限
   */
  async grantUserPermission(userId, permissionId, operatorId, options = {}) {
    return await this.prisma.$transaction(async (tx) => {
      // 创建或更新用户权限
      const userPermission = await tx.userPermission.upsert({
        where: {
          userId_permissionId: { userId, permissionId }
        },
        update: {
          isGranted: true,
          grantedAt: new Date(),
          grantedBy: operatorId,
          expiresAt: options.expiresAt,
          reason: options.reason
        },
        create: {
          userId,
          permissionId,
          isGranted: true,
          grantedBy: operatorId,
          expiresAt: options.expiresAt,
          reason: options.reason
        }
      });

      // 记录权限变更日志
      const permission = await tx.permission.findUnique({ where: { id: permissionId } });
      await tx.permissionLog.create({
        data: {
          actionType: 'GRANT_PERMISSION',
          targetUserId: userId,
          operatorId,
          permissionId,
          newValue: JSON.stringify({
            permissionId,
            permissionCode: permission.code,
            permissionName: permission.name,
            isGranted: true
          }),
          reason: options.reason || `授予权限: ${permission.name}`
        }
      });

      return userPermission;
    });
  }

  /**
   * 撤销用户个人权限
   */
  async revokeUserPermission(userId, permissionId, operatorId, reason) {
    return await this.prisma.$transaction(async (tx) => {
      const userPermission = await tx.userPermission.upsert({
        where: {
          userId_permissionId: { userId, permissionId }
        },
        update: {
          isGranted: false,
          grantedAt: new Date(),
          grantedBy: operatorId,
          reason
        },
        create: {
          userId,
          permissionId,
          isGranted: false,
          grantedBy: operatorId,
          reason
        }
      });

      // 记录权限变更日志
      const permission = await tx.permission.findUnique({ where: { id: permissionId } });
      await tx.permissionLog.create({
        data: {
          actionType: 'REVOKE_PERMISSION',
          targetUserId: userId,
          operatorId,
          permissionId,
          oldValue: JSON.stringify({
            permissionId,
            permissionCode: permission.code,
            permissionName: permission.name,
            isGranted: false
          }),
          reason: reason || `撤销权限: ${permission.name}`
        }
      });

      return userPermission;
    });
  }

  /**
   * 获取权限变更日志
   */
  async getPermissionLogs(filters = {}) {
    const where = {};
    
    if (filters.targetUserId) where.targetUserId = filters.targetUserId;
    if (filters.operatorId) where.operatorId = filters.operatorId;
    if (filters.actionType) where.actionType = filters.actionType;
    if (filters.factoryId) where.factoryId = filters.factoryId;
    
    if (filters.startDate && filters.endDate) {
      where.timestamp = {
        gte: new Date(filters.startDate),
        lte: new Date(filters.endDate)
      };
    }

    const logs = await this.prisma.permissionLog.findMany({
      where,
      include: {
        targetUser: {
          select: { id: true, username: true, fullName: true }
        },
        operator: {
          select: { id: true, username: true, fullName: true }
        },
        role: {
          select: { id: true, code: true, name: true }
        },
        permission: {
          select: { id: true, code: true, name: true, module: true }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: filters.limit || 100,
      skip: filters.offset || 0
    });

    const total = await this.prisma.permissionLog.count({ where });

    return {
      logs,
      total,
      limit: filters.limit || 100,
      offset: filters.offset || 0
    };
  }

  /**
   * 权限统计信息
   */
  async getPermissionStats() {
    const [
      totalPermissions,
      totalRoles,
      activeRoles,
      permissionsByModule,
      rolesByLevel
    ] = await Promise.all([
      this.prisma.permission.count({ where: { isActive: true } }),
      this.prisma.role.count(),
      this.prisma.role.count({ where: { isActive: true } }),
      this.prisma.permission.groupBy({
        by: ['module'],
        where: { isActive: true },
        _count: true
      }),
      this.prisma.role.groupBy({
        by: ['level'],
        where: { isActive: true },
        _count: true
      })
    ]);

    return {
      totalPermissions,
      totalRoles,
      activeRoles,
      permissionsByModule: permissionsByModule.reduce((acc, item) => {
        acc[item.module] = item._count;
        return acc;
      }, {}),
      rolesByLevel: rolesByLevel.reduce((acc, item) => {
        acc[`level${item.level}`] = item._count;
        return acc;
      }, {})
    };
  }

  /**
   * 批量权限操作
   */
  async batchPermissionOperation(operations, operatorId) {
    return await this.prisma.$transaction(async (tx) => {
      const results = [];

      for (const operation of operations) {
        const { type, userId, roleId, permissionId, options = {} } = operation;

        try {
          let result;
          switch (type) {
            case 'ASSIGN_ROLE':
              result = await this.assignUserRole(userId, roleId, operatorId, options);
              break;
            case 'REVOKE_ROLE':
              result = await this.revokeUserRole(userId, roleId, operatorId, options.reason);
              break;
            case 'GRANT_PERMISSION':
              result = await this.grantUserPermission(userId, permissionId, operatorId, options);
              break;
            case 'REVOKE_PERMISSION':
              result = await this.revokeUserPermission(userId, permissionId, operatorId, options.reason);
              break;
            default:
              throw new Error(`未知的操作类型: ${type}`);
          }

          results.push({
            operation,
            success: true,
            result
          });
        } catch (error) {
          results.push({
            operation,
            success: false,
            error: error.message
          });
        }
      }

      return results;
    });
  }
}

module.exports = PermissionService;