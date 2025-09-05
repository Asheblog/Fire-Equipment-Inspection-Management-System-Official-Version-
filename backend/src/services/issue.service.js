/**
 * 消防器材点检系统 - 隐患管理服务
 * 处理隐患上报、处理、审核等业务逻辑
 */

const { PrismaClient } = require('@prisma/client');
const ImageHelper = require('../utils/image.helper');

class IssueService {
  constructor() {
    this.prisma = new PrismaClient();
  }

  /**
   * 获取隐患列表
   * @param {Object} filters - 筛选条件
   * @param {Object} pagination - 分页参数
   * @param {number} userFactoryId - 用户厂区ID
   * @param {number} userId - 用户ID
   * @param {string} userRole - 用户角色
   * @returns {Promise<Object>} 隐患列表
   */
  async getIssueList(filters = {}, pagination = {}, userFactoryId = null, userId = null, userRole = null) {
    try {
      console.log('\n🔍 [隐患服务调试] ===== 开始查询隐患列表 =====');
      console.log('🔍 [隐患服务调试] 接收到的参数:', {
        filters,
        pagination,
        userFactoryId,
        userId,
        userRole
      });

      const {
        status,
        equipmentId,
        reporterId,
        startDate,
        endDate,
        severity
      } = filters;

      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = pagination;

      console.log('🔍 [隐患服务调试] 解析后的分页参数:', { page, limit, sortBy, sortOrder });

      // 构建查询条件
      const where = {};

      // 数据隔离
      if (userFactoryId) {
        where.equipment = { factoryId: userFactoryId };
        console.log('🔍 [隐患服务调试] 添加厂区过滤条件:', { factoryId: userFactoryId });
      } else {
        console.log('🔍 [隐患服务调试] ⚠️  无厂区过滤条件 (userFactoryId 为空)');
      }

      // 点检员只能查看自己上报的隐患
      if (userRole === 'INSPECTOR' && userId) {
        where.reporterId = userId;
        console.log('🔍 [隐患服务调试] 添加点检员过滤条件:', { reporterId: userId });
      } else if (reporterId) {
        where.reporterId = reporterId;
        console.log('🔍 [隐患服务调试] 添加上报人过滤条件:', { reporterId });
      }

      // 状态筛选
      if (status) {
        where.status = status;
        console.log('🔍 [隐患服务调试] 添加状态过滤条件:', { status });
      }

      // 器材筛选
      if (equipmentId) {
        where.equipmentId = equipmentId;
        console.log('🔍 [隐患服务调试] 添加器材过滤条件:', { equipmentId });
      }

      // 日期范围筛选
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
          where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
          where.createdAt.lte = new Date(endDate);
        }
        console.log('🔍 [隐患服务调试] 添加日期过滤条件:', where.createdAt);
      }

      console.log('🔍 [隐患服务调试] 最终的查询条件:', JSON.stringify(where, null, 2));

      const skip = (page - 1) * limit;
      const orderBy = {};
      orderBy[sortBy] = sortOrder;

      console.log('🔍 [隐患服务调试] 分页和排序:', { skip, limit, orderBy });

      // 先查询总数
      console.log('🔍 [隐患服务调试] 开始执行count查询...');
      const total = await this.prisma.issue.count({ where });
      console.log('🔍 [隐患服务调试] 查询到的总记录数:', total);

      // 再查询列表
      console.log('🔍 [隐患服务调试] 开始执行findMany查询...');
      const issues = await this.prisma.issue.findMany({
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
          reporter: {
            select: {
              id: true,
              fullName: true,
              role: true
            }
          },
          handler: {
            select: {
              id: true,
              fullName: true,
              role: true
            }
          },
          auditor: {
            select: {
              id: true,
              fullName: true,
              role: true
            }
          },
          inspectionLog: {
            select: {
              id: true,
              inspectionTime: true,
              overallResult: true
            }
          }
        }
      });

      console.log('🔍 [隐患服务调试] 查询到的记录数:', issues.length);
      
      if (issues.length > 0) {
        console.log('🔍 [隐患服务调试] 前3条记录详情:');
        issues.slice(0, 3).forEach((issue, index) => {
          console.log(`  ${index + 1}. ID: ${issue.id}, 状态: ${issue.status}, 器材厂区: ${issue.equipment.factory.name} (ID: ${issue.equipment.factory.id})`);
          console.log(`     上报人: ${issue.reporter.fullName} (${issue.reporter.role})`);
          console.log(`     创建时间: ${issue.createdAt.toISOString()}`);
        });
      } else {
        console.log('🔍 [隐患服务调试] ⚠️  查询结果为空');
        
        // 额外调试：查看是否有任何隐患记录
        const totalIssues = await this.prisma.issue.count();
        console.log('🔍 [隐患服务调试] 数据库中的隐患总数:', totalIssues);
        
        if (totalIssues > 0) {
          // 查看是否是厂区过滤的问题
          if (userFactoryId) {
            const issuesWithoutFilter = await this.prisma.issue.findMany({
              select: {
                id: true,
                status: true,
                equipment: {
                  select: {
                    factory: {
                      select: { id: true, name: true }
                    }
                  }
                }
              }
            });
            console.log('🔍 [隐患服务调试] 所有隐患记录的厂区分布:');
            issuesWithoutFilter.forEach(issue => {
              console.log(`    隐患 ${issue.id}: 厂区 ${issue.equipment.factory.name} (ID: ${issue.equipment.factory.id})`);
            });
          }
        }
      }

      const pages = Math.ceil(total / limit);

      // 计算隐患处理时效
      const processedIssues = issues.map(issue => ({
        ...issue,
        daysOpen: Math.floor((Date.now() - issue.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
        processingTime: issue.handledAt 
          ? Math.floor((issue.handledAt.getTime() - issue.createdAt.getTime()) / (24 * 60 * 60 * 1000))
          : null,
        severity: this.calculateIssueSeverity(issue)
      }));

      const result = {
        issues: processedIssues,
        pagination: {
          total,
          page,
          limit,
          pages,
          hasNext: page < pages,
          hasPrev: page > 1
        }
      };

      console.log('🔍 [隐患服务调试] 返回结果统计:', {
        processedIssuesCount: result.issues.length,
        total: result.pagination.total,
        page: result.pagination.page
      });
      console.log('🔍 [隐患服务调试] ===== 隐患列表查询完成 =====\n');

      return result;
    } catch (error) {
      console.error('🔍 [隐患服务调试] ❌ 获取隐患列表失败:', error);
      throw new Error('获取隐患列表失败');
    }
  }

  /**
   * 获取隐患详情
   * @param {number} id - 隐患ID
   * @param {number} userFactoryId - 用户厂区ID
   * @param {number} userId - 用户ID
   * @param {string} userRole - 用户角色
   * @returns {Promise<Object>} 隐患详情
   */
  async getIssueById(id, userFactoryId = null, userId = null, userRole = null) {
    try {
      const issue = await this.prisma.issue.findUnique({
        where: { id },
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
          reporter: {
            select: {
              id: true,
              fullName: true,
              role: true,
              factory: {
                select: { id: true, name: true }
              }
            }
          },
          handler: {
            select: {
              id: true,
              fullName: true,
              role: true
            }
          },
          auditor: {
            select: {
              id: true,
              fullName: true,
              role: true
            }
          },
          inspectionLog: {
            include: {
              inspector: {
                select: { id: true, fullName: true }
              }
            }
          }
        }
      });

      if (!issue) {
        throw new Error('隐患不存在');
      }

      // 数据权限检查
      if (userFactoryId && issue.equipment.factoryId !== userFactoryId) {
        throw new Error('无权查看该隐患');
      }

      // 点检员只能查看自己上报的隐患
      if (userRole === 'INSPECTOR' && issue.reporterId !== userId) {
        throw new Error('无权查看该隐患');
      }

      return {
        ...issue,
        // 图片字段处理 - 优先返回数组格式，回退到单图片字段
        issueImages: ImageHelper.extractImages(issue, 'issueImageUrls', 'issueImageUrl'),
        fixedImages: ImageHelper.extractImages(issue, 'fixedImageUrls', 'fixedImageUrl'),
        // 保持向下兼容 - 继续提供单图片字段
        issueImageUrl: ImageHelper.extractImages(issue, 'issueImageUrls', 'issueImageUrl')[0] || null,
        fixedImageUrl: ImageHelper.extractImages(issue, 'fixedImageUrls', 'fixedImageUrl')[0] || null,
        daysOpen: Math.floor((Date.now() - issue.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
        processingTime: issue.handledAt 
          ? Math.floor((issue.handledAt.getTime() - issue.createdAt.getTime()) / (24 * 60 * 60 * 1000))
          : null,
        severity: this.calculateIssueSeverity(issue)
      };
    } catch (error) {
      console.error('获取隐患详情失败:', error);
      throw error;
    }
  }

  /**
   * 处理隐患
   * @param {number} id - 隐患ID
   * @param {Object} handleData - 处理数据
   * @param {number} handlerId - 处理人ID
   * @param {number} userFactoryId - 用户厂区ID
   * @returns {Promise<Object>} 处理后的隐患
   */
  async handleIssue(id, handleData, handlerId, userFactoryId = null) {
    const { 
      solution, 
      fixedImageUrl,    // 兼容旧版单图片字段
      fixedImageUrls    // 新的多图片字段
    } = handleData;

    try {
      // 处理整改图片数据 - 优先使用新字段，回退到旧字段
      const finalFixedImages = fixedImageUrls || fixedImageUrl;
      const fixedImageData = ImageHelper.prepareForSave(
        finalFixedImages,
        'fixedImageUrls',
        'fixedImageUrl'
      );

      // 检查隐患是否存在且可处理
      const existingIssue = await this.prisma.issue.findUnique({
        where: { id },
        include: {
          equipment: {
            select: { factoryId: true }
          }
        }
      });

      if (!existingIssue) {
        throw new Error('隐患不存在');
      }

      // 数据权限检查
      if (userFactoryId && existingIssue.equipment.factoryId !== userFactoryId) {
        throw new Error('无权处理该隐患');
      }

      // 检查隐患状态
      if (existingIssue.status !== 'PENDING') {
        throw new Error('隐患状态不允许处理');
      }

      // 更新隐患状态为待审核
      const updatedIssue = await this.prisma.issue.update({
        where: { id },
        data: {
          status: 'PENDING_AUDIT',
          handlerId,
          handledAt: new Date(),
          solution,
          ...fixedImageData  // 使用新的图片数据格式
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
          reporter: {
            select: {
              id: true,
              fullName: true
            }
          },
          handler: {
            select: {
              id: true,
              fullName: true
            }
          }
        }
      });

      return updatedIssue;
    } catch (error) {
      console.error('处理隐患失败:', error);
      throw error;
    }
  }

  /**
   * 审核隐患处理
   * @param {number} id - 隐患ID
   * @param {Object} auditData - 审核数据
   * @param {number} auditorId - 审核人ID
   * @param {number} userFactoryId - 用户厂区ID
   * @returns {Promise<Object>} 审核后的隐患
   */
  async auditIssue(id, auditData, auditorId, userFactoryId = null) {
    const { approved, auditNote } = auditData;

    try {
      // 开启事务
      const result = await this.prisma.$transaction(async (prisma) => {
        // 检查隐患是否存在且可审核
        const existingIssue = await prisma.issue.findUnique({
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

        if (!existingIssue) {
          throw new Error('隐患不存在');
        }

        // 数据权限检查
        if (userFactoryId && existingIssue.equipment.factoryId !== userFactoryId) {
          throw new Error('无权审核该隐患');
        }

        // 检查隐患状态
        if (existingIssue.status !== 'PENDING_AUDIT') {
          throw new Error('隐患状态不允许审核');
        }

        const newStatus = approved ? 'CLOSED' : 'REJECTED';

        // 更新隐患状态
        const updatedIssue = await prisma.issue.update({
          where: { id },
          data: {
            status: newStatus,
            auditorId,
            auditedAt: new Date(),
            auditNote
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
            reporter: {
              select: {
                id: true,
                fullName: true
              }
            },
            handler: {
              select: {
                id: true,
                fullName: true
              }
            },
            auditor: {
              select: {
                id: true,
                fullName: true
              }
            }
          }
        });

        // 如果审核通过，检查器材是否还有其他未解决的隐患
        if (approved) {
          const remainingIssues = await prisma.issue.count({
            where: {
              equipmentId: existingIssue.equipmentId,
              id: { not: id },
              status: { in: ['PENDING', 'IN_PROGRESS', 'PENDING_AUDIT'] }
            }
          });

          // 如果没有其他未解决的隐患，将器材状态改为正常
          if (remainingIssues === 0) {
            await prisma.equipment.update({
              where: { id: existingIssue.equipmentId },
              data: { status: 'NORMAL' }
            });
          }
        } else {
          // 如果审核不通过，将隐患状态改回待处理
          await prisma.issue.update({
            where: { id },
            data: { 
              status: 'PENDING',
              handlerId: null,
              handledAt: null,
              solution: null,
              fixedImageUrl: null
            }
          });
        }

        return updatedIssue;
      });

      return result;
    } catch (error) {
      console.error('审核隐患失败:', error);
      throw error;
    }
  }

  /**
   * 添加隐患处理备注
   * @param {number} id - 隐患ID
   * @param {string} comment - 备注内容
   * @param {number} userId - 用户ID
   * @param {number} userFactoryId - 用户厂区ID
   * @returns {Promise<Object>} 更新结果
   */
  async addComment(id, comment, userId, userFactoryId = null) {
    try {
      // 检查隐患是否存在
      const issue = await this.prisma.issue.findUnique({
        where: { id },
        include: {
          equipment: {
            select: { factoryId: true }
          }
        }
      });

      if (!issue) {
        throw new Error('隐患不存在');
      }

      // 数据权限检查
      if (userFactoryId && issue.equipment.factoryId !== userFactoryId) {
        throw new Error('无权添加备注');
      }

      // 这里可以扩展为独立的评论表，目前简化处理
      // 将备注追加到审核备注中
      const timestamp = new Date().toISOString();
      const newComment = `[${timestamp}] ${comment}`;
      const updatedNote = issue.auditNote 
        ? `${issue.auditNote}\n${newComment}`
        : newComment;

      const updatedIssue = await this.prisma.issue.update({
        where: { id },
        data: { auditNote: updatedNote }
      });

      return {
        success: true,
        message: '备注添加成功',
        comment: newComment
      };
    } catch (error) {
      console.error('添加备注失败:', error);
      throw error;
    }
  }

  /**
   * 获取隐患统计信息
   * @param {number} factoryId - 厂区ID
   * @param {number} userId - 用户ID
   * @param {string} userRole - 用户角色
   * @param {string} period - 统计周期
   * @returns {Promise<Object>} 统计信息
   */
  async getIssueStats(factoryId = null, userId = null, userRole = null, period = 'month') {
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
        createdAt: { gte: startTime }
      };

      // 数据隔离
      if (factoryId) {
        where.equipment = { factoryId };
      }

      // 点检员只能查看自己的统计
      if (userRole === 'INSPECTOR' && userId) {
        where.reporterId = userId;
      }

      const [
        totalIssues,
        pendingIssues,
        inProgressIssues,
        pendingAuditIssues,
        closedIssues,
        rejectedIssues,
        avgProcessingTime
      ] = await Promise.all([
        // 总隐患数
        this.prisma.issue.count({ where }),
        // 待处理
        this.prisma.issue.count({ where: { ...where, status: 'PENDING' } }),
        // 处理中
        this.prisma.issue.count({ where: { ...where, status: 'IN_PROGRESS' } }),
        // 待审核
        this.prisma.issue.count({ where: { ...where, status: 'PENDING_AUDIT' } }),
        // 已关闭
        this.prisma.issue.count({ where: { ...where, status: 'CLOSED' } }),
        // 已驳回
        this.prisma.issue.count({ where: { ...where, status: 'REJECTED' } }),
        // 平均处理时间
        this.calculateAvgProcessingTime(where)
      ]);

      // 计算解决率
      const resolveRate = totalIssues > 0 
        ? ((closedIssues / totalIssues) * 100).toFixed(2)
        : 0;

      return {
        period,
        startTime,
        endTime: now,
        total: totalIssues,
        byStatus: {
          pending: pendingIssues,
          inProgress: inProgressIssues,
          pendingAudit: pendingAuditIssues,
          closed: closedIssues,
          rejected: rejectedIssues
        },
        resolveRate: parseFloat(resolveRate),
        avgProcessingTime: avgProcessingTime || 0
      };
    } catch (error) {
      console.error('获取隐患统计失败:', error);
      throw new Error('获取隐患统计失败');
    }
  }

  /**
   * 获取隐患趋势数据
   * @param {number} factoryId - 厂区ID
   * @param {number} days - 天数
   * @returns {Promise<Array>} 趋势数据
   */
  async getIssueTrend(factoryId = null, days = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      const where = {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      };

      if (factoryId) {
        where.equipment = { factoryId };
      }

      // 按日期分组统计
      const issues = await this.prisma.issue.findMany({
        where,
        select: {
          createdAt: true,
          status: true
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
          pending: 0,
          closed: 0
        };
      }

      // 统计每日数据
      issues.forEach(issue => {
        const dateKey = issue.createdAt.toISOString().split('T')[0];
        if (trendData[dateKey]) {
          trendData[dateKey].total++;
          if (issue.status === 'PENDING') {
            trendData[dateKey].pending++;
          } else if (issue.status === 'CLOSED') {
            trendData[dateKey].closed++;
          }
        }
      });

      return Object.values(trendData);
    } catch (error) {
      console.error('获取隐患趋势失败:', error);
      throw new Error('获取隐患趋势失败');
    }
  }

  /**
   * 计算隐患严重程度
   * @param {Object} issue - 隐患对象
   * @returns {string} 严重程度 ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
   */
  calculateIssueSeverity(issue) {
    const daysOpen = Math.floor((Date.now() - issue.createdAt.getTime()) / (24 * 60 * 60 * 1000));
    
    // 根据隐患描述和开放天数计算严重程度
    const description = issue.description.toLowerCase();
    
    // 关键词检测
    const criticalKeywords = ['火灾', '爆炸', '泄漏', '危险', '紧急'];
    const highKeywords = ['故障', '损坏', '失效', '异常'];
    
    const hasCriticalKeywords = criticalKeywords.some(keyword => description.includes(keyword));
    const hasHighKeywords = highKeywords.some(keyword => description.includes(keyword));
    
    if (hasCriticalKeywords || daysOpen > 7) {
      return 'CRITICAL';
    } else if (hasHighKeywords || daysOpen > 3) {
      return 'HIGH';
    } else if (daysOpen > 1) {
      return 'MEDIUM';
    } else {
      return 'LOW';
    }
  }

  /**
   * 计算平均处理时间
   * @param {Object} where - 查询条件
   * @returns {Promise<number>} 平均处理天数
   */
  async calculateAvgProcessingTime(where) {
    try {
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

      if (closedIssues.length === 0) {
        return 0;
      }

      const totalDays = closedIssues.reduce((sum, issue) => {
        const days = Math.floor((issue.handledAt.getTime() - issue.createdAt.getTime()) / (24 * 60 * 60 * 1000));
        return sum + days;
      }, 0);

      return Math.round(totalDays / closedIssues.length);
    } catch (error) {
      console.error('计算平均处理时间失败:', error);
      return 0;
    }
  }
}

module.exports = IssueService;