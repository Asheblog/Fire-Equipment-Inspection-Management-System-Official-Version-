/**
 * 消防器材点检系统 - 报表控制器
 * 处理数据看板和报表相关的HTTP请求
 */

const ReportService = require('../services/report.service');
const ReportExportService = require('../services/report-export.service');
const ResponseHelper = require('../utils/response.helper');
const fs = require('fs').promises;
const path = require('path');
const DownloadTokenUtil = require('../utils/download-token.util');

class ReportController {
  constructor() {
    this.reportService = new ReportService();
    this.exportService = new ReportExportService();
  }

  /**
   * 获取数据看板
   * GET /api/reports/dashboard
   */
  async getDashboard(req, res) {
    try {
      const { user, dataFilter } = req;
      
      const factoryId = dataFilter ? dataFilter.factoryId : null;
      const dashboard = await this.reportService.getDashboardData(
        factoryId,
        user.role
      );

      return ResponseHelper.success(res, dashboard, '数据看板获取成功');
    } catch (error) {
      console.error('获取数据看板失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取月度报表
   * GET /api/reports/monthly
   */
  async getMonthlyReport(req, res) {
    try {
      const { user, dataFilter } = req;
      const { year, month } = req.query;

      // 参数验证
      if (!year || !month) {
        return ResponseHelper.badRequest(res, '年份和月份参数必填');
      }

      const yearNum = parseInt(year);
      const monthNum = parseInt(month);

      if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
        return ResponseHelper.badRequest(res, '年份或月份参数格式不正确');
      }

      // 限制查询范围（最多查询过去2年的数据）
      const currentYear = new Date().getFullYear();
      if (yearNum < currentYear - 2 || yearNum > currentYear) {
        return ResponseHelper.badRequest(res, '只能查询过去2年内的数据');
      }

      const factoryId = dataFilter ? dataFilter.factoryId : null;
      const report = await this.reportService.getMonthlyReport(
        factoryId,
        yearNum,
        monthNum
      );

      return ResponseHelper.success(res, report, '月度报表获取成功');
    } catch (error) {
      console.error('获取月度报表失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取器材概览统计
   * GET /api/reports/equipment-overview
   */
  async getEquipmentOverview(req, res) {
    try {
      const { dataFilter } = req;
      
      const factoryId = dataFilter ? dataFilter.factoryId : null;
      const where = factoryId ? { factoryId } : {};
      
      const overview = await this.reportService.getEquipmentOverview(where);
      return ResponseHelper.success(res, overview, '器材概览获取成功');
    } catch (error) {
      console.error('获取器材概览失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取点检概览统计
   * GET /api/reports/inspection-overview
   */
  async getInspectionOverview(req, res) {
    try {
      const { dataFilter } = req;
      
      const factoryId = dataFilter ? dataFilter.factoryId : null;
      const where = factoryId ? { factoryId } : {};
      
      const overview = await this.reportService.getInspectionOverview(where);
      return ResponseHelper.success(res, overview, '点检概览获取成功');
    } catch (error) {
      console.error('获取点检概览失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取隐患概览统计
   * GET /api/reports/issue-overview
   */
  async getIssueOverview(req, res) {
    try {
      const { dataFilter } = req;
      
      const factoryId = dataFilter ? dataFilter.factoryId : null;
      const where = factoryId ? { factoryId } : {};
      
      const overview = await this.reportService.getIssueOverview(where);
      return ResponseHelper.success(res, overview, '隐患概览获取成功');
    } catch (error) {
      console.error('获取隐患概览失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取最近活动
   * GET /api/reports/recent-activity
   */
  async getRecentActivity(req, res) {
    try {
      const { dataFilter } = req;
      const { limit = 10 } = req.query;

      const limitNum = parseInt(limit);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 50) {
        return ResponseHelper.badRequest(res, '数量限制必须在1-50之间');
      }

      const factoryId = dataFilter ? dataFilter.factoryId : null;
      const where = factoryId ? { factoryId } : {};
      
      const activities = await this.reportService.getRecentActivity(where, limitNum);
      return ResponseHelper.success(res, activities, '最近活动获取成功');
    } catch (error) {
      console.error('获取最近活动失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 导出报表
   * POST /api/reports/export
   */
  async exportReport(req, res) {
    try {
      const { user, dataFilter } = req;
      const { reportType, year, month, format, includeCharts = false } = req.body;

      // 参数验证
      if (!reportType || !format) {
        return ResponseHelper.badRequest(res, '报表类型和格式参数必填');
      }

      if (reportType === 'monthly' && (!year || !month)) {
        return ResponseHelper.badRequest(res, '月度报表需要年份和月份参数');
      }

      if (!['excel', 'pdf'].includes(format)) {
        return ResponseHelper.badRequest(res, '不支持的导出格式');
      }

      // 获取报表数据
      const factoryId = dataFilter ? dataFilter.factoryId : null;
      let reportData;

      switch (reportType) {
        case 'monthly':
          reportData = await this.reportService.getMonthlyReport(factoryId, year, month);
          break;
        default:
          return ResponseHelper.badRequest(res, '不支持的报表类型');
      }

      // 生成报表文件
      let exportResult;
      if (format === 'excel') {
        exportResult = await this.exportService.generateMonthlyExcelReport(reportData, year, month);
      } else if (format === 'pdf') {
        exportResult = await this.exportService.generateMonthlyPDFReport(reportData, year, month);
      }

      // 获取文件信息
      const stat = await fs.stat(exportResult.filepath);

      // 生成一次性签名直链（默认10分钟有效）
      const signedUrl = DownloadTokenUtil.generateSignedUrl(exportResult.filename, {
        userId: req.user?.id,
        ttlSec: parseInt(process.env.DOWNLOAD_TOKEN_TTL || '600', 10)
      });

      return ResponseHelper.success(res, {
        downloadUrl: signedUrl,
        filename: exportResult.filename,
        size: stat.size,
        generatedAt: new Date().toISOString()
      }, '报表导出成功');

    } catch (error) {
      console.error('导出报表失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 预览报表
   * POST /api/reports/preview
   */
  async previewReport(req, res) {
    try {
      const { user, dataFilter } = req;
      const { reportType, year, month } = req.body;

      if (reportType === 'monthly' && (!year || !month)) {
        return ResponseHelper.badRequest(res, '月度报表需要年份和月份参数');
      }

      // 获取报表数据
      const factoryId = dataFilter ? dataFilter.factoryId : null;
      let reportData;

      switch (reportType) {
        case 'monthly':
          reportData = await this.reportService.getMonthlyReport(factoryId, year, month);
          break;
        default:
          return ResponseHelper.badRequest(res, '不支持的报表类型');
      }

      // 生成HTML预览（仅生成HTML，便于直接在浏览器打开）
      const exportResult = await this.exportService.generateMonthlyHTMLReport(reportData, year, month);

      // 生成签名直链（inline打开）
      const signedPreviewUrl = DownloadTokenUtil.generateSignedUrl(exportResult.filename, {
        userId: req.user?.id,
        ttlSec: parseInt(process.env.DOWNLOAD_TOKEN_TTL || '600', 10),
        inline: true
      });
      
      return ResponseHelper.success(res, {
        previewUrl: signedPreviewUrl,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24小时后过期
      }, '报表预览生成成功');

    } catch (error) {
      console.error('预览报表失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 下载文件
   * GET /api/reports/download/:filename
   */
  async downloadFile(req, res) {
    try {
      const { filename } = req.params;
      const token = req.query?.token;
      const inline = req.query?.inline === '1';
      
      if (!filename) {
        return ResponseHelper.badRequest(res, '文件名参数必填');
      }
      
      // 优先：校验签名token；失败时再看是否已通过JWT认证（向后兼容）
      if (token) {
        try {
          DownloadTokenUtil.verifyAndConsume(token, filename);
        } catch (e) {
          return ResponseHelper.unauthorized(res, '下载链接无效或已过期');
        }
      } else if (!req.user) {
        // 无token且未认证
        return ResponseHelper.unauthorized(res, '未认证的下载请求');
      }

      const fileInfo = this.exportService.getFileInfo(filename);
      
      // 检查文件是否存在
      try {
        await fs.access(fileInfo.filepath);
      } catch (error) {
        return ResponseHelper.notFound(res, '文件不存在或已过期');
      }

      // 设置响应头
      const ext = path.extname(filename).toLowerCase();
      const contentType = ext === '.xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
                         ext === '.pdf' ? 'application/pdf' :
                         ext === '.html' ? 'text/html; charset=utf-8' :
                         'application/octet-stream';

      res.setHeader('Content-Type', contentType);
      const dispositionType = inline ? 'inline' : 'attachment';
      res.setHeader('Content-Disposition', `${dispositionType}; filename="${encodeURIComponent(filename)}"`);
      
      // 发送文件
      res.sendFile(fileInfo.filepath);

    } catch (error) {
      console.error('下载文件失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }
}

// 导出控制器实例的方法，确保正确绑定this
const reportController = new ReportController();

module.exports = {
  getDashboard: reportController.getDashboard.bind(reportController),
  getMonthlyReport: reportController.getMonthlyReport.bind(reportController),
  getEquipmentOverview: reportController.getEquipmentOverview.bind(reportController),
  getInspectionOverview: reportController.getInspectionOverview.bind(reportController),
  getIssueOverview: reportController.getIssueOverview.bind(reportController),
  getRecentActivity: reportController.getRecentActivity.bind(reportController),
  exportReport: reportController.exportReport.bind(reportController),
  previewReport: reportController.previewReport.bind(reportController),
  downloadFile: reportController.downloadFile.bind(reportController)
};
