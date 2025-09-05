/**
 * 移动端辅助访问路由
 * 目标：
 * 1. PC 端获取一次性扫码 Token 以及组成二维码的 URL（前端可自行生成二维码）
 * 2. PC 端轮询 Token 状态（是否已被手机扫码）
 * 3. 手机端使用 Token 兑换：标记已使用，并返回一个『移动访问 session 标记』(演示用)
 *
 * 注意：这里不直接发放 JWT，仅返回一个轻量标记。实际业务中：
 * - 可在 consume 时颁发一个短期 JWT / 或引导前端正常登录后携带 token 绑定。
 */

const express = require('express');
const router = express.Router();
const MobileAccessService = require('../services/mobile.access.service');
const QRCodeGenerator = require('../utils/qrcode.generator');
const ResponseHelper = require('../utils/response.helper');

/**
 * 获取一次性扫码 Token
 * GET /api/mobile/qr-token
 */
router.get('/qr-token', (req, res) => {
  try {
    const token = MobileAccessService.generate({ purpose: 'pc-to-mobile' });
    const baseUrl = QRCodeGenerator.getBaseURL();
    const scanUrl = `${baseUrl}/m/inspection?token=${token.id}`; // 示例：可根据前端具体路径调整

    return ResponseHelper.success(res, {
      tokenId: token.id,
      expireAt: token.expireAt,
      scanUrl
    }, '生成二维码临时 Token 成功');
  } catch (error) {
    console.error('生成二维码 Token 失败:', error);
    return ResponseHelper.internalError(res, '生成失败');
  }
});

/**
 * 轮询 Token 状态
 * GET /api/mobile/qr-token/:id/status
 */
router.get('/qr-token/:id/status', (req, res) => {
  const { id } = req.params;
  const status = MobileAccessService.status(id);
  return ResponseHelper.success(res, status, '状态获取成功');
});

/**
 * 手机端兑换 Token
 * POST /api/mobile/qr-token/:id/consume
 */
router.post('/qr-token/:id/consume', (req, res) => {
  const { id } = req.params;
  const result = MobileAccessService.consume(id);
  if (!result.ok) {
    return ResponseHelper.badRequest(res, result.message, { code: result.code });
  }
  // 演示：返回一个移动访问标记（真实可生成JWT或绑定后续逻辑）
  const mobileSession = {
    sessionId: 'MOB-' + result.token.id.slice(0, 8),
    issuedAt: Date.now(),
    purpose: result.token.meta.purpose
  };
  return ResponseHelper.success(res, { mobileSession }, '兑换成功');
});

module.exports = router;

