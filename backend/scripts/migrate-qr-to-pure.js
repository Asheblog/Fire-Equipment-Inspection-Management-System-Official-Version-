/**
 * 迁移脚本：将 equipment.qrCode 中存储的完整URL 转换为纯码 (FIRE-...)
 * 使用：node backend/scripts/migrate-qr-to-pure.js
 */

const { PrismaClient } = require('@prisma/client');
const QRGen = require('../src/utils/qrcode.generator');
const prisma = new PrismaClient();

function extractPure(code) {
  if (!code) return code;
  return QRGen.extractQRCodeFromURL ? QRGen.extractQRCodeFromURL(code) : code;
}

(async () => {
  console.log('🚀 开始二维码字段规范化迁移 (URL -> 纯码)');
  const equipments = await prisma.equipment.findMany({ select: { id: true, qrCode: true } });
  let updated = 0;
  const changes = [];
  for (const e of equipments) {
    const pure = extractPure(e.qrCode);
    if (pure && pure !== e.qrCode) {
      await prisma.equipment.update({ where: { id: e.id }, data: { qrCode: pure } });
      updated++;
      changes.push({ id: e.id, from: e.qrCode, to: pure });
      console.log(`✔️  ID=${e.id} 更新: ${e.qrCode} -> ${pure}`);
    }
  }
  console.log(`✅ 迁移完成：共扫描 ${equipments.length} 条，更新 ${updated} 条。`);
  if (changes.length) {
    console.log('📝 变更摘要 (前10条):');
    changes.slice(0, 10).forEach(c => console.log(c));
  }
  await prisma.$disconnect();
})();

