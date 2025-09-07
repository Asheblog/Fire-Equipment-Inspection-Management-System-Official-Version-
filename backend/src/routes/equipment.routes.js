/**
 * 消防器材点检系统 - 器材管理路由
 * 定义器材相关的API端点
 */

const express = require('express');
const router = express.Router();

// 导入控制器
const equipmentController = require('../controllers/equipment.controller');

// 导入中间件
const ValidationHelper = require('../utils/validation.helper');

/**
 * 器材管理路由定义
 */

// 获取器材类型列表 (不需要特殊权限)
router.get('/types', equipmentController.getEquipmentTypes);

// 创建器材类型 (需要管理员权限)
router.post('/types', equipmentController.createEquipmentType);

// 获取器材类型详情
router.get('/types/:id', equipmentController.getEquipmentTypeById);

// 更新器材类型
router.put('/types/:id', equipmentController.updateEquipmentType);

// 删除器材类型
router.delete('/types/:id', equipmentController.deleteEquipmentType);

// 获取器材类型的点检项模板
router.get('/types/:id/checklist', equipmentController.getChecklistTemplates);

// 创建点检项模板
router.post('/types/:id/checklist', equipmentController.createChecklistTemplate);

// 批量创建点检项模板
router.post('/types/:id/checklist/batch', equipmentController.createChecklistTemplatesBatch);

// 更新点检项模板
router.put('/types/:typeId/checklist/:id', equipmentController.updateChecklistTemplate);

// 删除点检项模板
router.delete('/types/:typeId/checklist/:id', equipmentController.deleteChecklistTemplate);

// 批量更新点检项排序
router.put('/types/:id/checklist/reorder', equipmentController.reorderChecklistTemplates);

// 获取器材统计信息
router.get('/stats', equipmentController.getEquipmentStats);

// 批量导入器材 (需要管理员权限)
router.post('/batch-import', equipmentController.batchImportEquipments);

// 根据二维码获取器材信息（兼容完整URL与纯码）
// 场景：若前端把完整 https://IP:PORT/m/inspection/FIRE-... 直接拼接到 /api/equipments/qr/ 之后，
// 之前的 /qr/:qrCode 只会解析到 "https:"，导致格式校验失败。这里增加通配符捕获剩余路径并回退给控制器。
router.get('/qr/*', (req, res, next) => {
  if (req.params && typeof req.params[0] === 'string') {
    let raw = req.params[0];
    try { raw = decodeURIComponent(raw); } catch (_) {}
    raw = raw.split(/[?#]/)[0]; // 去掉查询串和 hash
    req.params.qrCode = raw;
  }
  return equipmentController.getEquipmentByQR(req, res, next);
});

// 规范形式（仅二维码码串）
router.get('/qr/:qrCode', equipmentController.getEquipmentByQR);

// 解析/归一化二维码并返回解析结果（无需认证，便于扫码前端快速判断）
router.get('/qr/resolve/:raw', async (req, res) => {
  try {
    const { raw } = req.params;
    const QRGen = require('../utils/qrcode.generator');
    const ResponseHelper = require('../utils/response.helper');
    const decoded = decodeURIComponent(raw);
    const pure = QRGen.extractQRCodeFromURL(decoded);
    const isValid = QRGen.validateQRCode(pure);
    const fullUrl = isValid ? (QRGen.buildQRCodeURL ? QRGen.buildQRCodeURL(pure) : decoded) : '';
    return ResponseHelper.success(res, {
      original: decoded,
      pureCode: pure,
      isValid,
      fullUrl: fullUrl || null
    }, '二维码解析结果');
  } catch (e) {
    return res.status(400).json({ success: false, message: '解析失败', error: e.message });
  }
});

// 根据二维码获取位置下的所有器材和检查项
router.get('/location/:qrCode', equipmentController.getLocationEquipments);


// 生成二维码图片
router.get('/qr-image/:qrCode', equipmentController.generateQRImage);

// 获取器材列表 (带分页和筛选)
router.get('/', 
  ValidationHelper.validateMiddleware(
    ValidationHelper.querySchema.pagination.concat(
      ValidationHelper.querySchema.equipmentFilter
    ), 
    'query'
  ),
  equipmentController.getEquipmentList
);

// 创建新器材
router.post('/', 
  ValidationHelper.validateMiddleware(
    ValidationHelper.equipmentSchema.create, 
    'body'
  ),
  equipmentController.createEquipment
);

// 获取器材详情
router.get('/:id', equipmentController.getEquipmentById);

// 更新器材信息
router.put('/:id', 
  ValidationHelper.validateMiddleware(
    ValidationHelper.equipmentSchema.update, 
    'body'
  ),
  equipmentController.updateEquipment
);

// 删除器材
router.delete('/:id', equipmentController.deleteEquipment);

module.exports = router;
