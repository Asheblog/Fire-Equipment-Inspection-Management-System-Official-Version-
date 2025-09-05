/**
 * 消防器材点检系统 - 报表路由
 * 定义报表和数据看板相关的API端点
 */

const express = require('express');
const router = express.Router();

// 导入控制器
const reportController = require('../controllers/report.controller');

/**
 * 报表管理路由定义
 */

// 获取数据看板
router.get('/dashboard', reportController.getDashboard);

// 获取月度报表
router.get('/monthly', reportController.getMonthlyReport);

// 获取器材概览统计
router.get('/equipment-overview', reportController.getEquipmentOverview);

// 获取点检概览统计
router.get('/inspection-overview', reportController.getInspectionOverview);

// 获取隐患概览统计
router.get('/issue-overview', reportController.getIssueOverview);

// 获取最近活动
router.get('/recent-activity', reportController.getRecentActivity);

// 导出报表
router.post('/export', reportController.exportReport);

// 预览报表
router.post('/preview', reportController.previewReport);

// 下载文件
router.get('/download/:filename', reportController.downloadFile);

module.exports = router;