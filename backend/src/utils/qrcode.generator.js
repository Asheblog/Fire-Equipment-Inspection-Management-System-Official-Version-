/**
 * 消防器材点检系统 - 二维码生成器
 * 生成器材唯一二维码标识
 */

const crypto = require('crypto');
const QRCode = require('qrcode');
const os = require('os');

class QRCodeGenerator {
  /**
   * 获取服务器局域网IP地址
   * @returns {string} 局域网IP地址
   */
  static getServerIP() {
    const interfaces = os.networkInterfaces();
    
    // 优先级：以太网 > WiFi > 其他
    const priorityOrder = ['以太网', 'Ethernet', 'WLAN', 'Wi-Fi', 'WiFi', 'eth0', 'wlan0'];
    
    // 首先按优先级查找
    for (const interfaceName of priorityOrder) {
      const networkInterface = interfaces[interfaceName];
      if (networkInterface) {
        for (const alias of networkInterface) {
          if (alias.family === 'IPv4' && !alias.internal) {
            console.log(`🌐 [QRCodeGenerator] 使用网络接口 ${interfaceName}: ${alias.address}`);
            return alias.address;
          }
        }
      }
    }
    
    // 如果优先级接口没找到，遍历所有接口
    for (const interfaceName in interfaces) {
      const networkInterface = interfaces[interfaceName];
      for (const alias of networkInterface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          console.log(`🌐 [QRCodeGenerator] 使用网络接口 ${interfaceName}: ${alias.address}`);
          return alias.address;
        }
      }
    }
    
    console.warn('⚠️ [QRCodeGenerator] 未找到局域网IP，使用localhost');
    return 'localhost';
  }

  /**
   * 智能获取基础URL
   * @returns {string} 基础URL
   */
  static getBaseURL() {
    // Step 1: 尝试读取系统运行时配置（系统设置表）中的 qr_base_url（一次性异步加载并缓存）
    if (!this._cachedSettingChecked) {
      this._cachedSettingChecked = true;
      try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        prisma.systemSetting.findUnique({ where: { key: 'qr_base_url' } })
          .then(rec => {
            if (rec && rec.value) {
              this._cachedQrBaseUrl = rec.value.trim();
              console.log(`🧩 [QRCodeGenerator] 已加载系统设置 qr_base_url: ${this._cachedQrBaseUrl}`);
            } else {
              console.log('🧩 [QRCodeGenerator] 系统设置未定义 qr_base_url，使用环境变量策略');
            }
            prisma.$disconnect();
          })
          .catch(err => {
            console.warn('⚠️ [QRCodeGenerator] 读取系统设置 qr_base_url 失败:', err.message);
            prisma.$disconnect();
          });
      } catch (e) {
        console.warn('⚠️ [QRCodeGenerator] Prisma 初始化失败（可能在构建阶段）:', e.message);
      }
    }

    if (this._cachedQrBaseUrl) {
      let finalFromSetting = this._cachedQrBaseUrl.replace(/\/$/, '');
      const forceHttpsSetting = process.env.FORCE_HTTPS === 'true' || process.env.ALWAYS_HTTPS === 'true';
      try {
        const parsed = new URL(finalFromSetting);
        if (forceHttpsSetting && parsed.protocol !== 'https:') {
          parsed.protocol = 'https:';
          finalFromSetting = parsed.toString().replace(/\/$/, '');
        }
        return finalFromSetting;
      } catch (_) {
        console.warn('⚠️ [QRCodeGenerator] qr_base_url 非法，回退到环境变量策略');
      }
    }

    // Step 2: 优先使用显式 BASE_URL；若缺失则使用 DOMAIN 兜底生成
    let configuredUrl = process.env.BASE_URL;
    if ((!configuredUrl || configuredUrl.trim() === '') && process.env.DOMAIN) {
      const rawDomain = process.env.DOMAIN.trim();
      if (rawDomain) {
        const hasProtocol = /^https?:\/\//i.test(rawDomain);
        const protocol = (process.env.NODE_ENV === 'production') ? 'https://' : 'http://';
        configuredUrl = hasProtocol ? rawDomain : protocol + rawDomain;
        console.log(`🛠️ [QRCodeGenerator] BASE_URL 未设置，使用 DOMAIN 兜底生成: ${configuredUrl}`);
      }
    }
    // 开发模式：如果当前基础URL缺少端口，则自动补上前端端口(默认5173)，确保二维码直达前端站点
    if (configuredUrl && process.env.NODE_ENV !== 'production') {
      try {
        const parsed = new URL(configuredUrl);
        if (!parsed.port) {
          const fePort = process.env.FRONTEND_PORT || process.env.VITE_PORT || '5173';
          parsed.port = fePort;
          const withPort = parsed.toString().replace(/\/$/, '');
          console.log(`🧪 [QRCodeGenerator] 开发模式自动补全前端端口: ${configuredUrl} → ${withPort}`);
          configuredUrl = withPort;
        }
      } catch (_) {
        // ignore parse errors
      }
    }
    const serverIP = this.getServerIP();
    const port = process.env.PORT || '3001';
    
    console.log(`🔗 [QRCodeGenerator] 配置检查:`, {
      配置的URL: configuredUrl,
      服务器IP: serverIP,
      端口: port
    });
    
    // 如果仍然没有配置（既无 BASE_URL 也无 DOMAIN），使用服务器IP
    if (!configuredUrl) {
      const autoUrl = `http://${serverIP}:${port}`;
      console.log(`💡 [QRCodeGenerator] 未配置BASE_URL，自动使用: ${autoUrl}`);
      return autoUrl;
    }
    
    // 如果配置的是localhost，自动替换为局域网IP
    if (configuredUrl.includes('localhost') && serverIP !== 'localhost') {
      const smartUrl = configuredUrl.replace('localhost', serverIP);
      console.log(`🔄 [QRCodeGenerator] localhost自动替换: ${configuredUrl} → ${smartUrl}`);
      return smartUrl;
    }
    
    // 如果配置了域名或其他IP，进行可选的 HTTPS 强制处理
    const forceHttps = process.env.FORCE_HTTPS === 'true' || process.env.ALWAYS_HTTPS === 'true';
    if (forceHttps && configuredUrl.startsWith('http://')) {
      try {
        const httpsUrl = new URL(configuredUrl);
        httpsUrl.protocol = 'https:';
        const updated = httpsUrl.toString().replace(/\/$/, '');
        console.log(`🔐 [QRCodeGenerator] 已强制转换为 HTTPS: ${configuredUrl} → ${updated}`);
        configuredUrl = updated;
      } catch (e) {
        console.warn(`⚠️ [QRCodeGenerator] 强制 HTTPS 转换失败: ${e.message}`);
      }
    }

    console.log(`✅ [QRCodeGenerator] 使用配置的URL: ${configuredUrl}`);
    return configuredUrl;
  }

  /**
   * 验证URL配置并给出建议
   * @returns {Object} 验证结果和建议
   */
  static validateURLConfig() {
    const baseUrl = this.getBaseURL();
    const serverIP = this.getServerIP();
    
    const result = {
      baseUrl,
      serverIP,
      isValid: true,
      warnings: [],
      suggestions: []
    };
    
    // 检查是否使用localhost
    if (baseUrl.includes('localhost')) {
      result.warnings.push('使用localhost地址，手机扫码无法访问');
      result.suggestions.push(`建议修改为局域网IP: http://${serverIP}:${process.env.PORT || '3001'}`);
    }
    
    // 检查是否使用HTTP（生产环境建议）
    if (baseUrl.startsWith('http://') && !baseUrl.includes('localhost') && !baseUrl.includes('192.168.') && !baseUrl.includes('10.')) {
      result.warnings.push('生产环境建议使用HTTPS确保安全性');
      result.suggestions.push(`建议改为: ${baseUrl.replace('http://', 'https://')}`);
    }
    
    return result;
  }
  /**
   * 生成唯一的器材二维码URL
   * @param {Object} equipment - 器材信息
   * @returns {string} 二维码URL
   */
  static generateEquipmentQR(equipment) {
    // 为向后兼容保留：返回“完整URL”形式
    const code = this.generateEquipmentCode(equipment);
    const url = `${this.getBaseURL()}/m/inspection/${code}`;
    console.log(`🔗 [generateEquipmentQR] 生成（兼容模式）: code=${code} url=${url}`);
    return url;
  }

  /**
   * 生成唯一器材纯码（不含 BASE_URL ）
   * @param {Object} equipment
   * @returns {string} 纯码 (FIRE-xxx-xx-....-XXXX)
   */
  static generateEquipmentCode(equipment) {
    const { name, typeId, factoryId, location } = equipment;
    if (!name || !typeId || !factoryId || !location) {
      throw new Error('生成二维码缺少必要参数: name, typeId, factoryId, location');
    }
    const numericFactoryId = parseInt(factoryId);
    const numericTypeId = parseInt(typeId);
    if (isNaN(numericFactoryId) || isNaN(numericTypeId)) {
      throw new Error(`二维码生成参数类型错误: factoryId=${factoryId}, typeId=${typeId}`);
    }
    const timestamp = Date.now();
    const components = [
      'FIRE',
      numericFactoryId.toString().padStart(3, '0'),
      numericTypeId.toString().padStart(2, '0'),
      timestamp.toString(36).toUpperCase(),
      this.generateChecksum(name + location)
    ];
    const code = components.join('-');
    console.log(`🆕 [generateEquipmentCode] 生成纯码: ${code}`);
    return code;
  }

  /**
   * 生成校验码
   * @param {string} data - 需要生成校验码的数据
   * @returns {string} 4位校验码
   */
  static generateChecksum(data) {
    const hash = crypto.createHash('md5').update(data).digest('hex');
    return hash.substring(0, 4).toUpperCase();
  }

  /**
   * 验证二维码格式
   * @param {string} qrCode - 二维码字符串或URL
   * @returns {boolean} 是否有效
   */
  static validateQRCode(qrCode) {
    if (!qrCode || typeof qrCode !== 'string') {
      return false;
    }

    // 如果是URL格式，提取二维码部分
    const codeToValidate = this.extractQRCodeFromURL(qrCode);
    
    // 支持两种格式:
    // 1. 简单格式: QR000035
    const simplePattern = /^QR\d{6}$/;
    // 2. 复杂格式: FIRE-XXX-XX-XXXXXXXX-XXXX
    const complexPattern = /^FIRE-\d{3}-\d{2}-[A-Z0-9]+-[A-F0-9]{4}$/;
    
    return simplePattern.test(codeToValidate) || complexPattern.test(codeToValidate);
  }

  /**
   * 从URL中提取二维码字符串
   * @param {string} input - URL或二维码字符串
   * @returns {string} 二维码字符串
   */
  static extractQRCodeFromURL(input) {
    if (!input) return '';
    
    // 如果是URL格式，提取最后的二维码部分
    if (input.includes('/m/inspection/')) {
      const parts = input.split('/m/inspection/');
      return parts[parts.length - 1];
    }
    
    // 否则直接返回原字符串
    return input;
  }

  /**
   * 解析二维码信息
   * @param {string} qrCode - 二维码字符串或URL
   * @returns {Object|null} 解析结果
   */
  static parseQRCode(qrCode) {
    if (!this.validateQRCode(qrCode)) {
      return null;
    }

    // 提取二维码字符串部分
    const codeString = this.extractQRCodeFromURL(qrCode);
    const parts = codeString.split('-');
    
    return {
      prefix: parts[0],           // FIRE
      factoryId: parseInt(parts[1]), // 厂区ID
      typeId: parseInt(parts[2]),    // 器材类型ID
      timestamp: parts[3],        // 时间戳
      checksum: parts[4],         // 校验码
      isValid: true
    };
  }

  /**
   * 生成批量二维码（用于批量导入器材）
   * @param {Array} equipmentList - 器材列表
   * @returns {Array} 带二维码的器材列表
   */
  static generateBatchQR(equipmentList) {
    return equipmentList.map(equipment => ({
      ...equipment,
      qrCode: this.generateEquipmentQR(equipment)
    }));
  }

  /**
   * 生成二维码图片Buffer（本地生成）
   * @param {string} qrCode - 二维码字符串
   * @param {Object} options - 生成选项
   * @returns {Promise<Buffer>} 二维码图片Buffer
   */
  static async generateQRImage(qrCode, options = {}) {
    const defaultOptions = {
      type: 'png',
      width: options.size || 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    };

    const qrOptions = { ...defaultOptions, ...options };
    
    try {
      const buffer = await QRCode.toBuffer(qrCode, qrOptions);
      return buffer;
    } catch (error) {
      throw new Error(`二维码生成失败: ${error.message}`);
    }
  }

  /**
   * 生成二维码图片Base64字符串
   * @param {string} qrCode - 二维码字符串
   * @param {Object} options - 生成选项
   * @returns {Promise<string>} Base64编码的图片字符串
   */
  static async generateQRBase64(qrCode, options = {}) {
    const defaultOptions = {
      type: 'png',
      width: options.size || 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    };

    const qrOptions = { ...defaultOptions, ...options };
    
    try {
      const dataUrl = await QRCode.toDataURL(qrCode, qrOptions);
      return dataUrl;
    } catch (error) {
      throw new Error(`二维码生成失败: ${error.message}`);
    }
  }

  /**
   * 生成二维码SVG字符串
   * @param {string} qrCode - 二维码字符串
   * @param {Object} options - 生成选项
   * @returns {Promise<string>} SVG字符串
   */
  static async generateQRSVG(qrCode, options = {}) {
    const defaultOptions = {
      width: options.size || 200,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    };

    const qrOptions = { ...defaultOptions, ...options };
    
    try {
      const svg = await QRCode.toString(qrCode, { ...qrOptions, type: 'svg' });
      return svg;
    } catch (error) {
      throw new Error(`二维码生成失败: ${error.message}`);
    }
  }


  /**
   * 验证二维码是否属于指定厂区
   * @param {string} qrCode - 二维码字符串或URL
   * @param {number} factoryId - 厂区ID
   * @returns {boolean} 是否属于该厂区
   */
  static validateFactoryOwnership(qrCode, factoryId) {
    const parsed = this.parseQRCode(qrCode);
    return parsed && parsed.factoryId === factoryId;
  }

  /**
   * 生成临时检查二维码URL（用于临时设备检查）
   * @param {number} factoryId - 厂区ID
   * @param {string} description - 临时设备描述
   * @returns {string} 临时二维码URL
   */
  static generateTempQR(factoryId, description) {
    const timestamp = Date.now();
    const components = [
      'TEMP', // 临时设备标识
      factoryId.toString().padStart(3, '0'),
      timestamp.toString(36).toUpperCase(),
      this.generateChecksum(description)
    ];
    
    const qrCode = components.join('-');
    
    // 使用智能URL生成
    const baseUrl = this.getBaseURL();
    
    console.log(`🔗 [generateTempQR] 生成临时二维码:`, {
      厂区ID: factoryId,
      描述: description,
      二维码: qrCode,
      完整URL: `${baseUrl}/m/inspection/${qrCode}`
    });
    
    // 返回完整的点检URL
    return `${baseUrl}/m/inspection/${qrCode}`;
  }

  /**
   * 检查二维码是否为临时设备
   * @param {string} qrCode - 二维码字符串或URL
   * @returns {boolean} 是否为临时设备
   */
  static isTempQR(qrCode) {
    const codeString = this.extractQRCodeFromURL(qrCode);
    return codeString && codeString.startsWith('TEMP-');
  }

  /**
   * 规范化二维码输入，支持多种格式
   * @param {string} input - 输入的二维码（可能是URL或字符串）
   * @returns {Object} 包含不同格式的二维码信息
   */
  static normalizeQRCode(input) {
    if (!input || typeof input !== 'string') {
      return {
        original: input,
        codeString: '',
        fullURL: '',
        isValid: false
      };
    }

    let codeString = '';
    let fullURL = '';

    // 如果输入是URL格式，提取二维码字符串
    if (input.includes('/m/inspection/')) {
      codeString = this.extractQRCodeFromURL(input);
      fullURL = input;
    } else {
      // 如果输入是二维码字符串，构建完整URL
      codeString = input;
      fullURL = this.buildQRCodeURL(input);
    }

    return {
      original: input,
      codeString: codeString,
      fullURL: fullURL,
      isValid: this.validateQRCode(codeString)
    };
  }

  /**
   * 从二维码字符串构建完整URL
   * @param {string} codeString - 二维码字符串
   * @returns {string} 完整的二维码URL
   */
  static buildQRCodeURL(codeString) {
    if (!codeString) return '';
    
    // 如果已经是URL格式，直接返回
    if (codeString.includes('/m/inspection/')) {
      return codeString;
    }
    
    const baseUrl = this.getBaseURL();
    return `${baseUrl}/m/inspection/${codeString}`;
  }

  /**
   * 提取二维码字符串（增强版，支持更多格式）
   * @param {string} input - URL或二维码字符串
   * @returns {string} 二维码字符串
   */
  static extractQRCodeString(input) {
    if (!input) return '';
    
    // 如果是URL格式，提取最后的二维码部分
    if (input.includes('/m/inspection/')) {
      const parts = input.split('/m/inspection/');
      return parts[parts.length - 1];
    }
    
    // 否则直接返回原字符串
    return input;
  }

  /**
   * 获取二维码的所有可能查询格式
   * @param {string} input - 输入的二维码
   * @returns {Array<string>} 所有可能的查询格式
   */
  static getQRCodeQueryFormats(input) {
    const normalized = this.normalizeQRCode(input);
    const formats = [normalized.original]; // 保持原始输入
    
    if (normalized.codeString && normalized.codeString !== normalized.original) {
      formats.push(normalized.codeString);
    }
    
    if (normalized.fullURL && normalized.fullURL !== normalized.original) {
      formats.push(normalized.fullURL);
    }
    
    // 去重
    return [...new Set(formats)];
  }
}

module.exports = QRCodeGenerator;
