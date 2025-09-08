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
        equipmentTypeId,
        reporterId,
        handlerId,
        startDate,
        endDate,
        severity,
        search,
        hasImage,
        overdue,
        factoryId,
        factoryIds
      } = filters;

      const {
        page = 1,
        limit = 20,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = pagination;

      console.log('🔍 [隐患服务调试] 解析后的分页参数:', { page, limit, sortBy, sortOrder });

      // 构建查询条件（使用 AND 聚合）
      const andConds = [];

      // 数据隔离 + 前端厂区筛选取交集
      let allowedFactoryIds = null;
      const explicitFactoryIds = Array.isArray(factoryIds) && factoryIds.length > 0
        ? factoryIds
        : (factoryId ? [factoryId] : []);

      if (Array.isArray(userFactoryId) && userFactoryId.length > 0) {
        allowedFactoryIds = explicitFactoryIds.length > 0 ? explicitFactoryIds.filter(id => userFactoryId.includes(id)) : userFactoryId;
        if (Array.isArray(allowedFactoryIds) && allowedFactoryIds.length === 0) {
          // 无权限交集，直接返回空结果
          return {
            issues: [],
            pagination: { total: 0, page, limit, pages: 0, hasNext: false, hasPrev: false }
          };
        }
      } else if (userFactoryId) {
        // 单厂区权限
        allowedFactoryIds = explicitFactoryIds.length > 0 ? explicitFactoryIds.filter(id => id === userFactoryId) : [userFactoryId];
        if (!allowedFactoryIds || allowedFactoryIds.length === 0) {
          return {
            issues: [],
            pagination: { total: 0, page, limit, pages: 0, hasNext: false, hasPrev: false }
          };
        }
      } else {
        // 超级管理员，无限制 -> 使用显式选择（如有）
        allowedFactoryIds = explicitFactoryIds.length > 0 ? explicitFactoryIds : null;
      }
      if (allowedFactoryIds) {
        andConds.push({ equipment: { factoryId: Array.isArray(allowedFactoryIds) ? { in: allowedFactoryIds } : allowedFactoryIds } });
        console.log('🔍 [隐患服务调试] 添加厂区过滤条件:', { allowedFactoryIds });
      } else {
        console.log('🔍 [隐患服务调试] ⚠️  无厂区过滤条件 (使用全部可见)');
      }

      // 点检员只能查看自己上报的隐患
      if (userRole === 'INSPECTOR' && userId) {
        andConds.push({ reporterId: userId });
        console.log('🔍 [隐患服务调试] 添加点检员过滤条件:', { reporterId: userId });
      } else if (reporterId) {
        andConds.push({ reporterId });
        console.log('🔍 [隐患服务调试] 添加上报人过滤条件:', { reporterId });
      }

      // 处理人筛选
      if (handlerId) {
        andConds.push({ handlerId });
        console.log('🔍 [隐患服务调试] 添加处理人过滤条件:', { handlerId });
      }

      // 状态筛选
      if (status) {
        andConds.push({ status });
        console.log('🔍 [隐患服务调试] 添加状态过滤条件:', { status });
      }

      // 器材筛选
      if (equipmentId) {
        andConds.push({ equipmentId });
        console.log('🔍 [隐患服务调试] 添加器材过滤条件:', { equipmentId });
      }
      if (equipmentTypeId) {
        andConds.push({ equipment: { typeId: equipmentTypeId } });
        console.log('🔍 [隐患服务调试] 添加器材类型过滤条件:', { equipmentTypeId });
      }

      // 日期范围筛选
      if (startDate || endDate) {
        const dateFilter = {};
        if (startDate) dateFilter.gte = new Date(startDate);
        if (endDate) dateFilter.lte = new Date(endDate);
        andConds.push({ createdAt: dateFilter });
        console.log('🔍 [隐患服务调试] 添加日期过滤条件:', dateFilter);
      }

      // 关键词搜索（描述/设备名/位置/二维码/上报人）
      if (search && String(search).trim().length > 0) {
        const s = String(search).trim();
        andConds.push({ OR: [
          { description: { contains: s } },
          { equipment: { name: { contains: s } } },
          { equipment: { location: { contains: s } } },
          { equipment: { qrCode: { contains: s } } },
          { reporter: { fullName: { contains: s } } }
        ]});
        console.log('🔍 [隐患服务调试] 添加搜索过滤条件:', { search: s });
      }

      // 是否包含图片
      if (hasImage === true) {
        andConds.push({ OR: [
          { issueImageUrl: { not: null } },
          { fixedImageUrl: { not: null } },
          { issueImageUrls: { not: null } },
          { fixedImageUrls: { not: null } }
        ]});
        console.log('🔍 [隐患服务调试] 添加有图过滤条件');
      }

      // 超期（开放天数 > overdue，仅统计未关闭/未驳回）
      if (overdue && Number.isInteger(overdue) && overdue > 0) {
        const overdueDate = new Date(Date.now() - overdue * 24 * 60 * 60 * 1000);
        andConds.push({ createdAt: { lte: overdueDate } });
        andConds.push({ status: { in: ['PENDING', 'IN_PROGRESS', 'PENDING_AUDIT'] } });
        console.log('🔍 [隐患服务调试] 添加超期过滤条件:', { overdueDays: overdue });
      }

      const where = andConds.length > 0 ? { AND: andConds } : {};
      console.log('🔍 [隐患服务调试] 最终的查询条件:', JSON.stringify(where, null, 2));

      const skip = (page - 1) * limit;
      const orderBy = {};
      orderBy[sortBy] = sortOrder;

      console.log('🔍 [隐患服务调试] 分页和排序:', { skip, limit, orderBy });

      // 分支：是否需要计算型严重程度（筛选/排序）
      let issues, total;
      const requiresComputedSeverity = Boolean(severity) || sortBy === 'severity';

      if (requiresComputedSeverity) {
        console.log('🔍 [隐患服务调试] 使用计算型严重程度进行筛选/排序');
        // 先取全量匹配 where 的数据
        issues = await this.prisma.issue.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          include: {
            equipment: {
              select: {
                id: true,
                name: true,
                qrCode: true,
                location: true,
                factory: { select: { id: true, name: true } },
                equipmentType: { select: { id: true, name: true } }
              }
            },
            reporter: { select: { id: true, fullName: true, role: true } },
            handler: { select: { id: true, fullName: true, role: true } },
            auditor: { select: { id: true, fullName: true, role: true } },
            inspectionLog: { select: { id: true, inspectionTime: true, overallResult: true } }
          }
        });
      } else {
        // 先查询总数
        console.log('🔍 [隐患服务调试] 开始执行count查询...');
        total = await this.prisma.issue.count({ where });
        console.log('🔍 [隐患服务调试] 查询到的总记录数:', total);

        // 再查询列表（使用数据库分页）
        console.log('🔍 [隐患服务调试] 开始执行findMany查询...');
        issues = await this.prisma.issue.findMany({
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
              factory: { select: { id: true, name: true } },
              equipmentType: { select: { id: true, name: true } }
              }
            },
            reporter: { select: { id: true, fullName: true, role: true } },
            handler: { select: { id: true, fullName: true, role: true } },
            auditor: { select: { id: true, fullName: true, role: true } },
            inspectionLog: { select: { id: true, inspectionTime: true, overallResult: true } }
          }
        });
      }

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

      // 计算隐患处理时效 & 归一化多图片字段（与详情接口保持一致结构）
      let processedIssues = issues.map(issue => {
        const issueImages = ImageHelper.extractImages(issue, 'issueImageUrls', 'issueImageUrl');
        const fixedImages = ImageHelper.extractImages(issue, 'fixedImageUrls', 'fixedImageUrl');
        return {
          ...issue,
          issueImages,
          fixedImages,
          // 单图片字段向下兼容（若旧字段为空则从数组首图补齐）
          issueImageUrl: issue.issueImageUrl || issueImages[0] || null,
          fixedImageUrl: issue.fixedImageUrl || fixedImages[0] || null,
          daysOpen: Math.floor((Date.now() - issue.createdAt.getTime()) / (24 * 60 * 60 * 1000)),
          processingTime: issue.handledAt
            ? Math.floor((issue.handledAt.getTime() - issue.createdAt.getTime()) / (24 * 60 * 60 * 1000))
            : null,
          severity: this.calculateIssueSeverity(issue)
        };
      });

      // 计算型严重程度筛选
      if (severity) {
        processedIssues = processedIssues.filter(i => i.severity === severity);
      }

      // 严重程度排序（如请求）
      if (sortBy === 'severity') {
        const order = ['LOW','MEDIUM','HIGH','CRITICAL'];
        processedIssues.sort((a,b) => {
          const av = order.indexOf(a.severity || 'LOW');
          const bv = order.indexOf(b.severity || 'LOW');
          return sortOrder === 'asc' ? av - bv : bv - av;
        });
      }

      // 计算分页（若前面未统计 total，则以筛选后总数为准）
      if (typeof total !== 'number') {
        total = processedIssues.length;
      }
      const pages = Math.ceil(total / limit);

      // 若使用计算分页，需要手动切片
      if (requiresComputedSeverity) {
        processedIssues = processedIssues.slice(skip, skip + limit);
      }

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

      // 数据权限检查（支持多厂区）
      if (Array.isArray(userFactoryId) && userFactoryId.length > 0) {
        if (!userFactoryId.includes(issue.equipment.factoryId)) {
          throw new Error('无权查看该隐患');
        }
      } else if (userFactoryId && issue.equipment.factoryId !== userFactoryId) {
        throw new Error('无权查看该隐患');
      }

      // 点检员只能查看自己上报的隐患
      if (userRole === 'INSPECTOR' && issue.reporterId !== userId) {
        throw new Error('无权查看该隐患');
      }

      const issueImages = ImageHelper.extractImages(issue, 'issueImageUrls', 'issueImageUrl');
      const fixedImages = ImageHelper.extractImages(issue, 'fixedImageUrls', 'fixedImageUrl');

      // 调试日志（DEBUG_IMAGES）已移除

      return {
        ...issue,
        issueImages,
        fixedImages,
        issueImageUrl: issue.issueImageUrl || issueImages[0] || null,
        fixedImageUrl: issue.fixedImageUrl || fixedImages[0] || null,
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
      if (Array.isArray(userFactoryId) && userFactoryId.length > 0) {
        if (!userFactoryId.includes(existingIssue.equipment.factoryId)) {
          throw new Error('无权处理该隐患');
        }
      } else if (userFactoryId && existingIssue.equipment.factoryId !== userFactoryId) {
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
        if (Array.isArray(userFactoryId) && userFactoryId.length > 0) {
          if (!userFactoryId.includes(existingIssue.equipment.factoryId)) {
            throw new Error('无权审核该隐患');
          }
        } else if (userFactoryId && existingIssue.equipment.factoryId !== userFactoryId) {
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
      if (Array.isArray(userFactoryId) && userFactoryId.length > 0) {
        if (!userFactoryId.includes(issue.equipment.factoryId)) {
          throw new Error('无权添加备注');
        }
      } else if (userFactoryId && issue.equipment.factoryId !== userFactoryId) {
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
  async getIssueStats(filters = {}, userFactoryId = null, userId = null, userRole = null, period = 'month') {
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

      // 构建查询条件（对齐列表筛选）
      const andConds = [{ createdAt: { gte: startTime } }];

      const { reporterId, handlerId, status, equipmentId, equipmentTypeId, search, hasImage, overdue, factoryId, factoryIds, startDate, endDate } = filters || {};

      // 数据隔离 + 厂区筛选
      let allowedFactoryIds = null;
      const explicitFactoryIds = Array.isArray(factoryIds) && factoryIds.length > 0 ? factoryIds : (factoryId ? [factoryId] : []);
      if (Array.isArray(userFactoryId) && userFactoryId.length > 0) {
        allowedFactoryIds = explicitFactoryIds.length > 0 ? explicitFactoryIds.filter(id => userFactoryId.includes(id)) : userFactoryId;
      } else if (userFactoryId) {
        allowedFactoryIds = explicitFactoryIds.length > 0 ? explicitFactoryIds.filter(id => id === userFactoryId) : [userFactoryId];
      } else {
        allowedFactoryIds = explicitFactoryIds.length > 0 ? explicitFactoryIds : null;
      }
      if (allowedFactoryIds) andConds.push({ equipment: { factoryId: Array.isArray(allowedFactoryIds) ? { in: allowedFactoryIds } : allowedFactoryIds } });

      if (userRole === 'INSPECTOR' && userId) andConds.push({ reporterId: userId });
      if (reporterId) andConds.push({ reporterId });
      if (handlerId) andConds.push({ handlerId });
      if (status) andConds.push({ status });
      if (equipmentId) andConds.push({ equipmentId });
      if (equipmentTypeId) andConds.push({ equipment: { typeId: equipmentTypeId } });

      if (startDate || endDate) {
        const range = {};
        if (startDate) range.gte = new Date(startDate);
        if (endDate) range.lte = new Date(endDate);
        andConds.push({ createdAt: range });
      }

      if (search && String(search).trim().length > 0) {
        const s = String(search).trim();
        andConds.push({ OR: [
          { description: { contains: s } },
          { equipment: { name: { contains: s } } },
          { equipment: { location: { contains: s } } },
          { equipment: { qrCode: { contains: s } } },
          { reporter: { fullName: { contains: s } } }
        ]});
      }

      if (hasImage === true) {
        andConds.push({ OR: [
          { issueImageUrl: { not: null } },
          { fixedImageUrl: { not: null } },
          { issueImageUrls: { not: null } },
          { fixedImageUrls: { not: null } }
        ]});
      }

      if (overdue && Number.isInteger(overdue) && overdue > 0) {
        const overdueDate = new Date(Date.now() - overdue * 24 * 60 * 60 * 1000);
        andConds.push({ createdAt: { lte: overdueDate } });
        andConds.push({ status: { in: ['PENDING', 'IN_PROGRESS', 'PENDING_AUDIT'] } });
      }

      const where = andConds.length > 0 ? { AND: andConds } : {};

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
  async getIssueTrend(filters = {}, userFactoryId = null, days = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      // 构建 where（与列表筛选一致）
      const andConds = [{ createdAt: { gte: startDate, lte: endDate } }];
      const { reporterId, handlerId, status, equipmentId, equipmentTypeId, search, hasImage, overdue, factoryId, factoryIds, startDate: fStart, endDate: fEnd } = (typeof filters === 'object' && filters) || {};

      // 数据隔离 + 厂区筛选
      let allowedFactoryIds = null;
      const explicitFactoryIds = Array.isArray(factoryIds) && factoryIds.length > 0 ? factoryIds : (factoryId ? [factoryId] : []);
      if (Array.isArray(userFactoryId) && userFactoryId.length > 0) {
        allowedFactoryIds = explicitFactoryIds.length > 0 ? explicitFactoryIds.filter(id => userFactoryId.includes(id)) : userFactoryId;
      } else if (userFactoryId) {
        allowedFactoryIds = explicitFactoryIds.length > 0 ? explicitFactoryIds.filter(id => id === userFactoryId) : [userFactoryId];
      } else {
        allowedFactoryIds = explicitFactoryIds.length > 0 ? explicitFactoryIds : null;
      }
      if (allowedFactoryIds) andConds.push({ equipment: { factoryId: Array.isArray(allowedFactoryIds) ? { in: allowedFactoryIds } : allowedFactoryIds } });

      // 点检员统计维持原有规则：仅以 reporterId 控制在调用处处理
      if (reporterId) andConds.push({ reporterId });
      if (handlerId) andConds.push({ handlerId });
      if (status) andConds.push({ status });
      if (equipmentId) andConds.push({ equipmentId });
      if (equipmentTypeId) andConds.push({ equipment: { typeId: equipmentTypeId } });

      if (fStart || fEnd) {
        const range = {};
        if (fStart) range.gte = new Date(fStart);
        if (fEnd) range.lte = new Date(fEnd);
        andConds.push({ createdAt: range });
      }

      if (search && String(search).trim().length > 0) {
        const s = String(search).trim();
        andConds.push({ OR: [
          { description: { contains: s } },
          { equipment: { name: { contains: s } } },
          { equipment: { location: { contains: s } } },
          { equipment: { qrCode: { contains: s } } },
          { reporter: { fullName: { contains: s } } }
        ]});
      }

      if (hasImage === true) {
        andConds.push({ OR: [
          { issueImageUrl: { not: null } },
          { fixedImageUrl: { not: null } },
          { issueImageUrls: { not: null } },
          { fixedImageUrls: { not: null } }
        ]});
      }

      if (overdue && Number.isInteger(overdue) && overdue > 0) {
        const overdueDate = new Date(Date.now() - overdue * 24 * 60 * 60 * 1000);
        andConds.push({ createdAt: { lte: overdueDate } });
        andConds.push({ status: { in: ['PENDING', 'IN_PROGRESS', 'PENDING_AUDIT'] } });
      }

      const where = andConds.length > 0 ? { AND: andConds } : {};

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
