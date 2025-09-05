/**
 * 数据库迁移脚本：将单图片字段迁移为多图片数组格式
 * 
 * 此脚本将：
 * 1. 将 inspection_logs 表的 inspection_image_url 转换为 inspection_image_urls 数组
 * 2. 将 issues 表的 issue_image_url 和 fixed_image_url 转换为对应的数组格式
 * 3. 保持原有字段不变，确保向下兼容
 */

const { PrismaClient } = require('@prisma/client');
const path = require('path');

const prisma = new PrismaClient();

// 日志函数
const log = (message) => {
  console.log(`[${new Date().toISOString()}] ${message}`);
};

const logError = (message, error) => {
  console.error(`[${new Date().toISOString()}] ERROR: ${message}`, error);
};

// 将单个URL转换为JSON数组字符串
const convertSingleUrlToArray = (url) => {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return null;
  }
  return JSON.stringify([url.trim()]);
};

// 迁移点检记录表
async function migrateInspectionLogs() {
  log('开始迁移点检记录图片数据...');
  
  try {
    // 获取所有有图片的点检记录
    const inspectionLogs = await prisma.inspectionLog.findMany({
      where: {
        inspectionImageUrl: {
          not: null,
          not: ''
        }
      },
      select: {
        id: true,
        inspectionImageUrl: true,
        inspectionImageUrls: true
      }
    });

    log(`找到 ${inspectionLogs.length} 条点检记录需要迁移`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const record of inspectionLogs) {
      try {
        // 如果已经有多图片数据，跳过
        if (record.inspectionImageUrls) {
          skippedCount++;
          continue;
        }

        // 转换单图片为数组格式
        const imageUrls = convertSingleUrlToArray(record.inspectionImageUrl);
        
        if (imageUrls) {
          await prisma.inspectionLog.update({
            where: { id: record.id },
            data: {
              inspectionImageUrls: imageUrls
            }
          });
          migratedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        logError(`迁移点检记录 ${record.id} 失败`, error);
      }
    }

    log(`点检记录迁移完成：迁移 ${migratedCount} 条，跳过 ${skippedCount} 条`);
  } catch (error) {
    logError('迁移点检记录失败', error);
    throw error;
  }
}

// 迁移隐患记录表
async function migrateIssues() {
  log('开始迁移隐患记录图片数据...');
  
  try {
    // 获取所有有图片的隐患记录
    const issues = await prisma.issue.findMany({
      where: {
        OR: [
          {
            issueImageUrl: {
              not: null,
              not: ''
            }
          },
          {
            fixedImageUrl: {
              not: null,
              not: ''
            }
          }
        ]
      },
      select: {
        id: true,
        issueImageUrl: true,
        fixedImageUrl: true,
        issueImageUrls: true,
        fixedImageUrls: true
      }
    });

    log(`找到 ${issues.length} 条隐患记录需要迁移`);

    let migratedCount = 0;
    let skippedCount = 0;

    for (const record of issues) {
      try {
        const updateData = {};
        let needsUpdate = false;

        // 处理问题图片
        if (record.issueImageUrl && !record.issueImageUrls) {
          const issueUrls = convertSingleUrlToArray(record.issueImageUrl);
          if (issueUrls) {
            updateData.issueImageUrls = issueUrls;
            needsUpdate = true;
          }
        }

        // 处理整改后图片
        if (record.fixedImageUrl && !record.fixedImageUrls) {
          const fixedUrls = convertSingleUrlToArray(record.fixedImageUrl);
          if (fixedUrls) {
            updateData.fixedImageUrls = fixedUrls;
            needsUpdate = true;
          }
        }

        if (needsUpdate) {
          await prisma.issue.update({
            where: { id: record.id },
            data: updateData
          });
          migratedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        logError(`迁移隐患记录 ${record.id} 失败`, error);
      }
    }

    log(`隐患记录迁移完成：迁移 ${migratedCount} 条，跳过 ${skippedCount} 条`);
  } catch (error) {
    logError('迁移隐患记录失败', error);
    throw error;
  }
}

// 验证迁移结果
async function validateMigration() {
  log('开始验证迁移结果...');
  
  try {
    // 检查点检记录
    const inspectionWithImages = await prisma.inspectionLog.count({
      where: {
        OR: [
          { inspectionImageUrl: { not: null, not: '' } },
          { inspectionImageUrls: { not: null, not: '' } }
        ]
      }
    });

    const inspectionWithUrls = await prisma.inspectionLog.count({
      where: {
        inspectionImageUrls: { not: null, not: '' }
      }
    });

    log(`点检记录验证：总计有图片记录 ${inspectionWithImages} 条，已迁移 ${inspectionWithUrls} 条`);

    // 检查隐患记录
    const issueWithImages = await prisma.issue.count({
      where: {
        OR: [
          { issueImageUrl: { not: null, not: '' } },
          { fixedImageUrl: { not: null, not: '' } },
          { issueImageUrls: { not: null, not: '' } },
          { fixedImageUrls: { not: null, not: '' } }
        ]
      }
    });

    const issuesWithUrls = await prisma.issue.count({
      where: {
        OR: [
          { issueImageUrls: { not: null, not: '' } },
          { fixedImageUrls: { not: null, not: '' } }
        ]
      }
    });

    log(`隐患记录验证：总计有图片记录 ${issueWithImages} 条，已迁移 ${issuesWithUrls} 条`);

    log('迁移结果验证完成');
  } catch (error) {
    logError('验证迁移结果失败', error);
    throw error;
  }
}

// 创建备份（可选）
async function createBackup() {
  log('数据迁移不会删除原有数据，原有字段将保持不变以确保向下兼容');
  log('如需备份，请在运行此脚本前手动备份数据库文件');
}

// 主执行函数
async function main() {
  try {
    log('='.repeat(50));
    log('开始多图片支持数据迁移');
    log('='.repeat(50));

    await createBackup();

    // 执行迁移
    await migrateInspectionLogs();
    await migrateIssues();

    // 验证结果
    await validateMigration();

    log('='.repeat(50));
    log('数据迁移完成！');
    log('='.repeat(50));
    
    process.exit(0);
  } catch (error) {
    logError('数据迁移失败', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main().catch((error) => {
    logError('脚本执行失败', error);
    process.exit(1);
  });
}

module.exports = {
  migrateInspectionLogs,
  migrateIssues,
  validateMigration,
  main
};