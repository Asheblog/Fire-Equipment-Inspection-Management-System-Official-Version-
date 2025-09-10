import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ===== 权限处理辅助函数 =====

/**
 * 设置角色权限
 */
async function setRolePermissions(roleId: number, permissionIds: number[]) {
  // 删除现有权限
  await prisma.rolePermission.deleteMany({
    where: { roleId }
  });
  
  // 创建新的权限关联
  if (permissionIds.length > 0) {
    const rolePermissions = permissionIds.map(permissionId => ({
      roleId,
      permissionId
    }));
    
    await prisma.rolePermission.createMany({
      data: rolePermissions
    });
  }
}

/**
 * 解析权限模式（支持通配符）
 */
async function resolvePermissionPatterns(patterns: string[]): Promise<number[]> {
  const allPermissions = await prisma.permission.findMany({
    where: { isActive: true }
  });
  
  const matchedPermissions: number[] = [];
  
  for (const pattern of patterns) {
    if (pattern.endsWith(':*')) {
      // 模块级通配符
      const module = pattern.replace(':*', '');
      const modulePermissions = allPermissions
        .filter(p => p.module === module)
        .map(p => p.id);
      matchedPermissions.push(...modulePermissions);
    } else if (pattern === '*') {
      // 全部权限
      const allPermissionIds = allPermissions.map(p => p.id);
      matchedPermissions.push(...allPermissionIds);
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

// ===== 权限系统定义 =====
const SYSTEM_PERMISSIONS = [
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

const SYSTEM_ROLES = [
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

async function main() {
  console.log('🌱 开始完整数据初始化...')

  // 清理现有数据 (开发环境) - 使用安全的删除方式
  console.log('📝 清理现有数据...')
  try {
    // 按照依赖关系顺序安全删除数据
    await prisma.permissionLog.deleteMany().catch(() => console.log('⚠️  permission_logs表不存在，跳过清理'))
    await prisma.userPermission.deleteMany().catch(() => console.log('⚠️  user_permissions表不存在，跳过清理'))
    await prisma.userRole.deleteMany().catch(() => console.log('⚠️  user_roles表不存在，跳过清理'))
    await prisma.rolePermission.deleteMany().catch(() => console.log('⚠️  role_permissions表不存在，跳过清理'))
    await prisma.role.deleteMany().catch(() => console.log('⚠️  roles表不存在，跳过清理'))
    await prisma.permission.deleteMany().catch(() => console.log('⚠️  permissions表不存在，跳过清理'))
    await prisma.inspectionLog.deleteMany().catch(() => console.log('⚠️  inspection_logs表不存在，跳过清理'))
    await prisma.issue.deleteMany().catch(() => console.log('⚠️  issues表不存在，跳过清理'))
    await prisma.equipment.deleteMany().catch(() => console.log('⚠️  equipments表不存在，跳过清理'))
    await prisma.checklistTemplate.deleteMany().catch(() => console.log('⚠️  checklist_templates表不存在，跳过清理'))
    await prisma.equipmentType.deleteMany().catch(() => console.log('⚠️  equipment_types表不存在，跳过清理'))
    await prisma.auditLog.deleteMany().catch(() => console.log('⚠️  audit_logs表不存在，跳过清理'))
    await prisma.securityLog.deleteMany().catch(() => console.log('⚠️  security_logs表不存在，跳过清理'))
    await prisma.errorLog.deleteMany().catch(() => console.log('⚠️  error_logs表不存在，跳过清理'))
    await prisma.user.deleteMany().catch(() => console.log('⚠️  users表不存在，跳过清理'))
    await prisma.factory.deleteMany().catch(() => console.log('⚠️  factories表不存在，跳过清理'))
    console.log('✅ 现有数据清理完成')
  } catch (error) {
    console.log('⚠️  数据清理过程中遇到错误，继续执行初始化:', error.message)
  }

  // 创建默认厂区
  const defaultFactory = await prisma.factory.create({
    data: {
      name: '默认厂区',
      address: '请根据实际情况修改厂区信息'
    }
  })
  console.log('✅ 创建默认厂区')

  // 创建超级管理员
  const saltRounds = 10
  const defaultPassword = await bcrypt.hash('Test123!@#', saltRounds)

  const superAdmin = await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash: defaultPassword,
      fullName: '系统管理员',
      role: 'SUPER_ADMIN',
      factoryId: defaultFactory.id,
      isActive: true
    }
  })
  console.log('✅ 创建超级管理员')

  // === 权限系统初始化 ===
  console.log('🔐 开始权限系统初始化...')

  // 1. 初始化权限数据
  console.log('📝 初始化权限数据...')
  for (const permissionData of SYSTEM_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permissionData.code },
      update: permissionData,
      create: {
        ...permissionData,
        isSystem: true,
        isActive: true
      }
    });
  }
  console.log(`✅ 已初始化 ${SYSTEM_PERMISSIONS.length} 个权限`)

  // 2. 初始化角色数据
  console.log('👥 初始化角色数据...')
  for (const roleData of SYSTEM_ROLES) {
    const { permissions, ...roleInfo } = roleData;
    
    // 创建或更新角色
    const role = await prisma.role.upsert({
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
      const allPermissions = await prisma.permission.findMany({
        where: { isActive: true }
      });
      
      await setRolePermissions(role.id, allPermissions.map(p => p.id));
    } else if (Array.isArray(permissions)) {
      // 根据权限模式匹配权限
      const rolePermissions = await resolvePermissionPatterns(permissions);
      await setRolePermissions(role.id, rolePermissions);
    }
  }
  console.log(`✅ 已初始化 ${SYSTEM_ROLES.length} 个角色`)

  // 3. 为超级管理员分配角色
  console.log('🔗 为超级管理员分配角色...')
  const superAdminRole = await prisma.role.findUnique({
    where: { code: 'SUPER_ADMIN' }
  });

  if (superAdminRole) {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: superAdmin.id,
          roleId: superAdminRole.id
        }
      },
      update: {},
      create: {
        userId: superAdmin.id,
        roleId: superAdminRole.id,
        grantedBy: superAdmin.id // 自己授予自己
      }
    });
  }

  // 4. 创建权限初始化审计记录
  await prisma.permissionLog.create({
    data: {
      actionType: 'SYSTEM_INIT',
      targetUserId: superAdmin.id,
      operatorId: superAdmin.id,
      reason: '权限系统初始化完成',
      newValue: JSON.stringify({
        message: '权限系统已成功初始化',
        permissions: SYSTEM_PERMISSIONS.length,
        roles: SYSTEM_ROLES.length,
        timestamp: new Date().toISOString()
      })
    }
  });

  console.log('✅ 权限系统初始化完成')

  // 创建基础器材类型（无模拟器材）
  const equipmentTypes = await prisma.equipmentType.createMany({
    data: [
      { name: '手提式干粉灭火器' },
      { name: '推车式干粉灭火器' },
      { name: '泡沫灭火器' },
      { name: '二氧化碳灭火器' },
      { name: '室内消火栓' },
      { name: '室外消火栓' },
      { name: '消防应急照明灯' },
      { name: '安全出口指示灯' },
      { name: '消防栓箱' },
      { name: '灭火器箱' }
    ]
  })
  console.log('✅ 创建基础器材类型:', equipmentTypes.count, '个')

  // 获取创建的器材类型
  const equipmentTypeList = await prisma.equipmentType.findMany()

  // 创建点检项模板 - 手提式干粉灭火器
  const dryPowderExtinguisher = equipmentTypeList.find(t => t.name === '手提式干粉灭火器')
  if (dryPowderExtinguisher) {
    await prisma.checklistTemplate.createMany({
      data: [
        { typeId: dryPowderExtinguisher.id, itemName: '压力表指针是否在绿区', sortOrder: 1 },
        { typeId: dryPowderExtinguisher.id, itemName: '筒体是否有锈蚀、变形', sortOrder: 2 },
        { typeId: dryPowderExtinguisher.id, itemName: '喷嘴是否畅通', sortOrder: 3 },
        { typeId: dryPowderExtinguisher.id, itemName: '保险销是否完好', sortOrder: 4 },
        { typeId: dryPowderExtinguisher.id, itemName: '标签和检验标识是否清晰', sortOrder: 5 },
        { typeId: dryPowderExtinguisher.id, itemName: '放置位置是否正确', sortOrder: 6 }
      ]
    })
  }

  // 创建点检项模板 - 室内消火栓
  const indoorHydrant = equipmentTypeList.find(t => t.name === '室内消火栓')
  if (indoorHydrant) {
    await prisma.checklistTemplate.createMany({
      data: [
        { typeId: indoorHydrant.id, itemName: '栓头是否完好无损', sortOrder: 1 },
        { typeId: indoorHydrant.id, itemName: '水带是否完整无破损', sortOrder: 2 },
        { typeId: indoorHydrant.id, itemName: '水枪是否齐全', sortOrder: 3 },
        { typeId: indoorHydrant.id, itemName: '箱门开启是否正常', sortOrder: 4 },
        { typeId: indoorHydrant.id, itemName: '水压是否正常', sortOrder: 5 },
        { typeId: indoorHydrant.id, itemName: '周围是否有遮挡物', sortOrder: 6 }
      ]
    })
  }

  // 创建点检项模板 - 消防应急照明灯
  const emergencyLight = equipmentTypeList.find(t => t.name === '消防应急照明灯')
  if (emergencyLight) {
    await prisma.checklistTemplate.createMany({
      data: [
        { typeId: emergencyLight.id, itemName: '灯具外观是否完好', sortOrder: 1 },
        { typeId: emergencyLight.id, itemName: '正常照明功能是否正常', sortOrder: 2 },
        { typeId: emergencyLight.id, itemName: '应急照明功能是否正常', sortOrder: 3 },
        { typeId: emergencyLight.id, itemName: '电池指示灯是否正常', sortOrder: 4 },
        { typeId: emergencyLight.id, itemName: '安装是否牢固', sortOrder: 5 }
      ]
    })
  }

  console.log('✅ 创建点检项模板完成')

  console.log('')
  console.log('🎉 完整数据初始化完成!')
  console.log('📊 数据汇总:')
  console.log(`   - 厂区: 1 个（默认厂区）`)
  console.log(`   - 用户: 1 个（超级管理员）`)
  console.log(`   - 权限: ${SYSTEM_PERMISSIONS.length} 个（系统权限）`)
  console.log(`   - 角色: ${SYSTEM_ROLES.length} 个（系统角色）`)
  console.log(`   - 器材类型: ${equipmentTypes.count} 个`)
  console.log(`   - 点检项模板: 已创建常用器材的检查项`)
  console.log(`   - 消防器材: 0 个（需要手动添加）`)
  console.log(`   - 点检记录: 0 条`)
  console.log(`   - 隐患记录: 0 条`)
  console.log('')
  console.log('🔑 默认账号:')
  console.log('   - 超级管理员: admin / Test123!@# （拥有完整系统权限）')
  console.log('')
  console.log('🔐 权限系统:')
  console.log('   - 超级管理员已自动分配完整权限')
  console.log('   - 支持6种预设角色：超级管理员、厂区管理员、设备管理员、安全管理员、点检员、报表查看员')
  console.log('   - 支持30+个细粒度权限控制')
  console.log('   - 权限管理功能已激活，可在系统中直接使用')
  console.log('')
  console.log('💡 使用提示:')
  console.log('   1. 使用超级管理员账号登录系统')
  console.log('   2. 权限管理功能已完全就绪，可直接管理用户权限')
  console.log('   3. 根据实际情况修改默认厂区信息')
  console.log('   4. 创建所需的厂区管理员和点检员账号')
  console.log('   5. 添加实际的消防器材台账')
  console.log('   6. 开始正常的点检作业流程')
}

main()
  .catch((e) => {
    console.error('❌ 完整数据初始化失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
