const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * 报表直链下载签名工具
 * - 生成一次性、带过期时间的签名Token
 * - 校验并防止重复使用
 * 注意：一次性校验为进程内内存级，集群部署需改为共享存储（如Redis）
 */
class DownloadTokenUtil {
  constructor() {
    this.secret = process.env.DOWNLOAD_TOKEN_SECRET || process.env.JWT_SECRET || 'download-token-secret-2024';
    this.defaultTTL = parseInt(process.env.DOWNLOAD_TOKEN_TTL || '600', 10); // 默认10分钟
    this.usedJti = new Map(); // jti -> expTs
    this.cleanupIntervalMs = 10 * 60 * 1000; // 10分钟清理一次
    this.scheduleCleanup();
  }

  scheduleCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [jti, expTs] of this.usedJti.entries()) {
        if (now > expTs) this.usedJti.delete(jti);
      }
    }, this.cleanupIntervalMs).unref?.();
  }

  generateToken({ filename, userId, ttlSec, jti }) {
    const payload = {
      typ: 'download',
      sub: userId || 'anonymous',
      filename,
      jti: jti || crypto.randomUUID()
    };
    const token = jwt.sign(payload, this.secret, {
      expiresIn: (ttlSec || this.defaultTTL)
    });
    return token;
  }

  /**
   * 校验token；确保：
   * - 类型为download
   * - 未被重复使用
   * - 与请求文件名一致
   * 成功返回解码后的payload；失败抛出错误
   */
  verifyAndConsume(token, requestedFilename) {
    const decoded = jwt.verify(token, this.secret);
    if (!decoded || decoded.typ !== 'download') throw new Error('INVALID_TOKEN_TYPE');
    if (!decoded.filename || decoded.filename !== requestedFilename) throw new Error('FILENAME_MISMATCH');
    const jti = decoded.jti;
    if (!jti) throw new Error('INVALID_JTI');
    if (this.usedJti.has(jti)) throw new Error('TOKEN_ALREADY_USED');
    // 标记为已使用（一次性）
    const expSec = decoded.exp ? decoded.exp : Math.floor(Date.now() / 1000) + this.defaultTTL;
    this.usedJti.set(jti, expSec * 1000);
    return decoded;
  }

  /**
   * 生成带签名的下载URL
   */
  generateSignedUrl(filename, { userId, ttlSec, inline } = {}) {
    const token = this.generateToken({ filename, userId, ttlSec });
    const base = `/api/reports/download/${encodeURIComponent(filename)}`;
    const params = new URLSearchParams({ token });
    if (inline) params.set('inline', '1');
    return `${base}?${params.toString()}`;
  }
}

module.exports = new DownloadTokenUtil();

