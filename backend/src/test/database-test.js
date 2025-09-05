/**
 * 数据库连接和基本操作测试
 * 验证SQLite兼容性修复结果
 */

const { PrismaClient } = require('@prisma/client')
const { Role, EquipmentStatus, IssueStatus, InspectionResult } = require('../shared/constants/enums.js')

const prisma = new PrismaClient()

async function testDatabaseConnection() {
  try {
    console.log('🔗 测试数据库连接...')
    
    // 1. 测试基本连接
    await prisma.$connect()
    console.log('✅ 数据库连接成功')
    
    // 2. 测试创建厂区
    const factory = await prisma.factory.create({
      data: {
        name: '测试厂区',
        address: '测试地址123号'
      }
    })
    console.log('✅ 厂区创建成功:', factory)
    
    // 3. 测试创建用户 (使用String类型的角色)
    const user = await prisma.user.create({
      data: {
        username: 'test_inspector',
        passwordHash: 'test_hash_123',
        fullName: '测试点检员',
        role: Role.INSPECTOR, // 使用常量
        factoryId: factory.id
      }
    })
    console.log('✅ 用户创建成功:', user)
    
    // 4. 测试创建器材类型
    const equipmentType = await prisma.equipmentType.create({
      data: {
        name: '干粉灭火器'
      }
    })
    console.log('✅ 器材类型创建成功:', equipmentType)
    
    // 5. 测试创建器材 (使用String类型的状态)
    const equipment = await prisma.equipment.create({
      data: {
        qrCode: 'TEST001',
        name: '干粉灭火器-001',
        typeId: equipmentType.id,
        factoryId: factory.id,
        location: 'A区1楼',
        specifications: '5kg ABC干粉',
        productionDate: new Date('2023-01-01'),
        expiryDate: new Date('2025-01-01'),
        status: EquipmentStatus.NORMAL // 使用常量
      }
    })
    console.log('✅ 器材创建成功:', equipment)
    
    // 6. 测试创建点检记录 (使用String类型存储JSON)
    const checklistResults = JSON.stringify([
      {
        itemName: '压力表指针是否在绿区',
        result: 'normal',
        note: '压力正常'
      },
      {
        itemName: '灭火器外观是否完好',
        result: 'normal',
        note: '外观良好'
      }
    ])
    
    const inspectionLog = await prisma.inspectionLog.create({
      data: {
        equipmentId: equipment.id,
        inspectorId: user.id,
        overallResult: InspectionResult.NORMAL,
        inspectionImageUrl: '/uploads/inspection_001.jpg',
        checklistResults: checklistResults // JSON字符串
      }
    })
    console.log('✅ 点检记录创建成功:', inspectionLog)
    
    // 7. 测试JSON数据解析
    const parsedResults = JSON.parse(inspectionLog.checklistResults)
    console.log('✅ JSON数据解析成功:', parsedResults)
    
    // 8. 测试查询和关系
    const equipmentWithLogs = await prisma.equipment.findFirst({
      where: { qrCode: 'TEST001' },
      include: {
        inspectionLogs: {
          include: {
            inspector: true
          }
        },
        factory: true,
        equipmentType: true
      }
    })
    console.log('✅ 关系查询成功:', {
      id: equipmentWithLogs.id,
      name: equipmentWithLogs.name,
      factory: equipmentWithLogs.factory.name,
      type: equipmentWithLogs.equipmentType.name,
      logsCount: equipmentWithLogs.inspectionLogs.length
    })
    
    // 9. 清理测试数据
    await prisma.inspectionLog.deleteMany()
    await prisma.equipment.deleteMany()
    await prisma.equipmentType.deleteMany()
    await prisma.user.deleteMany()
    await prisma.factory.deleteMany()
    console.log('✅ 测试数据清理完成')
    
    console.log('\n🎉 所有测试通过！SQLite兼容性修复成功！')
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message)
    console.error('详细错误:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// 运行测试
if (require.main === module) {
  testDatabaseConnection()
}

module.exports = {
  testDatabaseConnection,
  prisma
}