# 消防器材点检系统 - 安全模块

这是消防器材点检管理系统的完整安全与认证模块，提供企业级的安全防护和权限控制。

## 🔐 模块概览

### 核心安全组件

- **JWT认证系统** - 基于JSON Web Token的无状态认证
- **RBAC权限控制** - 角色基础的访问控制模型  
- **数据权限隔离** - 基于厂区的多租户数据隔离
- **输入验证与过滤** - 防止SQL注入和XSS攻击
- **速率限制保护** - 多层级的API调用频率控制
- **文件上传安全** - 安全的图片上传和处理
- **审计日志系统** - 完整的操作记录和安全事件追踪

## 📁 目录结构

```
backend/src/
├── auth/
│   └── auth.service.js          # 认证服务：登录、注册、密码管理
├── middleware/
│   └── auth.middleware.js       # 认证中间件：JWT验证、权限检查
├── security/
│   ├── rate-limiter.js         # 速率限制配置
│   ├── input-validator.js      # 输入验证和XSS防护
│   ├── file-upload.js          # 文件上传安全处理
│   ├── audit-logger.js         # 审计日志系统
│   └── security-config.js      # 安全中间件集成配置
└── routes/
    └── auth.routes.js          # 认证相关API路由
```

## 🚀 主要功能

### 1. JWT认证系统

- **Access Token**: 24小时有效期，包含用户信息和权限
- **Refresh Token**: 30天有效期，用于刷新访问令牌
- **Token黑名单**: 支持令牌撤销（预留接口）
- **安全算法**: 使用HS256签名，支持自定义密钥

### 2. 三级权限体系

#### 角色定义
- **INSPECTOR** (点检员): 查看器材、创建点检记录、上报隐患
- **FACTORY_ADMIN** (厂区管理员): 管理厂区内所有数据、处理隐患、查看报表  
- **SUPER_ADMIN** (超级管理员): 系统全部权限、跨厂区管理

#### 权限粒度
```javascript
// 权限格式: "模块:操作[:范围]"
'equipment:read'        // 查看器材
'equipment:*'          // 器材全部权限
'inspection:read:own'  // 查看自己的点检记录
'*:*'                 // 超级管理员全部权限
```

### 3. 数据权限隔离

- **厂区级隔离**: 用户只能访问所属厂区的数据
- **个人级隔离**: 普通用户只能看到自己创建的记录
- **动态过滤**: 自动在数据查询中添加权限过滤条件

### 4. 多层安全防护

#### 速率限制
```javascript
// 不同接口的速率限制策略
API通用限制: 15分钟内100次请求
登录接口: 15分钟内5次尝试
文件上传: 1分钟内10次上传
密码重置: 1小时内3次尝试
```

#### 输入验证
- **Schema验证**: 使用Joi进行结构化数据验证
- **SQL注入防护**: 检测并阻止SQL关键词
- **XSS防护**: HTML实体编码处理
- **文件类型检查**: 严格的MIME类型和扩展名验证

### 5. 审计日志系统

记录所有重要操作：
- 用户登录/登出事件
- 数据的增删改操作  
- 权限变更和角色调整
- 安全事件和异常访问
- 系统错误和性能指标

## 🔧 使用示例

### 基本认证流程

```javascript
// 1. 用户登录
POST /api/auth/login
{
  "username": "inspector001",
  "password": "SecurePass123!"
}

// 2. 获取令牌
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": "24h",
  "user": { "id": 1, "role": "INSPECTOR", ... }
}

// 3. 使用令牌访问API
GET /api/equipment
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

### 权限保护的路由

```javascript
const { authMiddleware } = require('../middleware/auth.middleware');

// 简单权限检查
router.get('/equipment', 
  authMiddleware.requireAuth('equipment:read'),
  getEquipmentList
);

// 权限检查 + 数据权限过滤
router.get('/inspections',
  authMiddleware.requireAuth('inspection:read', 'inspection'),
  getInspectionList  // req.dataFilter 会自动包含权限过滤条件
);

// 角色检查
router.post('/users',
  authMiddleware.requireRole(['FACTORY_ADMIN', 'SUPER_ADMIN']),
  createUser
);
```

### 文件上传安全

```javascript
const { fileUpload } = require('../security/file-upload');

router.post('/upload',
  authMiddleware.authenticate,
  ...fileUpload.createUploadChain('inspectionImage'), // 安全上传链
  (req, res) => {
    // req.uploadedFile 包含安全处理后的文件信息
    res.json({ fileUrl: req.uploadedFile.url });
  }
);
```

### 输入验证

```javascript
const { inputValidator } = require('../security/input-validator');

router.post('/equipment',
  authMiddleware.requireAuth('equipment:create'),
  inputValidator.validateAndSanitize('equipmentSchema'), // 验证+防护
  createEquipment
);
```

## ⚙️ 环境配置

### 必需的环境变量

```bash
# JWT密钥配置
JWT_SECRET=fire-safety-jwt-secret-2024
JWT_REFRESH_SECRET=fire-safety-refresh-secret-2024
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_EXPIRES_IN=30d

# 数据库连接
DATABASE_URL="file:../data/fire_safety.db"

# 运行环境
NODE_ENV=development
PORT=3000
```

### 生产环境建议

```bash
# 使用强随机密钥
JWT_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)

# 启用HTTPS
HTTPS_ENABLED=true
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/key.pem

# 配置信任代理
TRUST_PROXY=1
```

## 🔒 安全最佳实践

### 密码策略
- 最少8位，包含大小写字母、数字、特殊字符
- 使用bcrypt加密，salt rounds = 12
- 支持密码强度验证和历史检查

### Token安全
- 短期Access Token（24小时）+ 长期Refresh Token（30天）
- 包含JWT ID防止重放攻击
- 支持Token撤销和黑名单机制

### API安全
- 所有敏感接口都需要认证
- 细粒度的权限控制
- 完整的输入验证和过滤
- 多级速率限制保护

### 数据安全
- 严格的数据权限隔离
- 敏感数据加密存储
- 完整的审计日志追踪
- 定期的安全日志分析

## 📊 监控和告警

### 安全事件监控
- 登录失败次数异常
- 权限越权尝试
- SQL注入和XSS攻击
- 异常文件上传行为
- API调用频率异常

### 性能监控
- 认证接口响应时间
- Token验证性能
- 数据库查询优化
- 文件上传处理效率

## 🚨 应急响应

### 安全事件处理
1. **自动阻断**: 超过阈值自动触发速率限制
2. **实时告警**: 严重安全事件立即通知管理员
3. **日志保存**: 所有安全事件详细记录
4. **快速恢复**: 支持批量Token撤销和账户冻结

### 故障恢复
- Token服务高可用设计
- 数据库连接池和重试机制
- 文件上传错误自动清理
- 审计日志的定期备份

## 📈 性能优化

### 认证性能
- JWT无状态设计，减少数据库查询
- Token本地验证，避免远程调用
- 权限信息缓存，提升检查速度

### 数据查询优化
- 智能的数据权限过滤
- 索引优化的权限查询
- 分页和排序的性能保证

---

这个安全模块为消防器材点检系统提供了企业级的安全保障，确保数据安全、用户隐私和系统稳定运行。所有安全措施都经过仔细设计，符合行业最佳实践和安全规范。