/**
 * 消防器材点检系统 - 器材管理控制器
 * 处理器材相关的HTTP请求
 */

const EquipmentService = require('../services/equipment.service');
const ResponseHelper = require('../utils/response.helper');
const ValidationHelper = require('../utils/validation.helper');

class EquipmentController {
  constructor() {
    this.equipmentService = new EquipmentService();
  }

  /**
   * 获取器材列表
   * GET /api/equipments
   */
  async getEquipmentList(req, res) {
    try {
      const { user, dataFilter } = req;
      
      // 验证查询参数
      const queryValidation = ValidationHelper.validate(
        ValidationHelper.querySchema.pagination.concat(
          ValidationHelper.querySchema.equipmentFilter
        ),
        req.query
      );

      if (!queryValidation.isValid) {
        return ResponseHelper.validationError(res, queryValidation.errors);
      }

      const { page, limit, sortBy, sortOrder, ...filters } = queryValidation.data;
      
      const pagination = { page, limit, sortBy, sortOrder };
      const userFactoryId = dataFilter ? dataFilter.factoryId : null;

      const result = await this.equipmentService.getEquipmentList(
        filters,
        pagination,
        userFactoryId
      );

      // 返回前端期望的数据格式
      return ResponseHelper.success(res, {
        items: result.equipments,
        total: result.pagination.total,
        page: result.pagination.page,
        limit: result.pagination.limit,
        pages: result.pagination.pages,
        hasNext: result.pagination.hasNext,
        hasPrev: result.pagination.hasPrev
      }, '器材列表获取成功');
    } catch (error) {
      console.error('获取器材列表失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取器材详情
   * GET /api/equipments/:id
   */
  async getEquipmentById(req, res) {
    try {
      const { id } = req.params;
      const { user, dataFilter } = req;

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '器材ID格式不正确');
      }

      const userFactoryId = dataFilter ? dataFilter.factoryId : null;
      const equipment = await this.equipmentService.getEquipmentById(
        parseInt(id),
        userFactoryId
      );

      return ResponseHelper.success(res, equipment, '器材详情获取成功');
    } catch (error) {
      console.error('获取器材详情失败:', error);
      
      if (error.message === '器材不存在') {
        return ResponseHelper.notFound(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 根据二维码获取器材信息
   * GET /api/equipments/qr/:qrCode
   */
  async getEquipmentByQR(req, res) {
    try {
      const { qrCode } = req.params;
      const { user, dataFilter } = req;

      if (!qrCode) {
        return ResponseHelper.badRequest(res, '二维码不能为空');
      }

      const userFactoryId = dataFilter ? dataFilter.factoryId : null;
      const equipment = await this.equipmentService.getEquipmentByQR(
        qrCode,
        userFactoryId
      );

      return ResponseHelper.success(res, equipment, '器材信息获取成功');
    } catch (error) {
      console.error('根据二维码获取器材失败:', error);
      
      if (error.message.includes('二维码格式') || error.message === '器材不存在') {
        return ResponseHelper.notFound(res, error.message);
      }
      
      if (error.message === '无权访问该器材') {
        return ResponseHelper.forbidden(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 根据二维码获取位置下的所有器材和检查项
   * GET /api/equipments/location/:qrCode
   */
  async getLocationEquipments(req, res) {
    try {
      const { qrCode } = req.params;
      const { user, dataFilter } = req;

      if (!qrCode) {
        return ResponseHelper.badRequest(res, '二维码不能为空');
      }

      const userFactoryId = dataFilter ? dataFilter.factoryId : null;
      const locationData = await this.equipmentService.getEquipmentsByLocation(
        qrCode,
        userFactoryId
      );

      return ResponseHelper.success(res, locationData, '位置器材信息获取成功');
    } catch (error) {
      console.error('根据位置获取器材列表失败:', error);
      
      if (error.message.includes('二维码格式') || error.message === '器材不存在') {
        return ResponseHelper.notFound(res, error.message);
      }
      
      if (error.message === '无权访问该器材') {
        return ResponseHelper.forbidden(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 创建器材
   * POST /api/equipments
   */
  async createEquipment(req, res) {
    try {
      const { user, dataFilter } = req;
      
      // 路由层已使用 ValidationHelper.validateMiddleware 做过验证并写回 req.body
      // 再次调用 validate 会对已经被 Joi 转换后的 Date 对象再次按 iso() 规则校验，触发“日期格式不正确”假阳性
      // 直接使用中间件产出的 req.body
      const validatedData = req.body;

      const userFactoryId = dataFilter ? dataFilter.factoryId : null;
      const equipment = await this.equipmentService.createEquipment(
        validatedData,
        userFactoryId
      );

      return ResponseHelper.created(res, equipment, '器材创建成功');
    } catch (error) {
      console.error('创建器材失败:', error);
      
      if (error.message.includes('冲突') || error.message.includes('已存在')) {
        return ResponseHelper.conflict(res, error.message);
      }
      
      if (error.message.includes('不存在')) {
        return ResponseHelper.badRequest(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 更新器材
   * PUT /api/equipments/:id
   */
  async updateEquipment(req, res) {
    try {
      const { id } = req.params;
      const { user, dataFilter } = req;

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '器材ID格式不正确');
      }

      // 与创建逻辑相同：避免重复验证导致 Date 对象再次参与 iso 校验
      const validatedDataUpdate = req.body;

      const userFactoryId = dataFilter ? dataFilter.factoryId : null;
      const equipment = await this.equipmentService.updateEquipment(
        parseInt(id),
        validatedDataUpdate,
        userFactoryId
      );

      return ResponseHelper.success(res, equipment, '器材更新成功');
    } catch (error) {
      console.error('更新器材失败:', error);
      
      if (error.message.includes('不存在') || error.message.includes('无权')) {
        return ResponseHelper.notFound(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 删除器材
   * DELETE /api/equipments/:id
   */
  async deleteEquipment(req, res) {
    try {
      const { id } = req.params;
      const { user, dataFilter } = req;

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '器材ID格式不正确');
      }

      const userFactoryId = dataFilter ? dataFilter.factoryId : null;
      await this.equipmentService.deleteEquipment(
        parseInt(id),
        userFactoryId
      );

      return ResponseHelper.noContent(res);
    } catch (error) {
      console.error('删除器材失败:', error);
      
      if (error.message.includes('不存在') || error.message.includes('无权')) {
        return ResponseHelper.notFound(res, error.message);
      }
      
      if (error.message.includes('关联') || error.message.includes('无法删除')) {
        return ResponseHelper.badRequest(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 创建器材类型
   * POST /api/equipments/types
   */
  async createEquipmentType(req, res) {
    try {
      // 验证请求数据
      if (!req.body.name || req.body.name.trim() === '') {
        return ResponseHelper.badRequest(res, '器材类型名称不能为空');
      }

      const typeData = {
        name: req.body.name.trim()
      };

      const equipmentType = await this.equipmentService.createEquipmentType(typeData);
      return ResponseHelper.created(res, equipmentType, '器材类型创建成功');
    } catch (error) {
      console.error('创建器材类型失败:', error);
      
      if (error.message === '器材类型名称已存在') {
        return ResponseHelper.conflict(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取器材类型详情
   * GET /api/equipments/types/:id
   */
  async getEquipmentTypeById(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '器材类型ID格式不正确');
      }

      const equipmentType = await this.equipmentService.getEquipmentTypeById(parseInt(id));
      return ResponseHelper.success(res, equipmentType, '器材类型详情获取成功');
    } catch (error) {
      console.error('获取器材类型详情失败:', error);
      
      if (error.message === '器材类型不存在') {
        return ResponseHelper.notFound(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 更新器材类型
   * PUT /api/equipments/types/:id
   */
  async updateEquipmentType(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '器材类型ID格式不正确');
      }

      if (!req.body.name || req.body.name.trim() === '') {
        return ResponseHelper.badRequest(res, '器材类型名称不能为空');
      }

      const updateData = {
        name: req.body.name.trim()
      };

      const equipmentType = await this.equipmentService.updateEquipmentType(parseInt(id), updateData);
      return ResponseHelper.success(res, equipmentType, '器材类型更新成功');
    } catch (error) {
      console.error('更新器材类型失败:', error);
      
      if (error.message === '器材类型不存在') {
        return ResponseHelper.notFound(res, error.message);
      }
      
      if (error.message === '器材类型名称已存在') {
        return ResponseHelper.conflict(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 删除器材类型
   * DELETE /api/equipments/types/:id
   */
  async deleteEquipmentType(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '器材类型ID格式不正确');
      }

      await this.equipmentService.deleteEquipmentType(parseInt(id));
      return ResponseHelper.noContent(res);
    } catch (error) {
      console.error('删除器材类型失败:', error);
      
      if (error.message === '器材类型不存在') {
        return ResponseHelper.notFound(res, error.message);
      }
      
      if (error.message.includes('关联的器材')) {
        return ResponseHelper.badRequest(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取器材类型的点检项模板
   * GET /api/equipments/types/:id/checklist
   */
  async getChecklistTemplates(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '器材类型ID格式不正确');
      }

      const templates = await this.equipmentService.getChecklistTemplates(parseInt(id));
      return ResponseHelper.success(res, templates, '点检项模板获取成功');
    } catch (error) {
      console.error('获取点检项模板失败:', error);
      
      if (error.message === '器材类型不存在') {
        return ResponseHelper.notFound(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 创建点检项模板
   * POST /api/equipments/types/:id/checklist
   */
  async createChecklistTemplate(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '器材类型ID格式不正确');
      }

      if (!req.body.itemName || req.body.itemName.trim() === '') {
        return ResponseHelper.badRequest(res, '点检项目名称不能为空');
      }

      const templateData = {
        itemName: req.body.itemName.trim()
      };

      const template = await this.equipmentService.createChecklistTemplate(parseInt(id), templateData);
      return ResponseHelper.created(res, template, '点检项模板创建成功');
    } catch (error) {
      console.error('创建点检项模板失败:', error);
      
      if (error.message === '器材类型不存在') {
        return ResponseHelper.notFound(res, error.message);
      }
      
      if (error.message === '该点检项目已存在') {
        return ResponseHelper.conflict(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 批量创建点检项模板
   * POST /api/equipments/types/:id/checklist/batch
   */
  async createChecklistTemplatesBatch(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '器材类型ID格式不正确');
      }

      if (!req.body.itemNames || !Array.isArray(req.body.itemNames)) {
        return ResponseHelper.badRequest(res, '请提供点检项目名称数组');
      }

      if (req.body.itemNames.length === 0) {
        return ResponseHelper.badRequest(res, '点检项目名称数组不能为空');
      }

      const batchData = {
        itemNames: req.body.itemNames
      };

      const result = await this.equipmentService.createChecklistTemplatesBatch(parseInt(id), batchData);
      return ResponseHelper.created(res, result, result.message);
    } catch (error) {
      console.error('批量创建点检项模板失败:', error);
      
      if (error.message === '器材类型不存在') {
        return ResponseHelper.notFound(res, error.message);
      }
      
      if (error.message === '所有点检项目都已存在' || error.message === '没有有效的点检项目名称') {
        return ResponseHelper.badRequest(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 更新点检项模板
   * PUT /api/equipments/types/:typeId/checklist/:id
   */
  async updateChecklistTemplate(req, res) {
    try {
      const { typeId, id } = req.params;

      if (!typeId || isNaN(parseInt(typeId))) {
        return ResponseHelper.badRequest(res, '器材类型ID格式不正确');
      }

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '模板ID格式不正确');
      }

      if (!req.body.itemName || req.body.itemName.trim() === '') {
        return ResponseHelper.badRequest(res, '点检项目名称不能为空');
      }

      const updateData = {
        itemName: req.body.itemName.trim()
      };

      const template = await this.equipmentService.updateChecklistTemplate(
        parseInt(typeId), 
        parseInt(id), 
        updateData
      );
      
      return ResponseHelper.success(res, template, '点检项模板更新成功');
    } catch (error) {
      console.error('更新点检项模板失败:', error);
      
      if (error.message === '点检项模板不存在') {
        return ResponseHelper.notFound(res, error.message);
      }
      
      if (error.message === '该点检项目已存在') {
        return ResponseHelper.conflict(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 删除点检项模板
   * DELETE /api/equipments/types/:typeId/checklist/:id
   */
  async deleteChecklistTemplate(req, res) {
    try {
      const { typeId, id } = req.params;

      if (!typeId || isNaN(parseInt(typeId))) {
        return ResponseHelper.badRequest(res, '器材类型ID格式不正确');
      }

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '模板ID格式不正确');
      }

      await this.equipmentService.deleteChecklistTemplate(parseInt(typeId), parseInt(id));
      return ResponseHelper.noContent(res);
    } catch (error) {
      console.error('删除点检项模板失败:', error);
      
      if (error.message === '点检项模板不存在') {
        return ResponseHelper.notFound(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 批量更新点检项排序
   * PUT /api/equipments/types/:id/checklist/reorder
   */
  async reorderChecklistTemplates(req, res) {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id))) {
        return ResponseHelper.badRequest(res, '器材类型ID格式不正确');
      }

      if (!Array.isArray(req.body.templateIds)) {
        return ResponseHelper.badRequest(res, '模板ID列表格式不正确');
      }

      // 验证所有ID都是数字
      const templateIds = req.body.templateIds;
      for (const templateId of templateIds) {
        if (!templateId || isNaN(parseInt(templateId))) {
          return ResponseHelper.badRequest(res, '存在无效的模板ID');
        }
      }

      const templates = await this.equipmentService.reorderChecklistTemplates(
        parseInt(id), 
        templateIds.map(id => parseInt(id))
      );
      
      return ResponseHelper.success(res, templates, '点检项排序更新成功');
    } catch (error) {
      console.error('更新点检项排序失败:', error);
      
      if (error.message === '器材类型不存在') {
        return ResponseHelper.notFound(res, error.message);
      }
      
      if (error.message === '存在无效的模板ID') {
        return ResponseHelper.badRequest(res, error.message);
      }
      
      return ResponseHelper.internalError(res, error.message);
    }
  }
  async getEquipmentTypes(req, res) {
    try {
      const types = await this.equipmentService.getEquipmentTypes();
      return ResponseHelper.success(res, types, '器材类型获取成功');
    } catch (error) {
      console.error('获取器材类型失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 获取器材统计信息
   * GET /api/equipments/stats
   */
  async getEquipmentStats(req, res) {
    try {
      const { dataFilter } = req;
      const factoryId = dataFilter ? dataFilter.factoryId : null;
      
      const stats = await this.equipmentService.getEquipmentStats(factoryId);
      return ResponseHelper.success(res, stats, '器材统计获取成功');
    } catch (error) {
      console.error('获取器材统计失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 批量导入器材
   * POST /api/equipments/batch-import
   */
  async batchImportEquipments(req, res) {
    try {
      const { user, dataFilter } = req;
      const { equipments } = req.body;

      console.log('=== 批量导入开始 ===');
      console.log('请求用户:', {
        id: user.id,
        username: user.username,
        role: user.role,
        factoryId: user.factoryId
      });
      console.log('数据过滤器:', dataFilter);
      console.log('请求体原始数据:', JSON.stringify(req.body, null, 2));
      console.log('器材列表类型:', typeof equipments);
      console.log('器材列表是否为数组:', Array.isArray(equipments));
      console.log('器材列表长度:', equipments?.length);

      if (!Array.isArray(equipments) || equipments.length === 0) {
        console.error('❌ 器材列表验证失败:', {
          isArray: Array.isArray(equipments),
          length: equipments?.length,
          type: typeof equipments,
          value: equipments
        });
        return ResponseHelper.badRequest(res, '器材列表不能为空');
      }

      console.log('✅ 器材列表验证通过');
      
      // 打印每个器材的详细信息
      equipments.forEach((equipment, index) => {
        console.log(`器材 ${index + 1}:`, JSON.stringify(equipment, null, 2));
        console.log(`器材 ${index + 1} 字段分析:`, {
          name: { value: equipment.name, type: typeof equipment.name, isEmpty: !equipment.name },
          typeId: { value: equipment.typeId, type: typeof equipment.typeId, isEmpty: !equipment.typeId },
          factoryId: { value: equipment.factoryId, type: typeof equipment.factoryId, isEmpty: !equipment.factoryId },
          location: { value: equipment.location, type: typeof equipment.location, isEmpty: !equipment.location },
          productionDate: { value: equipment.productionDate, type: typeof equipment.productionDate },
          expiryDate: { value: equipment.expiryDate, type: typeof equipment.expiryDate }
        });
      });

      if (equipments.length > 100) {
        return ResponseHelper.badRequest(res, '单次导入不能超过100条记录');
      }

      const userFactoryId = dataFilter ? dataFilter.factoryId : null;
      const result = await this.equipmentService.batchImportEquipments(
        equipments,
        userFactoryId
      );

      return ResponseHelper.success(res, result, '批量导入完成');
    } catch (error) {
      console.error('批量导入器材失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }

  /**
   * 生成二维码图片
   * GET /api/equipments/qr-image/:qrCode
   */
  async generateQRImage(req, res) {
    try {
      // URL解码二维码参数
      const { qrCode: encodedQrCode } = req.params;
      let qrCode = decodeURIComponent(encodedQrCode);
      const { size = 200, format } = req.query;

      const QRCodeGenerator = require('../utils/qrcode.generator');
      
      console.log('🔗 [generateQRImage] 收到请求:', {
        原始参数: encodedQrCode,
        解码后: qrCode,
        尺寸: size,
        格式: format
      });
      
      // 如果传入是纯码则自动补全为完整URL用于生成可直接跳转的二维码
      // 纯码格式: FIRE-xxx-xx-...-XXXX 或 QR000000
      const purePattern = /^(FIRE-\d{3}-\d{2}-[A-Z0-9]+-[A-F0-9]{4}|QR\d{6})$/;
      let encodedContent = qrCode;
      if (purePattern.test(qrCode)) {
        // 构造完整URL
        encodedContent = QRCodeGenerator.buildQRCodeURL
          ? QRCodeGenerator.buildQRCodeURL(qrCode)
          : `${QRCodeGenerator.getBaseURL()}/m/inspection/${qrCode}`;
        console.log('🔄 [generateQRImage] 纯码自动补全为URL:', {
          原始: qrCode,
            编码内容: encodedContent
        });
      } else if (qrCode.includes('/m/inspection/')) {
        // 若已包含路径，尝试验证提取部分
        const extracted = QRCodeGenerator.extractQRCodeFromURL(qrCode);
        if (!QRCodeGenerator.validateQRCode(extracted)) {
          console.log('❌ [generateQRImage] 二维码格式验证失败(嵌套URL):', qrCode);
          return ResponseHelper.badRequest(res, '无效的二维码格式');
        }
      } else {
        // 非纯码且不含路径，直接判定非法
        if (!QRCodeGenerator.validateQRCode(qrCode)) {
          console.log('❌ [generateQRImage] 二维码格式验证失败:', qrCode);
          return ResponseHelper.badRequest(res, '无效的二维码格式');
        }
      }

      const sizeInt = parseInt(size);
      if (isNaN(sizeInt) || sizeInt < 50 || sizeInt > 1000) {
        return ResponseHelper.badRequest(res, '图片尺寸必须在50-1000px之间');
      }

      // 根据请求格式生成不同类型的二维码
      if (format === 'svg') {
        // 直接返回SVG文件
        const svgString = await QRCodeGenerator.generateQRSVG(encodedContent, { size: sizeInt });
        res.set({
          'Content-Type': 'image/svg+xml',
          'Cache-Control': 'public, max-age=3600', // 缓存1小时
          'Content-Disposition': `inline; filename=\"qr-${qrCode}.svg\"`
        });
        return res.send(svgString);
      } else if (format === 'png') {
        // 直接返回PNG文件
        const imageBuffer = await QRCodeGenerator.generateQRImage(encodedContent, { size: sizeInt });
        
        res.set({
          'Content-Type': 'image/png',
          'Content-Length': imageBuffer.length,
          'Cache-Control': 'public, max-age=3600', // 缓存1小时
          'Content-Disposition': `inline; filename=\"qr-${qrCode}.png\"`
        });
        
        return res.send(imageBuffer);
      } else {
        // 默认返回base64格式的JSON数据（前端期望的格式）
        const base64String = await QRCodeGenerator.generateQRBase64(encodedContent, { size: sizeInt });
        
        console.log('✅ [generateQRImage] 生成成功:', {
          原始输入: qrCode,
          编码内容: encodedContent,
          尺寸: sizeInt,
          base64长度: base64String.length
        });
        
        return ResponseHelper.success(res, {
          qrCode: encodedContent,
          originalInput: qrCode,
          imageUrl: base64String,  // 前端期望的字段名
          size: sizeInt
        }, '二维码生成成功');
      }
    } catch (error) {
      console.error('生成二维码图片失败:', error);
      return ResponseHelper.internalError(res, error.message);
    }
  }
}

// 导出控制器实例的方法，确保正确绑定this
const equipmentController = new EquipmentController();

module.exports = {
  getEquipmentList: equipmentController.getEquipmentList.bind(equipmentController),
  getEquipmentById: equipmentController.getEquipmentById.bind(equipmentController),
  getEquipmentByQR: equipmentController.getEquipmentByQR.bind(equipmentController),
  getLocationEquipments: equipmentController.getLocationEquipments.bind(equipmentController),
  createEquipment: equipmentController.createEquipment.bind(equipmentController),
  updateEquipment: equipmentController.updateEquipment.bind(equipmentController),
  deleteEquipment: equipmentController.deleteEquipment.bind(equipmentController),
  getEquipmentTypes: equipmentController.getEquipmentTypes.bind(equipmentController),
  createEquipmentType: equipmentController.createEquipmentType.bind(equipmentController),
  getEquipmentTypeById: equipmentController.getEquipmentTypeById.bind(equipmentController),
  updateEquipmentType: equipmentController.updateEquipmentType.bind(equipmentController),
  deleteEquipmentType: equipmentController.deleteEquipmentType.bind(equipmentController),
  getChecklistTemplates: equipmentController.getChecklistTemplates.bind(equipmentController),
  createChecklistTemplate: equipmentController.createChecklistTemplate.bind(equipmentController),
  createChecklistTemplatesBatch: equipmentController.createChecklistTemplatesBatch.bind(equipmentController),
  updateChecklistTemplate: equipmentController.updateChecklistTemplate.bind(equipmentController),
  deleteChecklistTemplate: equipmentController.deleteChecklistTemplate.bind(equipmentController),
  reorderChecklistTemplates: equipmentController.reorderChecklistTemplates.bind(equipmentController),
  getEquipmentStats: equipmentController.getEquipmentStats.bind(equipmentController),
  batchImportEquipments: equipmentController.batchImportEquipments.bind(equipmentController),
  generateQRImage: equipmentController.generateQRImage.bind(equipmentController)
};
