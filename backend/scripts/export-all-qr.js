/**
 * 批量导出所有器材二维码 (Base64 PNG) 到 JSON/单文件，或输出到目录
 * 用法：
 *   node backend/scripts/export-all-qr.js           （默认导出到 console 统计）
 *   node backend/scripts/export-all-qr.js out=dir   （导出PNG文件到指定目录）
 *   node backend/scripts/export-all-qr.js json=path （写入一个包含所有条目的JSON文件）
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const QRGen = require('../src/utils/qrcode.generator');

const prisma = new PrismaClient();

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  const args = process.argv.slice(2);
  const outDirArg = args.find(a => a.startsWith('out='));
  const jsonArg = args.find(a => a.startsWith('json='));
  const outDir = outDirArg ? outDirArg.split('=')[1] : null;
  const jsonPath = jsonArg ? jsonArg.split('=')[1] : null;

  const equipments = await prisma.equipment.findMany({
    select: { id: true, name: true, qrCode: true }
  });

  console.log(`共 ${equipments.length} 条器材记录，开始导出二维码...`);
  const results = [];

  if (outDir) ensureDir(outDir);

  for (const eq of equipments) {
    const pure = QRGen.extractQRCodeFromURL(eq.qrCode); // 若已纯码也安全
    const fullUrl = QRGen.buildQRCodeURL(pure);
    const base64 = await QRGen.generateQRBase64(fullUrl, { size: 300 });
    const entry = { id: eq.id, name: eq.name, code: pure, url: fullUrl, imageBase64: base64 };
    results.push(entry);

    if (outDir) {
      const filePath = path.join(outDir, `equipment-${eq.id}-${pure}.png`);
      const data = base64.split(',')[1];
      fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
    }
  }

  if (jsonPath) {
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');
    console.log(`已写入 JSON: ${jsonPath}`);
  }

  console.log('导出完成。');
  console.log({ total: results.length, outDir: outDir || 'N/A', json: jsonPath || 'N/A' });

  if (!outDir && !jsonPath) {
    console.log('示例前3条:');
    results.slice(0, 3).forEach(r => console.log({ id: r.id, code: r.code, url: r.url }));
  }
  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

