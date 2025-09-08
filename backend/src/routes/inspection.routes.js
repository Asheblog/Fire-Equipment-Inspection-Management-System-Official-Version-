/**
 * 消防器材点检系统 - 点检管理路由
 * 定义点检相关的API端点
 */

const express = require('express');
const router = express.Router();

// 导入控制器
const inspectionController = require('../controllers/inspection.controller');

// 导入中间件
const ValidationHelper = require('../utils/validation.helper');

/**
 * 请求体调试中间件 - 记录原始请求数据
 */
const debugRequestMiddleware = (req, res, next) => {
  console.log(`🟠 [路由调试] ===== ${req.method} ${req.path} 请求开始 =====`);
  console.log(`🟠 [路由调试] 时间戳: ${new Date().toISOString()}`);
  console.log(`🟠 [路由调试] 用户信息: ${req.user?.id || '未认证'} (${req.user?.role || '无角色'})`);
  console.log(`🟠 [路由调试] Content-Type: ${req.headers['content-type'] || '未设置'}`);
  console.log(`🟠 [路由调试] 原始请求体:`, JSON.stringify(req.body, null, 2));
  
  // 特别检查URL字段
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (key.toLowerCase().includes('url') || key.toLowerCase().includes('image')) {
        console.log(`🟠 [路由调试] 发现URL字段 ${key}:`);
        console.log(`  - 值: ${req.body[key]}`);
        console.log(`  - 类型: ${typeof req.body[key]}`);
        if (typeof req.body[key] === 'string') {
          console.log(`  - 长度: ${req.body[key].length}`);
          console.log(`  - 包含HTML编码: ${req.body[key].includes('&#x') ? '是' : '否'}`);
          console.log(`  - 前50字符: ${req.body[key].substring(0, 50)}${req.body[key].length > 50 ? '...' : ''}`);
        }
      }
    });
  }
  
  console.log(`🟠 [路由调试] ===== 路由调试完成，传递给验证中间件 =====`);
  next();
};

/**
 * 点检管理路由定义
 */

// 获取点检统计信息
router.get('/stats', inspectionController.getInspectionStats);

// 获取点检趋势数据
router.get('/trend', inspectionController.getInspectionTrend);

// 获取待点检器材列表
router.get('/pending', inspectionController.getPendingInspections);

// 获取点检记录列表 (带分页和筛选)
router.get('/', 
  ValidationHelper.validateMiddleware(
    ValidationHelper.querySchema.pagination.concat(
      ValidationHelper.querySchema.dateRange
    ), 
    'query'
  ),
  inspectionController.getInspectionList
);

// 创建点检记录
router.post('/', 
  debugRequestMiddleware,  // 添加调试中间件
  ValidationHelper.validateMiddleware(
    ValidationHelper.inspectionSchema.create, 
    'body'
  ),
  inspectionController.createInspection
);

// 批量创建点检记录
router.post('/batch', 
  debugRequestMiddleware,  // 添加调试中间件
  inspectionController.createBatchInspection
);

// 获取点检记录详情
 // 创建空点检记录（最小占位, 仅包含 equipmentId，可后续追加图片再补全其他字段）
router.post('/empty', inspectionController.createEmptyInspection);

// 追加图片（点检图片或异常图片，通过 type 区分：inspection|issue）
router.post('/:id/images', inspectionController.appendInspectionImage);

// 删除图片（点检/异常图片，通过 type 区分，query/body 提供 url）
router.delete('/:id/images', inspectionController.removeInspectionImage);

// 最终提交点检记录（补全 checklistResults / overallResult / issueDescription 等）
router.patch('/:id/finalize', inspectionController.finalizeInspection);

router.get('/:id', inspectionController.getInspectionById);

module.exports = router;
