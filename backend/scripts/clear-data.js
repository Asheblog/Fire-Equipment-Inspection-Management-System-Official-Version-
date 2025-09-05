const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function clearData() {
  console.log('🧹 开始清理虚拟数据，保留默认测试账户...')

  try {
    // 1. 删除点检记录（必须先删除，因为有外键约束）
    const deletedInspectionLogs = await prisma.inspectionLog.deleteMany()
    console.log(`✅ 清理点检记录: ${deletedInspectionLogs.count} 条`)

    // 2. 删除隐患记录
    const deletedIssues = await prisma.issue.deleteMany()
    console.log(`✅ 清理隐患记录: ${deletedIssues.count} 条`)

    // 3. 删除所有器材设备
    const deletedEquipments = await prisma.equipment.deleteMany()
    console.log(`✅ 清理器材设备: ${deletedEquipments.count} 个`)

    // 4. 保留默认测试账户，删除其他用户
    const defaultUsernames = [
      'admin',           // 超级管理员
      'admin_a',         // A厂区管理员  
      'admin_b',         // B厂区管理员
      'admin_c',         // C厂区管理员
      'inspector_001',   // 点检员
      'inspector_002',   // 点检员
      'inspector_003',   // 点检员
      'inspector_004'    // 点检员
    ]

    const deletedUsers = await prisma.user.deleteMany({
      where: {
        username: {
          notIn: defaultUsernames
        }
      }
    })
    console.log(`✅ 清理非默认用户: ${deletedUsers.count} 个`)

    // 5. 清理上传的文件目录（如果存在）
    const fs = require('fs')
    const path = require('path')
    
    const uploadsDir = path.join(__dirname, '../uploads')
    if (fs.existsSync(uploadsDir)) {
      const subdirs = ['inspections', 'issues', 'fixes', 'equipment']
      for (const subdir of subdirs) {
        const fullPath = path.join(uploadsDir, subdir)
        if (fs.existsSync(fullPath)) {
          const files = fs.readdirSync(fullPath)
          for (const file of files) {
            fs.unlinkSync(path.join(fullPath, file))
          }
          console.log(`✅ 清理上传文件目录: ${subdir} (${files.length} 个文件)`)
        }
      }
    }

    console.log('\n🎉 数据清理完成!')
    console.log('📊 保留的数据:')
    
    // 统计保留的数据
    const factoryCount = await prisma.factory.count()
    const userCount = await prisma.user.count()
    const equipmentTypeCount = await prisma.equipmentType.count()
    const checklistTemplateCount = await prisma.checklistTemplate.count()
    
    console.log(`   - 厂区: ${factoryCount} 个`)
    console.log(`   - 用户: ${userCount} 个`)
    console.log(`   - 器材类型: ${equipmentTypeCount} 个`)
    console.log(`   - 点检项模板: ${checklistTemplateCount} 个`)
    console.log(`   - 器材设备: 0 个`)
    console.log(`   - 点检记录: 0 条`)
    console.log(`   - 隐患记录: 0 条`)
    
    console.log('\n🔑 保留的默认测试账户:')
    const users = await prisma.user.findMany({
      include: {
        factory: true
      },
      orderBy: [
        { role: 'desc' },
        { username: 'asc' }
      ]
    })
    
    for (const user of users) {
      console.log(`   - ${user.username} (${user.fullName}) - ${user.role} - ${user.factory.name}`)
    }
    console.log('   - 所有账户密码: Test123!@#')

  } catch (error) {
    console.error('❌ 数据清理失败:', error)
    throw error
  }
}

async function main() {
  try {
    await clearData()
  } catch (error) {
    console.error('清理过程中发生错误:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()