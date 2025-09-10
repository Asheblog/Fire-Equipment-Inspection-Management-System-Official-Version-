const { PrismaClient } = require('@prisma/client');

/**
 * 消防器材点检系统 - 权限数据初始化脚本
 * 
 * 功能：
 * 1. 初始化系统权限定义
 * 2. 创建预设角色模板
 * 3. 迁移现有用户权限数据
 * 4. 建立权限继承关系
 */

class PermissionInitializer {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * 系统权限定义
   */
  static SYSTEM_PERMISSIONS = [
    // === 设备管理模块 ===
    { 
      code: 'equipment:read', 
      name: '查看设备', 
      description: '查看消防设备台账信息',
      module: 'equipment', 
      category: 'MODULE', 
      level: 1, 
      sortOrder: 1 
    },
    { 
      code: 'equipment:create', 
      name: '新增设备', 
      description: '添加新的消防设备记录',
      module: 'equipment', 
      category: 'MODULE', 
      level: 2, 
      sortOrder: 2 
    },
    { 
      code: 'equipment:update', 
      name: '编辑设备', 
      description: '修改消防设备信息',
      module: 'equipment', 
      category: 'MODULE', 
      level: 2, 
      sortOrder: 3 
    },
    { 
      code: 'equipment:delete', 
      name: '删除设备', 
      description: '删除消防设备记录',
      module: 'equipment', 
      category: 'MODULE', 
      level: 3, 
      sortOrder: 4 
    },
    { 
      code: 'equipment:export', 
      name: '导出设备', 
      description: '导出设备数据',
      module: 'equipment', 
      category: 'DATA', 
      level: 2, 
      sortOrder: 5 
    },
    { 
      code: 'equipment:import', 
      name: '导入设备', 
      description: '批量导入设备数据',
      module: 'equipment', 
      category: 'DATA', 
      level: 3, 
      sortOrder: 6 
    },
    { 
      code: 'equipment:qrcode', 
      name: '生成二维码', 
      description: '生成设备二维码',
      module: 'equipment', 
      category: 'MODULE', 
      level: 2, 
      sortOrder: 7 
    },

    // === 点检管理模块 ===
    { 
      code: 'inspection:read', 
      name: '查看点检记录', 
      description: '查看设备点检记录',
      module: 'inspection', 
      category: 'MODULE', 
      level: 1, 
      sortOrder: 10 
    },
    { 
      code: 'inspection:create', 
      name: '执行点检', 
      description: '执行设备点检操作',
      module: 'inspection', 
      category: 'MODULE', 
      level: 1, 
      sortOrder: 11 
    },
    { 
      code: 'inspection:stats', 
      name: '点检统计', 
      description: '查看点检统计数据',
      module: 'inspection', 
      category: 'DATA', 
      level: 2, 
      sortOrder: 12 
    },
    { 
      code: 'inspection:export', 
      name: '导出点检记录', 
      description: '导出点检数据',
      module: 'inspection', 
      category: 'DATA', 
      level: 2, 
      sortOrder: 13 
    },
    { 
      code: 'inspection:delete', 
      name: '删除点检记录', 
      description: '删除设备点检记录及关联数据',
      module: 'inspection', 
      category: 'MODULE', 
      level: 3, 
      sortOrder: 14 
    },

    // === 隐患管理模块 ===
    { 
      code: 'issue:read', 
      name: '查看隐患', 
      description: '查看安全隐患记录',
      module: 'issue', 
      category: 'MODULE', 
      level: 1, 
      sortOrder: 20 
    },
    { 
      code: 'issue:create', 
      name: '上报隐患', 
      description: '上报新的安全隐患',
      module: 'issue', 
      category: 'MODULE', 
      level: 1, 
      sortOrder: 21 
    },
    { 
      code: 'issue:handle', 
      name: '处理隐患', 
      description: '处理和整改隐患',
      module: 'issue', 
      category: 'MODULE', 
      level: 2, 
      sortOrder: 22 
    },
    { 
      code: 'issue:audit', 
      name: '审核隐患', 
      description: '审核隐患处理结果',
      module: 'issue', 
      category: 'MODULE', 
      level: 3, 
      sortOrder: 23 
    },
    { 
      code: 'issue:stats', 
      name: '隐患统计', 
      description: '查看隐患统计数据',
      module: 'issue', 
      category: 'DATA', 
      level: 2, 
      sortOrder: 24 
    },

    // === 用户管理模块 ===
    { 
      code: 'user:read', 
      name: '查看用户', 
      description: '查看系统用户信息',
      module: 'user', 
      category: 'MODULE', 
      level: 2, 
      sortOrder: 30 
    },
    { 
      code: 'user:create', 
      name: '新增用户', 
      description: '创建新用户账号',
      module: 'user', 
      category: 'MODULE', 
      level: 3, 
      sortOrder: 31 
    },
    { 
      code: 'user:update', 
      name: '编辑用户', 
      description: '修改用户信息',
      module: 'user', 
      category: 'MODULE', 
      level: 3, 
      sortOrder: 32 
    },
    { 
      code: 'user:delete', 
      name: '删除用户', 
      description: '删除用户账号',
      module: 'user', 
      category: 'MODULE', 
      level: 3, 
      sortOrder: 33 
    },
    { 
      code: 'user:reset_password', 
      name: '重置密码', 
      description: '重置用户密码',
      module: 'user', 
      category: 'MODULE', 
      level: 3, 
      sortOrder: 34 
    },

    // === 权限管理模块 ===
    { 
      code: 'permission:read', 
      name: '查看权限', 
      description: '查看权限和角色信息',
      module: 'permission', 
      category: 'SYSTEM', 
      level: 3, 
      sortOrder: 40 
    },
    { 
      code: 'permission:manage', 
      name: '管理权限', 
      description: '管理用户权限和角色',
      module: 'permission', 
      category: 'SYSTEM', 
      level: 3, 
      sortOrder: 41 
    },
    { 
      code: 'permission:assign', 
      name: '分配权限', 
      description: '分配用户角色和权限',
      module: 'permission', 
      category: 'SYSTEM', 
      level: 3, 
      sortOrder: 42 
    },

    // === 报表管理模块 ===
    { 
      code: 'report:dashboard', 
      name: '数据看板', 
      description: '查看数据统计看板',
      module: 'report', 
      category: 'MODULE', 
      level: 2, 
      sortOrder: 50 
    },
    { 
      code: 'report:monthly', 
      name: '月度报表', 
      description: '查看月度统计报表',
      module: 'report', 
      category: 'DATA', 
      level: 2, 
      sortOrder: 51 
    },
    { 
      code: 'report:export', 
      name: '导出报表', 
      description: '导出各类统计报表',
      module: 'report', 
      category: 'DATA', 
      level: 2, 
      sortOrder: 52 
    },

    // === 系统管理模块 ===
    { 
      code: 'system:settings', 
      name: '系统设置', 
      description: '管理系统配置',
      module: 'system', 
      category: 'SYSTEM', 
      level: 3, 
      sortOrder: 60 
    },
    { 
      code: 'system:logs', 
      name: '系统日志', 
      description: '查看系统日志',
      module: 'system', 
      category: 'SYSTEM', 
      level: 3, 
      sortOrder: 61 
    },
    { 
      code: 'system:backup', 
      name: '数据备份', 
      description: '执行数据备份',
      module: 'system', 
      category: 'SYSTEM', 
      level: 3, 
      sortOrder: 62 
    }
  ];

  /**
   * 系统预设角色定义
   */
  static SYSTEM_ROLES = [
    {
      code: 'SUPER_ADMIN',
      name: '超级管理员',
      description: '拥有系统所有权限，可管理整个系统',
      level: 3,
      isSystem: true,
      isDefault: false,
      permissions: '*' // 所有权限
    },
    {
      code: 'FACTORY_ADMIN',
      name: '厂区管理员',
      description: '管理所属厂区的设备、人员和数据',
      level: 2,
      isSystem: true,
      isDefault: false,
      permissions: [
        'equipment:*',
        'inspection:read',
        'inspection:stats',
        'inspection:export',
        'issue:read',
        'issue:handle',
        'issue:audit',
        'issue:stats',
        'user:read',
        'user:create',
        'user:update',
        'user:reset_password',
        'report:dashboard',
        'report:monthly',
        'report:export'
      ]
    },
    {
      code: 'EQUIPMENT_MANAGER',
      name: '设备管理员',
      description: '专门负责设备管理和维护',
      level: 2,
      isSystem: true,
      isDefault: false,
      permissions: [
        'equipment:*',
        'inspection:read',
        'inspection:stats',
        'issue:read',
        'issue:handle',
        'report:dashboard'
      ]
    },
    {
      code: 'SAFETY_MANAGER',
      name: '安全管理员',
      description: '负责安全隐患管理和审核',
      level: 2,
      isSystem: true,
      isDefault: false,
      permissions: [
        'equipment:read',
        'inspection:read',
        'inspection:stats',
        'issue:*',
        'report:dashboard',
        'report:monthly'
      ]
    },
    {
      code: 'INSPECTOR',
      name: '点检员',
      description: '执行设备点检和隐患上报',
      level: 1,
      isSystem: true,
      isDefault: true,
      permissions: [
        'equipment:read',
        'inspection:read',
        'inspection:create',
        'issue:create',
        'issue:read',
        'issue:handle'
      ]
    },
    {
      code: 'REPORT_VIEWER',
      name: '报表查看员',
      description: '只能查看各类报表和统计数据',
      level: 1,
      isSystem: true,
      isDefault: false,
      permissions: [
        'equipment:read',
        'inspection:read',
        'inspection:stats',
        'issue:read',
        'issue:stats',
        'report:dashboard',
        'report:monthly'
      ]
    }
  ];

  /**
   * 运行初始化脚本
   */
  async run() {
    console.log('🚀 开始权限数据初始化...');
    
    try {
      // 1. 初始化权限数据
      await this.initializePermissions();
      
      // 2. 初始化角色数据  
      await this.initializeRoles();
      
      // 3. 迁移现有用户数据
      await this.migrateUserData();
      
      // 4. 创建权限审计记录
      await this.createInitialAuditLog();
      
      console.log('✅ 权限数据初始化完成！');
    } catch (error) {
      console.error('❌ 权限数据初始化失败:', error);
      throw error;
    } finally {
      await this.prisma.$disconnect();
    }
  }

  /**
   * 初始化权限数据
   */
  async initializePermissions() {
    console.log('📝 初始化权限数据...');
    
    for (const permissionData of PermissionInitializer.SYSTEM_PERMISSIONS) {
      await this.prisma.permission.upsert({
        where: { code: permissionData.code },
        update: permissionData,
        create: {
          ...permissionData,
          isSystem: true,
          isActive: true
        }
      });
    }
    
    console.log(`✅ 已初始化 ${PermissionInitializer.SYSTEM_PERMISSIONS.length} 个权限`);
  }

  /**
   * 初始化角色数据
   */
  async initializeRoles() {
    console.log('👥 初始化角色数据...');
    
    for (const roleData of PermissionInitializer.SYSTEM_ROLES) {
      const { permissions, ...roleInfo } = roleData;
      
      // 创建或更新角色
      const role = await this.prisma.role.upsert({
        where: { code: roleData.code },
        update: roleInfo,
        create: {
          ...roleInfo,
          isActive: true
        }
      });

      // 处理角色权限
      if (permissions === '*') {
        // 超级管理员拥有所有权限
        const allPermissions = await this.prisma.permission.findMany({
          where: { isActive: true }
        });
        
        await this.setRolePermissions(role.id, allPermissions.map(p => p.id));
      } else if (Array.isArray(permissions)) {
        // 根据权限模式匹配权限
        const rolePermissions = await this.resolvePermissionPatterns(permissions);
        await this.setRolePermissions(role.id, rolePermissions);
      }
    }
    
    console.log(`✅ 已初始化 ${PermissionInitializer.SYSTEM_ROLES.length} 个角色`);
  }

  /**
   * 设置角色权限
   */
  async setRolePermissions(roleId, permissionIds) {
    // 删除现有权限
    await this.prisma.rolePermission.deleteMany({
      where: { roleId }
    });
    
    // 创建新的权限关联
    const rolePermissions = permissionIds.map(permissionId => ({
      roleId,
      permissionId
    }));
    
    await this.prisma.rolePermission.createMany({
      data: rolePermissions
    });
  }

  /**
   * 解析权限模式（支持通配符）
   */
  async resolvePermissionPatterns(patterns) {
    const allPermissions = await this.prisma.permission.findMany({
      where: { isActive: true }
    });
    
    const matchedPermissions = [];
    
    for (const pattern of patterns) {
      if (pattern.endsWith(':*')) {
        // 模块级通配符
        const module = pattern.replace(':*', '');
        const modulePermissions = allPermissions
          .filter(p => p.module === module)
          .map(p => p.id);
        matchedPermissions.push(...modulePermissions);
      } else {
        // 精确匹配
        const permission = allPermissions.find(p => p.code === pattern);
        if (permission) {
          matchedPermissions.push(permission.id);
        }
      }
    }
    
    return [...new Set(matchedPermissions)]; // 去重
  }

  /**
   * 迁移现有用户数据
   */
  async migrateUserData() {
    console.log('🔄 迁移现有用户数据...');
    
    const users = await this.prisma.user.findMany({
      include: { factory: true }
    });
    
    for (const user of users) {
      // 根据用户的传统角色分配新的角色
      let newRoleCode;
      switch (user.role) {
        case 'SUPER_ADMIN':
          newRoleCode = 'SUPER_ADMIN';
          break;
        case 'FACTORY_ADMIN':
          newRoleCode = 'FACTORY_ADMIN';
          break;
        case 'INSPECTOR':
          newRoleCode = 'INSPECTOR';
          break;
        default:
          newRoleCode = 'INSPECTOR'; // 默认角色
      }
      
      const role = await this.prisma.role.findUnique({
        where: { code: newRoleCode }
      });
      
      if (role) {
        await this.prisma.userRole.upsert({
          where: {
            userId_roleId: {
              userId: user.id,
              roleId: role.id
            }
          },
          update: {},
          create: {
            userId: user.id,
            roleId: role.id,
            grantedBy: 1 // 系统用户
          }
        });
      }
    }
    
    console.log(`✅ 已迁移 ${users.length} 个用户的权限数据`);
  }

  /**
   * 创建初始审计日志
   */
  async createInitialAuditLog() {
    // 获取第一个管理员用户作为系统操作者
    const systemUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { role: 'SUPER_ADMIN' },
          { role: 'FACTORY_ADMIN' }
        ]
      }
    });

    if (systemUser) {
      await this.prisma.permissionLog.create({
        data: {
          actionType: 'SYSTEM_INIT',
          targetUserId: systemUser.id,
          operatorId: systemUser.id,
          reason: '权限系统初始化完成',
          newValue: JSON.stringify({
            message: '权限系统已成功初始化',
            permissions: PermissionInitializer.SYSTEM_PERMISSIONS.length,
            roles: PermissionInitializer.SYSTEM_ROLES.length,
            timestamp: new Date().toISOString()
          })
        }
      });
    }
  }
}

/**
 * 执行初始化脚本
 */
async function runInitialization() {
  const initializer = new PermissionInitializer();
  await initializer.run();
}

// 如果直接运行此脚本
if (require.main === module) {
  runInitialization().catch(console.error);
}

module.exports = { PermissionInitializer, runInitialization };
