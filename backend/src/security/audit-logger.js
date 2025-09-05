const { PrismaClient } = require('@prisma/client');

/**
 * 消防器材点检系统 - 审计日志系统
 * 
 * 记录所有重要的用户操作和系统事件：
 * - 用户登录/登出
 * - 数据增删改操作
 * - 权限变更
 * - 安全事件
 * - 系统异常
 */

class AuditLogger {
  constructor() {
    this.prisma = new PrismaClient();
    this.setupLogLevels();
  }

  /**
   * 设置日志级别
   */
  setupLogLevels() {
    this.LOG_LEVELS = {
      INFO: 'info',        // 一般信息
      WARN: 'warn',        // 警告
      ERROR: 'error',      // 错误
      SECURITY: 'security' // 安全事件
    };

    this.ACTION_TYPES = {
      // 认证相关
      LOGIN: 'login',
      LOGOUT: 'logout',
      LOGIN_FAILED: 'login_failed',
      PASSWORD_CHANGE: 'password_change',
      TOKEN_REFRESH: 'token_refresh',
      
      // 数据操作
      CREATE: 'create',
      READ: 'read',
      UPDATE: 'update',
      DELETE: 'delete',
      
      // 权限操作
      PERMISSION_GRANT: 'permission_grant',
      PERMISSION_REVOKE: 'permission_revoke',
      ROLE_CHANGE: 'role_change',
      
      // 系统操作
      SYSTEM_CONFIG: 'system_config',
      DATA_EXPORT: 'data_export',
      DATA_IMPORT: 'data_import',
      
      // 安全事件
      UNAUTHORIZED_ACCESS: 'unauthorized_access',
      RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
      SUSPICIOUS_ACTIVITY: 'suspicious_activity',
      SQL_INJECTION_ATTEMPT: 'sql_injection_attempt',
      XSS_ATTEMPT: 'xss_attempt'
    };

    this.RESOURCE_TYPES = {
      USER: 'user',
      EQUIPMENT: 'equipment',
      INSPECTION: 'inspection',
      ISSUE: 'issue',
      FACTORY: 'factory',
      SYSTEM: 'system'
    };
  }

  /**
   * 记录用户操作日志
   * @param {Object} req - Express请求对象
   * @param {string} action - 操作类型
   * @param {string} resource - 资源类型
   * @param {Object} details - 详细信息
   * @param {string} level - 日志级别
   */
  async logUserAction(req, action, resource, details = {}, level = this.LOG_LEVELS.INFO) {
    try {
      const logData = {
        level,
        action,
        resource,
        userId: req.user?.id || null,
        username: req.user?.username || 'anonymous',
        userRole: req.user?.role || null,
        factoryId: req.user?.factoryId || null,
        
        // 请求信息
        ipAddress: this.getClientIP(req),
        userAgent: req.get('User-Agent') || null,
        method: req.method,
        url: req.originalUrl,
        
        // 详细信息
        details: JSON.stringify({
          ...details,
          requestId: req.id || this.generateRequestId(),
          timestamp: new Date().toISOString()
        }),
        
        // 成功状态（在响应中间件中更新）
        success: null,
        statusCode: null,
        
        createdAt: new Date()
      };

      // 异步记录日志，不阻塞主流程
      setImmediate(async () => {
        try {
          // 开发环境保留控制台输出
          if (process.env.NODE_ENV === 'development') {
            console.log('审计日志:', JSON.stringify(logData, null, 2));
          }
          
          // 写入审计日志表
          await this.prisma.auditLog.create({ 
            data: {
              userId: logData.userId || null,
              userRole: logData.userRole || null,
              factoryId: logData.factoryId || null,
              action: logData.action,
              resource: logData.resource,
              resourceId: logData.resourceId ? String(logData.resourceId) : null,
              details: JSON.stringify({
                ...logData.details,
                requestId: logData.requestId,
                timestamp: logData.timestamp
              }),
              ipAddress: logData.ipAddress || null,
              userAgent: logData.userAgent || null,
              level: logData.level || 'INFO',
              status: logData.success === null ? 'PENDING' : (logData.success ? 'SUCCESS' : 'FAILED'),
            }
          });
        } catch (error) {
          console.error('审计日志记录失败:', error);
        }
      });
    } catch (error) {
      console.error('审计日志准备失败:', error);
    }
  }

  /**
   * 记录安全事件
   * @param {string} eventType - 事件类型
   * @param {Object} details - 事件详情
   * @param {Object} req - Express请求对象（可选）
   */
  async logSecurityEvent(eventType, details, req = null) {
    try {
      const securityLog = {
        level: this.LOG_LEVELS.SECURITY,
        action: eventType,
        resource: this.RESOURCE_TYPES.SYSTEM,
        
        // 用户信息
        userId: req?.user?.id || null,
        username: req?.user?.username || 'anonymous',
        userRole: req?.user?.role || null,
        factoryId: req?.user?.factoryId || null,
        
        // 请求信息
        ipAddress: req ? this.getClientIP(req) : null,
        userAgent: req?.get('User-Agent') || null,
        method: req?.method || null,
        url: req?.originalUrl || null,
        
        // 安全事件详情
        details: JSON.stringify({
          ...details,
          severity: this.getEventSeverity(eventType),
          timestamp: new Date().toISOString(),
          eventId: this.generateEventId()
        }),
        
        success: false, // 安全事件通常表示异常
        statusCode: details.statusCode || null,
        createdAt: new Date()
      };

      // 立即记录安全事件
      if (process.env.NODE_ENV === 'development') {
        console.warn('安全事件:', JSON.stringify(securityLog, null, 2));
      }
      
      // 写入安全日志表
      await this.prisma.securityLog.create({
        data: {
          eventType,
          userId: securityLog.userId || null,
          userRole: securityLog.userRole || null,
          factoryId: securityLog.factoryId || null,
          severity: this.getEventSeverity(eventType).toUpperCase(),
          description: securityLog.description || `安全事件: ${eventType}`,
          metadata: JSON.stringify({
            ...details,
            severity: this.getEventSeverity(eventType),
            eventId: this.generateEventId()
          }),
          ipAddress: securityLog.ipAddress || null,
          userAgent: securityLog.userAgent || null,
        }
      });
      
      // 严重安全事件发送告警
      if (this.getEventSeverity(eventType) === 'high') {
        this.sendSecurityAlert(securityLog);
      }
    } catch (error) {
      console.error('安全事件记录失败:', error);
    }
  }

  /**
   * 记录系统异常
   * @param {Error} error - 错误对象
   * @param {Object} req - Express请求对象
   * @param {Object} context - 上下文信息
   */
  async logSystemError(error, req, context = {}) {
    try {
      const errorLog = {
        level: this.LOG_LEVELS.ERROR,
        action: 'system_error',
        resource: this.RESOURCE_TYPES.SYSTEM,
        
        userId: req?.user?.id || null,
        username: req?.user?.username || 'anonymous',
        userRole: req?.user?.role || null,
        factoryId: req?.user?.factoryId || null,
        
        ipAddress: req ? this.getClientIP(req) : null,
        userAgent: req?.get('User-Agent') || null,
        method: req?.method || null,
        url: req?.originalUrl || null,
        
        details: JSON.stringify({
          errorName: error.name,
          errorMessage: error.message,
          errorStack: error.stack,
          context,
          timestamp: new Date().toISOString()
        }),
        
        success: false,
        statusCode: 500,
        createdAt: new Date()
      };

      if (process.env.NODE_ENV === 'development') {
        console.error('系统错误:', JSON.stringify(errorLog, null, 2));
      }
      
      // 写入错误日志表
      await this.prisma.errorLog.create({
        data: {
          errorType: this.getErrorType(error),
          severity: this.getErrorSeverity(error).toUpperCase(),
          message: error.message,
          stackTrace: error.stack,
          context: JSON.stringify({
            errorName: error.name,
            context,
            timestamp: new Date().toISOString()
          }),
          userId: errorLog.userId || null,
          factoryId: errorLog.factoryId || null,
          endpoint: req?.originalUrl || null,
          method: req?.method || null,
          ipAddress: errorLog.ipAddress || null,
          userAgent: errorLog.userAgent || null,
        }
      });
    } catch (logError) {
      console.error('系统错误日志记录失败:', logError);
    }
  }

  /**
   * 创建审计日志中间件
   * @param {string} action - 操作类型
   * @param {string} resource - 资源类型
   * @returns {Function} Express中间件
   */
  createAuditMiddleware(action, resource) {
    // 保存this上下文引用
    const auditLogger = this;
    return (req, res, next) => {
      // 记录请求开始
      req.auditStartTime = Date.now();
      
      // 保存原始的res.json方法
      const originalJson = res.json;
      const originalSend = res.send;
      
      // 重写res.json以捕获响应
      res.json = function(body) {
        // 记录审计日志
        const duration = Date.now() - req.auditStartTime;
        const details = {
          duration: `${duration}ms`,
          responseSize: JSON.stringify(body).length,
          success: res.statusCode < 400
        };
        
        // 异步记录，不阻塞响应
        setImmediate(() => {
          auditLogger.logUserAction(req, action, resource, details);
        });
        
        return originalJson.call(this, body);
      };
      
      // 重写res.send以捕获其他响应
      res.send = function(body) {
        if (!res.headersSent) {
          const duration = Date.now() - req.auditStartTime;
          const details = {
            duration: `${duration}ms`,
            responseSize: typeof body === 'string' ? body.length : JSON.stringify(body).length,
            success: res.statusCode < 400
          };
          
          setImmediate(() => {
            auditLogger.logUserAction(req, action, resource, details);
          });
        }
        
        return originalSend.call(this, body);
      };
      
      next();
    };
  }

  /**
   * 获取客户端真实IP
   * @param {Object} req - Express请求对象
   * @returns {string} IP地址
   */
  getClientIP(req) {
    return req.ip || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           'unknown';
  }

  /**
   * 获取事件严重程度
   * @param {string} eventType - 事件类型
   * @returns {string} 严重程度
   */
  getEventSeverity(eventType) {
    const severityMap = {
      [this.ACTION_TYPES.LOGIN_FAILED]: 'medium',
      [this.ACTION_TYPES.UNAUTHORIZED_ACCESS]: 'high',
      [this.ACTION_TYPES.RATE_LIMIT_EXCEEDED]: 'low',
      [this.ACTION_TYPES.SUSPICIOUS_ACTIVITY]: 'high',
      [this.ACTION_TYPES.SQL_INJECTION_ATTEMPT]: 'high',
      [this.ACTION_TYPES.XSS_ATTEMPT]: 'medium'
    };
    
    return severityMap[eventType] || 'low';
  }

  /**
   * 生成请求ID
   * @returns {string} 唯一请求ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 生成事件ID
   * @returns {string} 唯一事件ID
   */
  generateEventId() {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 获取错误类型
   * @param {Error} error - 错误对象
   * @returns {string} 错误类型
   */
  getErrorType(error) {
    if (error.code && error.code.startsWith('P')) {
      return 'DATABASE'; // Prisma错误
    }
    if (error.name === 'ValidationError') {
      return 'VALIDATION';
    }
    if (error.name === 'SyntaxError') {
      return 'SYNTAX';
    }
    if (error.name === 'TypeError') {
      return 'TYPE';
    }
    if (error.status >= 400 && error.status < 500) {
      return 'CLIENT';
    }
    if (error.status >= 500) {
      return 'SERVER';
    }
    return 'SYSTEM';
  }

  /**
   * 获取错误严重程度
   * @param {Error} error - 错误对象
   * @returns {string} 严重程度
   */
  getErrorSeverity(error) {
    if (error.status === 500 || error.name === 'DatabaseError') {
      return 'error';
    }
    if (error.status === 404 || error.name === 'ValidationError') {
      return 'warn';
    }
    if (error.status >= 400 && error.status < 500) {
      return 'info';
    }
    return 'error';
  }

  /**
   * 发送安全告警
   * @param {Object} securityLog - 安全日志
   */
  async sendSecurityAlert(securityLog) {
    try {
      // 这里可以集成邮件、短信、钉钉等告警服务
      console.error('🚨 安全告警:', {
        eventType: securityLog.action,
        username: securityLog.username,
        ip: securityLog.ipAddress,
        time: securityLog.createdAt,
        details: JSON.parse(securityLog.details || '{}')
      });
      
      // 实际实现告警发送逻辑
      const EmailService = require('../services/email.service');
      const emailService = new EmailService();

      // 构造安全事件对象
      const securityEvent = {
        eventType: securityLog.action,
        severity: this.getEventSeverity(securityLog.action).toUpperCase(),
        description: securityLog.description || `安全事件: ${securityLog.action}`,
        userId: securityLog.userId,
        userRole: securityLog.userRole,
        ipAddress: securityLog.ipAddress,
        userAgent: securityLog.userAgent,
        timestamp: securityLog.createdAt || new Date()
      };

      // 发送邮件告警
      const emailResult = await emailService.sendSecurityAlert(securityEvent);
      
      if (emailResult.success) {
        console.log('安全告警邮件发送成功:', emailResult.messageId);
      } else {
        console.error('安全告警邮件发送失败:', emailResult.error);
      }

      // 可以添加其他告警方式
      // - 发送短信告警
      // - 推送到监控系统 (如Prometheus AlertManager)
      // - 发送到企业微信/钉钉
      // - 写入告警文件
      
    } catch (error) {
      console.error('安全告警发送失败:', error);
    }
  }

  /**
   * 查询审计日志
   * @param {Object} filters - 过滤条件
   * @param {Object} pagination - 分页参数
   * @returns {Promise<Object>} 审计日志列表
   */
  async queryAuditLogs(filters = {}, pagination = {}) {
    try {
      const {
        userId,
        action,
        resource,
        level,
        startDate,
        endDate,
        ipAddress
      } = filters;
      
      const {
        page = 1,
        limit = 20,
        sort = 'desc'
      } = pagination;
      
      // 构建查询条件
      const whereConditions = {};
      
      if (userId) whereConditions.userId = userId;
      if (action) whereConditions.action = action;
      if (resource) whereConditions.resource = resource;
      if (level) whereConditions.level = level;
      if (ipAddress) whereConditions.ipAddress = ipAddress;
      
      if (startDate || endDate) {
        whereConditions.timestamp = {};
        if (startDate) whereConditions.timestamp.gte = new Date(startDate);
        if (endDate) whereConditions.timestamp.lte = new Date(endDate);
      }
      
      // 执行查询
      const [logs, total] = await Promise.all([
        this.prisma.auditLog.findMany({
          where: whereConditions,
          include: {
            user: {
              select: { id: true, username: true, fullName: true, role: true }
            },
            factory: {
              select: { id: true, name: true }
            }
          },
          orderBy: { timestamp: sort },
          skip: (page - 1) * limit,
          take: limit
        }),
        this.prisma.auditLog.count({ where: whereConditions })
      ]);
      
      return {
        logs: logs.map(log => ({
          ...log,
          details: log.details ? JSON.parse(log.details) : null
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('查询审计日志失败:', error);
      throw new Error('查询审计日志失败');
    }
  }

  /**
   * 获取审计日志统计
   * @param {Object} timeRange - 时间范围
   * @returns {Promise<Object>} 统计数据
   */
  async getAuditStats(timeRange = {}) {
    try {
      const { startDate, endDate } = timeRange;
      
      // 构建时间范围条件
      const timeCondition = {};
      if (startDate || endDate) {
        if (startDate) timeCondition.gte = new Date(startDate);
        if (endDate) timeCondition.lte = new Date(endDate);
      }

      // 并行执行多个统计查询
      const [
        totalLogs,
        byAction,
        byLevel,
        byResource,
        securityLogsCount,
        errorLogsCount,
        recentActivity
      ] = await Promise.all([
        // 总日志数
        this.prisma.auditLog.count({
          where: timeCondition.gte || timeCondition.lte ? { timestamp: timeCondition } : {}
        }),
        
        // 按操作类型分组
        this.prisma.auditLog.groupBy({
          by: ['action'],
          where: timeCondition.gte || timeCondition.lte ? { timestamp: timeCondition } : {},
          _count: { action: true }
        }),
        
        // 按日志级别分组
        this.prisma.auditLog.groupBy({
          by: ['level'],
          where: timeCondition.gte || timeCondition.lte ? { timestamp: timeCondition } : {},
          _count: { level: true }
        }),
        
        // 按资源类型分组
        this.prisma.auditLog.groupBy({
          by: ['resource'],
          where: timeCondition.gte || timeCondition.lte ? { timestamp: timeCondition } : {},
          _count: { resource: true }
        }),
        
        // 安全日志数量
        this.prisma.securityLog.count({
          where: timeCondition.gte || timeCondition.lte ? { timestamp: timeCondition } : {}
        }),
        
        // 错误日志数量
        this.prisma.errorLog.count({
          where: timeCondition.gte || timeCondition.lte ? { timestamp: timeCondition } : {}
        }),
        
        // 最近活动
        this.prisma.auditLog.findMany({
          where: timeCondition.gte || timeCondition.lte ? { timestamp: timeCondition } : {},
          include: {
            user: { select: { username: true, fullName: true } }
          },
          orderBy: { timestamp: 'desc' },
          take: 10
        })
      ]);

      // 格式化统计结果
      const actionStats = byAction.reduce((acc, item) => {
        acc[item.action] = item._count.action;
        return acc;
      }, {});

      const levelStats = byLevel.reduce((acc, item) => {
        acc[item.level] = item._count.level;
        return acc;
      }, {});

      const resourceStats = byResource.reduce((acc, item) => {
        acc[item.resource] = item._count.resource;
        return acc;
      }, {});

      return {
        totalLogs,
        byAction: actionStats,
        byLevel: levelStats,
        byResource: resourceStats,
        securityEvents: securityLogsCount,
        errorCount: errorLogsCount,
        recentActivity: recentActivity.map(log => ({
          ...log,
          details: log.details ? JSON.parse(log.details) : null
        })),
        timeRange: { startDate, endDate }
      };
    } catch (error) {
      console.error('获取审计统计失败:', error);
      throw new Error('获取审计统计失败');
    }
  }

  /**
   * 清理旧的审计日志
   * @param {number} daysToKeep - 保留天数
   * @returns {Promise<number>} 删除的记录数
   */
  async cleanupOldLogs(daysToKeep = 90) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      // 清理旧的日志记录
      const [auditResult, securityResult, errorResult] = await Promise.all([
        // 清理审计日志
        this.prisma.auditLog.deleteMany({
          where: {
            timestamp: {
              lt: cutoffDate
            }
          }
        }),
        
        // 清理安全日志
        this.prisma.securityLog.deleteMany({
          where: {
            timestamp: {
              lt: cutoffDate
            }
          }
        }),
        
        // 清理错误日志
        this.prisma.errorLog.deleteMany({
          where: {
            timestamp: {
              lt: cutoffDate
            }
          }
        })
      ]);
      
      const totalDeleted = auditResult.count + securityResult.count + errorResult.count;
      
      console.log(`清理完成: 删除了 ${daysToKeep} 天前的日志记录`);
      console.log(`- 审计日志: ${auditResult.count} 条`);
      console.log(`- 安全日志: ${securityResult.count} 条`);
      console.log(`- 错误日志: ${errorResult.count} 条`);
      console.log(`- 总计: ${totalDeleted} 条`);
      
      return {
        totalDeleted,
        auditLogs: auditResult.count,
        securityLogs: securityResult.count,
        errorLogs: errorResult.count,
        cutoffDate
      };
    } catch (error) {
      console.error('清理审计日志失败:', error);
      throw new Error('清理审计日志失败');
    }
  }
}

module.exports = AuditLogger;