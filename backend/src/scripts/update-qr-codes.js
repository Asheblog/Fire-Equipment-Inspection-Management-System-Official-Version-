/**
 * 批量更新现有器材的二维码为URL格式
 * 使用智能URL配置系统
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function updateQRCodesToURL() {
  try {
    console.log('🚀 开始批量更新器材二维码为智能URL格式...');
    
    // 导入二维码生成器
    const QRCodeGenerator = require('../utils/qrcode.generator');
    
    // 验证URL配置
    const urlValidation = QRCodeGenerator.validateURLConfig();
    console.log(`🔗 智能URL配置检查:`);
    console.log(`   - 当前基础URL: ${urlValidation.baseUrl}`);
    console.log(`   - 服务器局域网IP: ${urlValidation.serverIP}`);
    
    if (urlValidation.warnings.length > 0) {
      console.log(`⚠️  配置警告:`);
      urlValidation.warnings.forEach(warning => {
        console.log(`   - ${warning}`);
      });
    }
    
    if (urlValidation.suggestions.length > 0) {
      console.log(`💡 优化建议:`);
      urlValidation.suggestions.forEach(suggestion => {
        console.log(`   - ${suggestion}`);
      });
    }
    
    // 获取所有器材
    const equipments = await prisma.equipment.findMany({
      select: {
        id: true,
        qrCode: true,
        name: true,
        location: true,
        equipmentType: {
          select: {
            id: true,
            name: true
          }
        },
        factory: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    
    console.log(`📦 找到 ${equipments.length} 个器材需要检查更新`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const equipment of equipments) {
      const { id, qrCode, name, location, equipmentType, factory } = equipment;
      
      try {
        // 检查当前二维码是否需要更新
        const currentBaseUrl = urlValidation.baseUrl;
        const expectedUrl = `${currentBaseUrl}/m/inspection/`;
        
        // 如果已经是正确的URL格式且域名匹配，跳过
        if (qrCode.includes('/m/inspection/') && qrCode.startsWith(currentBaseUrl)) {
          console.log(`⏭️  跳过器材 "${name}" (已是正确URL格式)`);
          skippedCount++;
          continue;
        }
        
        // 提取或生成新的二维码字符串
        let newQRCodeString;
        
        if (qrCode.includes('/m/inspection/')) {
          // 如果是URL格式但域名不对，提取二维码字符串部分
          newQRCodeString = qrCode.split('/m/inspection/')[1];
          console.log(`🔄 更新域名: ${name} - 保留二维码字符串 ${newQRCodeString}`);
        } else {
          // 如果是纯字符串格式，直接使用
          newQRCodeString = qrCode;
          console.log(`🆕 添加URL前缀: ${name} - 二维码字符串 ${newQRCodeString}`);
        }
        
        // 生成新的完整URL
        const newQRCode = `${currentBaseUrl}/m/inspection/${newQRCodeString}`;
        
        // 更新数据库
        await prisma.equipment.update({
          where: { id },
          data: { qrCode: newQRCode }
        });
        
        console.log(`✅ 更新器材 "${name}": ${qrCode} → ${newQRCode}`);
        updatedCount++;
        
      } catch (error) {
        console.error(`❌ 更新器材 "${name}" 失败:`, error.message);
        errorCount++;
      }
    }
    
    console.log('\n📊 更新完成统计:');
    console.log(`✅ 成功更新: ${updatedCount} 个器材`);
    console.log(`⏭️  跳过更新: ${skippedCount} 个器材`);
    console.log(`❌ 更新失败: ${errorCount} 个器材`);
    console.log(`📦 总计器材: ${equipments.length} 个`);
    
    if (updatedCount > 0) {
      console.log(`\n🎉 成功更新 ${updatedCount} 个器材的二维码!`);
      console.log(`📱 现在所有二维码都使用: ${urlValidation.baseUrl}`);
      
      if (!urlValidation.baseUrl.includes('localhost')) {
        console.log('✅ 手机扫码可以正常访问了!');
      } else {
        console.log('⚠️  当前仍使用localhost，手机扫码无法访问');
        console.log(`💡 建议修改BASE_URL为: http://${urlValidation.serverIP}:3001`);
      }
    } else {
      console.log('\n✨ 所有器材二维码已经是正确的URL格式，无需更新。');
    }
    
  } catch (error) {
    console.error('❌ 批量更新二维码失败:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行更新脚本
if (require.main === module) {
  updateQRCodesToURL()
    .then(() => {
      console.log('\n🏁 脚本执行完成');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 脚本执行失败:', error);
      process.exit(1);
    });
}

module.exports = { updateQRCodesToURL };