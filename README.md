# 消防器材点检管理系统

> 基于React + Node.js的现代化消防安全管理平台

[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-blueviolet.svg)](https://www.prisma.io/)

## 🎯 系统概述

消防器材点检管理系统是一套完整的数字化消防安全管理解决方案，采用前后端集成部署架构，支持移动端扫码点检和PC端集中管理。

### 核心功能
- 📱 **移动端扫码点检** - 一线员工使用手机进行现场点检
- 🖥️ **PC端管理后台** - 管理员进行数据管理和统计分析
- 🔐 **多级权限控制** - 点检员/厂区管理员/超级管理员三级体系
- 📊 **实时数据看板** - 关键指标实时监控和趋势分析
- 🔄 **隐患闭环管理** - 发现→处理→审核→关闭的完整流程

## 🏗️ 技术架构

### 前端技术栈
- **React 18** + **TypeScript** - 现代化前端框架
- **Vite** - 快速构建工具
- **shadcn/ui** + **Tailwind CSS** - 企业级UI组件库
- **Zustand** - 轻量级状态管理
- **html5-qrcode** - 移动端扫码功能

### 后端技术栈
- **Node.js** + **Express.js** - 稳定的服务端框架
- **Prisma** + **SQLite** - 类型安全的数据库访问
- **JWT** - 无状态身份认证
- **Multer** - 文件上传处理
- **PM2** - 生产环境进程管理

### 部署架构
- **集成部署模式** - 后端同时提供API服务和静态文件托管
- **单一端口访问** - 简化部署和运维复杂度
- **跨平台支持** - Windows/Linux/macOS全平台兼容

## 🚀 快速开始

### 系统要求
- Node.js 18.x 或更高版本
- npm 或 yarn 包管理器
- 支持现代浏览器 (Chrome 90+, Firefox 88+, Safari 14+)

### 一键部署（新版安全脚本）

推荐使用新增 `secure-deploy.js`：避免生产误删数据、支持 HTTPS 协助、自生成随机密钥、可非交互运行。

```bash
# 交互模式
node secure-deploy.js

# 或非交互（CI/CD）
node secure-deploy.js --non-interactive \
  --http-port 3001 \
  --enable-https true --domain example.com \
  --pm2 true --seed false

# 旧方式（不推荐生产）
node deploy.js
```

支持环境变量（优先级：CLI > ENV > 默认）：
`DEPLOY_DOMAIN` / `DEPLOY_HTTP_PORT` / `DEPLOY_HTTPS_PORT` / `DEPLOY_ENABLE_HTTPS` / `DEPLOY_DB_PATH` / `DEPLOY_PM2` / `DEPLOY_PM2_NAME` / `DEPLOY_RUN_SEED` / `DEPLOY_ENABLE_SELF_SIGNED`。

> **⚠️ 摄像头功能提醒**  
> 移动端扫码需 HTTPS；开发可用自签证书；生产请使用有效证书。

## 🔳 二维码策略说明

系统采用“数据库仅存纯码 + 运行时拼接 URL”策略：

- 数据库存储的 `equipment.qrCode` 为纯码：`FIRE-<厂区ID3位>-<类型ID2位>-<时间戳Base36>-<校验4位>`。
- 打印/展示或生成图片时，后端把纯码转换为完整访问链接：`{BASE_URL}/m/inspection/{纯码}`，二维码内容即该 URL，扫码直接跳转。
- 更换域名 / 协议时不需要批量 SQL 更新，只需重新批量导出二维码图片。
- 兼容旧数据：已提供迁移脚本将历史“完整URL”规范化为纯码。

### 相关接口
- `GET /api/equipments/qr/:qrCode` 支持纯码或完整URL（内部自动提取）。
- `GET /api/equipments/qr/*` 通配符兼容错误传入的整段 URL。
- `GET /api/equipments/qr/resolve/:raw` 解析并返回：`original`、`pureCode`、`isValid`、`fullUrl`。
- `GET /api/equipments/qr-image/:qrCode` 若传纯码自动补全并生成二维码图片（Base64 / PNG / SVG）。

### 脚本
| 目的 | 命令 |
| ---- | ---- |
| 迁移旧URL到纯码 | `node backend/scripts/migrate-qr-to-pure.js` |
| 批量导出二维码 | `node backend/scripts/export-all-qr.js out=backend/exports/qr json=backend/exports/qr_codes.json` |

### 前端扫码流程建议
1. 扫码获取 raw 字符串（可能是纯码或完整URL）。
2. 提取 `/m/inspection/` 之后部分作为纯码，如果没有则尝试直接作为纯码。
3. 若未登录，带 `redirect` 参数跳转登录；成功后回到 `/m/inspection/{code}`。
4. 点检页加载时调用 `/api/equipments/qr/{code}` 获取器材信息。

### 设计优势
- 解耦：域名/IP 改动无需修改 DB。
- 安全：数据库不暴露内部访问地址。
- 扩展：后续可在 URL 添加签名/版本参数不污染存储字段。
- 容错：通配符与解析接口降低前端误传导致的失败率。


#### 开发环境HTTPS快速启动

为了在开发环境中测试摄像头功能，使用HTTPS模式：

**统一跨平台方式（推荐）：**
```bash
# 使用Node.js脚本（Windows/Linux/macOS通用）
npm run dev
# 或
node dev.js
```

**Linux/macOS传统方式：**
```bash  
# Shell脚本方式（如果存在）
./dev.sh
```

**功能特点：**
- ✅ 自动检测当前局域网IP地址
- ✅ 智能生成包含当前IP的SSL证书  
- ✅ 同时启动前后端服务
- ✅ IP变化时重新运行即可更新证书
- ✅ 跨平台兼容（Windows/Linux/macOS）

#### 生产环境 HTTPS 部署

1. 域名解析到服务器公网 IP。  
2. 运行：
   ```bash
   node secure-deploy.js --enable-https true --domain your-domain.com
   ```
3. 若 certbot dry-run 未通过：
   ```bash
   sudo certbot certonly --standalone -d your-domain.com
   ```
4. 使用 Nginx/Caddy 反向代理到后端 HTTP 端口 (`PORT`)。  
5. 如需 Node 原生 HTTPS，更新 `.env` 的 `SSL_CERT_PATH` / `SSL_KEY_PATH`。

详见: [docs/ssl-deployment-guide.md](docs/ssl-deployment-guide.md)

#### 手动部署（最小步骤）
```bash
# 1. 安装后端依赖
cd backend
npm install
npx prisma generate
npx prisma db push
npx prisma db seed

# 2. 构建前端
cd ../frontend
npm install
npm run build

# 3. 启动服务
cd ../backend
npm start
```

### 访问系统
部署完成后，访问 `http://localhost:3001`

## 👤 默认账户

| 角色 | 用户名 | 密码 | 权限范围 |
|------|--------|------|----------|
| 超级管理员 | admin | Test123!@# | 全系统管理 |
| 厂区管理员 | factory_admin | Test123!@# | 所属厂区管理 |
| 点检员 | inspector | Test123!@# | 扫码点检 |

## 📱 功能特性

### 移动端 (一线点检员)
- **便捷登录** - 简化的移动端登录界面
- **扫码点检** - 调用摄像头扫描器材二维码
- **动态表单** - 根据器材类型自动加载检查项
- **异常上报** - 发现问题时拍照和描述上报
- **离线缓存** - PWA支持离线使用 (可选)

### PC端管理 (管理员)
- **实时看板** - 器材状态、点检统计、隐患数量
- **器材管理** - 台账管理、二维码生成、批量导入
- **隐患管理** - 处理流程、审核机制、状态追踪
- **数据报表** - 月度统计、趋势分析、导出功能
- **用户管理** - 账号创建、角色分配、权限控制

### 安全特性
- **JWT认证** - 无状态令牌机制
- **RBAC权限** - 基于角色的访问控制
- **数据隔离** - 厂区级数据权限隔离
- **输入验证** - 防止SQL注入和XSS攻击
- **审计日志** - 完整的操作记录追踪

## 📊 系统截图

### 移动端界面
| 登录页面 | 扫码首页 | 点检表单 |
|---------|---------|---------|
| ![登录](docs/images/mobile-login.png) | ![首页](docs/images/mobile-home.png) | ![点检](docs/images/mobile-check.png) |

### PC端管理界面
| 数据看板 | 器材管理 | 隐患处理 |
|---------|---------|---------|
| ![看板](docs/images/pc-dashboard.png) | ![器材](docs/images/pc-equipment.png) | ![隐患](docs/images/pc-issues.png) |

## 🛠️ 开发指南

### 目录结构
```
fire-safety-system/
├── backend/              # 后端应用
│   ├── src/             # 源代码
│   │   ├── controllers/ # 控制器
│   │   ├── services/    # 业务服务
│   │   ├── routes/      # 路由定义
│   │   └── middleware/  # 中间件
│   ├── prisma/          # 数据库模型
│   ├── uploads/         # 上传文件
│   └── public/          # 前端构建文件
├── frontend/            # 前端应用
│   ├── src/            # 源代码
│   │   ├── pages/      # 页面组件
│   │   ├── components/ # UI组件
│   │   ├── stores/     # 状态管理
│   │   └── api/        # API接口
│   └── dist/           # 构建输出
├── docs/               # 文档目录
└── deploy.*            # 部署脚本
```

### 开发环境启动
```bash
# 启动后端开发服务器
cd backend
npm run dev

# 启动前端开发服务器
cd frontend
npm run dev
```

### API文档
完整的API文档请查看: [API_DOCUMENTATION.md](backend/API_DOCUMENTATION.md)

## 🚦 系统管理

### PM2 进程管理
```bash
pm2 status          # 查看应用状态
pm2 logs            # 查看日志
pm2 restart all     # 重启应用
pm2 stop all        # 停止应用
pm2 delete all      # 删除应用
```

### 数据库管理
```bash
cd backend
npm run db:studio   # 打开数据库管理界面
npm run db:reset    # 重置数据库
npm run db:backup   # 备份数据库
```

### 日志查看
```bash
cd backend
tail -f logs/combined.log  # 查看应用日志
tail -f logs/err.log       # 查看错误日志
```

## 🔧 配置说明

### 环境变量
主要配置项说明 (`.env` 文件):

```env
# 应用配置
NODE_ENV=production          # 环境模式
PORT=3001                   # 服务端口

# 数据库配置
DATABASE_URL="file:../data/fire_safety.db"  # 与 secure-deploy 保持一致（数据库位于项目根 data/）

# JWT配置
JWT_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret"

# 文件上传配置
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=5242880       # 5MB

# 安全配置
RATE_LIMIT_WINDOW_MS=900000 # 15分钟
RATE_LIMIT_MAX_REQUESTS=100 # 最大请求数
```

## 📈 性能优化

### 前端优化
- Vite构建优化和代码分割
- 图片懒加载和压缩
- 组件级别的状态管理
- PWA缓存策略

### 后端优化
- 数据库查询优化和索引
- JWT无状态认证减少服务器负载
- 文件上传限制和安全处理
- PM2集群模式和负载均衡

## 🔒 安全措施

- **身份认证**: JWT令牌机制
- **权限控制**: 基于角色的访问控制
- **输入验证**: 严格的参数校验和过滤
- **文件安全**: 上传类型限制和内容检查
- **速率限制**: 防止暴力攻击
- **审计日志**: 完整的操作记录

### ✅ 验证与错误响应统一规范（新增）

后端已统一所有“数据验证失败”返回结构，便于前端一次性高亮表单错误并提升用户体验。

标准 422 验证失败响应格式：
```
HTTP 422
{
  "success": false,
  "code": "VALIDATION_ERROR",
  "message": "部分字段有误，请修改后再提交",
  "errors": [
    {
      "field": "email",            // 出错字段（点号表示嵌套路径）
      "code": "EMAIL_INVALID",      // 机器可读错误码
      "message": "邮箱格式不正确",   // 具体校验消息（可直接展示）
      "hint": "请输入有效邮箱，例如 user@example.com", // 可选友好提示
      "value": "abc@"              // 原始输入值（对敏感字段会脱敏）
    }
  ],
  "traceId": "b9d8...",             // 请求级追踪ID（响应头也会返回 X-Trace-Id）
  "timestamp": "2025-09-02T08:30:10.123Z"
}
```

主要改动要点：
- 统一使用 `errors` 数组（旧字段 `details` 已废弃）。
- 所有字段级错误补充 `code` 与 `hint`，便于前端做 i18n 和差异化展示。
- 统一 HTTP 状态码：语义校验失败使用 422。
- 每个请求附带 `traceId`，方便排障与日志关联。
- 新增文件 `backend/src/utils/validation-error.formatter.js` 负责格式化 & 脱敏。
- 新增中间件 `backend/src/middleware/trace-id.js` 自动注入追踪 ID。

常见字段错误码示例：
| 错误码 | 含义 |
|--------|------|
| FIELD_REQUIRED | 必填字段缺失/为空 |
| STRING_TOO_SHORT | 字符串长度不足 |
| STRING_TOO_LONG | 字符串超出最大长度 |
| EMAIL_INVALID | 邮箱格式错误 |
| URL_INVALID | URL 格式不正确 |
| PATTERN_NOT_MATCH | 未通过正则/格式校验 |
| VALUE_NOT_IN_ALLOWED_SET | 值不在允许枚举中 |
| NUMBER_TOO_SMALL / NUMBER_TOO_LARGE | 数值越界 |
| ARRAY_MIN_ITEMS | 数组元素不足 |
| DATE_TOO_EARLY / DATE_TOO_LATE | 日期不在允许范围 |

前端适配建议（已实现）：
1. 统一读取 `response.errors`，遍历并根据 `field` 映射到表单控件。  
2. 优先显示 `message`；如需多语言，用 `code` 查本地字典。  
3. 自动聚焦第一条错误；顶部汇总错误数量。  
4. 展示或记录 `traceId`，用于与后端日志对照。  
5. 对敏感字段（密码等）后端已脱敏，无需担心泄露。

前端新增能力摘要：
- 新增工具 `src/utils/validation.ts`：统一解析/聚焦/汇总字段错误。
- 改造组件：Profile、UserManagement、UserPermissionDialog、EquipmentDialog、EquipmentTypeDialog、EquipmentTypesPage、IssuePage、MobileInspectionPage、ImportModal 等。
- 表单统一在 422 响应时批量显示全部字段错误并自动聚焦第一个出错字段。

### ♻️ 路由层统一验证与重复校验移除（未发布）

为避免“同一请求被 Joi 解析两次”导致的伪错误（典型：日期字符串第一次被转成 Date，第二次再跑 `.iso()` 报 `date.base`），后端已将输入验证职责集中在路由层 `ValidationHelper.validateMiddleware`：

- 已清理的重复验证控制器：Equipment / User / Inspection / Issue。
- 新增：`PUT /api/users/:id` 增加路由级验证中间件，控制器去除内层验证。
- 规则：路由使用 `validateMiddleware` 后，控制器内不要再调用 `ValidationHelper.validate`；直接使用清洗后的 `req.body` / `req.query`。
- 好处：
  - 避免日期/格式“假阳性”错误。
  - 减少一次 schema 遍历提升性能。
  - 日志更干净，错误定位更单一。

开发建议：
1. 新增接口时先在路由加 `validateMiddleware(schema, 'body' | 'query')`。
2. 控制器里不再二次验证，仅做业务权限/存在性检查。
3. 如果确需在控制器做动态条件校验，优先扩展 schema（合并条件）而非再次调用 validate。


（如旧前端仍依赖 `details`，需同步升级，否则将无法获取字段列表。）

### 🚀 安全部署脚本摘要（secure-deploy.js）

| 能力 | 描述 |
|------|------|
| 非破坏性 | 不再强制 reset 数据库，使用 `migrate deploy` |
| 幂等执行 | 重复运行不清空数据，不重复种子 |
| 随机密钥 | 首次生成随机 JWT/刷新密钥 |
| HTTPS 协助 | 域名输入 / 证书检测 / certbot dry-run / 自签名可选 |
| PM2 管理 | 已有进程 reload，否则 start |
| 非交互模式 | 通过 `--non-interactive` + 环境变量用于 CI |
| 环境合并 | `.env` 仅补缺，不覆盖已有值 |
| 跨平台 | 纯 Node 实现，无 Bash 依赖 |

> 旧 `deploy.js` 保留用于回溯，不建议继续在生产使用。

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 🆘 技术支持

如遇到问题，请通过以下方式获取帮助:

1. **查看文档** - 首先查阅项目文档和API说明
2. **检查日志** - 查看应用和错误日志
3. **Issue反馈** - 在GitHub提交Issue
4. **技术交流** - 联系开发团队

---

## 📞 联系信息

- **项目地址**: [GitHub Repository]
- **技术文档**: [项目Wiki]
- **更新日志**: [CHANGELOG.md]

---

> 🔥 **消防安全，数字先行** - 让科技守护生命安全！
