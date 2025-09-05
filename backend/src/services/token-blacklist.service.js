/**
 * JWT令牌黑名单服务
 * 负责管理失效的JWT令牌，防止已登出用户的令牌继续使用
 */

const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

class TokenBlacklistService {
  /**
   * 将令牌添加到黑名单
   * @param {string} token - JWT令牌（完整令牌）
   * @param {number} userId - 用户ID
   * @param {string} tokenType - 令牌类型 ('ACCESS' | 'REFRESH')
   * @param {string} reason - 失效原因
   * @param {Date} expiresAt - 令牌过期时间
   * @param {string} jti - JWT ID（可选）
   * @returns {Promise<Object>} 黑名单记录
   */
  async addToBlacklist(token, userId, tokenType = 'REFRESH', reason = 'LOGOUT', expiresAt, jti = null) {
    try {
      // 对完整令牌进行哈希处理以保护隐私和减少存储空间
      const tokenHash = this.hashToken(token);
      
      // 检查令牌是否已在黑名单中
      const existing = await prisma.tokenBlacklist.findUnique({
        where: { token: tokenHash }
      });
      
      if (existing) {
        console.log(`Token already blacklisted: ${tokenHash.substring(0, 10)}...`);
        return existing;
      }

      const blacklistEntry = await prisma.tokenBlacklist.create({
        data: {
          token: tokenHash,
          jti,
          userId,
          tokenType,
          reason,
          expiresAt: new Date(expiresAt)
        }
      });

      console.log(`Token blacklisted: User ${userId}, Type: ${tokenType}, Reason: ${reason}`);
      return blacklistEntry;

    } catch (error) {
      console.error('添加令牌到黑名单失败:', error);
      throw new Error('Failed to blacklist token');
    }
  }

  /**
   * 检查令牌是否在黑名单中
   * @param {string} token - JWT令牌
   * @param {string} jti - JWT ID（可选）
   * @returns {Promise<boolean>} 是否在黑名单中
   */
  async isTokenBlacklisted(token, jti = null) {
    try {
      const tokenHash = this.hashToken(token);
      
      // 优先使用JTI查找（如果提供）
      if (jti) {
        const blacklistEntry = await prisma.tokenBlacklist.findFirst({
          where: {
            OR: [
              { token: tokenHash },
              { jti }
            ]
          }
        });
        return !!blacklistEntry;
      }
      
      // 使用令牌哈希查找
      const blacklistEntry = await prisma.tokenBlacklist.findUnique({
        where: { token: tokenHash }
      });
      
      return !!blacklistEntry;
      
    } catch (error) {
      console.error('检查令牌黑名单状态失败:', error);
      // 安全起见，如果查询失败，认为令牌有效
      return false;
    }
  }

  /**
   * 批量将用户的所有令牌加入黑名单（用于强制登出）
   * @param {number} userId - 用户ID
   * @param {string} reason - 失效原因
   * @param {Array} tokens - 令牌数组 [{token, type, expiresAt, jti}]
   * @returns {Promise<Array>} 黑名单记录数组
   */
  async blacklistAllUserTokens(userId, reason = 'FORCED_LOGOUT', tokens = []) {
    try {
      const blacklistEntries = [];
      
      for (const tokenInfo of tokens) {
        const entry = await this.addToBlacklist(
          tokenInfo.token,
          userId,
          tokenInfo.type || 'REFRESH',
          reason,
          tokenInfo.expiresAt,
          tokenInfo.jti
        );
        blacklistEntries.push(entry);
      }

      console.log(`Blacklisted ${blacklistEntries.length} tokens for user ${userId}, reason: ${reason}`);
      return blacklistEntries;

    } catch (error) {
      console.error('批量加入黑名单失败:', error);
      throw new Error('Failed to blacklist user tokens');
    }
  }

  /**
   * 清理过期的黑名单记录
   * @param {Date} beforeDate - 清理此日期之前过期的记录
   * @returns {Promise<number>} 清理的记录数量
   */
  async cleanupExpiredTokens(beforeDate = new Date()) {
    try {
      const result = await prisma.tokenBlacklist.deleteMany({
        where: {
          expiresAt: {
            lt: beforeDate
          }
        }
      });

      console.log(`Cleaned up ${result.count} expired blacklisted tokens`);
      return result.count;

    } catch (error) {
      console.error('清理过期黑名单记录失败:', error);
      throw new Error('Failed to cleanup expired tokens');
    }
  }

  /**
   * 获取用户的黑名单记录
   * @param {number} userId - 用户ID
   * @param {number} limit - 限制返回数量
   * @returns {Promise<Array>} 黑名单记录数组
   */
  async getUserBlacklistedTokens(userId, limit = 50) {
    try {
      const tokens = await prisma.tokenBlacklist.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true
            }
          }
        }
      });

      return tokens;

    } catch (error) {
      console.error('获取用户黑名单记录失败:', error);
      throw new Error('Failed to get user blacklisted tokens');
    }
  }

  /**
   * 获取黑名单统计信息
   * @returns {Promise<Object>} 统计信息
   */
  async getBlacklistStats() {
    try {
      const [total, expired, byType, byReason] = await Promise.all([
        // 总数
        prisma.tokenBlacklist.count(),
        
        // 过期数量
        prisma.tokenBlacklist.count({
          where: {
            expiresAt: {
              lt: new Date()
            }
          }
        }),
        
        // 按类型统计
        prisma.tokenBlacklist.groupBy({
          by: ['tokenType'],
          _count: { tokenType: true }
        }),
        
        // 按原因统计
        prisma.tokenBlacklist.groupBy({
          by: ['reason'],
          _count: { reason: true }
        })
      ]);

      return {
        total,
        expired,
        active: total - expired,
        byType: byType.reduce((acc, item) => {
          acc[item.tokenType] = item._count.tokenType;
          return acc;
        }, {}),
        byReason: byReason.reduce((acc, item) => {
          acc[item.reason] = item._count.reason;
          return acc;
        }, {})
      };

    } catch (error) {
      console.error('获取黑名单统计失败:', error);
      throw new Error('Failed to get blacklist statistics');
    }
  }

  /**
   * 对令牌进行哈希处理
   * @param {string} token - 原始令牌
   * @returns {string} 哈希后的令牌
   * @private
   */
  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * 定期清理任务（可以通过定时器调用）
   * @returns {Promise<number>} 清理的记录数量
   */
  async scheduledCleanup() {
    try {
      console.log('开始定期清理过期黑名单记录...');
      const cleaned = await this.cleanupExpiredTokens();
      console.log(`定期清理完成，清理了 ${cleaned} 条记录`);
      return cleaned;
    } catch (error) {
      console.error('定期清理任务失败:', error);
      return 0;
    }
  }
}

module.exports = new TokenBlacklistService();