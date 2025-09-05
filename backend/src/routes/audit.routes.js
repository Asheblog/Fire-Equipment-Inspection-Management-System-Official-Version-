/**
 * 消防器材点检系统 - 审计日志管理路由
 * 定义审计日志相关的API端点
 */

const express = require('express');
const router = express.Router();

// 导入审计日志类
const AuditLogger = require('../security/audit-logger');

// 导入中间件
const AuthMiddleware = require('../middleware/auth.middleware');
const ValidationHelper = require('../utils/validation.helper');

// 创建中间件实例
const authMiddleware = new AuthMiddleware();
const { authenticate, requireRole } = authMiddleware;

// 创建审计日志实例
const auditLogger = new AuditLogger();

/**
 * 获取审计日志列表
 * GET /api/audit/logs
 */
router.get('/logs', 
  authenticate,
  requireRole(['SUPER_ADMIN', 'FACTORY_ADMIN']),
  async (req, res) => {
    try {
      const { user } = req;
      const {
        userId,
        action,
        resource,
        level,
        startDate,
        endDate,
        ipAddress,
        page = 1,
        limit = 20,
        sort = 'desc'
      } = req.query;

      // 数据隔离：普通管理员只能查看自己厂区的日志
      const filters = {
        userId: userId ? parseInt(userId) : undefined,
        action,
        resource,
        level,
        startDate,
        endDate,
        ipAddress
      };

      // 厂区管理员只能查看自己厂区的数据
      if (user.role === 'FACTORY_ADMIN') {
        filters.factoryId = user.factoryId;
      }

      const pagination = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100), // 限制最大100条
        sort
      };

      const result = await auditLogger.queryAuditLogs(filters, pagination);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('获取审计日志失败:', error);
      res.status(500).json({
        success: false,
        message: '获取审计日志失败',
        error: error.message
      });
    }
  }
);

/**
 * 获取安全日志列表
 * GET /api/audit/security-logs
 */
router.get('/security-logs',
  authenticate,
  requireRole(['SUPER_ADMIN']), // 只有超级管理员可以查看安全日志
  async (req, res) => {
    try {
      const {
        eventType,
        userId,
        severity,
        resolved,
        startDate,
        endDate,
        page = 1,
        limit = 20,
        sort = 'desc'
      } = req.query;

      const filters = {
        eventType,
        userId: userId ? parseInt(userId) : undefined,
        severity,
        resolved: resolved !== undefined ? resolved === 'true' : undefined,
        startDate,
        endDate
      };

      const pagination = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        sort
      };

      const result = await auditLogger.querySecurityLogs(filters, pagination);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('获取安全日志失败:', error);
      res.status(500).json({
        success: false,
        message: '获取安全日志失败',
        error: error.message
      });
    }
  }
);

/**
 * 获取错误日志列表
 * GET /api/audit/error-logs
 */
router.get('/error-logs',
  authenticate,
  requireRole(['SUPER_ADMIN']), // 只有超级管理员可以查看错误日志
  async (req, res) => {
    try {
      const {
        errorType,
        severity,
        endpoint,
        resolved,
        startDate,
        endDate,
        page = 1,
        limit = 20,
        sort = 'desc'
      } = req.query;

      const filters = {
        errorType,
        severity,
        endpoint,
        resolved: resolved !== undefined ? resolved === 'true' : undefined,
        startDate,
        endDate
      };

      const pagination = {
        page: parseInt(page),
        limit: Math.min(parseInt(limit), 100),
        sort
      };

      const result = await auditLogger.queryErrorLogs(filters, pagination);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('获取错误日志失败:', error);
      res.status(500).json({
        success: false,
        message: '获取错误日志失败',
        error: error.message
      });
    }
  }
);

/**
 * 获取审计统计数据
 * GET /api/audit/stats
 */
router.get('/stats',
  authenticate,
  requireRole(['SUPER_ADMIN', 'FACTORY_ADMIN']),
  async (req, res) => {
    try {
      const { startDate, endDate } = req.query;

      const timeRange = {};
      if (startDate) timeRange.startDate = startDate;
      if (endDate) timeRange.endDate = endDate;

      const stats = await auditLogger.getAuditStats(timeRange);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('获取审计统计失败:', error);
      res.status(500).json({
        success: false,
        message: '获取审计统计失败',
        error: error.message
      });
    }
  }
);

/**
 * 清理旧日志
 * POST /api/audit/cleanup
 */
router.post('/cleanup',
  authenticate,
  requireRole(['SUPER_ADMIN']), // 只有超级管理员可以清理日志
  async (req, res) => {
    try {
      const { daysToKeep = 90 } = req.body;

      // 验证参数
      if (daysToKeep < 7) {
        return res.status(400).json({
          success: false,
          message: '保留天数不能少于7天'
        });
      }

      if (daysToKeep > 3650) {
        return res.status(400).json({
          success: false,
          message: '保留天数不能超过10年'
        });
      }

      const result = await auditLogger.cleanupOldLogs(parseInt(daysToKeep));

      // 记录清理操作到审计日志
      auditLogger.logAudit({
        userId: req.user.id,
        userRole: req.user.role,
        action: 'CLEANUP',
        resource: 'AuditLog',
        details: {
          daysToKeep: parseInt(daysToKeep),
          deletedCounts: result
        },
        ipAddress: req.ip,
        userAgent: req.get('User-Agent')
      });

      res.json({
        success: true,
        data: result,
        message: `成功清理了 ${result.totalDeleted} 条旧日志记录`
      });
    } catch (error) {
      console.error('清理日志失败:', error);
      res.status(500).json({
        success: false,
        message: '清理日志失败',
        error: error.message
      });
    }
  }
);

/**
 * 标记安全日志为已处理
 * PUT /api/audit/security-logs/:id/resolve
 */
router.put('/security-logs/:id/resolve',
  authenticate,
  requireRole(['SUPER_ADMIN']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { comments } = req.body;

      const updatedLog = await auditLogger.prisma.securityLog.update({
        where: { id: parseInt(id) },
        data: {
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy: req.user.id,
          metadata: comments ? JSON.stringify({ resolvedComments: comments }) : undefined
        },
        include: {
          user: { select: { username: true, fullName: true } },
          resolver: { select: { username: true, fullName: true } }
        }
      });

      res.json({
        success: true,
        data: updatedLog,
        message: '安全日志已标记为已处理'
      });
    } catch (error) {
      console.error('标记安全日志失败:', error);
      res.status(500).json({
        success: false,
        message: '标记安全日志失败',
        error: error.message
      });
    }
  }
);

/**
 * 标记错误日志为已处理
 * PUT /api/audit/error-logs/:id/resolve
 */
router.put('/error-logs/:id/resolve',
  authenticate,
  requireRole(['SUPER_ADMIN']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { comments } = req.body;

      const updatedLog = await auditLogger.prisma.errorLog.update({
        where: { id: parseInt(id) },
        data: {
          resolved: true,
          resolvedAt: new Date(),
          resolvedBy: req.user.id,
          context: comments ? JSON.stringify({ resolvedComments: comments }) : undefined
        },
        include: {
          user: { select: { username: true, fullName: true } },
          resolver: { select: { username: true, fullName: true } }
        }
      });

      res.json({
        success: true,
        data: updatedLog,
        message: '错误日志已标记为已处理'
      });
    } catch (error) {
      console.error('标记错误日志失败:', error);
      res.status(500).json({
        success: false,
        message: '标记错误日志失败',
        error: error.message
      });
    }
  }
);

/**
 * 测试邮件发送
 * POST /api/audit/test-email
 */
router.post('/test-email',
  authenticate,
  requireRole(['SUPER_ADMIN']), // 只有超级管理员可以测试邮件
  async (req, res) => {
    try {
      const { testEmail } = req.body;

      if (!testEmail) {
        return res.status(400).json({
          success: false,
          message: '请提供测试邮箱地址'
        });
      }

      // 验证邮箱格式
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(testEmail)) {
        return res.status(400).json({
          success: false,
          message: '邮箱格式不正确'
        });
      }

      const EmailService = require('../services/email.service');
      const emailService = new EmailService();

      const result = await emailService.sendTestEmail(testEmail);

      res.json({
        success: result.success,
        data: result,
        message: result.message
      });
    } catch (error) {
      console.error('测试邮件发送失败:', error);
      res.status(500).json({
        success: false,
        message: '测试邮件发送失败',
        error: error.message
      });
    }
  }
);

module.exports = router;