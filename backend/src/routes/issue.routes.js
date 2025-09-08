/**
 * 消防器材点检系统 - 隐患管理路由
 * 定义隐患相关的API端点
 */

const express = require('express');
const router = express.Router();

// 导入控制器
const issueController = require('../controllers/issue.controller');

// 导入中间件
const ValidationHelper = require('../utils/validation.helper');

/**
 * 隐患管理路由定义
 */

// 获取隐患统计信息（支持筛选参数 + 周期 period）
router.get('/stats', 
  ValidationHelper.validateMiddleware(
    ValidationHelper.querySchema.issueFilter
      .concat(ValidationHelper.querySchema.dateRange)
      .keys({ period: require('joi').string().valid('today','week','month','year').default('month') }),
    'query'
  ),
  issueController.getIssueStats
);

// 获取隐患趋势数据（支持筛选参数 + days）
router.get('/trend', 
  ValidationHelper.validateMiddleware(
    ValidationHelper.querySchema.issueFilter
      .concat(ValidationHelper.querySchema.dateRange)
      .keys({ days: require('joi').number().integer().min(1).max(365).default(30) }),
    'query'
  ),
  issueController.getIssueTrend
);

// 获取隐患列表 (带分页和筛选)
router.get('/', 
  ValidationHelper.validateMiddleware(
    ValidationHelper.querySchema.pagination
      .concat(ValidationHelper.querySchema.dateRange)
      .concat(ValidationHelper.querySchema.issueFilter), 
    'query'
  ),
  issueController.getIssueList
);

// 获取隐患详情
router.get('/:id', issueController.getIssueById);

// 处理隐患
router.put('/:id/handle', 
  ValidationHelper.validateMiddleware(
    ValidationHelper.issueSchema.handle, 
    'body'
  ),
  issueController.handleIssue
);

// 审核隐患处理
router.put('/:id/audit', 
  ValidationHelper.validateMiddleware(
    ValidationHelper.issueSchema.audit, 
    'body'
  ),
  issueController.auditIssue
);

// 导出隐患列表（按当前筛选条件）
router.post('/export', 
  ValidationHelper.validateMiddleware(
    ValidationHelper.issueSchema.export,
    'body'
  ),
  issueController.exportIssueList
);

// 添加隐患处理备注
router.post('/:id/comments', 
  ValidationHelper.validateMiddleware(
    ValidationHelper.issueSchema.comment, 
    'body'
  ),
  issueController.addComment
);

module.exports = router;
