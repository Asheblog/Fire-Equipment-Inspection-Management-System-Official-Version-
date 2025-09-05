/**
 * 图片处理工具类
 * 处理单图片和多图片数组的兼容性
 */

class ImageHelper {
  /**
   * 标准化图片数据 - 将单图片或多图片统一为数组格式
   * @param {string|string[]|null|undefined} images - 图片URL或数组
   * @returns {string[]} 标准化的图片数组
   */
  static normalizeImages(images) {
    if (!images) return [];
    
    // 如果是字符串，判断是否为JSON数组格式
    if (typeof images === 'string') {
      try {
        // 尝试解析为JSON数组
        const parsed = JSON.parse(images);
        if (Array.isArray(parsed)) {
          return parsed.filter(url => url && typeof url === 'string');
        }
        // 如果不是JSON数组，作为单个URL处理
        return [images];
      } catch {
        // 解析失败，作为单个URL处理
        return [images];
      }
    }
    
    // 如果已经是数组
    if (Array.isArray(images)) {
      return images.filter(url => url && typeof url === 'string');
    }
    
    return [];
  }

  /**
   * 序列化图片数组为JSON字符串存储
   * @param {string|string[]|null|undefined} images - 图片URL或数组
   * @returns {string|null} JSON字符串或null
   */
  static serializeImages(images) {
    const normalized = this.normalizeImages(images);
    if (normalized.length === 0) return null;
    if (normalized.length === 1) return JSON.stringify(normalized); // 保持数组格式一致性
    return JSON.stringify(normalized);
  }

  /**
   * 反序列化JSON字符串为图片数组
   * @param {string|null} imagesJson - JSON字符串
   * @returns {string[]} 图片数组
   */
  static deserializeImages(imagesJson) {
    if (!imagesJson) return [];
    
    try {
      const parsed = JSON.parse(imagesJson);
      if (Array.isArray(parsed)) {
        return parsed.filter(url => url && typeof url === 'string');
      }
      // 如果不是数组但是字符串，作为单个URL处理
      if (typeof parsed === 'string') {
        return [parsed];
      }
    } catch {
      // 如果解析失败，可能是旧格式的单个URL
      return [imagesJson];
    }
    
    return [];
  }

  /**
   * 数据库记录的图片字段兼容处理
   * 优先使用新的多图片字段，回退到旧的单图片字段
   * @param {Object} record - 数据库记录
   * @param {string} newField - 新的多图片字段名
   * @param {string} oldField - 旧的单图片字段名
   * @returns {string[]} 图片数组
   */
  static extractImages(record, newField, oldField) {
    // 优先使用新的多图片字段
    if (record[newField]) {
      return this.deserializeImages(record[newField]);
    }
    
    // 回退到旧的单图片字段
    if (record[oldField]) {
      return [record[oldField]];
    }
    
    return [];
  }

  /**
   * 为数据库保存准备图片数据
   * @param {string|string[]|null|undefined} images - 图片数据
   * @returns {Object} 包含新旧字段的对象
   */
  static prepareForSave(images, newField, oldField) {
    const normalized = this.normalizeImages(images);
    const result = {};
    
    // 设置新的多图片字段
    result[newField] = this.serializeImages(normalized);
    
    // 为了兼容性，也设置旧字段（取第一张图片）
    result[oldField] = normalized.length > 0 ? normalized[0] : null;
    
    return result;
  }

  /**
   * 验证图片URL是否有效
   * @param {string} url - 图片URL
   * @returns {boolean} 是否有效
   */
  static isValidImageUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    // 基本URL格式检查
    const urlPattern = /^(https?:\/\/|\/)/;
    if (!urlPattern.test(url)) return false;
    
    // 检查文件扩展名（可选）
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg)(\?|$)/i;
    return imageExtensions.test(url) || url.includes('/uploads/');
  }

  /**
   * 过滤无效的图片URL
   * @param {string[]} images - 图片数组
   * @returns {string[]} 有效的图片数组
   */
  static filterValidImages(images) {
    return this.normalizeImages(images).filter(url => this.isValidImageUrl(url));
  }
}

module.exports = ImageHelper;