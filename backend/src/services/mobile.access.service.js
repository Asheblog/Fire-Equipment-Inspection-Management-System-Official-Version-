/**
 * 移动端访问令牌服务
 * 功能：
 * 1. 生成一次性扫码 Token（PC 端生成二维码展示给用户，用手机扫码）
 * 2. 手机端扫码后调用消费接口，占用该 Token，标记已使用
 * 3. 查询 Token 状态（用于 PC 端轮询，得知是否已被手机扫码）
 * 4. 定期自动清理过期 / 已完成且超过一定时间的 Token
 *
 * 说明：当前实现采用内存 Map，适合单实例 / 开发环境。
 * 生产可替换为 Redis，便于多实例共享和更精细的过期控制。
 */

const crypto = require('crypto');

class MobileAccessService {
  constructor() {
    // 内存存储（key = tokenId, value = token对象）
    this.tokens = new Map();
    // 默认有效时间（秒）
    this.EXPIRE_SECONDS = 5 * 60; // 5 分钟
    // 已使用 Token 在被占用后继续保留的时间（毫秒）
    this.USED_RETENTION_MS = 60 * 1000; // 1 分钟
    // 启动清理任务
    setInterval(() => this.cleanup(), 60 * 1000).unref();
  }

  /**
   * 生成一次性 Token
   * @param {Object} meta 附加元数据 { purpose, userId }
   * @returns {Object} token 对象
   */
  generate(meta = {}) {
    const id = crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const token = {
      id,
      createdAt: now,
      expireAt: now + this.EXPIRE_SECONDS * 1000,
      used: false,
      usedAt: null,
      meta: {
        purpose: meta.purpose || 'mobile-inspection',
        userId: meta.userId || null
      }
    };
    this.tokens.set(id, token);
    return token;
  }

  /**
   * 消费（占用）Token
   * @param {string} id
   * @returns {Object} 结果对象 { ok, code, message, token? }
   */
  consume(id) {
    if (!id) {
      return { ok: false, code: 'INVALID', message: '缺少 token 参数' };
    }
    const token = this.tokens.get(id);
    if (!token) {
      return { ok: false, code: 'NOT_FOUND', message: 'Token 不存在或已过期' };
    }
    if (Date.now() > token.expireAt) {
      this.tokens.delete(id);
      return { ok: false, code: 'EXPIRED', message: 'Token 已过期' };
    }
    if (token.used) {
      return { ok: false, code: 'USED', message: 'Token 已被使用' };
    }
    token.used = true;
    token.usedAt = Date.now();
    this.tokens.set(id, token);
    return { ok: true, code: 'OK', message: '兑换成功', token };
  }

  /**
   * 获取状态（PC 轮询）
   * @param {string} id
   * @returns {Object}
   */
  status(id) {
    const token = this.tokens.get(id);
    if (!token) {
      return { exists: false };
    }
    return {
      exists: true,
      used: token.used,
      expireAt: token.expireAt,
      remainSeconds: Math.max(0, Math.floor((token.expireAt - Date.now()) / 1000))
    };
  }

  /**
   * 清理过期与已完成 Token
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;
    for (const [id, token] of this.tokens.entries()) {
      if (now > token.expireAt) {
        this.tokens.delete(id); removed++; continue;
      }
      if (token.used && token.usedAt && now - token.usedAt > this.USED_RETENTION_MS) {
        this.tokens.delete(id); removed++; continue;
      }
    }
    if (removed > 0) {
      console.log(`🧹 [MobileAccessService] 清理 token 数量: ${removed}`);
    }
  }
}

module.exports = new MobileAccessService();

