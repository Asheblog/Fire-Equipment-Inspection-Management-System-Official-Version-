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

// 获取隐患统计信息
router.get('/stats', issueController.getIssueStats);

// 获取隐患趋势数据
router.get('/trend', issueController.getIssueTrend);

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

// 添加隐患处理备注
router.post('/:id/comments', 
  ValidationHelper.validateMiddleware(
    ValidationHelper.issueSchema.comment, 
    'body'
  ),
  issueController.addComment
);

module.exports = router;