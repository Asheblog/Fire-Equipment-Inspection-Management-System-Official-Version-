import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function cleanDatabase() {
  console.log('🧹 开始清理数据库，只保留默认用户...')

  try {
    // 1. 清理所有业务数据（按依赖关系顺序）
    console.log('📝 清理点检记录...')
    await prisma.inspectionLog.deleteMany()
    console.log('✅ 点检记录已清理')

    console.log('📝 清理隐患记录...')
    await prisma.issue.deleteMany()
    console.log('✅ 隐患记录已清理')

    console.log('📝 清理消防器材...')
    await prisma.equipment.deleteMany()
    console.log('✅ 消防器材已清理')

    console.log('📝 清理点检项模板...')
    await prisma.checklistTemplate.deleteMany()
    console.log('✅ 点检项模板已清理')

    console.log('📝 清理器材类型...')
    await prisma.equipmentType.deleteMany()
    console.log('✅ 器材类型已清理')

    console.log('📝 清理审计日志...')
    await prisma.auditLog.deleteMany()
    console.log('✅ 审计日志已清理')

    console.log('📝 清理安全日志...')
    await prisma.securityLog.deleteMany()
    console.log('✅ 安全日志已清理')

    console.log('📝 清理错误日志...')
    await prisma.errorLog.deleteMany()
    console.log('✅ 错误日志已清理')

    console.log('📝 清理权限管理相关数据...')
    await prisma.permissionLog.deleteMany()
    await prisma.userPermission.deleteMany()
    await prisma.userRole.deleteMany()
    await prisma.rolePermission.deleteMany()
    await prisma.role.deleteMany()
    await prisma.permission.deleteMany()
    console.log('✅ 权限管理数据已清理')

    // 2. 删除所有用户（稍后重新创建超级管理员）
    console.log('📝 清理用户数据...')
    await prisma.user.deleteMany()
    console.log('✅ 用户数据已清理')

    // 3. 清理厂区数据
    console.log('📝 清理厂区数据...')
    await prisma.factory.deleteMany()
    console.log('✅ 厂区数据已清理')

    // 4. 重新创建一个默认厂区和超级管理员
    console.log('📝 创建默认厂区...')
    const defaultFactory = await prisma.factory.create({
      data: {
        name: '默认厂区',
        address: '请根据实际情况修改厂区信息'
      }
    })
    console.log('✅ 默认厂区已创建')

    console.log('📝 创建超级管理员...')
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
    console.log('✅ 超级管理员已创建')

    console.log('')
    console.log('🎉 数据库清理完成!')
    console.log('📊 保留数据汇总:')
    console.log(`   - 厂区: 1 个（默认厂区）`)
    console.log(`   - 用户: 1 个（超级管理员）`)
    console.log(`   - 其他业务数据: 0 条`)
    console.log('')
    console.log('🔑 默认账号:')
    console.log('   - 超级管理员: admin / Test123!@#')
    console.log('')
    console.log('💡 提示: 您可以使用管理员账号登录后添加厂区、用户和其他基础数据')

  } catch (error) {
    console.error('❌ 清理过程中发生错误:', error)
    throw error
  }
}

cleanDatabase()
  .catch((e) => {
    console.error('❌ 数据库清理失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })