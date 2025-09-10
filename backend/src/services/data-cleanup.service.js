const { PrismaClient } = require('@prisma/client');

/**
 * 数据清理服务
 * - 读取 SystemSetting 中的运行时配置
 * - 支持手动/自动清理以下类别：inspectionLogs, auditLogs, securityLogs, errorLogs
 * - 默认关闭自动清理
 */
class DataCleanupService {
  constructor() {
    this.prisma = new PrismaClient();
    this.allowedCategories = new Set(['inspectionLogs', 'auditLogs', 'securityLogs', 'errorLogs']);
    this.schedulerStarted = false;
  }

  async getSettings() {
    const rows = await this.prisma.systemSetting.findMany();
    const map = new Map(rows.map(r => [r.key, r.value]));
    const autoCleanupEnabled = (map.get('auto_cleanup_enabled') || 'false') === 'true';
    const dataRetentionDays = parseInt(map.get('data_retention_days') || '365', 10);
    let categories = [];
    try {
      categories = JSON.parse(map.get('cleanup_categories') || '[]');
    } catch (_) {
      categories = [];
    }
    const lastCleanupAt = map.get('last_cleanup_at') || null;
    return { autoCleanupEnabled, dataRetentionDays, categories, lastCleanupAt };
  }

  async saveSettings({ autoCleanupEnabled, dataRetentionDays, categories }) {
    const days = Math.max(30, Math.min(3650, parseInt(dataRetentionDays || 365, 10) || 365));
    const filtered = Array.isArray(categories)
      ? categories.filter(c => this.allowedCategories.has(c))
      : [];

    await this.prisma.$transaction([
      this.prisma.systemSetting.upsert({
        where: { key: 'auto_cleanup_enabled' },
        update: { value: autoCleanupEnabled ? 'true' : 'false' },
        create: { key: 'auto_cleanup_enabled', value: autoCleanupEnabled ? 'true' : 'false', description: '是否启用自动清理任务（默认关闭）' }
      }),
      this.prisma.systemSetting.upsert({
        where: { key: 'data_retention_days' },
        update: { value: String(days) },
        create: { key: 'data_retention_days', value: String(days), description: '数据保留天数（30-3650）' }
      }),
      this.prisma.systemSetting.upsert({
        where: { key: 'cleanup_categories' },
        update: { value: JSON.stringify(filtered) },
        create: { key: 'cleanup_categories', value: JSON.stringify(filtered), description: '自动清理的数据类别' }
      })
    ]);

    return { autoCleanupEnabled, dataRetentionDays: days, categories: filtered };
  }

  /**
   * 立即清理一次
   * 返回每类清理的数量及总数
   */
  async cleanupNow(options = null) {
    const settings = await this.getSettings();
    const retentionDays = options?.dataRetentionDays || settings.dataRetentionDays || 365;
    const categories = Array.isArray(options?.categories) && options.categories.length > 0
      ? options.categories
      : (settings.categories || []);

    const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    const results = { counts: {}, total: 0, cutoff: cutoff.toISOString() };

    // 点检记录
    if (categories.includes('inspectionLogs')) {
      const r = await this.prisma.inspectionLog.deleteMany({
        where: { inspectionTime: { lt: cutoff } }
      });
      results.counts.inspectionLogs = r.count || 0;
      results.total += results.counts.inspectionLogs;
    }

    // 审计日志
    if (categories.includes('auditLogs')) {
      const r = await this.prisma.auditLog.deleteMany({
        where: { timestamp: { lt: cutoff } }
      });
      results.counts.auditLogs = r.count || 0;
      results.total += results.counts.auditLogs;
    }

    // 安全日志
    if (categories.includes('securityLogs')) {
      const r = await this.prisma.securityLog.deleteMany({
        where: { timestamp: { lt: cutoff } }
      });
      results.counts.securityLogs = r.count || 0;
      results.total += results.counts.securityLogs;
    }

    // 错误日志
    if (categories.includes('errorLogs')) {
      const r = await this.prisma.errorLog.deleteMany({
        where: { timestamp: { lt: cutoff } }
      });
      results.counts.errorLogs = r.count || 0;
      results.total += results.counts.errorLogs;
    }

    // 写回上次清理时间
    const nowISO = new Date().toISOString();
    await this.prisma.systemSetting.upsert({
      where: { key: 'last_cleanup_at' },
      update: { value: nowISO },
      create: { key: 'last_cleanup_at', value: nowISO, description: '上次执行清理的时间' }
    });

    return { ...results, lastCleanupAt: nowISO };
  }

  /**
   * 启动每日计划任务（默认3:30执行）
   * - 仅在 auto_cleanup_enabled 为 true 时执行
   */
  startScheduler() {
    if (this.schedulerStarted) return;
    this.schedulerStarted = true;

    const scheduleOnce = async () => {
      try {
        const { autoCleanupEnabled } = await this.getSettings();
        if (autoCleanupEnabled) {
          console.log('[DataCleanup] Auto cleanup triggered');
          await this.cleanupNow();
        } else {
          console.log('[DataCleanup] Auto cleanup disabled');
        }
      } catch (e) {
        console.error('[DataCleanup] Auto cleanup failed:', e.message);
      } finally {
        // 计划下一次（24小时后）
        setTimeout(scheduleOnce, 24 * 60 * 60 * 1000);
      }
    };

    // 计算到下一次 03:30 的延迟
    const now = new Date();
    const next = new Date(now);
    next.setDate(now.getDate() + 1);
    next.setHours(3, 30, 0, 0);
    const initialDelay = next.getTime() - now.getTime();
    setTimeout(scheduleOnce, initialDelay > 0 ? initialDelay : 60 * 60 * 1000);
    console.log('[DataCleanup] Scheduler started, first run in', Math.round((initialDelay > 0 ? initialDelay : 3600000) / 1000), 'seconds');
  }
}

module.exports = new DataCleanupService();

