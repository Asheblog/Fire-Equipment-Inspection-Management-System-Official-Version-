const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const EnhancedAuthMiddleware = require('../middleware/enhanced-auth.middleware');
const SecuritySettingsService = require('../services/security-settings.service');
const auth = new EnhancedAuthMiddleware();
const { authenticate, authorize } = auth;
const securitySettingsService = new SecuritySettingsService();

// 统一规范化函数（GET 与 PUT 都使用，防止历史脏数据残留）
function normalizeQrBaseUrl(input) {
  if (!input) return '';
  let original = String(input);
  let url = original.trim();
  // 先进行HTML实体解码（至少处理协议关键字符 : / & ）
  const beforeDecode = url;
  url = url
    .replace(/&#x2F;/gi, '/')
    .replace(/&#x3A;/gi, ':')
    .replace(/&amp;/gi, '&')
    .replace(/&colon;/gi, ':')
    .replace(/&sol;/gi, '/');
  if (process.env.QR_DEBUG === 'true' && beforeDecode !== url) {
    console.log('[QR_DEBUG][normalizeQrBaseUrl] htmlEntityDecoded from=', beforeDecode, 'to=', url);
  }
  // 全局移除零宽字符 / BOM（不仅仅开头）
  url = url.replace(/[\u200B-\u200D\uFEFF]/g, '');
  // 去掉所有前导斜杠
  url = url.replace(/^\/*/, '');
  // 统计并剥离所有前导协议，统一最后再加 https://
  url = url.replace(/^(https?:\/\/)+/i, '');
  // 针对仍然存在的“协议 + 被实体编码斜杠”形式，如 https:&#x2F;&#x2F; 再次转换
  url = url.replace(/^(https?:)(&#x2F;|\/){2}/i, (m, p1) => p1 + '//');
  // 如果仍包含被编码的第二段协议（极端情况，如 https:&#x2F;&#x2F;https:&#x2F;&#x2F;domain）先全部解码再重新剥离
  if (/https:&#x2F;&#x2F;https:&#x2F;&#x2F;/i.test(original)) {
    const tmp = original
      .replace(/&#x2F;/gi, '/')
      .replace(/&#x3A;/gi, ':')
      .replace(/^(https?:\/\/)+/i, '')
      .replace(/^(https?:\/\/)+/i, '');
    if (process.env.QR_DEBUG === 'true') {
      console.log('[QR_DEBUG][normalizeQrBaseUrl] double-encoded protocol collapse tmp=', tmp);
    }
  }
  // 再次清理可能的空格
  url = url.trim();
  if (!url) return '';
  // 去除末尾单斜杠
  url = url.replace(/\/$/, '');
  const finalUrl = 'https://' + url;
  if (process.env.QR_DEBUG === 'true') {
    const toHex = (s) => Array.from(s).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
    console.log('[QR_DEBUG][normalizeQrBaseUrl] raw=', original, 'hex=', toHex(original));
    console.log('[QR_DEBUG][normalizeQrBaseUrl] normalized=', finalUrl, 'hex=', toHex(finalUrl));
  }
  return finalUrl;
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
    if (process.env.QR_DEBUG === 'true') {
      console.log('[QR_DEBUG][GET /system-settings] rawDBValue=', raw, 'normalized=', normalized);
    }
    // 若历史存的值不规范，后台自愈一次（异步，不阻塞响应）
    if (raw && normalized && raw !== normalized) {
      prisma.systemSetting.update({ where: { key: 'qr_base_url' }, data: { value: normalized } })
        .then(() => {
          if (process.env.QR_DEBUG === 'true') {
            console.log('[QR_DEBUG][GET /system-settings] self-heal wrote normalized value back to DB');
          }
          try {
            const QRCodeGenerator = require('../utils/qrcode.generator');
            QRCodeGenerator._cachedQrBaseUrl = normalized;
            QRCodeGenerator._cachedSettingChecked = true;
          } catch (_) {}
        })
        .catch(err => {
          if (process.env.QR_DEBUG === 'true') {
            console.log('[QR_DEBUG][GET /system-settings] self-heal DB update failed:', err.message);
          }
        });
    }
    // —— 扩展：数据清理相关设置 ——
    const autoCleanupEnabled = (map['auto_cleanup_enabled'] || 'false') === 'true';
    const dataRetentionDays = parseInt(map['data_retention_days'] || '365', 10) || 365;
    let cleanupCategories = [];
    try {
      cleanupCategories = JSON.parse(map['cleanup_categories'] || '[]');
    } catch (_) { cleanupCategories = []; }
    const lastCleanupAt = map['last_cleanup_at'] || '';

    // 安全设置（记住我）
    const sec = await securitySettingsService.getSettings();

    return res.json({ success: true, data: { 
      qrBaseUrl: normalized,
      autoCleanupEnabled,
      dataRetentionDays,
      cleanupCategories,
      lastCleanupAt,
      rememberMeEnabled: sec.rememberMeEnabled,
      rememberMeDays: sec.rememberMeDays,
      sessionTimeoutMinutes: sec.sessionTimeoutMinutes,
      maxLoginAttempts: sec.authMaxLoginAttempts,
      enableAuditLogging: sec.enableAuditLogging,
      allowPasswordReset: sec.allowPasswordReset,
    } });
  } catch (e) {
    if (process.env.QR_DEBUG === 'true') {
      console.log('[QR_DEBUG][GET /system-settings] error:', e.message);
    }
    return res.status(500).json({ success: false, message: e.message });
  }
});

// 兼容旧接口: 获取当前二维码基础URL设置
router.get('/qr-base-url', authenticate, authorize('*:*'), async (req, res) => {
  try {
    const rec = await prisma.systemSetting.findUnique({ where: { key: 'qr_base_url' } });
    const value = rec?.value || '';
    const normalized = normalizeQrBaseUrl(value);
    if (process.env.QR_DEBUG === 'true') {
      console.log('[QR_DEBUG][GET /system-settings/qr-base-url] rawDB=', value, 'normalized=', normalized);
    }
    if (value && normalized && value !== normalized) {
      prisma.systemSetting.update({ where: { key: 'qr_base_url' }, data: { value: normalized } })
        .then(() => {
          if (process.env.QR_DEBUG === 'true') {
            console.log('[QR_DEBUG][GET /system-settings/qr-base-url] self-heal wrote normalized value back to DB');
          }
          try {
            const QRCodeGenerator = require('../utils/qrcode.generator');
            QRCodeGenerator._cachedQrBaseUrl = normalized;
            QRCodeGenerator._cachedSettingChecked = true;
          } catch (_) {}
        })
        .catch(err => {
          if (process.env.QR_DEBUG === 'true') {
            console.log('[QR_DEBUG][GET /system-settings/qr-base-url] self-heal DB update failed:', err.message);
          }
        });
    }
    return res.json({ success: true, data: { qrBaseUrl: normalized } });
  } catch (e) {
    if (process.env.QR_DEBUG === 'true') {
      console.log('[QR_DEBUG][GET /system-settings/qr-base-url] error:', e.message);
    }
    return res.status(500).json({ success: false, message: e.message });
  }
});

// 更新二维码基础URL
router.put('/qr-base-url', authenticate, authorize('*:*'), async (req, res) => {
  try {
    let { qrBaseUrl } = req.body || {};
    if (process.env.QR_DEBUG === 'true') {
      console.log('[QR_DEBUG][PUT /system-settings/qr-base-url] inputBody=', qrBaseUrl);
    }
    if (qrBaseUrl) {
      qrBaseUrl = normalizeQrBaseUrl(qrBaseUrl);
    }
    if (process.env.QR_DEBUG === 'true') {
      console.log('[QR_DEBUG][PUT /system-settings/qr-base-url] normalizedToSave=', qrBaseUrl);
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

// 更新清理相关设置
router.put('/cleanup', authenticate, authorize('*:*'), async (req, res) => {
  try {
    const { autoCleanupEnabled, dataRetentionDays, categories } = req.body || {};
    // 简要校验
    const enabled = !!autoCleanupEnabled;
    const daysNum = parseInt(dataRetentionDays, 10);
    const days = Number.isFinite(daysNum) ? Math.max(30, Math.min(3650, daysNum)) : 365;
    let cats = Array.isArray(categories) ? categories : [];
    const DataCleanupService = require('../services/data-cleanup.service');
    const saved = await DataCleanupService.saveSettings({ autoCleanupEnabled: enabled, dataRetentionDays: days, categories: cats });
    return res.json({ success: true, data: saved });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// 手动执行一键清理
router.post('/cleanup/execute', authenticate, authorize('*:*'), async (req, res) => {
  try {
    const DataCleanupService = require('../services/data-cleanup.service');
    const result = await DataCleanupService.cleanupNow();
    return res.json({ success: true, data: result });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// 安全设置（记住我）
router.put('/security', authenticate, authorize('*:*'), async (req, res) => {
  try {
    const {
      rememberMeEnabled,
      rememberMeDays,
      sessionTimeoutMinutes,
      maxLoginAttempts,
      enableAuditLogging,
      allowPasswordReset,
    } = req.body || {};
    const saved = await securitySettingsService.saveSettings({
      rememberMeEnabled,
      rememberMeDays,
      sessionTimeoutMinutes,
      authMaxLoginAttempts: maxLoginAttempts,
      enableAuditLogging,
      allowPasswordReset,
    });
    return res.json({ success: true, data: saved });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
