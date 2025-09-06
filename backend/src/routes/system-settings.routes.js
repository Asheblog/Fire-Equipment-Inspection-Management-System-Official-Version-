const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const EnhancedAuthMiddleware = require('../middleware/enhanced-auth.middleware');
const auth = new EnhancedAuthMiddleware();
const { authenticate, authorize } = auth;

// 统一获取全部系统设置
router.get('/', authenticate, authorize('*:*'), async (req, res) => {
  try {
    const records = await prisma.systemSetting.findMany();
    const map = {};
    for (const r of records) {
      map[r.key] = r.value || '';
    }
    return res.json({ success: true, data: {
      qrBaseUrl: map['qr_base_url'] || ''
    }});
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// 兼容旧接口: 获取当前二维码基础URL设置
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
      // 去除可能的零宽字符 / BOM
      qrBaseUrl = qrBaseUrl.replace(/^[\u200B-\u200D\uFEFF]+/, '');
      // 折叠重复协议: https://https://domain.com -> https://domain.com
      qrBaseUrl = qrBaseUrl.replace(/^(https?:\/\/){2,}/i, (m) => m.startsWith('https') ? 'https://' : 'http://');
      // 若仍出现混合双协议 (例如 http://https://domain.com) 取最后主体并统一为 https
      if (/^https?:\/\/https?:\/\//i.test(qrBaseUrl)) {
        const parts = qrBaseUrl.split(/https?:\/\//i).filter(p => p);
        const last = parts[parts.length - 1];
        qrBaseUrl = 'https://' + last.replace(/^\/*/, '');
      }
      // 如果没有协议则补 https://
      if (!/^https?:\/\//i.test(qrBaseUrl)) {
        qrBaseUrl = 'https://' + qrBaseUrl.replace(/^\/*/, '');
      }
      // 再次防御性清理可能残留的双协议
      qrBaseUrl = qrBaseUrl.replace(/^https?:\/\/https?:\/\//i, 'https://');
      // 移除末尾单斜杠
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
