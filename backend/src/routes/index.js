/**
 * 消防器材点检系统 - API路由汇总
 * 集中管理所有API路由
 */

const express = require('express');
const router = express.Router();

// 导入子路由
const authRoutes = require('./auth.routes');
const equipmentRoutes = require('./equipment.routes');
const inspectionRoutes = require('./inspection.routes');
const issueRoutes = require('./issue.routes');
const userRoutes = require('./user.routes');
const reportRoutes = require('./report.routes');
const auditRoutes = require('./audit.routes');
const permissionRoutes = require('./permission.routes');
const mobileRoutes = require('./mobile.routes');
const systemSettingsRoutes = require('./system-settings.routes');

// 导入中间件
const EnhancedAuthMiddleware = require('../middleware/enhanced-auth.middleware');
const RateLimiter = require('../security/rate-limiter');
const FileUploadSecurity = require('../security/file-upload');
const authMiddleware = new EnhancedAuthMiddleware();
const rateLimiter = new RateLimiter();
const fileUpload = new FileUploadSecurity();
const { authenticate, requireAuth, authorize } = authMiddleware;

/**
 * 公开路由 (无需认证)
 */
router.use('/auth', authRoutes);
// 移动端辅助访问（二维码临时令牌） - 公开
router.use('/mobile', mobileRoutes);

/**
 * 需要认证的路由
 */

// 器材管理 (所有角色都可以查看，创建/修改需要管理员权限)
router.use('/equipments', 
  authenticate,
  equipmentRoutes
);

// 器材点检项模板 (与器材管理共用路径)
router.get('/equipments/:equipmentId/checklist',
  authenticate,
  require('../controllers/inspection.controller').getChecklistTemplate
);

// 点检管理 (点检员可创建，管理员可查看全部)
router.use('/inspections',
  authenticate,
  inspectionRoutes
);

// 隐患管理 (点检员可查看自己上报的，管理员可处理)
router.use('/issues',
  authenticate,
  issueRoutes
);

// 用户管理 (需要管理员权限)
router.use('/users',
  authenticate,
  authorize('user:read'),
  userRoutes
);

// 厂区管理 (独立路由)
router.get('/factories',
  authenticate,
  authorize('factory:read'),
  require('../controllers/user.controller').getFactoryList
);

router.post('/factories',
  authenticate,
  authorize('factory:create'),
  require('../controllers/user.controller').createFactory
);

// 获取单个厂区详情
router.get('/factories/:id',
  authenticate,
  authorize('factory:read'),
  require('../controllers/user.controller').getFactoryById
);

// 更新厂区信息
router.put('/factories/:id',
  authenticate,
  authorize('factory:update'),
  require('../controllers/user.controller').updateFactory
);

// 删除厂区
router.delete('/factories/:id',
  authenticate,
  authorize('factory:delete'),
  require('../controllers/user.controller').deleteFactory
);

// 报表下载（签名直链），放在鉴权前以允许token校验
router.get('/reports/download/:filename',
  require('../controllers/report.controller').downloadFile
);

// 报表和数据看板 (所有角色都可以查看，按权限过滤数据)
router.use('/reports',
  authenticate,
  reportRoutes
);

// 审计日志管理 (需要管理员权限)
router.use('/audit',
  authenticate,
  authorize('audit:read'),
  auditRoutes
);

// 权限管理 (需要超级管理员权限)
router.use('/permissions',
  authenticate,
  authorize('*:*'),
  permissionRoutes
);

// 系统运行时设置 (超级管理员)
router.use('/system-settings',
  authenticate,
  authorize('*:*'),
  systemSettingsRoutes
);

/**
 * 文件上传路由
 */
router.post('/upload',
  authenticate,
  rateLimiter.getUploadLimiter(),
  (req, res, next) => {
    let raw = 0;
    req.on('data', c => { raw += c.length; });
    req.on('end', () => {
      console.log('[UPLOAD RAW_BYTES]', raw);
    });
    next();
  },
  ...fileUpload.createUploadChain('file'),
  // EXIF 校验中间件（放在文件通过基本校验之后）
  async (req, res, next) => {
    try {
      const ExifValidator = require('../utils/exif.validator');
      if (!req.uploadedFile || !req.uploadedFile.path) {
        return next();
      }
      const exifResult = await ExifValidator.validate(req.uploadedFile.path, { maxTimeDriftMinutes: 10 });
      req.uploadedFile.exif = exifResult;
      // 如果严格要求拍摄时间接近当前时间，可在 exifResult.passed 为 false 时拦截：
      if (exifResult && exifResult.passed === false) {
        const ResponseHelper = require('../utils/response.helper');
        return ResponseHelper.badRequest(res, '照片拍摄时间异常，疑似非现场拍摄', { exif: exifResult });
      }
      next();
    } catch (e) {
      console.warn('EXIF 校验过程出错:', e.message);
      next();
    }
  },
  (req, res) => {
    console.log(`🟣 [上传调试] ===== 文件上传成功 =====`);
    console.log(`🟣 [上传调试] 用户ID: ${req.user?.id || '未知'}`);
    console.log(`🟣 [上传调试] 上传时间: ${new Date().toISOString()}`);
    console.log(`🟣 [上传调试] 原始文件名: ${req.uploadedFile.originalName}`);
    console.log(`🟣 [上传调试] 存储文件名: ${req.uploadedFile.filename}`);
    console.log(`🟣 [上传调试] 文件路径: ${req.uploadedFile.path}`);
    console.log(`🟣 [上传调试] 生成的URL: ${req.uploadedFile.url}`);
    console.log(`🟣 [上传调试] 文件大小: ${req.uploadedFile.size} bytes`);
    console.log(`🟣 [上传调试] MIME类型: ${req.uploadedFile.mimeType}`);
    
    // 检查生成的URL格式
    console.log(`🟣 [上传调试] URL格式分析:`);
    console.log(`  - URL类型: ${typeof req.uploadedFile.url}`);
    console.log(`  - URL长度: ${req.uploadedFile.url.length}`);
    console.log(`  - 是否以/uploads开头: ${req.uploadedFile.url.startsWith('/uploads') ? '是' : '否'}`);
    console.log(`  - 是否包含HTML编码字符: ${req.uploadedFile.url.includes('&#x') ? '是' : '否'}`);
    console.log(`  - URL字符编码检查: ${req.uploadedFile.url.split('').map(char => `${char}(${char.charCodeAt(0)})`).slice(0, 20).join(' ')}...`);
    
    const responseData = {
      fileUrl: req.uploadedFile.url,
      fileName: req.uploadedFile.filename,
      fileSize: req.uploadedFile.size,
      exif: req.uploadedFile.exif || null
    };
    
    console.log(`🟣 [上传调试] 返回给前端的响应数据:`, JSON.stringify(responseData, null, 2));
    console.log(`🟣 [上传调试] ===== 文件上传处理完成 =====`);
    
    const ResponseHelper = require('../utils/response.helper');
    return ResponseHelper.success(res, responseData, '文件上传成功');
  }
);

/**
 * API健康检查
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API服务正常',
    timestamp: new Date().toISOString(),
    version: require('../../package.json').version
  });
});

/**
 * API信息
 */
router.get('/', (req, res) => {
  res.json({
    name: '消防器材点检管理系统 API',
    version: require('../../package.json').version,
    description: '企业级消防器材点检管理平台API服务',
    endpoints: {
      auth: {
        login: 'POST /api/auth/login',
        refresh: 'POST /api/auth/refresh',
        logout: 'POST /api/auth/logout',
        profile: 'GET /api/auth/profile',
        changePassword: 'PUT /api/auth/change-password'
      },
      equipments: {
        list: 'GET /api/equipments',
        create: 'POST /api/equipments',
        detail: 'GET /api/equipments/:id',
        update: 'PUT /api/equipments/:id',
        delete: 'DELETE /api/equipments/:id',
        qrCode: 'GET /api/equipments/qr/:qrCode',
        types: 'GET /api/equipments/types',
        stats: 'GET /api/equipments/stats',
        checklist: 'GET /api/equipments/:id/checklist',
        batchImport: 'POST /api/equipments/batch-import'
      },
      inspections: {
        list: 'GET /api/inspections',
        create: 'POST /api/inspections',
        detail: 'GET /api/inspections/:id',
        delete: 'DELETE /api/inspections/:id',
        stats: 'GET /api/inspections/stats',
        trend: 'GET /api/inspections/trend',
        pending: 'GET /api/inspections/pending'
      },
      issues: {
        list: 'GET /api/issues',
        detail: 'GET /api/issues/:id',
        handle: 'PUT /api/issues/:id/handle',
        audit: 'PUT /api/issues/:id/audit',
        comment: 'POST /api/issues/:id/comments',
        stats: 'GET /api/issues/stats',
        trend: 'GET /api/issues/trend'
      },
      users: {
        list: 'GET /api/users',
        create: 'POST /api/users',
        detail: 'GET /api/users/:id',
        update: 'PUT /api/users/:id',
        status: 'PUT /api/users/:id/status',
        password: 'PUT /api/users/:id/password',
        stats: 'GET /api/users/stats'
      },
      factories: {
        list: 'GET /api/factories',
        create: 'POST /api/factories',
        detail: 'GET /api/factories/:id',
        update: 'PUT /api/factories/:id',
        delete: 'DELETE /api/factories/:id'
      },
      reports: {
        dashboard: 'GET /api/reports/dashboard',
        monthly: 'GET /api/reports/monthly',
        equipmentOverview: 'GET /api/reports/equipment-overview',
        inspectionOverview: 'GET /api/reports/inspection-overview',
        issueOverview: 'GET /api/reports/issue-overview',
        recentActivity: 'GET /api/reports/recent-activity'
      },
      audit: {
        logs: 'GET /api/audit/logs',
        securityLogs: 'GET /api/audit/security-logs',
        errorLogs: 'GET /api/audit/error-logs',
        stats: 'GET /api/audit/stats',
        cleanup: 'POST /api/audit/cleanup',
        resolveSecurityLog: 'PUT /api/audit/security-logs/:id/resolve',
        resolveErrorLog: 'PUT /api/audit/error-logs/:id/resolve',
        testEmail: 'POST /api/audit/test-email'
      },
      upload: {
        file: 'POST /api/upload'
      },
      system: {
        health: 'GET /api/health',
        info: 'GET /api/'
      }
    },
    documentation: {
      api: '/docs/api',
      security: '/docs/security',
      authentication: 'Bearer Token (JWT)',
      rateLimit: '限流保护已启用',
      dataIsolation: '基于厂区的数据隔离'
    }
  });
});

module.exports = router;
