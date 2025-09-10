const { PrismaClient } = require('@prisma/client');

/**
 * 安全设置服务（系统设置持久化）
 * - 负责读取/写入系统级安全相关设置（记住我、会话等）
 * - 简易内存缓存，减少数据库压力
 */
class SecuritySettingsService {
  constructor() {
    this.prisma = new PrismaClient();
    this._cache = {
      data: null,
      expiresAt: 0,
    };
    this.cacheTtlMs = 60 * 1000; // 1分钟缓存
  }

  /**
   * 读取并返回安全设置（含默认值）
   * @param {boolean} [forceReload=false]
   */
  async getSettings(forceReload = false) {
    const now = Date.now();
    if (!forceReload && this._cache.data && this._cache.expiresAt > now) {
      return this._cache.data;
    }

    const rows = await this.prisma.systemSetting.findMany();
    const map = new Map(rows.map(r => [r.key, r.value || '']));

    const rememberMeEnabled = (map.get('remember_me_enabled') || 'true') === 'true';
    const rememberMeDays = parseInt(map.get('remember_me_days') || '90', 10) || 90;

    // 会话超时（分钟）
    const sessionTimeoutMinutes = (() => {
      const num = parseInt(map.get('session_timeout_minutes') || '480', 10);
      if (!Number.isFinite(num)) return 480;
      return Math.max(15, Math.min(1440, num));
    })();

    // 最大登录尝试次数（每15分钟）
    const authMaxLoginAttempts = (() => {
      const num = parseInt(map.get('auth_max_login_attempts') || '5', 10);
      if (!Number.isFinite(num)) return 5;
      return Math.max(3, Math.min(10, num));
    })();

    // 审计日志开关
    const enableAuditLogging = (map.get('enable_audit_logging') || 'true') === 'true';

    // 允许密码重置
    const allowPasswordReset = (map.get('allow_password_reset') || 'true') === 'true';

    const data = {
      rememberMeEnabled,
      rememberMeDays,
      sessionTimeoutMinutes,
      authMaxLoginAttempts,
      enableAuditLogging,
      allowPasswordReset,
    };

    this._cache = { data, expiresAt: now + this.cacheTtlMs };
    return data;
  }

  /**
   * 保存安全设置（仅处理识别的字段）
   * @param {{rememberMeEnabled?: boolean, rememberMeDays?: number}} payload
   */
  async saveSettings(payload = {}) {
    const enabled = payload.rememberMeEnabled === undefined ? undefined : !!payload.rememberMeEnabled;
    const daysNum = parseInt(payload.rememberMeDays, 10);
    const rememberMeDays = payload.rememberMeDays === undefined
      ? undefined
      : (Number.isFinite(daysNum) ? Math.max(7, Math.min(365, daysNum)) : 90);

    const sessNum = parseInt(payload.sessionTimeoutMinutes, 10);
    const sessionTimeoutMinutes = payload.sessionTimeoutMinutes === undefined
      ? undefined
      : (Number.isFinite(sessNum) ? Math.max(15, Math.min(1440, sessNum)) : 480);

    const maxNum = parseInt(payload.authMaxLoginAttempts, 10);
    const authMaxLoginAttempts = payload.authMaxLoginAttempts === undefined
      ? undefined
      : (Number.isFinite(maxNum) ? Math.max(3, Math.min(10, maxNum)) : 5);

    const enableAuditLogging = payload.enableAuditLogging === undefined ? undefined : !!payload.enableAuditLogging;
    const allowPasswordReset = payload.allowPasswordReset === undefined ? undefined : !!payload.allowPasswordReset;

    const tx = [];
    if (enabled !== undefined) {
      tx.push(
        this.prisma.systemSetting.upsert({
          where: { key: 'remember_me_enabled' },
          update: { value: enabled ? 'true' : 'false' },
          create: {
            key: 'remember_me_enabled',
            value: enabled ? 'true' : 'false',
            description: '是否启用“记住我”登录（长效刷新令牌）',
          },
        })
      );
    }

    if (rememberMeDays !== undefined) {
      tx.push(
        this.prisma.systemSetting.upsert({
          where: { key: 'remember_me_days' },
          update: { value: String(rememberMeDays) },
          create: {
            key: 'remember_me_days',
            value: String(rememberMeDays),
            description: '“记住我”刷新令牌有效天数（7-365）',
          },
        })
      );
    }

    if (sessionTimeoutMinutes !== undefined) {
      tx.push(
        this.prisma.systemSetting.upsert({
          where: { key: 'session_timeout_minutes' },
          update: { value: String(sessionTimeoutMinutes) },
          create: {
            key: 'session_timeout_minutes',
            value: String(sessionTimeoutMinutes),
            description: '会话超时（分钟，15-1440）',
          },
        })
      );
    }

    if (authMaxLoginAttempts !== undefined) {
      tx.push(
        this.prisma.systemSetting.upsert({
          where: { key: 'auth_max_login_attempts' },
          update: { value: String(authMaxLoginAttempts) },
          create: {
            key: 'auth_max_login_attempts',
            value: String(authMaxLoginAttempts),
            description: '最大登录尝试次数（每15分钟，3-10）',
          },
        })
      );
    }

    if (enableAuditLogging !== undefined) {
      tx.push(
        this.prisma.systemSetting.upsert({
          where: { key: 'enable_audit_logging' },
          update: { value: enableAuditLogging ? 'true' : 'false' },
          create: {
            key: 'enable_audit_logging',
            value: enableAuditLogging ? 'true' : 'false',
            description: '是否启用审计日志记录',
          },
        })
      );
    }

    if (allowPasswordReset !== undefined) {
      tx.push(
        this.prisma.systemSetting.upsert({
          where: { key: 'allow_password_reset' },
          update: { value: allowPasswordReset ? 'true' : 'false' },
          create: {
            key: 'allow_password_reset',
            value: allowPasswordReset ? 'true' : 'false',
            description: '是否允许管理员重置用户密码',
          },
        })
      );
    }

    if (tx.length > 0) {
      await this.prisma.$transaction(tx);
    }

    // 刷新缓存
    this._cache = { data: null, expiresAt: 0 };
    return this.getSettings(true);
  }
}

module.exports = SecuritySettingsService;
