/**
 * EXIF 校验工具
 * 目标：对上传图片做基础真实性检测：
 * - 解析拍摄时间 (DateTimeOriginal) 与服务器当前时间的偏差
 * - 读取基础尺寸 / 方向信息
 * - （可扩展）GPS 信息、设备型号
 *
 * 说明：EXIF 并不能 100% 防造假，仅作为降低从相册上传旧图片的风险手段之一。
 */

const fs = require('fs');
const path = require('path');

let ExifReader = null;
try {
  // 动态 require，若未安装在后续 README 提示安装
  ExifReader = require('exifreader');
} catch (e) {
  console.warn('⚠️ 未安装 exifreader，EXIF 校验将被跳过');
}

class ExifValidator {
  /**
   * 校验文件 EXIF
   * @param {string} filePath 完整路径
   * @param {Object} options { maxTimeDriftMinutes }
   * @returns {Object} { passed, warnings, meta }
   */
  static async validate(filePath, options = {}) {
    const maxTimeDriftMinutes = options.maxTimeDriftMinutes || 10; // 容忍拍摄时间偏差
    const result = {
      passed: true,
      warnings: [],
      meta: {}
    };

    if (!ExifReader) {
      result.warnings.push('未启用EXIF解析');
      return result;
    }
    if (!fs.existsSync(filePath)) {
      return { passed: false, warnings: ['文件不存在'], meta: {} };
    }

    try {
      const buffer = fs.readFileSync(filePath);
      const tags = ExifReader.load(buffer);
      const dateOriginal = tags.DateTimeOriginal?.description || tags.DateCreated?.description;
      const now = Date.now();
      let driftOk = true;
      if (dateOriginal) {
        const parsed = Date.parse(dateOriginal.replace(/:/g, '-').replace(' ', 'T'));
        if (!isNaN(parsed)) {
          const diffMinutes = Math.abs(now - parsed) / 60000;
          if (diffMinutes > maxTimeDriftMinutes) {
            driftOk = false;
            result.warnings.push(`拍摄时间与当前时间偏差 ${diffMinutes.toFixed(1)} 分钟 > 允许 ${maxTimeDriftMinutes}`);
          }
          result.meta.dateOriginal = dateOriginal;
          result.meta.timeDiffMinutes = diffMinutes;
        }
      } else {
        result.warnings.push('缺少拍摄时间(DateTimeOriginal)');
      }

      // 设备信息
      if (tags.Make || tags.Model) {
        result.meta.device = `${tags.Make?.description || ''} ${tags.Model?.description || ''}`.trim();
      }

      // GPS 信息（如需要进一步核对地理范围）
      if (tags.GPSLatitude && tags.GPSLongitude) {
        result.meta.gps = {
          lat: tags.GPSLatitude.description,
          lng: tags.GPSLongitude.description
        };
      }

      if (!driftOk) {
        result.passed = false; // 可以选择设为 false 或仅作警告，按业务策略决定
      }
    } catch (error) {
      result.warnings.push('EXIF 解析失败: ' + error.message);
    }

    return result;
  }
}

module.exports = ExifValidator;

