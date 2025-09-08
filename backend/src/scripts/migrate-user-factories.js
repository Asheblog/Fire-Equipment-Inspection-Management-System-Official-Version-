/**
 * 一次性迁移脚本：为现有用户填充 user_factories 映射表
 * 目的：支持“用户可归属多个厂区”，将原有 users.factory_id 作为主厂区同步到映射表
 */

const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();
  try {
    const users = await prisma.user.findMany({ select: { id: true, factoryId: true } });
    let created = 0;
    for (const u of users) {
      if (!u.factoryId) continue;
      // 若已存在映射则跳过
      const exists = await prisma.userFactory.findFirst({ where: { userId: u.id, factoryId: u.factoryId } });
      if (exists) continue;
      await prisma.userFactory.create({ data: { userId: u.id, factoryId: u.factoryId } });
      created++;
    }
    console.log(`✅ 迁移完成：共补齐 ${created} 条 user_factories 记录`);
  } catch (e) {
    console.error('❌ 迁移失败：', e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };

