const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const EnhancedAuthMiddleware = require('../middleware/enhanced-auth.middleware');
const auth = new EnhancedAuthMiddleware();
const { authenticate, authorize } = auth;

// 统一规范化函数（GET 与 PUT 都使用，防止历史脏数据残留）
function normalizeQrBaseUrl(input) {
  if (!input) return '';
  let url = String(input).trim();
  // 移除零宽字符 / BOM
  url = url.replace(/^[\u200B-\u200D\uFEFF]+/, '');
  // 去掉所有前导斜杠
  url = url.replace(/^\/*/, '');
  // 统计并剥离所有前导协议，统一最后再加 https://
  url = url.replace(/^(https?:\/\/)+/i, '');
  // 再次清理可能的空格
  url = url.trim();
  if (!url) return '';
  // 去除末尾单斜杠
  url = url.replace(/\/$/, '');
  return 'https://' + url; // 统一 https
}

// 统一获取全部系统设置
router.get('/', authenticate, authorize('*:*'), async (req, res) => {
  try {
    const records = await prisma.systemSetting.findMany();
    const map = {};
    for (const r of records) {
      map[r.key] = r.value || '';
    }
    let raw = map['qr_base_url'] || '';
    const normalized = normalizeQrBaseUrl(raw);
    // 若历史存的值不规范，后台自愈一次（异步，不阻塞响应）
    if (raw && normalized && raw !== normalized) {
      prisma.systemSetting.update({ where: { key: 'qr_base_url' }, data: { value: normalized } })
        .then(() => {
          try {
            const QRCodeGenerator = require('../utils/qrcode.generator');
            // 覆盖缓存为规范化后的值
            QRCodeGenerator._cachedQrBaseUrl = normalized;
            QRCodeGenerator._cachedSettingChecked = true;
          } catch (_) {}
        })
        .catch(() => {});
    }
    return res.json({ success: true, data: { qrBaseUrl: normalized } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// 兼容旧接口: 获取当前二维码基础URL设置
router.get('/qr-base-url', authenticate, authorize('*:*'), async (req, res) => {
  try {
    const rec = await prisma.systemSetting.findUnique({ where: { key: 'qr_base_url' } });
    const value = rec?.value || '';
    const normalized = normalizeQrBaseUrl(value);
    if (value && normalized && value !== normalized) {
      prisma.systemSetting.update({ where: { key: 'qr_base_url' }, data: { value: normalized } })
        .then(() => {
          try {
            const QRCodeGenerator = require('../utils/qrcode.generator');
            QRCodeGenerator._cachedQrBaseUrl = normalized;
            QRCodeGenerator._cachedSettingChecked = true;
          } catch (_) {}
        })
        .catch(() => {});
    }
    return res.json({ success: true, data: { qrBaseUrl: normalized } });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// 更新二维码基础URL
router.put('/qr-base-url', authenticate, authorize('*:*'), async (req, res) => {
  try {
    let { qrBaseUrl } = req.body || {};
    if (qrBaseUrl) {
      qrBaseUrl = normalizeQrBaseUrl(qrBaseUrl);
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
