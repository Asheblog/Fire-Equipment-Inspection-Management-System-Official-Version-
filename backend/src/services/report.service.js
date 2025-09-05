/**
 * 消防器材点检系统 - 报表服务
 * 处理数据看板和报表生成相关的业务逻辑
 */

const { PrismaClient } = require('@prisma/client');

class ReportService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * 获取数据看板信息
   * @param {number} factoryId - 厂区ID
   * @param {string} userRole - 用户角色
   * @returns {Promise<Object>} 看板数据
   */
  async getDashboardData(factoryId = null, userRole = null) {
    try {
      const where = factoryId ? { factoryId } : {};

      // 并行获取各项统计数据
      const [
        equipmentStats,
        inspectionStats,
        issueStats,
        recentActivity,
        monthlyTrend
      ] = await Promise.all([
        this.getEquipmentOverview(where),
        this.getInspectionOverview(where),
        this.getIssueOverview(where),
        this.getRecentActivity(where, 10),
        this.getMonthlyTrend(where)
      ]);

      return {
        equipmentStats: equipmentStats,
        inspectionStats: inspectionStats,
        issueStats: issueStats,
        recentActivities: recentActivity,
        monthlyTrend: monthlyTrend,
        lastUpdated: new Date().toISOString()
      };
    } catch (error) {
      console.error('获取看板数据失败:', error);
      throw new Error('获取看板数据失败');
    }
  }

  /**
   * 获取器材概览统计
   * @param {Object} where - 查询条件
   * @returns {Promise<Object>} 器材统计
   */
  async getEquipmentOverview(where = {}) {
    try {
      const [
        total,
        normal,
        abnormal,
        scrapped,
        expiring,
        expired
      ] = await Promise.all([
        this.prisma.equipment.count({ where }),
        this.prisma.equipment.count({ where: { ...where, status: 'NORMAL' } }),
        this.prisma.equipment.count({ where: { ...where, status: 'ABNORMAL' } }),
        this.prisma.equipment.count({ where: { ...where, status: 'SCRAPPED' } }),
        this.prisma.equipment.count({
          where: {
            ...where,
            expiryDate: {
              lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              gt: new Date()
            }
          }
        }),
        this.prisma.equipment.count({
          where: {
            ...where,
            expiryDate: { lt: new Date() }
          }
        })
      ]);

      return {
        total,
        normal,
        abnormal,
        scrapped,
        expiring,
        expired,
        healthRate: total > 0 ? ((normal / total) * 100).toFixed(2) : 0
      };
    } catch (error) {
      console.error('获取器材概览失败:', error);
      throw error;
    }
  }

  /**
   * 获取点检概览统计
   * @param {Object} where - 查询条件
   * @returns {Promise<Object>} 点检统计
   */
  async getInspectionOverview(where = {}) {
    try {
      const today = new Date();
      const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

      const inspectionWhere = where.factoryId ? 
        { equipment: { factoryId: where.factoryId } } : {};

      const [
        totalThisMonth,
        normalThisMonth,
        abnormalThisMonth,
        totalLastMonth,
        todayInspections,
        pendingEquipments
      ] = await Promise.all([
        // 本月总点检数
        this.prisma.inspectionLog.count({
          where: {
            ...inspectionWhere,
            inspectionTime: { gte: thisMonth }
          }
        }),
        // 本月正常点检数
        this.prisma.inspectionLog.count({
          where: {
            ...inspectionWhere,
            inspectionTime: { gte: thisMonth },
            overallResult: 'NORMAL'
          }
        }),
        // 本月异常点检数
        this.prisma.inspectionLog.count({
          where: {
            ...inspectionWhere,
            inspectionTime: { gte: thisMonth },
            overallResult: 'ABNORMAL'
          }
        }),
        // 上月总点检数
        this.prisma.inspectionLog.count({
          where: {
            ...inspectionWhere,
            inspectionTime: { 
              gte: lastMonth,
              lt: thisMonth
            }
          }
        }),
        // 今日点检数
        this.prisma.inspectionLog.count({
          where: {
            ...inspectionWhere,
            inspectionTime: {
              gte: new Date(today.getFullYear(), today.getMonth(), today.getDate())
            }
          }
        }),
        // 待点检器材数（30天未点检）
        this.prisma.equipment.count({
          where: {
            ...where,
            status: { not: 'SCRAPPED' },
            OR: [
              { lastInspectedAt: null },
              { 
                lastInspectedAt: { 
                  lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) 
                } 
              }
            ]
          }
        })
      ]);

      // 计算月度增长率
      const monthlyGrowth = totalLastMonth > 0 
        ? (((totalThisMonth - totalLastMonth) / totalLastMonth) * 100).toFixed(2)
        : 0;

      // 计算合格率
      const passRate = totalThisMonth > 0 
        ? ((normalThisMonth / totalThisMonth) * 100).toFixed(2)
        : 0;

      return {
        thisMonth: totalThisMonth,
        normalRate: parseFloat(passRate),
        abnormalCount: abnormalThisMonth,
        pendingCount: pendingEquipments
      };
    } catch (error) {
      console.error('获取点检概览失败:', error);
      throw error;
    }
  }

  /**
   * 获取隐患概览统计
   * @param {Object} where - 查询条件
   * @returns {Promise<Object>} 隐患统计
   */
  async getIssueOverview(where = {}) {
    try {
      const issueWhere = where.factoryId ? 
        { equipment: { factoryId: where.factoryId } } : {};

      const [
        totalPending,
        totalInProgress,
        totalPendingAudit,
        totalClosed,
        totalThisMonth,
        avgProcessingTime
      ] = await Promise.all([
        // 待处理隐患
        this.prisma.issue.count({
          where: { ...issueWhere, status: 'PENDING' }
        }),
        // 处理中隐患
        this.prisma.issue.count({
          where: { ...issueWhere, status: 'IN_PROGRESS' }
        }),
        // 待审核隐患
        this.prisma.issue.count({
          where: { ...issueWhere, status: 'PENDING_AUDIT' }
        }),
        // 已关闭隐患
        this.prisma.issue.count({
          where: { ...issueWhere, status: 'CLOSED' }
        }),
        // 本月新增隐患
        this.prisma.issue.count({
          where: {
            ...issueWhere,
            createdAt: {
              gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            }
          }
        }),
        // 计算平均处理时间
        this.calculateAvgProcessingTime(issueWhere)
      ]);

      const totalActive = totalPending + totalInProgress + totalPendingAudit;

      return {
        total: totalPending + totalInProgress + totalPendingAudit + totalClosed,
        pending: totalPending,
        underReview: totalPendingAudit,
        closed: totalClosed,
        thisMonth: totalThisMonth
      };
    } catch (error) {
      console.error('获取隐患概览失败:', error);
      throw error;
    }
  }

  /**
   * 获取最近活动记录
   * @param {Object} where - 查询条件
   * @param {number} limit - 记录数量
   * @returns {Promise<Array>} 活动记录
   */
  async getRecentActivity(where = {}, limit = 10) {
    try {
      const equipmentWhere = where.factoryId ? { factoryId: where.factoryId } : {};
      const inspectionWhere = where.factoryId ? 
        { equipment: { factoryId: where.factoryId } } : {};

      // 获取最近的点检记录
      const recentInspections = await this.prisma.inspectionLog.findMany({
        where: inspectionWhere,
        take: limit,
        orderBy: { inspectionTime: 'desc' },
        include: {
          equipment: {
            select: { name: true, location: true }
          },
          inspector: {
            select: { fullName: true }
          }
        }
      });

      // 获取最近的隐患记录
      const recentIssues = await this.prisma.issue.findMany({
        where: inspectionWhere,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          equipment: {
            select: { name: true, location: true }
          },
          reporter: {
            select: { fullName: true }
          }
        }
      });

      // 合并并排序活动记录
      const activities = [];

      recentInspections.forEach(inspection => {
        activities.push({
          id: inspection.id,
          type: 'INSPECTION',
          title: `${inspection.inspector.fullName} 对 ${inspection.equipment.name} 进行了点检`,
          description: `位置: ${inspection.equipment.location}`,
          user: inspection.inspector,
          createdAt: inspection.inspectionTime
        });
      });

      recentIssues.forEach(issue => {
        activities.push({
          id: issue.id,
          type: 'ISSUE_CREATED', 
          title: `${issue.reporter.fullName} 上报了 ${issue.equipment.name} 的隐患`,
          description: `位置: ${issue.equipment.location}`,
          user: issue.reporter,
          createdAt: issue.createdAt
        });
      });

      // 按时间排序并取前N条
      return activities
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, limit);
    } catch (error) {
      console.error('获取最近活动失败:', error);
      throw error;
    }
  }

  /**
   * 获取月度报表数据
   * @param {number} factoryId - 厂区ID
   * @param {number} year - 年份
   * @param {number} month - 月份
   * @returns {Promise<Object>} 月度报表
   */
  async getMonthlyReport(factoryId = null, year, month) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const where = factoryId ? { factoryId } : {};
      const inspectionWhere = factoryId ? 
        { equipment: { factoryId } } : {};
      const issueWhere = factoryId ? 
        { equipment: { factoryId } } : {};

      const [
        equipmentSummary,
        inspectionSummary,
        issueSummary,
        dailyInspections,
        topEquipmentTypes,
        inspectorPerformance
      ] = await Promise.all([
        // 器材概况
        this.getEquipmentOverview(where),
        // 点检概况
        this.getMonthlyInspectionSummary(inspectionWhere, startDate, endDate),
        // 隐患概况
        this.getMonthlyIssueSummary(issueWhere, startDate, endDate),
        // 每日点检趋势
        this.getDailyInspectionTrend(inspectionWhere, startDate, endDate),
        // 器材类型排行
        this.getTopEquipmentTypes(where, startDate, endDate),
        // 点检员绩效
        this.getInspectorPerformance(inspectionWhere, startDate, endDate)
      ]);

      return {
        reportDate: {
          year,
          month,
          startDate,
          endDate
        },
        summary: {
          equipment: equipmentSummary,
          inspection: inspectionSummary,
          issue: issueSummary
        },
        trends: {
          dailyInspections
        },
        rankings: {
          equipmentTypes: topEquipmentTypes,
          inspectors: inspectorPerformance
        },
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('获取月度报表失败:', error);
      throw new Error('获取月度报表失败');
    }
  }

  /**
   * 获取月度点检汇总
   */
  async getMonthlyInspectionSummary(where, startDate, endDate) {
    const timeWhere = {
      ...where,
      inspectionTime: { gte: startDate, lte: endDate }
    };

    const [total, normal, abnormal] = await Promise.all([
      this.prisma.inspectionLog.count({ where: timeWhere }),
      this.prisma.inspectionLog.count({ 
        where: { ...timeWhere, overallResult: 'NORMAL' } 
      }),
      this.prisma.inspectionLog.count({ 
        where: { ...timeWhere, overallResult: 'ABNORMAL' } 
      })
    ]);

    return {
      total,
      normal,
      abnormal,
      passRate: total > 0 ? ((normal / total) * 100).toFixed(2) : 0
    };
  }

  /**
   * 获取月度隐患汇总
   */
  async getMonthlyIssueSummary(where, startDate, endDate) {
    const timeWhere = {
      ...where,
      createdAt: { gte: startDate, lte: endDate }
    };

    const [total, closed, pending] = await Promise.all([
      this.prisma.issue.count({ where: timeWhere }),
      this.prisma.issue.count({ 
        where: { ...timeWhere, status: 'CLOSED' } 
      }),
      this.prisma.issue.count({ 
        where: { ...timeWhere, status: { in: ['PENDING', 'IN_PROGRESS', 'PENDING_AUDIT'] } } 
      })
    ]);

    return {
      total,
      closed,
      pending,
      resolveRate: total > 0 ? ((closed / total) * 100).toFixed(2) : 0
    };
  }

  /**
   * 获取每日点检趋势
   */
  async getDailyInspectionTrend(where, startDate, endDate) {
    const inspections = await this.prisma.inspectionLog.findMany({
      where: {
        ...where,
        inspectionTime: { gte: startDate, lte: endDate }
      },
      select: {
        inspectionTime: true,
        overallResult: true
      }
    });

    // 按日期分组统计
    const trendData = {};
    const days = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));

    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      trendData[dateKey] = { date: dateKey, total: 0, normal: 0, abnormal: 0 };
    }

    inspections.forEach(inspection => {
      const dateKey = inspection.inspectionTime.toISOString().split('T')[0];
      if (trendData[dateKey]) {
        trendData[dateKey].total++;
        if (inspection.overallResult === 'NORMAL') {
          trendData[dateKey].normal++;
        } else {
          trendData[dateKey].abnormal++;
        }
      }
    });

    return Object.values(trendData);
  }

  /**
   * 获取器材类型排行
   */
  async getTopEquipmentTypes(where, startDate, endDate) {
    const equipmentTypes = await this.prisma.equipmentType.findMany({
      include: {
        equipments: {
          where,
          include: {
            inspectionLogs: {
              where: {
                inspectionTime: { gte: startDate, lte: endDate }
              }
            }
          }
        }
      }
    });

    return equipmentTypes
      .map(type => ({
        name: type.name,
        equipmentCount: type.equipments.length,
        inspectionCount: type.equipments.reduce(
          (sum, eq) => sum + eq.inspectionLogs.length, 0
        )
      }))
      .sort((a, b) => b.inspectionCount - a.inspectionCount)
      .slice(0, 10);
  }

  /**
   * 获取点检员绩效
   */
  async getInspectorPerformance(where, startDate, endDate) {
    const inspectors = await this.prisma.user.findMany({
      where: { role: 'INSPECTOR', isActive: true },
      include: {
        inspectionLogs: {
          where: {
            ...where,
            inspectionTime: { gte: startDate, lte: endDate }
          }
        }
      }
    });

    return inspectors
      .map(inspector => ({
        name: inspector.fullName,
        totalInspections: inspector.inspectionLogs.length,
        normalInspections: inspector.inspectionLogs.filter(
          log => log.overallResult === 'NORMAL'
        ).length,
        abnormalInspections: inspector.inspectionLogs.filter(
          log => log.overallResult === 'ABNORMAL'
        ).length
      }))
      .sort((a, b) => b.totalInspections - a.totalInspections)
      .slice(0, 10);
  }

  /**
   * 计算平均处理时间
   */
  async calculateAvgProcessingTime(where) {
    const closedIssues = await this.prisma.issue.findMany({
      where: {
        ...where,
        status: 'CLOSED',
        handledAt: { not: null }
      },
      select: {
        createdAt: true,
        handledAt: true
      }
    });

    if (closedIssues.length === 0) return 0;

    const totalDays = closedIssues.reduce((sum, issue) => {
      const days = Math.floor(
        (issue.handledAt.getTime() - issue.createdAt.getTime()) / (24 * 60 * 60 * 1000)
      );
      return sum + days;
    }, 0);

    return Math.round(totalDays / closedIssues.length);
  }

  /**
   * 获取月度趋势数据（最近12个月）
   * @param {Object} where - 查询条件
   * @returns {Promise<Array>} 月度趋势数据
   */
  async getMonthlyTrend(where = {}) {
    try {
      // 计算最近12个月的日期范围
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 11);
      startDate.setDate(1); // 设置为月初
      startDate.setHours(0, 0, 0, 0);

      console.log(`📊 [月度趋势] 计算时间范围: ${startDate.toISOString()} - ${endDate.toISOString()}`);

      // 获取时间范围内的数据
      const [equipmentData, inspectionData, issueData] = await Promise.all([
        // 器材创建趋势（按月）
        this.prisma.equipment.findMany({
          where: {
            ...where,
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          select: { createdAt: true }
        }),

        // 点检趋势（按月）
        this.prisma.inspectionLog.findMany({
          where: {
            ...where,
            inspectionTime: {
              gte: startDate,
              lte: endDate
            }
          },
          select: { 
            inspectionTime: true,
            overallResult: true
          }
        }),

        // 隐患趋势（按月）
        this.prisma.issue.findMany({
          where: {
            ...where,
            createdAt: {
              gte: startDate,
              lte: endDate
            }
          },
          select: { 
            createdAt: true,
            status: true
          }
        })
      ]);

      console.log(`📊 [月度趋势] 获取数据统计:`, {
        equipmentCount: equipmentData.length,
        inspectionCount: inspectionData.length,
        issueCount: issueData.length
      });

      // 初始化12个月的数据结构
      const monthlyData = [];
      const currentDate = new Date(startDate);

      for (let i = 0; i < 12; i++) {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
        const monthName = currentDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short' });

        monthlyData.push({
          month: monthKey,
          monthName: monthName,
          equipmentCount: 0,
          inspectionCount: 0,
          normalInspectionCount: 0,
          abnormalInspectionCount: 0,
          issueCount: 0,
          pendingIssueCount: 0,
          closedIssueCount: 0
        });

        // 移动到下个月
        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      // 统计器材数据
      equipmentData.forEach(item => {
        const date = new Date(item.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthData = monthlyData.find(m => m.month === monthKey);
        if (monthData) {
          monthData.equipmentCount++;
        }
      });

      // 统计点检数据
      inspectionData.forEach(item => {
        const date = new Date(item.inspectionTime);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthData = monthlyData.find(m => m.month === monthKey);
        if (monthData) {
          monthData.inspectionCount++;
          if (item.overallResult === 'NORMAL') {
            monthData.normalInspectionCount++;
          } else {
            monthData.abnormalInspectionCount++;
          }
        }
      });

      // 统计隐患数据
      issueData.forEach(item => {
        const date = new Date(item.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthData = monthlyData.find(m => m.month === monthKey);
        if (monthData) {
          monthData.issueCount++;
          if (item.status === 'PENDING' || item.status === 'IN_PROGRESS' || item.status === 'PENDING_AUDIT') {
            monthData.pendingIssueCount++;
          } else if (item.status === 'CLOSED') {
            monthData.closedIssueCount++;
          }
        }
      });

      console.log('📊 [月度趋势] 生成的月度数据:', monthlyData.map(m => ({
        month: m.monthName,
        equipment: m.equipmentCount,
        inspection: m.inspectionCount,
        issues: m.issueCount
      })));

      return monthlyData;

    } catch (error) {
      console.error('获取月度趋势数据失败:', error);
      // 返回空的12个月数据结构，而不是空数组
      const fallbackData = [];
      const currentDate = new Date();
      currentDate.setMonth(currentDate.getMonth() - 11);
      currentDate.setDate(1);

      for (let i = 0; i < 12; i++) {
        const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
        const monthName = currentDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'short' });
        
        fallbackData.push({
          month: monthKey,
          monthName: monthName,
          equipmentCount: 0,
          inspectionCount: 0,
          normalInspectionCount: 0,
          abnormalInspectionCount: 0,
          issueCount: 0,
          pendingIssueCount: 0,
          closedIssueCount: 0
        });

        currentDate.setMonth(currentDate.getMonth() + 1);
      }

      return fallbackData;
    }
  }
}

module.exports = ReportService;