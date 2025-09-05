/**
 * 隐患显示问题诊断脚本
 * 用于分析点检记录异常但隐患不显示的问题
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function diagnoseIssueDisplay() {
  console.log('🔍 开始诊断隐患显示问题...\n')

  try {
    // 1. 检查基础数据
    console.log('=== 基础数据统计 ===')
    const [userCount, factoryCount, equipmentCount, inspectionCount, issueCount] = await Promise.all([
      prisma.user.count(),
      prisma.factory.count(),
      prisma.equipment.count(),
      prisma.inspectionLog.count(),
      prisma.issue.count()
    ])

    console.log(`厂区数量: ${factoryCount}`)
    console.log(`用户数量: ${userCount}`)
    console.log(`器材数量: ${equipmentCount}`)
    console.log(`点检记录: ${inspectionCount}`)
    console.log(`隐患记录: ${issueCount}`)

    // 2. 检查用户信息和权限配置
    console.log('\n=== 用户信息分析 ===')
    const users = await prisma.user.findMany({
      include: { factory: true },
      orderBy: [{ role: 'desc' }, { username: 'asc' }]
    })

    users.forEach(user => {
      console.log(`${user.username} (${user.fullName}) - ${user.role} - 厂区: ${user.factory.name} (ID: ${user.factoryId})`)
    })

    // 3. 检查C厂区的器材
    console.log('\n=== C厂区器材分析 ===')
    const cFactory = await prisma.factory.findFirst({ where: { name: 'C厂区' } })
    if (!cFactory) {
      console.log('❌ 未找到C厂区')
      return
    }

    const cFactoryEquipments = await prisma.equipment.findMany({
      where: { factoryId: cFactory.id },
      include: {
        equipmentType: true,
        inspectionLogs: {
          orderBy: { inspectionTime: 'desc' },
          take: 3,
          include: {
            inspector: true,
            issue: true
          }
        },
        issues: {
          orderBy: { createdAt: 'desc' },
          include: {
            reporter: true
          }
        }
      }
    })

    console.log(`C厂区器材总数: ${cFactoryEquipments.length}`)
    cFactoryEquipments.forEach(equipment => {
      console.log(`\n器材: ${equipment.name} (${equipment.qrCode})`)
      console.log(`  状态: ${equipment.status}`)
      console.log(`  点检记录: ${equipment.inspectionLogs.length} 条`)
      console.log(`  隐患记录: ${equipment.issues.length} 条`)

      // 显示最近的点检记录
      equipment.inspectionLogs.forEach((log, index) => {
        console.log(`  点检 ${index + 1}: ${log.inspectionTime.toISOString()} - ${log.overallResult} - 点检员: ${log.inspector.fullName}`)
        if (log.issue) {
          console.log(`    关联隐患: ID ${log.issue.id} - 状态: ${log.issue.status}`)
        }
      })

      // 显示隐患记录
      equipment.issues.forEach((issue, index) => {
        console.log(`  隐患 ${index + 1}: ID ${issue.id} - ${issue.status} - 上报人: ${issue.reporter.fullName} - ${issue.createdAt.toISOString()}`)
        console.log(`    描述: ${issue.description}`)
      })
    })

    // 4. 检查最近的异常点检记录
    console.log('\n=== 异常点检记录分析 ===')
    const abnormalInspections = await prisma.inspectionLog.findMany({
      where: { overallResult: 'ABNORMAL' },
      orderBy: { inspectionTime: 'desc' },
      take: 10,
      include: {
        equipment: {
          include: { factory: true }
        },
        inspector: true,
        issue: true
      }
    })

    console.log(`异常点检记录总数: ${abnormalInspections.length}`)
    abnormalInspections.forEach((log, index) => {
      console.log(`\n异常记录 ${index + 1}:`)
      console.log(`  时间: ${log.inspectionTime.toISOString()}`)
      console.log(`  器材: ${log.equipment.name} (${log.equipment.qrCode})`)
      console.log(`  厂区: ${log.equipment.factory.name}`)
      console.log(`  点检员: ${log.inspector.fullName} (厂区: ${log.inspector.factoryId})`)
      console.log(`  是否创建隐患: ${log.issueId ? 'YES (ID: ' + log.issueId + ')' : 'NO'}`)
      if (log.issue) {
        console.log(`  隐患状态: ${log.issue.status}`)
        console.log(`  隐患描述: ${log.issue.description}`)
      }
    })

    // 5. 检查具体的隐患记录
    console.log('\n=== 隐患记录详细分析 ===')
    const allIssues = await prisma.issue.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        equipment: {
          include: { factory: true }
        },
        reporter: true,
        inspectionLog: true
      }
    })

    console.log(`隐患记录总数: ${allIssues.length}`)
    allIssues.forEach((issue, index) => {
      console.log(`\n隐患记录 ${index + 1}:`)
      console.log(`  ID: ${issue.id}`)
      console.log(`  状态: ${issue.status}`)
      console.log(`  创建时间: ${issue.createdAt.toISOString()}`)
      console.log(`  器材: ${issue.equipment.name}`)
      console.log(`  器材厂区: ${issue.equipment.factory.name} (ID: ${issue.equipment.factoryId})`)
      console.log(`  上报人: ${issue.reporter.fullName} (${issue.reporter.role})`)
      console.log(`  上报人厂区: ${issue.reporter.factoryId}`)
      console.log(`  描述: ${issue.description}`)
      if (issue.inspectionLog) {
        console.log(`  关联点检记录: ID ${issue.inspectionLog.id}`)
      }
    })

    // 6. 模拟权限过滤测试
    console.log('\n=== 权限过滤模拟测试 ===')
    
    // 获取系统管理员和C厂区管理员
    const superAdmin = users.find(u => u.role === 'SUPER_ADMIN')
    const cFactoryAdmin = users.find(u => u.role === 'FACTORY_ADMIN' && u.factory.name === 'C厂区')

    console.log(`\n系统管理员 (${superAdmin.username}):`)
    console.log(`  厂区ID: ${superAdmin.factoryId}`)
    
    // 模拟超级管理员的查询条件（理论上应该没有厂区限制）
    const superAdminIssues = await prisma.issue.findMany({
      // 超级管理员应该能看到所有隐患，所以不应该有厂区过滤
      include: {
        equipment: {
          include: { factory: true }
        }
      }
    })
    console.log(`  可见隐患数量（无过滤）: ${superAdminIssues.length}`)

    if (cFactoryAdmin) {
      console.log(`\nC厂区管理员 (${cFactoryAdmin.username}):`)
      console.log(`  厂区ID: ${cFactoryAdmin.factoryId}`)
      
      // 模拟C厂区管理员的查询条件（只能看到C厂区的隐患）
      const cFactoryAdminIssues = await prisma.issue.findMany({
        where: {
          equipment: { factoryId: cFactoryAdmin.factoryId }
        },
        include: {
          equipment: {
            include: { factory: true }
          }
        }
      })
      console.log(`  可见隐患数量（厂区过滤）: ${cFactoryAdminIssues.length}`)
      
      cFactoryAdminIssues.forEach(issue => {
        console.log(`    - 隐患 ${issue.id}: ${issue.equipment.factory.name} - ${issue.status}`)
      })
    }

    // 7. 检查今天的数据
    console.log('\n=== 今日数据分析 ===')
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [todayInspections, todayIssues] = await Promise.all([
      prisma.inspectionLog.findMany({
        where: {
          inspectionTime: {
            gte: today,
            lt: tomorrow
          }
        },
        include: {
          equipment: { include: { factory: true } },
          inspector: true,
          issue: true
        }
      }),
      prisma.issue.findMany({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow
          }
        },
        include: {
          equipment: { include: { factory: true } },
          reporter: true
        }
      })
    ])

    console.log(`今日点检记录: ${todayInspections.length} 条`)
    console.log(`今日隐患记录: ${todayIssues.length} 条`)

    todayInspections.forEach((inspection, index) => {
      console.log(`  点检 ${index + 1}: ${inspection.equipment.factory.name} - ${inspection.equipment.name} - ${inspection.overallResult}`)
      if (inspection.overallResult === 'ABNORMAL') {
        console.log(`    异常点检，是否创建隐患: ${inspection.issueId ? 'YES' : 'NO'}`)
      }
    })

    todayIssues.forEach((issue, index) => {
      console.log(`  隐患 ${index + 1}: ${issue.equipment.factory.name} - ${issue.equipment.name} - ${issue.status}`)
    })

  } catch (error) {
    console.error('❌ 诊断过程中发生错误:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// 运行诊断
diagnoseIssueDisplay()