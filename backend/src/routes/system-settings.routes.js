const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const EnhancedAuthMiddleware = require('../middleware/enhanced-auth.middleware');
const auth = new EnhancedAuthMiddleware();
const { authenticate, authorize } = auth;

// 获取当前二维码基础URL设置
router.get('/qr-base-url', authenticate, authorize('*:*'), async (req, res) => {
  try {
    const rec = await prisma.systemSetting.findUnique({ where: { key: 'qr_base_url' } });
    const value = rec?.value || '';
    return res.json({ success: true, data: { qrBaseUrl: value } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// 更新二维码基础URL
router.put('/qr-base-url', authenticate, authorize('*:*'), async (req, res) => {
  try {
    let { qrBaseUrl } = req.body || {};
    if (qrBaseUrl) {
      qrBaseUrl = qrBaseUrl.trim();
      if (!/^https?:\/\//i.test(qrBaseUrl)) {
        // 默认强制 https
        qrBaseUrl = 'https://' + qrBaseUrl.replace(/^\/*/, '');
      }
      qrBaseUrl = qrBaseUrl.replace(/\/$/, '');
    }
    await prisma.systemSetting.upsert({
      where: { key: 'qr_base_url' },
      update: { value: qrBaseUrl || null },
      create: { key: 'qr_base_url', value: qrBaseUrl || null, description: '二维码基础访问地址(留空则使用环境变量 BASE_URL / DOMAIN 兜底)' }
    });
    // 清理缓存
    const QRCodeGenerator = require('../utils/qrcode.generator');
    delete QRCodeGenerator._cachedQrBaseUrl;
    QRCodeGenerator._cachedSettingChecked = false;
    return res.json({ success: true, data: { qrBaseUrl: qrBaseUrl || '' } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
