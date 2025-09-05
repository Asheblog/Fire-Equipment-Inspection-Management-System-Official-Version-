const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

/**
 * 消防器材点检系统 - 文件上传安全处理
 * 
 * 提供安全的文件上传功能：
 * - 文件类型验证
 * - 文件大小限制
 * - 安全的文件名生成
 * - 图片处理和优化
 * - 恶意文件检测
 */

class FileUploadSecurity {
  constructor() {
    this.allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp'
    ];
    
    this.allowedExtensions = [
      '.jpg',
      '.jpeg', 
      '.png',
      '.webp'
    ];
    
    this.maxFileSize = 5 * 1024 * 1024; // 5MB
    this.uploadDir = path.join(__dirname, '../../uploads');
    
    this.ensureUploadDirectory();
  }

  /**
   * 确保上传目录存在
   */
  ensureUploadDirectory() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
      console.log(`创建上传目录: ${this.uploadDir}`);
    }

    // 创建按年月分组的子目录
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = String(currentDate.getMonth() + 1).padStart(2, '0');
    const monthDir = path.join(this.uploadDir, year.toString(), month);
    
    if (!fs.existsSync(monthDir)) {
      fs.mkdirSync(monthDir, { recursive: true });
    }
  }

  /**
   * 配置Multer存储
   */
  getStorageConfig() {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        const currentDate = new Date();
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const uploadPath = path.join(this.uploadDir, year.toString(), month);
        
        // 确保目录存在
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
      },
      
      filename: (req, file, cb) => {
        try {
          // 生成安全的文件名
          const ext = path.extname(file.originalname).toLowerCase();
          const timestamp = Date.now();
          const randomString = crypto.randomBytes(8).toString('hex');
          const userId = req.user?.id || 'anonymous';
          
          const filename = `${userId}_${timestamp}_${randomString}${ext}`;
          
          // 记录文件上传日志
          console.log(`文件上传 - 用户: ${userId}, 原文件名: ${file.originalname}, 新文件名: ${filename}`);
          
          cb(null, filename);
        } catch (error) {
          console.error('文件名生成失败:', error);
          cb(new Error('文件名生成失败'), null);
        }
      }
    });
  }

  /**
   * 文件过滤器 - 验证文件类型和大小
   */
  fileFilter = (req, file, cb) => {
    try {
      console.log(`文件过滤检查 - 文件: ${file.originalname}, MIME类型: ${file.mimetype}`);
      
      // 检查MIME类型
      if (!this.allowedMimeTypes.includes(file.mimetype)) {
        console.warn(`不支持的MIME类型: ${file.mimetype}`);
        return cb(new Error(`不支持的文件类型。仅支持: ${this.allowedMimeTypes.join(', ')}`), false);
      }

      // 检查文件扩展名
      const ext = path.extname(file.originalname).toLowerCase();
      if (!this.allowedExtensions.includes(ext)) {
        console.warn(`不支持的文件扩展名: ${ext}`);
        return cb(new Error(`不支持的文件扩展名。仅支持: ${this.allowedExtensions.join(', ')}`), false);
      }

      // 检查文件名中的危险字符
      const dangerousPatterns = [
        /\.\./,           // 路径遍历
        /[<>:"|?*]/,      // Windows保留字符
        /^\./,            // 隐藏文件
        /\0/,             // NULL字符
        /\$/,             // Shell特殊字符
        /[;&|`]/          // 命令注入字符
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(file.originalname)) {
          console.warn(`文件名包含危险字符: ${file.originalname}`);
          return cb(new Error('文件名包含不允许的字符'), false);
        }
      }

      cb(null, true);
    } catch (error) {
      console.error('文件过滤器错误:', error);
      cb(new Error('文件验证失败'), false);
    }
  };

  /**
   * 创建上传中间件
   * @param {string} fieldName - 文件字段名
   * @param {number} maxCount - 最大文件数量
   * @returns {Function} Multer中间件
   */
  createUploadMiddleware(fieldName = 'file', maxCount = 1) {
    const upload = multer({
      storage: this.getStorageConfig(),
      fileFilter: this.fileFilter,
      limits: {
        fileSize: this.maxFileSize,
        files: maxCount,
        fields: 10,          // 限制字段数量
        fieldNameSize: 100,  // 限制字段名长度
        fieldSize: 1024      // 限制字段值大小
      }
    });

    // 根据文件数量选择合适的方法
    if (maxCount === 1) {
      return upload.single(fieldName);
    } else {
      return upload.array(fieldName, maxCount);
    }
  }

  /**
   * 文件上传错误处理中间件
   */
  handleUploadError = (error, req, res, next) => {
    if (error instanceof multer.MulterError) {
      console.error('Multer错误:', error);
      
      switch (error.code) {
        case 'LIMIT_FILE_SIZE':
          return res.status(400).json({
            error: 'FILE_TOO_LARGE',
            message: `文件大小超出限制，最大允许 ${this.maxFileSize / (1024 * 1024)}MB`
          });
          
        case 'LIMIT_FILE_COUNT':
          return res.status(400).json({
            error: 'TOO_MANY_FILES',
            message: '上传文件数量超出限制'
          });
          
        case 'LIMIT_UNEXPECTED_FILE':
          return res.status(400).json({
            error: 'UNEXPECTED_FILE',
            message: '意外的文件字段'
          });
          
        case 'LIMIT_FIELD_COUNT':
          return res.status(400).json({
            error: 'TOO_MANY_FIELDS',
            message: '表单字段数量超出限制'
          });
          
        default:
          return res.status(400).json({
            error: 'UPLOAD_ERROR',
            message: '文件上传失败'
          });
      }
    } else if (error) {
      console.error('文件上传错误:', error);
      return res.status(400).json({
        error: 'UPLOAD_ERROR',
        message: error.message || '文件上传失败'
      });
    }
    
    next();
  };

  /**
   * 验证上传后的文件
   */
  validateUploadedFile = (req, res, next) => {
    try {
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({
          error: 'NO_FILE_UPLOADED',
          message: '没有上传文件'
        });
      }

      // 再次验证文件大小（双重检查）
      if (file.size > this.maxFileSize) {
        this.deleteFile(file.path);
        return res.status(400).json({
          error: 'FILE_TOO_LARGE',
          message: '文件大小超出限制'
        });
      }

      // 验证文件确实存在
      if (!fs.existsSync(file.path)) {
        return res.status(500).json({
          error: 'FILE_SAVE_FAILED',
          message: '文件保存失败'
        });
      }

      // 检查文件是否为空
      const stats = fs.statSync(file.path);
      if (stats.size === 0) {
        this.deleteFile(file.path);
        return res.status(400).json({
          error: 'EMPTY_FILE',
          message: '不能上传空文件'
        });
      }

      // 生成文件URL
      const relativePath = path.relative(this.uploadDir, file.path);
      const fileUrl = `/uploads/${relativePath.replace(/\\/g, '/')}`;
      
      // 将文件信息添加到请求对象
      req.uploadedFile = {
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        url: fileUrl,
        size: file.size,
        mimeType: file.mimetype
      };

      console.log(`文件上传成功 - 用户: ${req.user?.id}, 文件: ${file.filename}, 大小: ${file.size}bytes`);
      
      next();
    } catch (error) {
      console.error('文件验证失败:', error);
      
      // 清理失败的文件
      if (req.file && req.file.path) {
        this.deleteFile(req.file.path);
      }
      
      return res.status(500).json({
        error: 'FILE_VALIDATION_FAILED',
        message: '文件验证失败'
      });
    }
  };

  /**
   * 删除文件
   * @param {string} filePath - 文件路径
   */
  deleteFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`删除文件: ${filePath}`);
      }
    } catch (error) {
      console.error(`删除文件失败: ${filePath}`, error);
    }
  }

  /**
   * 清理旧文件的定时任务
   * @param {number} daysOld - 删除多少天前的文件
   */
  cleanupOldFiles(daysOld = 30) {
    try {
      const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
      
      const cleanupDirectory = (dir) => {
        if (!fs.existsSync(dir)) return;
        
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.isDirectory()) {
            cleanupDirectory(filePath);
            
            // 如果目录为空，删除目录
            const remainingFiles = fs.readdirSync(filePath);
            if (remainingFiles.length === 0) {
              fs.rmdirSync(filePath);
              console.log(`删除空目录: ${filePath}`);
            }
          } else if (stats.isFile() && stats.mtime.getTime() < cutoffTime) {
            fs.unlinkSync(filePath);
            console.log(`清理旧文件: ${filePath}`);
          }
        }
      };
      
      cleanupDirectory(this.uploadDir);
      console.log(`完成清理 ${daysOld} 天前的旧文件`);
    } catch (error) {
      console.error('清理旧文件失败:', error);
    }
  }

  /**
   * 获取文件信息
   * @param {string} filename - 文件名
   * @returns {Object|null} 文件信息
   */
  getFileInfo(filename) {
    try {
      // 搜索文件（因为按年月分目录存储）
      const findFile = (dir) => {
        if (!fs.existsSync(dir)) return null;
        
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.isDirectory()) {
            const found = findFile(filePath);
            if (found) return found;
          } else if (file === filename) {
            const relativePath = path.relative(this.uploadDir, filePath);
            return {
              filename,
              path: filePath,
              url: `/uploads/${relativePath.replace(/\\/g, '/')}`,
              size: stats.size,
              mtime: stats.mtime,
              exists: true
            };
          }
        }
        
        return null;
      };
      
      return findFile(this.uploadDir);
    } catch (error) {
      console.error('获取文件信息失败:', error);
      return null;
    }
  }

  /**
   * 创建完整的文件上传处理链
   * @param {string} fieldName - 文件字段名
   * @param {number} maxCount - 最大文件数量
   * @returns {Array<Function>} 中间件数组
   */
  createUploadChain(fieldName = 'file', maxCount = 1) {
    return [
      this.createUploadMiddleware(fieldName, maxCount),
      this.handleUploadError,
      this.validateUploadedFile
    ];
  }

  /**
   * 获取上传目录统计信息
   * @returns {Object} 统计信息
   */
  getUploadStats() {
    try {
      let totalFiles = 0;
      let totalSize = 0;
      
      const scanDirectory = (dir) => {
        if (!fs.existsSync(dir)) return;
        
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.isDirectory()) {
            scanDirectory(filePath);
          } else if (stats.isFile()) {
            totalFiles++;
            totalSize += stats.size;
          }
        }
      };
      
      scanDirectory(this.uploadDir);
      
      return {
        totalFiles,
        totalSize,
        totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
        uploadDir: this.uploadDir
      };
    } catch (error) {
      console.error('获取上传统计失败:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        totalSizeMB: 0,
        uploadDir: this.uploadDir,
        error: error.message
      };
    }
  }
}

module.exports = FileUploadSecurity;