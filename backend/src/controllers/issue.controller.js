/**
 * 消防器材点检系统 - 隐患管理控制器
 * 处理隐患相关的HTTP请求
 */

const IssueService = require('../services/issue.service');
const ResponseHelper = require('../utils/response.helper');
const ValidationHelper = require('../utils/validation.helper');

class IssueController {
  constructor() {
    this.issueService = new IssueService();
  }

  /**
   * 获取隐患列表
   * GET /api/issues
   */
  async getIssueList(req, res) {
    try {
      const { user, dataFilter } = req;
      
      // 查询参数已在路由层 validateMiddleware 验证
      const { page, limit, sortBy, sortOrder, ...filters } = req.query;
      
      const pagination = { page, limit, sortBy, sortOrder };
      const userFactoryId = dataFilter ? dataFilter.factoryId : null;

      const result = await this.issueService.getIssueList(
        filters,
        pagination,
        userFactoryId,
        user.id,
        user.role
      );

      return ResponseHelper.list(
        res,
        result.issues,
        result.pagination.total,
        result.pagination.page,
        result.pagination.limit,
        '隐患列表获取成功'
      );
    } catch (error) {
      console.error('获取隐患列表失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取隐患详情
   * GET /api/issues/:id
   */
  async getIssueById(req, res) {
    try {
      const { id } = req.params;
      const { user, dataFilter } = req;

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '隐患ID格式不正确');
      }

      const userFactoryId = dataFilter ? dataFilter.factoryId : null;
      const issue = await this.issueService.getIssueById(
        parseInt(id),
        userFactoryId,
        user.id,
        user.role
      );

      return ResponseHelper.success(res, issue, '隐患详情获取成功');
    } catch (error) {
      console.error('获取隐患详情失败:', error);
      
      if (error.message.includes('不存在') || error.message.includes('无权')) {
        return ResponseHelper.notFound(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 处理隐患
   * PUT /api/issues/:id/handle
   */
  async handleIssue(req, res) {
    try {
      const { id } = req.params;
      const { user, dataFilter } = req;

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '隐患ID格式不正确');
      }

      // 权限检查：只有厂区管理员和超级管理员可以处理隐患
      if (user.role === 'INSPECTOR') {
        return ResponseHelper.forbidden(res, '无权处理隐患');
      }

      // 请求体已在路由层验证
      const validatedBody = req.body;
      const userFactoryId = dataFilter ? dataFilter.factoryId : null;
      const issue = await this.issueService.handleIssue(
        parseInt(id),
        validatedBody,
        user.id,
        userFactoryId
      );

      return ResponseHelper.success(res, issue, '隐患处理成功');
    } catch (error) {
      console.error('处理隐患失败:', error);
      
      if (error.message.includes('不存在') || error.message.includes('无权')) {
        return ResponseHelper.notFound(res, error.message);
      }
      
      if (error.message.includes('状态不允许')) {
        return ResponseHelper.badRequest(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 审核隐患处理
   * PUT /api/issues/:id/audit
   */
  async auditIssue(req, res) {
    try {
      const { id } = req.params;
      const { user, dataFilter } = req;

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '隐患ID格式不正确');
      }

      // 权限检查：只有超级管理员可以审核隐患
      if (user.role !== 'SUPER_ADMIN') {
        return ResponseHelper.forbidden(res, '无权审核隐患');
      }

      // 已在路由层验证
      const validatedAudit = req.body;
      const userFactoryId = dataFilter ? dataFilter.factoryId : null;
      const issue = await this.issueService.auditIssue(
        parseInt(id),
        validatedAudit,
        user.id,
        userFactoryId
      );

      return ResponseHelper.success(res, issue, '隐患审核成功');
    } catch (error) {
      console.error('审核隐患失败:', error);
      
      if (error.message.includes('不存在') || error.message.includes('无权')) {
        return ResponseHelper.notFound(res, error.message);
      }
      
      if (error.message.includes('状态不允许')) {
        return ResponseHelper.badRequest(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 添加隐患处理备注
   * POST /api/issues/:id/comments
   */
  async addComment(req, res) {
    try {
      const { id } = req.params;
      const { user, dataFilter } = req;

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '隐患ID格式不正确');
      }

      // 已在路由层验证
      const validatedComment = req.body;
      const userFactoryId = dataFilter ? dataFilter.factoryId : null;
      const result = await this.issueService.addComment(
        parseInt(id),
        validatedComment.comment,
        user.id,
        userFactoryId
      );

      return ResponseHelper.success(res, result, '备注添加成功');
    } catch (error) {
      console.error('添加备注失败:', error);
      
      if (error.message.includes('不存在') || error.message.includes('无权')) {
        return ResponseHelper.notFound(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取隐患统计信息
   * GET /api/issues/stats
   */
  async getIssueStats(req, res) {
    try {
      const { user, dataFilter } = req;
      const { period = 'month' } = req.query;

      const factoryId = dataFilter ? dataFilter.factoryId : null;
      const stats = await this.issueService.getIssueStats(
        factoryId,
        user.id,
        user.role,
        period
      );

      return ResponseHelper.success(res, stats, '隐患统计获取成功');
    } catch (error) {
      console.error('获取隐患统计失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取隐患趋势数据
   * GET /api/issues/trend
   */
  async getIssueTrend(req, res) {
    try {
      const { dataFilter } = req;
      const { days = 30 } = req.query;

      if (isNaN(parseInt(days)) || parseInt(days) < 1 || parseInt(days) > 365) {
        return ResponseHelper.badRequest(res, '天数参数必须在1-365之间');
      }

      const factoryId = dataFilter ? dataFilter.factoryId : null;
      const trend = await this.issueService.getIssueTrend(
        factoryId,
        parseInt(days)
      );

      return ResponseHelper.success(res, trend, '隐患趋势获取成功');
    } catch (error) {
      console.error('获取隐患趋势失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }
}

// 导出控制器实例的方法，确保正确绑定this
const issueController = new IssueController();

module.exports = {
  getIssueList: issueController.getIssueList.bind(issueController),
  getIssueById: issueController.getIssueById.bind(issueController),
  handleIssue: issueController.handleIssue.bind(issueController),
  auditIssue: issueController.auditIssue.bind(issueController),
  addComment: issueController.addComment.bind(issueController),
  getIssueStats: issueController.getIssueStats.bind(issueController),
  getIssueTrend: issueController.getIssueTrend.bind(issueController)
};
