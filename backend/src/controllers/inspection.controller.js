/**
 * 消防器材点检系统 - 点检控制器
 * 处理点检记录相关的HTTP请求
 */

const InspectionService = require('../services/inspection.service');
const ResponseHelper = require('../utils/response.helper');
const ValidationHelper = require('../utils/validation.helper');

class InspectionController {
  constructor() {
    this.inspectionService = new InspectionService();
  }

  /**
   * 获取器材点检项模板
   * GET /api/equipments/:equipmentId/checklist
   */
  async getChecklistTemplate(req, res) {
    try {
      const { equipmentId } = req.params;

      if (!equipmentId || isNaN(parseInt(equipmentId))) {
        return ResponseHelper.badRequest(res, '器材ID格式不正确');
      }

      const checklist = await this.inspectionService.getChecklistTemplate(
        parseInt(equipmentId)
      );

      return ResponseHelper.success(res, checklist, '点检模板获取成功');
    } catch (error) {
      console.error('获取点检模板失败:', error);
      
      if (error.message === '器材不存在') {
        return ResponseHelper.notFound(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 创建点检记录
   * POST /api/inspections
   */
  async createInspection(req, res) {
    try {
      const { user } = req;
      
      // 已在路由层 validateMiddleware 验证，直接使用 req.body
      const inspection = await this.inspectionService.createInspection(
        req.body,
        user.id
      );

      return ResponseHelper.created(res, inspection, '点检记录创建成功');
    } catch (error) {
      console.error('创建点检记录失败:', error);
      
      if (error.message === '器材不存在') {
        return ResponseHelper.notFound(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取点检记录列表
   * GET /api/inspections
   */
  async getInspectionList(req, res) {
    try {
      const { user, dataFilter } = req;
      
      // 查询参数已在路由层验证
      const { page, limit, sortBy, sortOrder, ...filters } = req.query;
      
      const pagination = { page, limit, sortBy, sortOrder };
      const userFactoryId = dataFilter ? dataFilter.factoryId : null;

      const result = await this.inspectionService.getInspectionList(
        filters,
        pagination,
        userFactoryId,
        user.id,
        user.role
      );

      return ResponseHelper.list(
        res,
        result.inspections,
        result.pagination.total,
        result.pagination.page,
        result.pagination.limit,
        '点检记录获取成功'
      );
    } catch (error) {
      console.error('获取点检记录失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取点检记录详情
   * GET /api/inspections/:id
   */
  async getInspectionById(req, res) {
    try {
      const { id } = req.params;
      const { user, dataFilter } = req;

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '点检记录ID格式不正确');
      }

      const userFactoryId = dataFilter ? dataFilter.factoryId : null;
      const inspection = await this.inspectionService.getInspectionById(
        parseInt(id),
        userFactoryId,
        user.id,
        user.role
      );

      return ResponseHelper.success(res, inspection, '点检记录详情获取成功');
    } catch (error) {
      console.error('获取点检记录详情失败:', error);
      
      if (error.message.includes('不存在') || error.message.includes('无权')) {
        return ResponseHelper.notFound(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取点检统计信息
   * GET /api/inspections/stats
   */
  async getInspectionStats(req, res) {
    try {
      const { user, dataFilter } = req;
      const { period = 'month' } = req.query;

      const factoryId = dataFilter ? dataFilter.factoryId : null;
      const stats = await this.inspectionService.getInspectionStats(
        factoryId,
        user.id,
        user.role,
        period
      );

      return ResponseHelper.success(res, stats, '点检统计获取成功');
    } catch (error) {
      console.error('获取点检统计失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取点检趋势数据
   * GET /api/inspections/trend
   */
  async getInspectionTrend(req, res) {
    try {
      const { dataFilter } = req;
      const { days = 30 } = req.query;

      if (isNaN(parseInt(days)) || parseInt(days) < 1 || parseInt(days) > 365) {
        return ResponseHelper.badRequest(res, '天数参数必须在1-365之间');
      }

      const factoryId = dataFilter ? dataFilter.factoryId : null;
      const trend = await this.inspectionService.getInspectionTrend(
        factoryId,
        parseInt(days)
      );

      return ResponseHelper.success(res, trend, '点检趋势获取成功');
    } catch (error) {
      console.error('获取点检趋势失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 批量创建点检记录
   * POST /api/inspections/batch
   */
  async createBatchInspection(req, res) {
    try {
      const { user } = req;
      
      console.log('收到批量点检请求:', JSON.stringify(req.body, null, 2));
      
      // 验证请求数据
      const { location, equipments } = req.body;
      
      if (!location) {
        return ResponseHelper.badRequest(res, '位置信息不能为空');
      }
      
      if (!Array.isArray(equipments) || equipments.length === 0) {
        return ResponseHelper.badRequest(res, '器材列表不能为空');
      }

      // 验证每个器材数据
      for (let i = 0; i < equipments.length; i++) {
        const equipment = equipments[i];
        if (!equipment.equipmentId || !equipment.overallResult || !equipment.checklistResults || !equipment.inspectionImageUrl) {
          return ResponseHelper.badRequest(res, `器材 ${i + 1} 的数据不完整`);
        }
        
        if (!Array.isArray(equipment.checklistResults)) {
          return ResponseHelper.badRequest(res, `器材 ${i + 1} 的检查项结果格式不正确`);
        }
        
        // 如果是异常结果，检查是否有异常描述
        if (equipment.overallResult === 'ABNORMAL' && !equipment.issueDescription) {
          return ResponseHelper.badRequest(res, `器材 ${i + 1} 异常时必须提供异常描述`);
        }
      }

      const result = await this.inspectionService.createBatchInspection(
        { location, equipments },
        user.id
      );

      return ResponseHelper.created(res, result, `成功创建${result.summary.totalEquipments}个器材的点检记录`);
    } catch (error) {
      console.error('批量创建点检记录失败:', error);
      
      if (error.message.includes('器材不存在')) {
        return ResponseHelper.notFound(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取待点检器材列表
   * GET /api/inspections/pending
   */
  async getPendingInspections(req, res) {
    try {
      const { dataFilter } = req;
      const { days = 30 } = req.query;

      if (isNaN(parseInt(days)) || parseInt(days) < 1 || parseInt(days) > 365) {
        return ResponseHelper.badRequest(res, '天数参数必须在1-365之间');
      }

      const factoryId = dataFilter ? dataFilter.factoryId : null;
      const equipments = await this.inspectionService.getPendingInspections(
        factoryId,
        parseInt(days)
      );

      return ResponseHelper.success(res, equipments, '待点检器材获取成功');
    } catch (error) {
      console.error('获取待点检器材失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 创建一个空的点检记录（最小化字段，后续通过 append 接口追加图片与结果）
   * POST /api/inspections/empty
   * body: { equipmentId: number }
   */
  async createEmptyInspection(req, res) {
    try {
      const { user } = req;
      const { equipmentId } = req.body || {};

      if (!equipmentId || isNaN(parseInt(equipmentId))) {
        return ResponseHelper.badRequest(res, 'equipmentId 参数缺失或格式不正确');
      }

      const inspection = await this.inspectionService.createEmptyInspection(parseInt(equipmentId), user.id);

      return ResponseHelper.created(res, inspection, '空点检记录创建成功');
    } catch (error) {
      console.error('创建空点检记录失败:', error);

      if (error.message === '器材不存在') {
        return ResponseHelper.notFound(res, error.message);
      }
      if (error.message.includes('无权')) {
        return ResponseHelper.forbidden(res, error.message);
      }

      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 追加一张点检图片
   * POST /api/inspections/:id/images
   * body: { imageUrl: string, type?: 'inspection' }  // 预留 type 扩展
   */
  async appendInspectionImage(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      const { imageUrl, type = 'inspection' } = req.body || {};

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '点检记录ID格式不正确');
      }
      if (!imageUrl || typeof imageUrl !== 'string') {
        return ResponseHelper.badRequest(res, 'imageUrl 不能为空');
      }

      const updated = await this.inspectionService.appendInspectionImage(parseInt(id), type, imageUrl, user);

      return ResponseHelper.success(res, updated, '图片追加成功');
    } catch (error) {
      console.error('追加点检图片失败:', error);

      if (error.message === '点检记录不存在') {
        return ResponseHelper.notFound(res, error.message);
      }
      if (error.message === 'PERMISSION_DENIED' || error.message.includes('无权')) {
        return ResponseHelper.forbidden(res, '无权操作该点检记录');
      }
      if (error.message === 'IMAGE_ALREADY_EXISTS') {
        return ResponseHelper.conflict(res, '图片已存在于记录中');
      }

      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 删除一张点检图片
   * DELETE /api/inspections/:id/images?url=xxx
   * query: url=图片完整URL (或 body: { imageUrl })
   */
  async removeInspectionImage(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      const imageUrl = req.query.url || (req.body && req.body.imageUrl);

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '点检记录ID格式不正确');
      }
      if (!imageUrl || typeof imageUrl !== 'string') {
        return ResponseHelper.badRequest(res, 'imageUrl 不能为空');
      }

      const updated = await this.inspectionService.removeInspectionImage(parseInt(id), 'inspection', imageUrl, user);

      return ResponseHelper.success(res, updated, '图片删除成功');
    } catch (error) {
      console.error('删除点检图片失败:', error);

      if (error.message === '点检记录不存在') {
        return ResponseHelper.notFound(res, error.message);
      }
      if (error.message === 'IMAGE_NOT_FOUND') {
        return ResponseHelper.notFound(res, '记录中不存在该图片');
      }
      if (error.message === 'PERMISSION_DENIED' || error.message.includes('无权')) {
        return ResponseHelper.forbidden(res, '无权操作该点检记录');
      }

      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 最终提交 / 补全点检记录
   * PATCH /api/inspections/:id/finalize
   * body: { overallResult, checklistResults, issueDescription, issueImages? ... }
   */
  async finalizeInspection(req, res) {
    try {
      const { user } = req;
      const { id } = req.params;
      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '点检记录ID格式不正确');
      }

      const updated = await this.inspectionService.finalizeInspection(parseInt(id), req.body || {}, user);

      return ResponseHelper.success(res, updated, '点检记录提交成功');
    } catch (error) {
      console.error('提交点检记录失败:', error);

      if (error.message === '点检记录不存在') {
        return ResponseHelper.notFound(res, error.message);
      }
      if (error.message === 'PERMISSION_DENIED' || error.message.includes('无权')) {
        return ResponseHelper.forbidden(res, '无权操作该点检记录');
      }
      if (error.message === 'INVALID_STATE') {
        return ResponseHelper.conflict(res, '当前状态不允许提交');
      }

      return ResponseHelper.internalError(res, error.message);
    }
  }
}

// 导出控制器实例的方法，确保正确绑定this
const inspectionController = new InspectionController();

module.exports = {
  getChecklistTemplate: inspectionController.getChecklistTemplate.bind(inspectionController),
  createInspection: inspectionController.createInspection.bind(inspectionController),
  createBatchInspection: inspectionController.createBatchInspection.bind(inspectionController),
  getInspectionList: inspectionController.getInspectionList.bind(inspectionController),
  getInspectionById: inspectionController.getInspectionById.bind(inspectionController),
  getInspectionStats: inspectionController.getInspectionStats.bind(inspectionController),
  getInspectionTrend: inspectionController.getInspectionTrend.bind(inspectionController),
  getPendingInspections: inspectionController.getPendingInspections.bind(inspectionController),

  // 新增的增量接口导出
  createEmptyInspection: inspectionController.createEmptyInspection.bind(inspectionController),
  appendInspectionImage: inspectionController.appendInspectionImage.bind(inspectionController),
  removeInspectionImage: inspectionController.removeInspectionImage.bind(inspectionController),
  finalizeInspection: inspectionController.finalizeInspection.bind(inspectionController)
};
