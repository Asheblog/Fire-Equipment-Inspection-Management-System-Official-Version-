const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function verifyData() {
  console.log('🔍 验证数据清理结果...\n')

  try {
    const userCount = await prisma.user.count()
    const factoryCount = await prisma.factory.count()
    const equipmentCount = await prisma.equipment.count()
    const inspectionCount = await prisma.inspectionLog.count()
    const issueCount = await prisma.issue.count()
    const equipmentTypeCount = await prisma.equipmentType.count()
    const checklistTemplateCount = await prisma.checklistTemplate.count()

    console.log('📊 当前数据统计:')
    console.log(`   - 厂区数量: ${factoryCount}`)
    console.log(`   - 用户数量: ${userCount}`)
    console.log(`   - 器材类型: ${equipmentTypeCount}`)
    console.log(`   - 点检项模板: ${checklistTemplateCount}`)
    console.log(`   - 器材设备: ${equipmentCount}`)
    console.log(`   - 点检记录: ${inspectionCount}`)
    console.log(`   - 隐患记录: ${issueCount}`)

    console.log('\n👥 保留的用户账户:')
    const users = await prisma.user.findMany({
      include: { factory: true },
      orderBy: [{ role: 'desc' }, { username: 'asc' }]
    })

    for (const user of users) {
      console.log(`   - ${user.username} (${user.fullName}) - ${user.role} - ${user.factory.name}`)
    }

    console.log('\n🏭 厂区信息:')
    const factories = await prisma.factory.findMany()
    for (const factory of factories) {
      console.log(`   - ${factory.name}: ${factory.address || '暂无地址'}`)
    }

    if (equipmentCount === 0 && inspectionCount === 0 && issueCount === 0) {
      console.log('\n✅ 数据清理成功！系统已重置为零数据状态，仅保留基础配置和默认测试账户。')
    } else {
      console.log('\n⚠️  警告：仍有虚拟数据未清理完成。')
    }

  } catch (error) {
    console.error('❌ 验证失败:', error)
  } finally {
    await prisma.$disconnect()
  }
}

verifyData()