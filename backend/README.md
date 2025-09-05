# 消防器材点检管理系统 - Node.js后端

> 基于已完成的数据库模型和安全系统，构建完整的RESTful API服务

## 🚀 快速开始

### 一键初始化和启动
```bash
npm run setup
```

这个命令会自动完成：
- ✅ 环境依赖检查
- ✅ 数据库设置和数据填充
- ✅ 启动API服务器
- ✅ 运行功能测试
- ✅ 显示系统摘要

### 手动启动
```bash
# 安装依赖
npm install

# 数据库设置
npm run db:setup

# 启动开发服务器
npm run dev

# 或启动生产服务器
npm start
```

## 📁 项目结构

```
backend/
├── src/
│   ├── controllers/          # 控制器层 (HTTP请求处理)
│   │   ├── equipment.controller.js    # 器材管理控制器
│   │   ├── inspection.controller.js   # 点检管理控制器
│   │   ├── issue.controller.js        # 隐患管理控制器
│   │   ├── user.controller.js         # 用户管理控制器
│   │   └── report.controller.js       # 报表控制器
│   ├── services/            # 业务逻辑层
│   │   ├── equipment.service.js       # 器材管理服务
│   │   ├── inspection.service.js      # 点检管理服务
│   │   ├── issue.service.js           # 隐患管理服务
│   │   ├── user.service.js            # 用户管理服务
│   │   └── report.service.js          # 报表服务
│   ├── routes/              # 路由定义
│   │   ├── index.js                   # 主路由汇总
│   │   ├── auth.routes.js             # 认证路由
│   │   ├── equipment.routes.js        # 器材管理路由
│   │   ├── inspection.routes.js       # 点检管理路由
│   │   ├── issue.routes.js            # 隐患管理路由
│   │   ├── user.routes.js             # 用户管理路由
│   │   └── report.routes.js           # 报表路由
│   ├── utils/               # 工具函数
│   │   ├── response.helper.js         # 统一响应格式
│   │   ├── validation.helper.js       # 数据验证工具
│   │   └── qrcode.generator.js        # 二维码生成器
│   ├── middleware/          # 中间件 (已存在)
│   ├── security/            # 安全模块 (已存在)
│   └── auth/                # 认证模块 (已存在)
├── prisma/                  # 数据库模型 (已存在)
├── uploads/                 # 文件上传目录
│   ├── inspections/         # 点检图片
│   └── fixes/               # 隐患处理图片
├── data/                    # SQLite数据库文件
├── app.js                   # 应用入口 (已更新)
├── test-api.js              # API功能测试
├── setup-and-run.js         # 一键启动脚本
└── API_DOCUMENTATION.md     # 完整API文档
```

## 🔧 核心API功能

### 📱 新增：移动端防造假点检支持
为降低从相册上传旧图/伪造图片风险，新增以下机制：
- 🔐 一次性扫码 Token：PC 端生成 `/api/mobile/qr-token` 返回 token + `scanUrl`，PC 前端生成二维码；
- 📲 手机扫码后访问 `scanUrl`（示例落地到 `mobile-inspection.html` 或 SPA 内指定路由）再调用 `POST /api/mobile/qr-token/:id/consume` 占用该 Token；
- 🖼 现场拍照：移动页通过 `getUserMedia` 打开后摄，Canvas 截帧 + 水印（时间戳 + 随机 nonce）；
- 🗂 禁止相册：不呈现 `<input type=file>`，仅视频流截帧；
- 🕒 EXIF 校验：上传接口加入 EXIF 校验（`DateTimeOriginal` 与服务器时间偏差 > 10 分钟则拒绝，或可调整策略）；
- ⚠️ EXIF 不是绝对防伪：仍需结合审计、随机抽检；
- 🔄 Token 5 分钟过期 + 一次性使用，使用后 1 分钟自动清理（`MobileAccessService`）。

**相关新增文件**：
```
src/services/mobile.access.service.js   # 移动端扫码 Token 内存服务
src/routes/mobile.routes.js             # 移动端辅助路由 (公开)
src/utils/exif.validator.js             # EXIF 校验工具
public/mobile-inspection.html           # 简易移动端拍照页面示例
```

**可选依赖**：若需启用 EXIF 解析，请安装：
```bash
npm install exifreader
```
未安装时系统会自动跳过 EXIF 校验并给出警告。

**新增公开端点**：
```http
GET  /api/mobile/qr-token                 # 生成一次性扫码 token
GET  /api/mobile/qr-token/:id/status      # 轮询 token 状态 (PC)
POST /api/mobile/qr-token/:id/consume     # 手机端兑换 token
```

**上传接口增强**：
```http
POST /api/upload  # 返回字段新增 exif 信息
```
响应示例（成功并含 EXIF 警告）：
```json
{
  "success": true,
  "data": {
    "fileUrl": "/uploads/2025/09/123_...jpg",
    "fileName": "123_...jpg",
    "fileSize": 234567,
    "exif": {
      "passed": true,
      "warnings": ["缺少拍摄时间(DateTimeOriginal)"],
      "meta": {"device": "Apple iPhone"}
    }
  }
}
```

> 提示：若需要更严格策略，可将 `exifResult.passed=false` 改为仅警告模式，或拓展 GPS 范围验证、pHash 去重等。


### 1. 器材管理API (/api/equipments)
- ✅ **CRUD操作**: 创建、查询、更新、删除器材
- ✅ **二维码功能**: 自动生成唯一二维码，支持扫码查询
- ✅ **智能筛选**: 按厂区、类型、状态、即将到期等条件筛选
- ✅ **批量导入**: 支持批量导入器材数据
- ✅ **统计分析**: 器材总数、健康率、到期预警等

**关键端点**:
```http
GET    /api/equipments              # 器材列表 (分页+筛选)
POST   /api/equipments              # 创建器材
GET    /api/equipments/:id          # 器材详情
PUT    /api/equipments/:id          # 更新器材
DELETE /api/equipments/:id          # 删除器材
GET    /api/equipments/qr/:qrCode   # 扫码查询器材
GET    /api/equipments/types        # 器材类型列表
GET    /api/equipments/stats        # 器材统计信息
POST   /api/equipments/batch-import # 批量导入器材
```

### 2. 点检管理API (/api/inspections)
- ✅ **动态表单**: 根据器材类型自动加载点检项模板
- ✅ **扫码点检**: 支持二维码扫描快速定位器材
- ✅ **异常处理**: 点检异常自动创建隐患单
- ✅ **状态同步**: 自动更新器材状态和最后点检时间
- ✅ **数据统计**: 点检合格率、趋势分析、待点检预警

**关键端点**:
```http
GET  /api/equipments/:id/checklist  # 获取点检项模板
POST /api/inspections               # 创建点检记录
GET  /api/inspections               # 点检记录列表
GET  /api/inspections/:id           # 点检记录详情
GET  /api/inspections/stats         # 点检统计信息
GET  /api/inspections/trend         # 点检趋势数据
GET  /api/inspections/pending       # 待点检器材列表
```

### 3. 隐患管理API (/api/issues)
- ✅ **自动创建**: 点检异常时自动生成隐患单
- ✅ **处理流程**: 厂区管理员处理 → 超级管理员审核
- ✅ **状态流转**: PENDING → IN_PROGRESS → PENDING_AUDIT → CLOSED/REJECTED
- ✅ **通知机制**: 关键节点状态变更
- ✅ **统计分析**: 隐患数量、处理时效、解决率等

**关键端点**:
```http
GET  /api/issues                # 隐患列表
GET  /api/issues/:id            # 隐患详情
PUT  /api/issues/:id/handle     # 处理隐患 (管理员)
PUT  /api/issues/:id/audit      # 审核隐患 (超管)
POST /api/issues/:id/comments   # 添加处理备注
GET  /api/issues/stats          # 隐患统计信息
GET  /api/issues/trend          # 隐患趋势数据
```

### 4. 用户管理API (/api/users)
- ✅ **角色权限**: INSPECTOR、FACTORY_ADMIN、SUPER_ADMIN
- ✅ **数据隔离**: 基于厂区的数据访问控制
- ✅ **用户生命周期**: 创建、更新、停用、密码重置
- ✅ **权限验证**: 细粒度的权限控制和验证
- ✅ **统计分析**: 用户数量、活跃度等

**关键端点**:
```http
GET  /api/users              # 用户列表
POST /api/users              # 创建用户
GET  /api/users/:id          # 用户详情
PUT  /api/users/:id          # 更新用户
PUT  /api/users/:id/status   # 修改用户状态
PUT  /api/users/:id/password # 重置密码
GET  /api/users/stats        # 用户统计信息
```

### 5. 厂区管理API (/api/factories)
- ✅ **厂区列表**: 获取所有厂区信息
- ✅ **厂区创建**: 超级管理员创建新厂区
- ✅ **数据统计**: 每个厂区的用户和器材数量

**关键端点**:
```http
GET  /api/factories     # 厂区列表
POST /api/factories     # 创建厂区 (超管)
```

### 6. 报表系统API (/api/reports)
- ✅ **数据看板**: 实时统计各项关键指标
- ✅ **月度报表**: 详细的月度数据分析
- ✅ **趋势分析**: 时间序列数据和趋势图表
- ✅ **最近活动**: 系统操作日志和活动记录

**关键端点**:
```http
GET /api/reports/dashboard           # 数据看板
GET /api/reports/monthly             # 月度报表
GET /api/reports/equipment-overview  # 器材概览
GET /api/reports/inspection-overview # 点检概览
GET /api/reports/issue-overview      # 隐患概览
GET /api/reports/recent-activity     # 最近活动
```

### 7. 文件上传API (/api/upload)
- ✅ **安全上传**: 类型检查、大小限制、路径过滤
- ✅ **图片处理**: 点检图片、隐患图片、处理后图片
- ✅ **存储管理**: 分类存储、自动清理旧文件

## 🔐 安全特性

### 认证和授权
- **JWT认证**: 无状态令牌，支持刷新机制
- **角色权限**: 基于角色的访问控制(RBAC)
- **数据隔离**: 厂区级数据访问控制
- **权限细化**: API级别的权限验证

### 安全防护
- **输入验证**: Joi模式验证，防止注入攻击
- **速率限制**: 防止暴力破解和DDoS攻击
- **安全头**: Helmet中间件配置安全HTTP头
- **文件安全**: 上传文件类型检查和大小限制
- **审计日志**: 关键操作的完整日志记录

### 密码安全
- **BCrypt加密**: 高强度密码哈希
- **强密码策略**: 大小写字母+数字+特殊字符
- **密码重置**: 安全的密码重置机制

## 🎯 业务逻辑亮点

### 智能二维码系统
- **唯一性保证**: FIRE-厂区-类型-时间戳-校验码格式
- **权限验证**: 自动验证二维码归属权限
- **批量生成**: 支持批量导入时自动生成二维码

### 动态点检流程
1. 扫码识别器材
2. 自动加载对应的点检项模板
3. 逐项检查并记录结果
4. 异常时自动创建隐患单
5. 更新器材状态和点检时间

### 隐患处理闭环
1. **自动创建**: 点检异常时系统自动生成
2. **分级处理**: 厂区管理员处理，超级管理员审核
3. **状态流转**: 完整的状态管理和流程控制
4. **审核机制**: 支持通过/驳回，包含审核意见

### 数据权限隔离
- **点检员**: 只能操作和查看所属厂区数据
- **厂区管理员**: 管理本厂区的所有数据
- **超级管理员**: 跨厂区的全部数据访问权限

## 🚀 性能优化

### 数据库优化
- **索引策略**: 针对查询模式的复合索引
- **并行查询**: Promise.all并行执行独立查询
- **分页机制**: 所有列表接口支持分页
- **连接池**: Prisma自动管理数据库连接

### API性能
- **响应压缩**: Gzip压缩减少传输大小
- **请求验证**: 提前验证减少无效数据库操作
- **错误处理**: 统一的错误处理和响应格式
- **缓存策略**: 静态资源缓存和API响应缓存

## 📊 监控和测试

### 健康检查
```http
GET /api/health          # API服务健康状态
GET /status              # 系统运行状态
```

### 测试工具
```bash
npm run test:api         # API功能测试
npm run test:security    # 安全功能测试
npm run security:audit   # 安全审计
```

### 系统监控
- **运行时监控**: 内存、CPU、运行时间
- **API监控**: 响应时间、错误率
- **业务监控**: 点检数量、隐患处理时效
- **安全监控**: 登录失败、异常访问

## 🛠️ 开发工具

### 数据库管理
```bash
npm run db:studio        # 打开Prisma Studio
npm run db:generate      # 生成数据库客户端
npm run db:push          # 同步数据库结构
npm run db:seed          # 填充测试数据
```

### 开发调试
```bash
npm run dev              # 开发模式 (热重载)
npm run lint             # 代码规范检查
npm run security:audit   # 安全漏洞检查
```

## 📚 默认测试数据

系统会自动创建以下测试账户：

| 角色 | 用户名 | 密码 | 权限范围 |
|------|--------|------|----------|
| 超级管理员 | admin | Test123!@# | 全系统 |
| 厂区管理员 | factory_admin | Test123!@# | 所属厂区 |
| 点检员 | inspector | Test123!@# | 所属厂区 |

## 📋 部署配置

### 环境变量
```env
DATABASE_URL="file:../data/fire_safety.db"
JWT_SECRET="your-jwt-secret"
JWT_REFRESH_SECRET="your-refresh-secret"
PORT=3000
NODE_ENV=production
```

### PM2部署 (生产环境)
```bash
npm install -g pm2
pm2 start app.js --name fire-safety-api
pm2 startup
pm2 save
```

## 📖 相关文档

- [完整API文档](./API_DOCUMENTATION.md) - 详细的API使用说明
- [数据库设计](./prisma/schema.prisma) - Prisma数据模型
- [安全配置](./src/security/) - 安全模块详情

## 🎉 特色功能

### 1. 一键部署
`npm run setup` 命令实现从零到完整系统的自动化部署

### 2. 智能权限控制
基于JWT的无状态认证 + RBAC权限控制 + 数据隔离

### 3. 完整业务闭环
从器材管理 → 扫码点检 → 异常上报 → 隐患处理 → 审核通过的完整流程

### 4. 实时数据看板
器材健康度、点检合格率、隐患处理时效等关键指标的实时展示

### 5. 企业级安全
多层安全防护，满足企业级应用的安全要求

---

这个后端API系统提供了完整的消防器材点检管理功能，具备企业级的安全性、可扩展性和维护性。通过统一的RESTful API设计，可以轻松支持Web前端、移动端或第三方系统集成。
