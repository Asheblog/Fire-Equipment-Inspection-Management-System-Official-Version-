/**
 * 消防器材点检系统 - 点检服务
 * 处理点检记录相关的业务逻辑
 */

const { PrismaClient } = require('@prisma/client');
const ImageHelper = require('../utils/image.helper');

class InspectionService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * 根据器材ID获取点检项模板
   * @param {number} equipmentId - 器材ID
   * @returns {Promise<Array>} 点检项列表
   */
  async getChecklistTemplate(equipmentId) {
    try {
      const equipment = await this.prisma.equipment.findUnique({
        where: { id: equipmentId },
        include: {
          equipmentType: {
            include: {
              checklistTemplates: {
                orderBy: { sortOrder: 'asc' }
              }
            }
          }
        }
      });

      if (!equipment) {
        throw new Error('器材不存在');
      }

      return equipment.equipmentType.checklistTemplates.map(template => ({
        id: template.id,
        itemName: template.itemName,
        sortOrder: template.sortOrder,
        result: null, // 待填写
        note: ''     // 待填写
      }));
    } catch (error) {
      console.error('获取点检模板失败:', error);
      throw error;
    }
  }

  /**
   * 创建点检记录
   * @param {Object} inspectionData - 点检数据
   * @param {number} inspectorId - 点检员ID
   * @returns {Promise<Object>} 点检记录
   */
  async createInspection(inspectionData, inspectorId) {
    const {
      equipmentId,
      overallResult,
      checklistResults,
      inspectionImageUrl,        // 兼容旧版单图片字段
      inspectionImageUrls,       // 新的多图片字段
      issueDescription,
      issueImageUrl,            // 兼容旧版单图片字段
      issueImageUrls            // 新的多图片字段
    } = inspectionData;

    try {
      // 处理点检图片数据 - 优先使用新字段，回退到旧字段
      const finalInspectionImages = inspectionImageUrls || inspectionImageUrl;
      const inspectionImageData = ImageHelper.prepareForSave(
        finalInspectionImages, 
        'inspectionImageUrls', 
        'inspectionImageUrl'
      );

      // 处理异常图片数据
      const finalIssueImages = issueImageUrls || issueImageUrl;
      const issueImageData = ImageHelper.prepareForSave(
        finalIssueImages,
        'issueImageUrls',
        'issueImageUrl'
      );

      // 开启事务
      const result = await this.prisma.$transaction(async (prisma) => {
        // 1. 验证器材存在
        const equipment = await prisma.equipment.findUnique({
          where: { id: equipmentId },
          include: { factory: true }
        });

        if (!equipment) {
          throw new Error('器材不存在');
        }

        let issueId = null;

        // 2. 如果点检结果异常，创建隐患记录
        if (overallResult === 'ABNORMAL') {
          const issue = await prisma.issue.create({
            data: {
              equipmentId,
              description: issueDescription,
              reporterId: inspectorId,
              ...issueImageData,  // 使用新的图片数据格式
              status: 'PENDING'
            }
          });
          issueId = issue.id;

          // 更新器材状态为异常
          await prisma.equipment.update({
            where: { id: equipmentId },
            data: { status: 'ABNORMAL' }
          });
        } else {
          // 正常情况下，如果器材之前是异常状态，需要检查是否还有其他未解决的隐患
          if (equipment.status === 'ABNORMAL') {
            const activeIssueCount = await prisma.issue.count({
              where: {
                equipmentId,
                status: { in: ['PENDING', 'IN_PROGRESS', 'PENDING_AUDIT'] }
              }
            });

            // 如果没有其他未解决的隐患，将器材状态改为正常
            if (activeIssueCount === 0) {
              await prisma.equipment.update({
                where: { id: equipmentId },
                data: { status: 'NORMAL' }
              });
            }
          }
        }

        // 3. 创建点检记录
        const inspection = await prisma.inspectionLog.create({
          data: {
            equipmentId,
            inspectorId,
            overallResult,
            ...inspectionImageData,  // 使用新的图片数据格式
            checklistResults: JSON.stringify(checklistResults),
            issueId
          },
          include: {
            equipment: {
              select: {
                id: true,
                name: true,
                qrCode: true,
                location: true
              }
            },
            inspector: {
              select: {
                id: true,
                fullName: true
              }
            },
            issue: {
              select: {
                id: true,
                description: true,
                status: true
              }
            }
          }
        });

        // 4. 更新器材的最后点检时间
        await prisma.equipment.update({
          where: { id: equipmentId },
          data: { lastInspectedAt: new Date() }
        });

        return inspection;
      });

      return result;
    } catch (error) {
      console.error('创建点检记录失败:', error);
      throw error;
    }
  }

  /**
   * 获取点检记录列表
   * @param {Object} filters - 筛选条件
   * @param {Object} pagination - 分页参数
   * @param {number} userFactoryId - 用户厂区ID
   * @param {number} userId - 用户ID
   * @param {string} userRole - 用户角色
   * @returns {Promise<Object>} 点检记录列表
   */
  async getInspectionList(filters = {}, pagination = {}, userFactoryId = null, userId = null, userRole = null) {
    try {
      const {
        equipmentId,
        inspectorId,
        result,
        startDate,
        endDate
      } = filters;

      const {
        page = 1,
        limit = 20,
        sortBy = 'inspectionTime',
        sortOrder = 'desc'
      } = pagination;

      // 构建查询条件
      const where = {};

      // 数据隔离（支持多厂区）
      if (Array.isArray(userFactoryId) && userFactoryId.length > 0) {
        where.equipment = { factoryId: { in: userFactoryId } };
      } else if (userFactoryId) {
        where.equipment = { factoryId: userFactoryId };
      }

      // 点检员只能查看自己的记录
      if (userRole === 'INSPECTOR' && userId) {
        where.inspectorId = userId;
      } else if (inspectorId) {
        where.inspectorId = inspectorId;
      }

      // 器材筛选
      if (equipmentId) {
        where.equipmentId = equipmentId;
      }

      // 结果筛选
      if (result) {
        where.overallResult = result;
      }

      // 日期范围筛选
      if (startDate || endDate) {
        where.inspectionTime = {};
        if (startDate) {
          where.inspectionTime.gte = new Date(startDate);
        }
        if (endDate) {
          where.inspectionTime.lte = new Date(endDate);
        }
      }

      const skip = (page - 1) * limit;
      const orderBy = {};
      orderBy[sortBy] = sortOrder;

      const [inspections, total] = await Promise.all([
        this.prisma.inspectionLog.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            equipment: {
              select: {
                id: true,
                name: true,
                qrCode: true,
                location: true,
                factory: {
                  select: { id: true, name: true }
                },
                equipmentType: {
                  select: { id: true, name: true }
                }
              }
            },
            inspector: {
              select: {
                id: true,
                fullName: true
              }
            },
            issue: {
              select: {
                id: true,
                description: true,
                status: true
              }
            }
          }
        }),
        this.prisma.inspectionLog.count({ where })
      ]);

      const pages = Math.ceil(total / limit);

      // 归一化多图片字段（列表接口补齐与详情接口一致）
      const normalizedInspections = inspections.map(item => {
        const inspectionImages = ImageHelper.extractImages(item, 'inspectionImageUrls', 'inspectionImageUrl');
        return {
          ...item,
            inspectionImages,
          inspectionImageUrl: item.inspectionImageUrl || inspectionImages[0] || null
        };
      });

      return {
        inspections: normalizedInspections,
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
      console.error('获取点检记录失败:', error);
      throw new Error('获取点检记录失败');
    }
  }

  /**
   * 获取点检记录详情
   * @param {number} id - 点检记录ID
   * @param {number} userFactoryId - 用户厂区ID
   * @param {number} userId - 用户ID
   * @param {string} userRole - 用户角色
   * @returns {Promise<Object>} 点检记录详情
   */
  async getInspectionById(id, userFactoryId = null, userId = null, userRole = null) {
    try {
      const where = { id };

      const inspection = await this.prisma.inspectionLog.findFirst({
        where,
        include: {
          equipment: {
            include: {
              factory: {
                select: { id: true, name: true, address: true }
              },
              equipmentType: {
                select: { id: true, name: true }
              }
            }
          },
          inspector: {
            select: {
              id: true,
              fullName: true,
              factory: {
                select: { id: true, name: true }
              }
            }
          },
          issue: {
            include: {
              reporter: {
                select: { id: true, fullName: true }
              },
              handler: {
                select: { id: true, fullName: true }
              },
              auditor: {
                select: { id: true, fullName: true }
              }
            }
          }
        }
      });

      if (!inspection) {
        throw new Error('点检记录不存在');
      }

      // 数据权限检查（支持多厂区）
      if (Array.isArray(userFactoryId) && userFactoryId.length > 0) {
        if (!userFactoryId.includes(inspection.equipment.factoryId)) {
          throw new Error('无权查看该点检记录');
        }
      } else if (userFactoryId && inspection.equipment.factoryId !== userFactoryId) {
        throw new Error('无权查看该点检记录');
      }

      // 点检员只能查看自己的记录
      if (userRole === 'INSPECTOR' && inspection.inspectorId !== userId) {
        throw new Error('无权查看该点检记录');
      }

      // 归一化图片字段（保持与列表一致）
      const inspectionImages = ImageHelper.extractImages(inspection, 'inspectionImageUrls', 'inspectionImageUrl');
      const issueImages = inspection.issue ? ImageHelper.extractImages(inspection.issue, 'issueImageUrls', 'issueImageUrl') : [];
      const fixedImages = inspection.issue ? ImageHelper.extractImages(inspection.issue, 'fixedImageUrls', 'fixedImageUrl') : [];

      // 调试日志（DEBUG_IMAGES）已移除，保持生产输出整洁

      return {
        ...inspection,
        inspectionImages,
        inspectionImageUrl: inspection.inspectionImageUrl || inspectionImages[0] || null,
        issue: inspection.issue ? {
          ...inspection.issue,
          issueImages,
          fixedImages,
          issueImageUrl: inspection.issue.issueImageUrl || issueImages[0] || null,
          fixedImageUrl: inspection.issue.fixedImageUrl || fixedImages[0] || null
        } : null
      };
    } catch (error) {
      console.error('获取点检记录详情失败:', error);
      throw error;
    }
  }

  /**
   * 获取点检统计信息
   * @param {number} factoryId - 厂区ID
   * @param {number} userId - 用户ID
   * @param {string} userRole - 用户角色
   * @param {string} period - 统计周期 ('today', 'week', 'month', 'year')
   * @returns {Promise<Object>} 统计信息
   */
  async getInspectionStats(factoryId = null, userId = null, userRole = null, period = 'month') {
    try {
      // 根据周期计算开始时间
      const now = new Date();
      let startTime;

      switch (period) {
        case 'today':
          startTime = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          const dayOfWeek = now.getDay();
          startTime = new Date(now.getTime() - dayOfWeek * 24 * 60 * 60 * 1000);
          startTime.setHours(0, 0, 0, 0);
          break;
        case 'month':
          startTime = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'year':
          startTime = new Date(now.getFullYear(), 0, 1);
          break;
        default:
          startTime = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // 构建查询条件
      const where = {
        inspectionTime: { gte: startTime }
      };

      // 数据隔离
      if (factoryId) {
        where.equipment = { factoryId };
      }

      // 点检员只能查看自己的统计
      if (userRole === 'INSPECTOR' && userId) {
        where.inspectorId = userId;
      }

      const [
        totalInspections,
        normalInspections,
        abnormalInspections,
        uniqueEquipments,
        uniqueInspectors
      ] = await Promise.all([
        // 总点检次数
        this.prisma.inspectionLog.count({ where }),
        // 正常点检次数
        this.prisma.inspectionLog.count({
          where: { ...where, overallResult: 'NORMAL' }
        }),
        // 异常点检次数
        this.prisma.inspectionLog.count({
          where: { ...where, overallResult: 'ABNORMAL' }
        }),
        // 涉及的器材数量
        this.prisma.inspectionLog.findMany({
          where,
          select: { equipmentId: true },
          distinct: ['equipmentId']
        }).then(result => result.length),
        // 涉及的点检员数量
        this.prisma.inspectionLog.findMany({
          where,
          select: { inspectorId: true },
          distinct: ['inspectorId']
        }).then(result => result.length)
      ]);

      // 计算合格率
      const passRate = totalInspections > 0 
        ? ((normalInspections / totalInspections) * 100).toFixed(2)
        : 0;

      return {
        period,
        startTime,
        endTime: now,
        total: totalInspections,
        byResult: {
          normal: normalInspections,
          abnormal: abnormalInspections
        },
        passRate: parseFloat(passRate),
        equipmentCoverage: uniqueEquipments,
        inspectorCount: uniqueInspectors
      };
    } catch (error) {
      console.error('获取点检统计失败:', error);
      throw new Error('获取点检统计失败');
    }
  }

  /**
   * 获取点检趋势数据
   * @param {number} factoryId - 厂区ID
   * @param {number} days - 天数
   * @returns {Promise<Array>} 趋势数据
   */
  async getInspectionTrend(factoryId = null, days = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      const where = {
        inspectionTime: {
          gte: startDate,
          lte: endDate
        }
      };

      if (factoryId) {
        where.equipment = { factoryId };
      }

      // 按日期分组统计
      const inspections = await this.prisma.inspectionLog.findMany({
        where,
        select: {
          inspectionTime: true,
          overallResult: true
        }
      });

      // 按日期归类数据
      const trendData = {};
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dateKey = date.toISOString().split('T')[0];
        trendData[dateKey] = {
          date: dateKey,
          total: 0,
          normal: 0,
          abnormal: 0
        };
      }

      // 统计每日数据
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
    } catch (error) {
      console.error('获取点检趋势失败:', error);
      throw new Error('获取点检趋势失败');
    }
  }

  /**
   * 获取待点检器材列表
   * @param {number} factoryId - 厂区ID
   * @param {number} days - 超期天数阈值
   * @returns {Promise<Array>} 待点检器材列表
   */
  async getPendingInspections(factoryId = null, days = 30) {
    try {
      const overdueDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const where = {
        status: { not: 'SCRAPPED' },
        OR: [
          { lastInspectedAt: null },
          { lastInspectedAt: { lt: overdueDate } }
        ]
      };

      if (Array.isArray(factoryId) && factoryId.length > 0) {
        where.factoryId = { in: factoryId };
      } else if (factoryId) {
        where.factoryId = factoryId;
      }

      const equipments = await this.prisma.equipment.findMany({
        where,
        include: {
          equipmentType: {
            select: { id: true, name: true }
          },
          factory: {
            select: { id: true, name: true }
          },
          _count: {
            select: { inspectionLogs: true }
          }
        },
        orderBy: [
          { lastInspectedAt: 'asc' },
          { name: 'asc' }
        ]
      });

      return equipments.map(equipment => ({
        ...equipment,
        daysSinceLastInspection: equipment.lastInspectedAt 
          ? Math.floor((Date.now() - equipment.lastInspectedAt.getTime()) / (24 * 60 * 60 * 1000))
          : null,
        totalInspections: equipment._count.inspectionLogs,
        isOverdue: equipment.lastInspectedAt 
          ? equipment.lastInspectedAt < overdueDate
          : true
      }));
    } catch (error) {
      console.error('获取待点检器材失败:', error);
      throw new Error('获取待点检器材失败');
    }
  }

  /**
   * 获取本月按厂区的点检完成进度
   * @param {number[]|number|null} factoryIds - 授权厂区ID列表（可为单个或数组，null 表示不限制）
   * @param {string|null} month - 月份 YYYY-MM，默认当前月
   * @returns {Promise<Object>} 进度汇总
   */
  async getMonthlyProgress(factoryIds = null, month = null) {
    const now = new Date();
    const [y, m] = month && /^\d{4}-\d{2}$/.test(month)
      ? month.split('-').map(n => parseInt(n, 10))
      : [now.getFullYear(), now.getMonth() + 1];

    const start = new Date(y, m - 1, 1, 0, 0, 0);
    const end = new Date(y, m, 1, 0, 0, 0);

    const inFilter = Array.isArray(factoryIds) ? factoryIds : (factoryIds ? [factoryIds] : undefined);

    // 获取可见厂区
    const factories = await this.prisma.factory.findMany({
      where: inFilter ? { id: { in: inFilter } } : {},
      select: { id: true, name: true }
    });

    let totalAll = 0;
    let completedAll = 0;

    const byFactory = [];
    for (const f of factories) {
      // 总设备数（排除报废）
      const total = await this.prisma.equipment.count({
        where: { factoryId: f.id, status: { not: 'SCRAPPED' } }
      });

      // 本月已点检的去重设备数量
      const inspected = await this.prisma.inspectionLog.findMany({
        where: {
          inspectionTime: { gte: start, lt: end },
          equipment: { factoryId: f.id }
        },
        select: { equipmentId: true }
      });
      const completed = new Set(inspected.map(x => x.equipmentId)).size;

      byFactory.push({
        factoryId: f.id,
        factoryName: f.name,
        total,
        completed,
        pending: Math.max(0, total - completed)
      });

      totalAll += total;
      completedAll += completed;
    }

    return {
      month: `${y}-${String(m).padStart(2, '0')}`,
      total: totalAll,
      completed: completedAll,
      pending: Math.max(0, totalAll - completedAll),
      factories: byFactory
    };
  }

  /**
   * 获取指定厂区本月未完成点检的设备列表
   * @param {number} factoryId - 厂区ID
   * @param {string|null} month - YYYY-MM
   * @returns {Promise<Array>} 设备列表
   */
  async getMonthlyPendingEquipments(factoryId, month = null) {
    const now = new Date();
    const [y, m] = month && /^\d{4}-\d{2}$/.test(month)
      ? month.split('-').map(n => parseInt(n, 10))
      : [now.getFullYear(), now.getMonth() + 1];

    const start = new Date(y, m - 1, 1, 0, 0, 0);
    const end = new Date(y, m, 1, 0, 0, 0);

    const equipments = await this.prisma.equipment.findMany({
      where: {
        factoryId,
        status: { not: 'SCRAPPED' },
        NOT: {
          inspectionLogs: {
            some: { inspectionTime: { gte: start, lt: end } }
          }
        }
      },
      include: {
        equipmentType: { select: { id: true, name: true } },
        factory: { select: { id: true, name: true } }
      },
      orderBy: [{ name: 'asc' }]
    });

    return equipments;
  }

  /**
   * 批量创建点检记录
   * @param {Object} locationInspectionData - 位置点检数据
   * @param {number} inspectorId - 点检员ID
   * @returns {Promise<Object>} 批量创建结果
   */
  async createBatchInspection(locationInspectionData, inspectorId) {
    const {
      location,
      equipments
    } = locationInspectionData;

    try {
      console.log(`开始批量创建点检记录 - 位置: ${location}, 器材数量: ${equipments.length}`);
      
      // 开启事务
      const result = await this.prisma.$transaction(async (prisma) => {
        const createdInspections = [];
        const createdIssues = [];
        let normalCount = 0;
        let abnormalCount = 0;

        // 逐个处理每个器材的点检记录
        for (const equipmentData of equipments) {
          const {
            equipmentId,
            overallResult,
            checklistResults,
            inspectionImageUrl,
            issueDescription,
            issueImageUrl
          } = equipmentData;

          console.log(`处理器材 ${equipmentId} 的点检记录, 结果: ${overallResult}`);

          // 1. 验证器材存在
          const equipment = await prisma.equipment.findUnique({
            where: { id: equipmentId },
            include: { factory: true }
          });

          if (!equipment) {
            throw new Error(`器材不存在: ID ${equipmentId}`);
          }

          let issueId = null;

          // 2. 如果点检结果异常，创建隐患记录
          if (overallResult === 'ABNORMAL') {
            console.log(`为器材 ${equipmentId} 创建隐患记录`);
            const issue = await prisma.issue.create({
              data: {
                equipmentId,
                description: issueDescription || '点检发现异常',
                reporterId: inspectorId,
                issueImageUrl,
                status: 'PENDING'
              }
            });
            issueId = issue.id;
            createdIssues.push(issue);
            abnormalCount++;

            // 更新器材状态为异常
            await prisma.equipment.update({
              where: { id: equipmentId },
              data: { 
                status: 'ABNORMAL',
                lastInspectedAt: new Date()
              }
            });
          } else {
            console.log(`器材 ${equipmentId} 点检正常`);
            normalCount++;
            
            // 正常情况下，检查是否还有其他未解决的隐患
            const activeIssueCount = await prisma.issue.count({
              where: {
                equipmentId,
                status: { in: ['PENDING', 'IN_PROGRESS', 'PENDING_AUDIT'] }
              }
            });

            // 更新器材状态和最后点检时间
            await prisma.equipment.update({
              where: { id: equipmentId },
              data: { 
                status: activeIssueCount === 0 ? 'NORMAL' : 'ABNORMAL',
                lastInspectedAt: new Date()
              }
            });
          }

          // 3. 创建点检记录
          const inspection = await prisma.inspectionLog.create({
            data: {
              equipmentId,
              inspectorId,
              overallResult,
              inspectionImageUrl,
              checklistResults: JSON.stringify(checklistResults),
              issueId
            },
            include: {
              equipment: {
                select: {
                  id: true,
                  name: true,
                  qrCode: true,
                  location: true,
                  equipmentType: {
                    select: { name: true }
                  }
                }
              },
              inspector: {
                select: {
                  id: true,
                  fullName: true
                }
              },
              issue: {
                select: {
                  id: true,
                  description: true,
                  status: true
                }
              }
            }
          });

          createdInspections.push(inspection);
          console.log(`成功创建器材 ${equipmentId} 的点检记录: ${inspection.id}`);
        }

        console.log(`批量点检完成 - 正常: ${normalCount}, 异常: ${abnormalCount}, 隐患: ${createdIssues.length}`);

        return {
          inspections: createdInspections,
          issues: createdIssues,
          summary: {
            location,
            totalEquipments: equipments.length,
            normalCount,
            abnormalCount,
            issueCount: createdIssues.length,
            inspectorId
          }
        };
      });

      console.log('批量点检记录创建成功');
      return result;

    } catch (error) {
      console.error('批量创建点检记录失败:', error);
      throw error;
    }
  }

  /**
   * 私有方法：加载点检记录（含器材与工厂）用于更新
   */
  async _loadInspectionForUpdate(prisma, id) {
    return prisma.inspectionLog.findUnique({
      where: { id },
      include: {
        equipment: {
          select: {
            id: true,
            factoryId: true,
            status: true
          }
        }
      }
    });
  }

  /**
   * 私有方法：权限校验
   * INSPECTOR 只能操作自己的记录；FACTORY_ADMIN 需同厂区；SUPER_ADMIN 放行
   */
  _checkPermission(inspection, user) {
    if (!inspection) {
      throw new Error('点检记录不存在');
    }
    const role = user.role;
    if (role === 'SUPER_ADMIN') return;
    const factoryId = inspection.equipment.factoryId;
    if (role === 'FACTORY_ADMIN') {
      if (factoryId !== user.factoryId) throw new Error('PERMISSION_DENIED');
      return;
    }
    if (role === 'INSPECTOR') {
      if (inspection.inspectorId !== user.id || factoryId !== user.factoryId) {
        throw new Error('PERMISSION_DENIED');
      }
      return;
    }
    // 其它角色（若存在）默认按厂区隔离
    if (factoryId !== user.factoryId) throw new Error('PERMISSION_DENIED');
  }

  /**
   * 私有方法：更新图片数组（统一序列化+首图同步）
   */
  _updateImageArray(images, newField, oldField) {
    return ImageHelper.prepareForSave(images, newField, oldField);
  }

  /**
   * 私有方法：判断文件是否仍被引用
   * 由于多图字段存储为JSON字符串(String)，使用 contains('"url"') 精确匹配 token
   */
  async _isFileReferenced(prisma, url) {
    const token = `"${url}"`;
    const [
      issueCount,
      issueMultiCount,
      issueFixedSingleCount,
      issueFixedMultiCount,
      inspSingleCount,
      inspMultiCount
    ] = await Promise.all([
      prisma.issue.count({ where: { issueImageUrl: url } }),
      prisma.issue.count({ where: { issueImageUrls: { contains: token } } }),
      prisma.issue.count({ where: { fixedImageUrl: url } }),
      prisma.issue.count({ where: { fixedImageUrls: { contains: token } } }),
      prisma.inspectionLog.count({ where: { inspectionImageUrl: url } }),
      prisma.inspectionLog.count({ where: { inspectionImageUrls: { contains: token } } })
    ]);
    return (issueCount + issueMultiCount + issueFixedSingleCount + issueFixedMultiCount + inspSingleCount + inspMultiCount) > 0;
  }

  /**
   * 私有方法：安全删除本地未再引用的上传文件
   */
  async _safeUnlink(url) {
    try {
      const fs = require('fs');
      const path = require('path');
      if (!url || typeof url !== 'string') return;
      // 仅允许形如 /uploads/xxx 或 /uploads/sub/xxx
      if (!url.startsWith('/uploads/')) return;
      const relative = url.replace(/^\/uploads\//, '');
      const filePath = path.join(__dirname, '../../uploads', relative);
      if (filePath.indexOf(path.join(__dirname, '../../uploads')) !== 0) return; // 目录逃逸保护
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
    } catch (e) {
      console.warn('[SAFE_UNLINK] 删除文件失败(忽略)：', e.message);
    }
  }

  /**
   * 创建空点检记录（增量模式起点）
   * checklistResults 使用 { "__pending": true } 占位，finalize 时校验
   */
  async createEmptyInspection(equipmentId, inspectorId) {
    try {
      const equipment = await this.prisma.equipment.findUnique({
        where: { id: equipmentId },
        select: { id: true, factoryId: true, status: true }
      });
      if (!equipment) throw new Error('器材不存在');

      const inspection = await this.prisma.inspectionLog.create({
        data: {
          equipmentId,
            inspectorId,
          overallResult: 'NORMAL',
          inspectionImageUrls: null,
          inspectionImageUrl: null,
          checklistResults: JSON.stringify({ __pending: true }),
          issueId: null
        },
        include: {
          equipment: { select: { id: true, factoryId: true } },
          inspector: { select: { id: true, fullName: true } }
        }
      });

      // 归一化返回
      return {
        ...inspection,
        inspectionImages: [],
        inspectionImageUrl: null
      };
    } catch (error) {
      console.error('创建空点检记录失败:', error);
      throw error;
    }
  }

  /**
   * 追加一张点检图片
   */
  async appendInspectionImage(id, type, imageUrl, user) {
    if (type !== 'inspection') {
      // 预留扩展
      throw new Error('暂不支持的图片类型');
    }
    try {
      const updated = await this.prisma.$transaction(async (prisma) => {
        const inspection = await this._loadInspectionForUpdate(prisma, id);
        this._checkPermission(inspection, user);

        // pending 检查：允许在 finalize 前追加
        const existingImages = ImageHelper.extractImages(inspection, 'inspectionImageUrls', 'inspectionImageUrl');
        if (existingImages.includes(imageUrl)) {
          throw new Error('IMAGE_ALREADY_EXISTS');
        }

        const newImages = [...existingImages, imageUrl];
        const imageData = this._updateImageArray(newImages, 'inspectionImageUrls', 'inspectionImageUrl');

        const saved = await prisma.inspectionLog.update({
          where: { id },
          data: {
            ...imageData
          },
          include: {
            equipment: { select: { id: true, factoryId: true } },
            inspector: { select: { id: true, fullName: true } }
          }
        });

        const inspectionImages = ImageHelper.extractImages(saved, 'inspectionImageUrls', 'inspectionImageUrl');

        return {
          ...saved,
          inspectionImages,
          inspectionImageUrl: saved.inspectionImageUrl || inspectionImages[0] || null
        };
      });

      return updated;
    } catch (error) {
      console.error('追加点检图片失败:', error);
      throw error;
    }
  }

  /**
   * 删除一张点检图片
   */
  async removeInspectionImage(id, type, imageUrl, user) {
    if (type !== 'inspection') {
      throw new Error('暂不支持的图片类型');
    }
    try {
      const updated = await this.prisma.$transaction(async (prisma) => {
        const inspection = await this._loadInspectionForUpdate(prisma, id);
        this._checkPermission(inspection, user);

        const existingImages = ImageHelper.extractImages(inspection, 'inspectionImageUrls', 'inspectionImageUrl');
        if (!existingImages.includes(imageUrl)) {
          throw new Error('IMAGE_NOT_FOUND');
        }
        const newImages = existingImages.filter(u => u !== imageUrl);
        const imageData = this._updateImageArray(newImages, 'inspectionImageUrls', 'inspectionImageUrl');

        const saved = await prisma.inspectionLog.update({
          where: { id },
          data: {
            ...imageData
          },
          include: {
            equipment: { select: { id: true, factoryId: true } },
            inspector: { select: { id: true, fullName: true } }
          }
        });

        // 删除物理文件（事务外逻辑需放在事务回调后，但我们先记录是否可删）
        const shouldDelete = !(await this._isFileReferenced(prisma, imageUrl));

        const inspectionImages = ImageHelper.extractImages(saved, 'inspectionImageUrls', 'inspectionImageUrl');

        return {
          saved,
          shouldDelete,
          response: {
            ...saved,
            inspectionImages,
            inspectionImageUrl: saved.inspectionImageUrl || inspectionImages[0] || null
          }
        };
      });

      if (updated.shouldDelete) {
        this._safeUnlink(imageUrl);
      }

      return updated.response;
    } catch (error) {
      console.error('删除点检图片失败:', error);
      throw error;
    }
  }

  /**
   * 最终提交点检记录
   * body: { overallResult, checklistResults, issueDescription, issueImageUrl?, issueImageUrls? }
   */
  async finalizeInspection(id, data, user) {
    try {
      const result = await this.prisma.$transaction(async (prisma) => {
        const inspection = await this._loadInspectionForUpdate(prisma, id);
        this._checkPermission(inspection, user);

        // 状态校验（防重复提交）
        let pendingFlag = false;
        try {
          const parsed = JSON.parse(inspection.checklistResults || '{}');
          if (parsed && typeof parsed === 'object' && parsed.__pending) {
            pendingFlag = true;
          }
        } catch {
          // ignore
        }
        if (!pendingFlag) {
          throw new Error('INVALID_STATE');
        }

        const {
          overallResult,
          checklistResults,
          issueDescription,
          issueImageUrl,
          issueImageUrls
        } = data || {};

        if (!overallResult || !['NORMAL', 'ABNORMAL'].includes(overallResult)) {
          throw new Error('overallResult 参数无效');
        }
        if (!Array.isArray(checklistResults) || checklistResults.length === 0) {
          throw new Error('checklistResults 不能为空数组');
        }

        let issueId = null;

        if (overallResult === 'ABNORMAL') {
          const finalIssueImages = issueImageUrls || issueImageUrl;
          const issueImageData = ImageHelper.prepareForSave(
            finalIssueImages,
            'issueImageUrls',
            'issueImageUrl'
          );
          const issue = await prisma.issue.create({
            data: {
              equipmentId: inspection.equipmentId,
              description: issueDescription || '点检发现异常',
              reporterId: inspection.inspectorId,
              status: 'PENDING',
              ...issueImageData
            }
          });
          issueId = issue.id;

          // 更新设备状态为异常
          await prisma.equipment.update({
            where: { id: inspection.equipmentId },
            data: { status: 'ABNORMAL' }
          });
        } else {
          // 正常：若设备之前异常则检查是否可以恢复
            if (inspection.equipment.status === 'ABNORMAL') {
            const activeCount = await prisma.issue.count({
              where: {
                equipmentId: inspection.equipmentId,
                status: { in: ['PENDING', 'IN_PROGRESS', 'PENDING_AUDIT'] }
              }
            });
            if (activeCount === 0) {
              await prisma.equipment.update({
                where: { id: inspection.equipmentId },
                data: { status: 'NORMAL' }
              });
            }
          }
        }

        const updatedInspection = await prisma.inspectionLog.update({
          where: { id },
          data: {
            overallResult,
            checklistResults: JSON.stringify(checklistResults),
            issueId
          },
          include: {
            equipment: {
              select: {
                id: true,
                factoryId: true,
                status: true
              }
            },
            inspector: {
              select: { id: true, fullName: true }
            },
            issue: {
              select: { id: true, description: true, status: true }
            }
          }
        });

        // 更新设备最后点检时间
        await prisma.equipment.update({
          where: { id: inspection.equipmentId },
          data: { lastInspectedAt: new Date() }
        });

        const inspectionImages = ImageHelper.extractImages(updatedInspection, 'inspectionImageUrls', 'inspectionImageUrl');

        return {
          ...updatedInspection,
          inspectionImages,
          inspectionImageUrl: updatedInspection.inspectionImageUrl || inspectionImages[0] || null
        };
      });

      return result;
    } catch (error) {
      console.error('最终提交点检记录失败:', error);
      throw error;
    }
  }
}

module.exports = InspectionService;
