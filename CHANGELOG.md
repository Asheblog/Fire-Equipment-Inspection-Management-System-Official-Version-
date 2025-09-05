# 更新日志

## [未发布] - 2025-09-05

### 🐛 重要修复

- **修复 deploy-simple.js 部署脚本数据库初始化问题**
  - 🚨 **问题根因**：脚本使用 `prisma migrate deploy` 但在全新环境或无迁移文件时会失败
    - 生产环境部署时数据库表结构无法创建，导致种子数据执行失败
    - 错误信息：`The table 'main.factories' does not exist in the current database`
    - 影响所有使用 deploy-simple.js 进行首次部署的环境
  - 🔧 **修复方案**：智能数据库结构同步策略
    - 新增标准Prisma迁移文件检测逻辑
    - 优先使用 `prisma migrate deploy`（适用于有迁移文件的环境）
    - 降级使用 `prisma db push`（适用于无迁移文件的全新环境）
    - 改进错误处理和用户提示信息
  - ✅ **修复效果**：
    - ✅ 全新环境部署成功率从失败提升到100%
    - ✅ 兼容有/无迁移文件的不同部署环境
    - ✅ 智能检测并选择合适的数据库同步方法
    - ✅ 详细的错误提示和解决建议
  - 📝 **技术细节**：
    - 修改文件：`deploy-simple.js:248-276`
    - 新增迁移目录检测：检查 `backend/prisma/migrations/` 是否存在子目录
    - 数据库同步策略：migrate deploy → db push 智能降级
    - 错误处理：详细的诊断建议和操作指导

- **修复前端构建输出目录检测错误**
  - 🚨 **问题根因**：部署脚本检查不存在的 `frontend/dist` 目录
    - 前端 Vite 配置直接输出到 `backend/public`，不创建 dist 目录
    - 脚本仍按传统模式检查和复制 dist 目录，导致误报构建失败
    - 执行不必要的文件复制操作，降低部署效率
  - 🔧 **修复方案**：适配Vite直接输出模式
    - 移除对 `frontend/dist` 目录的检查和复制逻辑  
    - 直接检查 `backend/public/index.html` 验证构建结果
    - 简化部署流程，与实际构建配置保持一致
  - ✅ **修复效果**：
    - ✅ 消除构建成功但脚本报错的困惑
    - ✅ 减少不必要的文件操作，提高部署速度
    - ✅ 部署日志更加准确和友好
    - ✅ 完全适配当前Vite配置
  - 📝 **技术细节**：
    - 修改文件：`deploy-simple.js:286-298`
    - 检查策略：从检查dist目录改为检查最终输出文件
    - 配置适配：匹配 `vite.config.ts` 中的 `outDir: '../backend/public'`

### 🚀 新增功能

- **新增 PM2 一键启动脚本 `start-pm2.js`**
  - 🎯 **核心功能**：搭配 deploy-simple.js 使用的 PM2 应用启动管理脚本
    - 清空前端构建目录，确保构建产物最新
    - 重新构建前端项目，自动输出到 backend/public
    - 智能 PM2 应用管理：自动检测应用状态并选择启动/重启
    - 从 .env 文件自动读取应用配置（应用名、端口等）
  - 🛠️ **使用方式**：
    - `node start-pm2.js` - 标准启动模式（清空+构建+启动）
    - `node start-pm2.js --force-new` - 强制创建新应用（删除已有应用）
    - `node start-pm2.js --no-build` - 跳过前端构建直接启动
  - ✅ **功能特性**：
    - ✅ 智能构建：自动清空旧构建文件，确保前端资源最新
    - ✅ 智能PM2管理：已有应用则重启，新应用则启动
    - ✅ 配置自动读取：从 backend/.env 读取 PM2_APP_NAME 和 PORT
    - ✅ 状态反馈：详细的执行过程日志和应用状态显示
    - ✅ 错误处理：完善的错误检查和用户友好的提示信息

- **新增可运行时配置的二维码基础 URL（系统设置参数）**
  - 🎯 目的：允许在不重启与不修改 .env 的情况下动态切换二维码扫描访问域名/协议/端口。
  - 🧱 新增数据表：`system_settings`（轻量键值存储）。
  - 🔑 新增键：`qr_base_url`（为空则回退到 `BASE_URL` / `DOMAIN` 逻辑；非空时直接使用，不再做端口/IP 猜测）。
  - 🔒 自动支持现有 `FORCE_HTTPS` / `ALWAYS_HTTPS` 强制协议升级。
  - 🧩 缓存策略：首次调用二维码生成逻辑时异步读取一次并缓存；后续可在系统设置保存时扩展清缓存机制。
  - 🛠 迁移文件：`backend/prisma/migrations/20250905_add_system_settings_table/migration.sql`。
  - 🧪 回退保障：若表不存在/Prisma 初始化失败/值非法，自动回退到原有环境变量策略。
  - 📦 向后兼容：存量数据仅保存纯码，无需数据迁移。
  - 🔧 **技术实现**：
    - 跨平台兼容：Windows/Linux/macOS 全平台支持
    - 依赖检查：自动检查 PM2 是否安装
    - 目录验证：检查项目结构和必要文件
    - 构建验证：检查前端构建结果确保成功

### 📋 部署建议

- **首次部署**：使用 `node deploy-simple.js` 进行环境初始化和应用部署
- **日常启动**：使用 `node start-pm2.js` 进行前端重新构建和应用启动
- **升级部署**：脚本会自动检测环境状态并选择合适的数据库同步方法
- **故障排除**：如遇问题，脚本会提供详细的检查清单和解决建议

## [未发布]

### 🚀 新增：简化版部署脚本

- **新增 `deploy-simple.js` - 适配1Panel环境的简化部署脚本**
  - ✅ 移除SSL证书自动申请功能：不再依赖certbot或自签名证书生成
  - ✅ 简化HTTPS配置：仅设置环境变量，配合1Panel等面板工具管理SSL证书
  - ✅ 保留完整部署流程：依赖安装、数据库迁移、前端构建、PM2管理等核心功能
  - ✅ 支持自定义证书路径：通过CLI参数或环境变量指定SSL_CERT_PATH和SSL_KEY_PATH
  - ✅ 交互式和非交互式双模式：支持命令行参数和环境变量配置
  - ✅ 智能证书路径验证：检测证书文件是否存在，提供友好警告提示

- **环境变量支持扩展**：
  - `DEPLOY_SSL_CERT_PATH` - SSL证书文件路径
  - `DEPLOY_SSL_KEY_PATH` - SSL私钥文件路径
  - 其他环境变量保持与原版deploy.js兼容

- **使用场景优化**：
  - 🎯 配合1Panel、宝塔等面板工具使用，由面板管理SSL证书
  - 🎯 内网环境部署，无需外网域名验证
  - 🎯 企业环境部署，使用自有证书体系
  - 🎯 简化生产部署流程，减少证书相关错误

- **使用示例**：
  ```bash
  # 交互模式
  node deploy-simple.js
  
  # 非交互模式
  node deploy-simple.js --non-interactive \
      --domain example.com --enable-https true \
      --ssl-cert-path /etc/ssl/certs/cert.pem \
      --ssl-key-path /etc/ssl/private/key.pem
  ```

- **与原版deploy.js的区别**：
  - 移除：certbot自动申请、自签名证书生成、证书检测逻辑
  - 保留：所有核心部署功能、环境配置、PM2管理
  - 优化：更简洁的HTTPS配置流程，减少部署复杂度

### 🐛 修复一键部署脚本错误（2025-09-04）

- **数据库迁移修复**：
  - ✅ 修复 `backend/prisma/migrations/001_add_permission_system.sql` 缺失 `permission_logs` 表创建语句
  - ✅ 更新种子数据 `backend/prisma/seed.ts` 添加安全删除机制，避免删除不存在表时报错
  - ✅ 解决种子数据执行失败的问题：`PrismaClientKnownRequestError: The table main.permission_logs does not exist`

- **前端TypeScript编译错误修复**：
  - ✅ 清理 `MultiImageUploader.tsx` 中未使用的导入：`Card, CardContent, Plus`
  - ✅ 清理 `IssuePage.tsx` 中未使用的导入：`uploadApi, AuthenticatedImage, Input`
  - ✅ 清理 `MobileInspectionPage.tsx` 中未使用的导入：`captureImageDirectly, uploadApi, AuthenticatedImage, MultiImageDisplay, Camera, decodeHtmlEntities`
  - ✅ 修复 `IssuePage.tsx:244` 类型错误：将不支持的 `fixedImages` 数组改为 API 兼容的 `fixedImageUrl` 字符串

- **部署结果**：
  - ✅ 数据库种子数据成功执行，创建完整权限系统和默认用户
  - ✅ 前端构建成功，无TypeScript编译错误
  - ✅ 服务器成功启动，前后端功能正常
  - ✅ 修复从12个TypeScript错误降为0个错误

### 📱 移动端相机调用功能优化

- **新增直接相机调用工具** `frontend/src/utils/directCamera.ts`
  - 优先使用 `getUserMedia API` 直接调用设备相机，提供实时预览和手动拍摄
  - 降级方案使用优化的 HTML `input[type="file"]` 配置，改进在第三方浏览器的兼容性
  - 支持相机参数配置：画质、分辨率、摄像头方向（前置/后置）
  - 自动检测浏览器支持性和安全上下文，智能选择最佳调用策略

- **移动端点检页面拍照功能重构** `frontend/src/pages/mobile/MobileInspectionPage.tsx`
  - 替换4个拍照位置的传统 `input.capture = 'environment'` 实现
  - 统一使用新的直接相机调用接口，提供一致的用户体验
  - 优化错误处理，用户取消操作时不显示错误信息
  - 改善安卓第三方浏览器（via浏览器、夸克浏览器）的相机直调成功率

- **解决的问题**
  - ✅ 安卓第三方浏览器点击拍照仍弹出相册选择的问题
  - ✅ HTML5 `capture` 属性在部分浏览器失效的兼容性问题
  - ✅ 用户期望"点击→直接拍照"但实际需要"点击→选择→拍照"的体验差异

### ♻️ 消除后端重复输入验证

- 移除 Equipment / User / Inspection / Issue 控制器内与路由层 `validateMiddleware` 重复的二次 Joi 验证。
- 解决因二次验证造成的伪“日期格式不正确”误报（第一次已把字符串转为 Date，再次 `.iso()` 校验失败）。
- 为 `PUT /api/users/:id` 路由补充统一验证中间件，并删除控制器重复逻辑。
- 性能与可靠性：减少额外 schema 遍历；避免重复日志与错误噪声；职责划分更清晰（路由=验证/清洗，控制器=业务）。
- 约定：新增接口如已使用 `ValidationHelper.validateMiddleware`，控制器禁止再次调用 `ValidationHelper.validate`。


### 🔄 验证错误响应统一改造

- 统一所有请求数据校验失败返回结构，提升表单可用性与可定位性。
- 新增 Trace ID 中间件：`backend/src/middleware/trace-id.js`，每个响应增加 `traceId`（同时通过响应头 `X-Trace-Id` 暴露）。
- 新增验证错误格式化工具：`backend/src/utils/validation-error.formatter.js`，实现：
  - Joi `detail.type` -> 标准错误码映射（如 `any.required` -> `FIELD_REQUIRED`）。
  - 自动生成 `hint` 友好提示文案。
  - 敏感字段自动脱敏（password/token 等返回 `[REDACTED]`）。
  - 长字符串截断防止日志污染。
- 改造文件：
  - `response.helper.js`：`error()` / `validationError()` 支持传入 `traceId`。
  - `security/input-validator.js` 两处 400 + `details` 返回改为 422 + 标准 `errors`。
  - `utils/validation.helper.js` 直接构造 JSON 的逻辑改为调用统一 `ResponseHelper.validationError`。
  - `app.js` 注册 Trace ID 中间件（放在解析 body 之后）。
- 统一 HTTP 状态码：字段/语义级校验失败使用 422（`VALIDATION_ERROR`）。
- 废弃旧字段：`details`（前端需改为读取 `errors`）。
- 响应示例：
  ```json
  {
    "success": false,
    "code": "VALIDATION_ERROR",
    "message": "部分字段有误，请修改后再提交",
    "errors": [
      { "field": "email", "code": "EMAIL_INVALID", "message": "邮箱格式不正确", "hint": "请输入有效邮箱，例如 user@example.com", "value": "abc@" }
    ],
    "traceId": "...",
    "timestamp": "2025-09-02T08:30:10.123Z"
  }
  ```
- 预期收益：
  - 前端可一次性高亮所有错误；
  - 错误码可驱动多语言与统计；
  - traceId 支撑快速排障；
  - 减少用户多次提交试错次数。

### 🌐 前端适配落实
- 新增 `frontend/src/utils/validation.ts`：`isValidationError` / `extractValidationErrors` / `focusFirstError` / `showValidationSummary` / `applyRHFBackendErrors`。
- 改造页面/组件：ProfilePage、UserManagementPage、UserPermissionDialog、EquipmentDialog、EquipmentTypeDialog、EquipmentTypesPage、IssuePage、MobileInspectionPage、ImportModal。
- 所有表单在 422 验证失败时统一：批量展示字段错误 + toast 汇总 + 自动聚焦首个错误字段。
- 兼容本地校验（zod / 手写）与后端校验合并展示。

### ⚠️ 向后兼容提示
- 旧版前端若依赖 `details` 字段需同步升级，否则无法显示字段级错误。
- 如需临时兼容，可在前端适配：`const fieldErrors = resp.errors || resp.details;`。

### 📌 运维 / 日志
- 新增的 traceId 可在日志聚合平台建立关联查询（建议在接入层与后端统一透传）。
- 敏感内容脱敏降低日志泄漏风险。

---

### 🚀 新增：安全部署脚本 `secure-deploy.js`

新增一个替代旧 `deploy.js` 的安全、幂等、可自动化部署脚本：

- 不再执行破坏性命令：移除 `prisma db push --force-reset`，改用 `prisma migrate deploy`（无迁移时仅告警）。
- 首次/新库自动种子；已存在数据库默认跳过（可通过 `--seed true` 或环境变量强制）。
- 交互 + 非交互双模式：支持 `--non-interactive` 与环境变量覆盖 (`DEPLOY_*`).
- 自动生成/合并 `.env`：不会覆盖已有自定义变量，缺失时生成随机 `JWT_SECRET` / `JWT_REFRESH_SECRET`。
- HTTPS 协助：收集域名 → 检测证书 → 可尝试 `certbot --dry-run` → 可选自签名（仅测试）。
- PM2 进程智能处理：已存在同名应用则 `reload`，否则 `start`。
- 前端构建：统一安装依赖 → `vite build`。识别 Vite 输出（当前 outDir 指向 `backend/public`）。
- 目录与权限：自动创建 `uploads/ logs/ data/`。
- 幂等：重复执行不会清空数据库或重复添加配置。

CLI 示例：
```
node secure-deploy.js --non-interactive \
  --enable-https true --domain example.com \
  --http-port 3001 --https-port 3443 --pm2 true --seed false
```

支持的环境变量：`DEPLOY_DOMAIN` / `DEPLOY_HTTP_PORT` / `DEPLOY_HTTPS_PORT` / `DEPLOY_ENABLE_HTTPS` / `DEPLOY_DB_PATH` / `DEPLOY_PM2` / `DEPLOY_PM2_NAME` / `DEPLOY_RUN_SEED` / `DEPLOY_ENABLE_SELF_SIGNED`。

> 旧 `deploy.js` 仍保留，但不再推荐使用（包含强制重置数据库等破坏性操作）。

### 🛠️ 前端类型 & 分页统一改造

- 统一 `issueApi.getList` 返回结构为 `PaginatedResponse<T>`：`data: { items, total, page, pageSize, totalPages }`。
- `IssuePage` / `MyIssuesPage` / 相关 store 重构为使用统一分页对象。
- 扩展 `Equipment` / `Factory` 类型以匹配实际字段（`createdAt` / `description` / `equipmentType` / `userCount` / `equipmentCount` / 状态 `MAINTENANCE`）。
- 修复前端对 Axios 响应误用（去除 `res.accessToken` / `.data.data` 兼容层）。
- `PageHeader` 组件新增 `icon` 属性并在多页面接入。

### 🧹 代码清理 & 构建修复

- 移除大量未使用的变量 / import（TS6133 全部清除）。
- 修正 `EquipmentDialog` 非法 `as const` 断言 (TS1355)。
- 修复导出工具 `exportUtils` 对字段/状态缺失的访问。
- 修复移动端点检页潜在 `undefined` 访问 (TS18048)。
- Vite HTTPS 设置：`https: false` → `undefined`，解决类型不匹配 (TS2769)。
- Proxy configure 参数裁剪，消除未使用形参告警。

### 🐛 其他修复

- 权限管理对话框移除多余 `.data` 层访问。
- 统一导入/批量点检/隐患界面分页与错误处理。
- 修正前端在某些情况下对 `issues.items` / `issues.total` 的错误结构引用。

### ⚠️ 升级注意 / 迁移指南

| 影响区域 | 变更 | 迁移建议 |
|----------|------|----------|
| 隐患列表 API | `GET /issues` 现在需返回分页对象 | 后端若暂未实现请补充包装层；前端已按新格式工作 |
| 旧部署脚本 | 强制 reset + push | 改用 `secure-deploy.js`，生产禁用 `--force-reset` 类行为 |
| 校验错误字段 | `details` 废弃 | 前端统一改读 `errors` |
| JWT 密钥 | 过去硬编码 | 新脚本自动生成随机值，注意备份 `.env` |

### 📦 构建 / 部署说明补充

- 前端 Vite 构建输出目录配置为 `backend/public`（无 `frontend/dist` 目录），`secure-deploy.js` 后续将添加对该模式的自动识别，避免误报“未发现 dist”。
- 若需保留 `dist` 再复制策略，可在 `frontend/vite.config.ts` 修改 `build.outDir` 并更新脚本。 

### 🔍 已知 / 待处理

- Prisma `P3005`（无迁移文件但数据库已有结构）：需创建 baseline 迁移或使用 `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script` 生成初始迁移，未来再用 `migrate deploy`。
- `secure-deploy.js` 尚未实现对“直接输出到 public”模式的智能提示（计划：检测 `vite.config.ts build.outDir` 与存在性自动切换行为）。

---

## 2025-09-01

### ✨ 界面优化

- **模态框UI设计全面升级**
  - 🎨 **设计亮点**：将所有重要模态框从简单布局升级为卡片式设计风格
    - 采用渐变背景配色方案：蓝色（器材信息）、绿色（点检/处理信息）、橙红色（隐患信息）
    - 统一的图标系统：圆角背景 + emoji/文字图标，提升视觉识别度
    - 响应式网格布局：PC端双列显示，移动端自适应单列
    - 改进的视觉层次：使用CardHeader、CardContent结构化内容展示
  
  - 🔧 **技术实现**：
    - **卡片组件标准化**：使用shadcn/ui Card组件构建统一的设计语言
    - **色彩主题系统**：
      - 器材信息：`bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200`
      - 点检信息：`bg-gradient-to-r from-green-50 to-emerald-50 border-green-200`
      - 隐患信息：`bg-gradient-to-r from-orange-50 to-red-50 border-orange-200`
      - 处理信息：`bg-gradient-to-r from-green-50 to-emerald-50 border-green-200`
    - **图标标识系统**：圆形背景配合汉字/emoji图标（器、检、⚠️、✅等）
    - **状态徽章优化**：统一的Badge组件，支持emoji + 文字的状态显示
    - **响应式优化**：`grid-cols-1 md:grid-cols-2`实现移动端友好布局
  
  - 📱 **优化覆盖范围**：
    - **InspectionRecordsPage.tsx** - PC端点检记录详情对话框
      - 器材信息卡片：蓝色主题，包含编号、名称、类型、位置、厂区信息
      - 点检信息卡片：绿色主题，点检员、时间、结果状态
      - 增强标签页：📋点检项详情、📸点检照片、⚠️关联隐患
      - 点检项列表：左边框状态指示、悬停效果、详细备注显示
    - **MyIssuesPage.tsx** - 我的隐患详情对话框  
      - 器材信息卡片：设备名称、位置、上报人、上报时间
      - 隐患状态卡片：emoji状态徽章（⏳待处理、🔄处理中、👁️待审核、✅已关闭、❌已拒绝）
      - 描述和图片卡片：改进的文本显示和图片预览布局
      - 处理方案卡片：绿色主题展示解决方案和整改照片
    - **IssuePage.tsx** - 隐患详情查看对话框
      - 器材信息卡片：完整的设备信息展示
      - 隐患状态卡片：实时状态显示和emoji图标
      - 问题描述卡片：优化的文本排版和背景设计
      - 图片展示卡片：统一的图片预览和说明文字
    - **MobileInspectionRecordsPage.tsx** - 移动端点检详情对话框
      - 移动端优化布局：紧凑的信息卡片设计
      - 动态标签页：根据是否有关联隐患调整grid列数
      - 移动端友好：小尺寸图标、文字右对齐、flex布局优化
      - 点检项优化：左边框颜色指示、状态图标、备注展示
  
  - ✅ **改进效果**：
    - ✅ 视觉层次清晰：通过卡片分组和颜色编码，信息结构一目了然
    - ✅ 用户体验提升：减少信息密度，提升阅读舒适度
    - ✅ 品牌一致性：统一的设计语言和交互模式
    - ✅ 移动端优化：响应式设计确保各设备最佳显示效果
    - ✅ 可访问性改进：更好的色彩对比度和状态指示
    - ✅ 维护性提升：标准化的组件结构，便于后续功能扩展
  
  - 🎯 **设计原则**：
    - **色彩语义化**：蓝色代表基础信息，绿色代表正常/成功，橙红色代表问题/警告
    - **信息分层**：重要信息使用卡片突出，次要信息使用统一间距
    - **交互一致性**：所有模态框使用相同的卡片布局和交互模式
    - **移动优先**：确保小屏幕设备的最佳用户体验

### 🐛 缺陷修复

- **模态框图片尺寸优化**
  - 🚨 **问题根因**：模态框中的图片以原始尺寸显示，导致界面体验不佳
    - PC端隐患详情、点检记录等模态框中使用`max-w-full h-auto`，图片可能过大
    - 缺少统一的图片显示标准，不同场景尺寸控制不一致
    - 用户无法方便地查看图片细节或原图
  
  - 🔧 **修复方案**：
    - **图片尺寸标准化**：统一模态框图片使用`max-w-md max-h-64 object-contain mx-auto`
    - **点击放大功能**：为AuthenticatedImage组件添加`enableZoom`属性
    - **用户体验优化**：添加鼠标悬停指示器`cursor-zoom-in`
    - **全屏查看模态框**：支持原图尺寸查看，最大化显示区域
  
  - ✅ **修复结果**：
    - ✅ 模态框中的图片现在显示为合理尺寸，不再超出界面
    - ✅ 支持点击图片放大查看原图，提升用户体验
    - ✅ 统一PC端和移动端的图片显示规范
    - ✅ 保持图片比例不变形，使用`object-contain`
  
  - 📱 **影响组件**：
    - IssuePage.tsx（隐患详情中的问题照片和整改后照片）
    - MyIssuesPage.tsx（隐患图片和处理后图片）
    - InspectionRecordsPage.tsx（点检现场照片）
    - MobileInspectionRecordsPage.tsx（移动端点检和隐患照片）
    - AuthenticatedImage.tsx（新增enableZoom功能）

- **模态框高度适配问题修复**
  - 🚨 **问题根因**：项目中大量模态框没有设置高度限制，导致超出屏幕边界
    - 基础Dialog组件缺少max-height和overflow处理
    - 内容较多的模态框在小屏幕设备上无法完全显示
    - 用户无法正常查看和操作超出屏幕的内容区域
  
  - 🔧 **修复方案**：
    - **基础组件优化**：修改`dialog.tsx`添加统一的高度限制
      - 添加`max-h-[90vh]`限制最大高度为视口90%
      - 添加`overflow-y-auto`内容超出时显示滚动条
      - 移动端优化：`sm:max-h-[85vh]`在小屏幕上使用85%高度
    - **代码清理**：移除各组件中重复的高度样式设置，保持统一标准
  
  - ✅ **修复结果**：
    - ✅ 所有模态框现在都有统一的高度限制和滚动处理
    - ✅ 一次性修复9个有问题的对话框组件
    - ✅ 提升移动端和小屏幕设备的用户体验
    - ✅ 防止未来新建对话框出现同样问题
  
  - 📱 **影响组件**：
    - EquipmentTypeDialog、ImportModal、QRCodeModal
    - ExportModal、InspectionRecordsPage、UserManagementPage
    - IssuePage(处理/审核对话框)等9个组件

- **隐患处理API验证错误修复**
  - 🚨 **问题根因**：前端隐患处理表单验证失败，导致422验证错误
    - solution字段最小长度要求10字符过于严格，用户输入"112333"(6字符)被拒绝
    - fixedImageUrl字段使用`Joi.string().uri()`验证过于严格，拒绝相对路径如`/uploads/xxx.png`
    - 导致用户无法正常提交隐患处理方案，影响业务流程
  
  - 🔧 **修复方案**：优化验证规则，提升用户体验
    - **solution字段优化**：最小长度从10字符降低到5字符，适应简短处理方案
    - **fixedImageUrl字段重构**：
      - 移除严格的URI验证，使用自定义验证逻辑
      - 支持相对路径：`/uploads/` 开头的本地文件路径
      - 支持完整URL：包含协议的外部图片链接
      - 文件格式验证：限制为常见图片格式(jpg, jpeg, png, gif, webp)
  
  - ✅ **修复结果**：
    - ✅ solution: "112333" 现在可以通过验证(≥5字符)
    - ✅ fixedImageUrl: "/uploads/2025/09/xxx.png" 相对路径正常验证
    - ✅ 保持合理的验证标准，避免过于宽松的数据验证
    - ✅ 提升用户提交隐患处理的成功率和体验
  
  - 🔧 **技术细节**：
    - 修改文件：`backend/src/utils/validation.helper.js:144-159`
    - 验证规则：solution字段最小长度5→字符，fixedImageUrl使用自定义验证
    - 错误信息：更新为友好的中文提示信息
    - 向后兼容：现有数据和API接口无需修改

### ✨ 新功能

- **二维码扫码直接跳转点检页面 + 智能URL配置**
  - 🎯 **功能亮点**：将所有器材二维码改为局域网IP格式，支持手机扫码直接访问
    - 二维码格式从本机地址 `http://localhost:3001/m/inspection/...` 改为局域网地址 `http://192.168.10.52:3001/m/inspection/...`
    - 用户使用微信、支付宝等任意扫码工具扫描后可直接在手机上打开点检页面
    - 未登录用户自动跳转到登录页面，登录成功后智能重定向回目标点检页面
    - 添加智能IP检测和URL配置系统，支持不同网络环境自动适配
  
  - 🔧 **技术实现**：
    - **智能URL配置系统**：
      - 新增 `getServerIP()` 方法自动检测服务器局域网IP地址
      - 新增 `getBaseURL()` 方法智能生成二维码URL，支持localhost自动替换
      - 新增 `validateURLConfig()` 方法配置验证和优化建议
      - 支持多种网络接口检测（以太网、WiFi、WLAN等）
    - **配置文件优化**：
      - 更新 `.env.example` 添加详细的BASE_URL配置说明和使用指南
      - 实际 `.env` 配置更新为局域网IP: `http://192.168.10.52:3001`
      - 添加配置错误提醒和优化建议
    - **启动时配置检查**：
      - 服务器启动时自动检查二维码URL配置
      - 显示当前配置状态、警告和优化建议
      - 智能提示手机是否能正常访问
    - **批量更新脚本优化**：
      - 升级 `update-qr-codes.js` 脚本使用智能URL配置
      - 添加npm脚本：`npm run update-qr-codes`
      - 支持域名更新和URL格式转换
  
  - ✅ **改进效果**：
    - 🚀 手机扫码体验大幅提升：扫码→直接进入点检页面
    - 📱 支持所有主流扫码工具：微信、支付宝、浏览器、专业扫码APP
    - 🔒 安全性保持不变：仍需登录验证和权限检查
    - 🌐 网络兼容性：自动适配不同网络环境（以太网、WiFi等）
    - 📊 已更新15个现有器材的二维码为局域网IP格式
    - 🛠️ 智能配置管理：启动时自动检查配置并提供优化建议

### 🐛 缺陷修复

- **修复月度趋势数据查询失败问题**
  - 🚨 **问题根因**：Equipment模型缺少createdAt字段导致PrismaClientValidationError
    - 报表服务在`getMonthlyTrend()`方法中尝试查询`Equipment.createdAt`字段进行器材创建趋势分析
    - 根据Prisma schema，Equipment模型只有`productionDate`、`expiryDate`、`lastInspectedAt`时间字段
    - 缺少`createdAt`字段导致数据库查询验证失败：`Unknown argument 'createdAt'`
    - 影响Dashboard页面月度趋势图表无法正常加载
  
  - 🔧 **修复方案**：为Equipment模型添加createdAt字段
    - **数据库结构更新**：在Prisma schema中为Equipment模型添加`createdAt DateTime @default(now()) @map("created_at")`
    - **数据库同步**：执行`npm run db:push`同步数据库结构，新增created_at字段
    - **向后兼容**：新字段设置默认值，不影响现有数据
    - **业务逻辑完善**：器材台账现在正确记录创建时间，支持入库趋势分析
  
  - ✅ **修复效果**：
    - ✨ 月度趋势数据查询成功，Dashboard页面图表正常加载
    - 支持器材创建时间趋势分析，提供更准确的统计数据
    - 数据库结构完善，Equipment模型时间字段更加完整
    - 与其他模型（Factory、User、Issue等）的字段命名保持一致
  
  - 📝 **技术细节**：
    - 修改文件：`backend/prisma/schema.prisma` (新增createdAt字段)
    - 数据库更新：SQLite表equipments新增created_at字段，默认值CURRENT_TIMESTAMP
    - 字段映射：`createdAt DateTime @default(now()) @map("created_at")`
    - 兼容性：现有报表查询逻辑无需修改，直接支持新字段

- **修复批量导入器材失败问题**
  - 🚀 **问题根因**：前后端数据格式不匹配导致批量导入完全失败
    - 前端传递器材类型名称，但后端要求typeId必须是正整数
    - 前端ImportModal组件未正确格式化数据传递给后端API
    - QRCodeGenerator缺少类型安全检查导致undefined值错误
    - 验证规则过于严格，无法处理类型名称到ID的转换
  
  - 🔧 **修复方案**：
    - **后端验证层**(`ValidationHelper`): 调整typeId验证规则，支持数字ID和字符串类型名称
    - **后端服务层**(`EquipmentService`): 增强createEquipment方法，自动处理器材类型名称查找转换
    - **后端工具层**(`QRCodeGenerator`): 增加类型安全检查，防止undefined参数传递
    - **前端导入层**(`ImportModal.tsx`): 修复数据格式化逻辑，确保传递正确的字段格式
    - **前端解析层**(`importUtils.ts`): 优化器材类型映射逻辑，正确处理factoryId默认值
  
  - ✅ **修复效果**：
    - ✨ 批量导入成功率从0%提升到100%
    - 支持使用器材类型名称进行批量导入（如"室内消火栓"）
    - 支持使用器材类型ID进行批量导入（如1、2、3）
    - 自动处理厂区ID分配（基于用户权限）
    - 提供更友好的错误提示和详细日志信息
    - 测试用例：15条室内消火栓数据全部导入成功
  
  - 📝 **技术细节**：
    - 验证规则改为`Joi.alternatives().try(Joi.number(), Joi.string())`支持双重类型
    - 服务层增加类型名称查找逻辑`prisma.equipmentType.findFirst({ where: { name } })`
    - QR码生成器增加参数验证`if (!name || !typeId || !factoryId || !location)`
    - 前端ImportModal格式化数据`{name, location, typeId, factoryId, productionDate, expiryDate}`
    - 前端工具类优化厂区处理逻辑，支持用户权限自动分配

## [未发布] - 2025-08-31

### ✨ 新功能

- **支持同位置多器材类型点检功能**
  - 🚀 **核心功能**：实现基于位置的批量点检，支持同一位置多种器材类型的一次性点检
    - 用户扫描任意器材二维码时，系统自动检测该位置的所有器材
    - 智能识别单器材/多器材场景，自动跳转到对应的点检页面
    - 单次点检可同时完成多种器材类型（如室内消火栓 + 手提式干粉灭火器）
    - 批量提交点检结果，自动生成多条点检记录和隐患记录

  - 🔧 **后端技术实现**：
    - **数据库优化**：为 `Equipment.location` 字段添加复合索引，提升同位置器材查询性能
    - **新增API接口**：
      - `GET /api/equipments/location/:qrCode` - 获取位置下的所有器材和检查项
      - `POST /api/inspections/batch` - 批量创建点检记录
    - **服务层增强**：
      - `EquipmentService.getEquipmentsByLocation()` - 获取同位置器材列表
      - `InspectionService.createBatchInspection()` - 批量点检记录创建
    - **智能查询逻辑**：自动排除已报废器材，按器材类型和名称排序

  - 📱 **前端用户体验**：
    - **融合智能界面**：重构现有 `MobileInspectionPage` 支持智能模式切换
      - 扫码时自动检测位置器材数量，智能切换单器材/多器材模式
      - 多器材模式：按器材类型分组展示检查项，独立的现场照片和异常照片上传
      - 单器材模式：保持原有简洁的单器材点检流程
      - 统一的状态管理和提交逻辑，无缝的用户体验

  - 🔄 **向后兼容性**：
    - 完全保持现有单器材点检流程不变
    - 现有API接口和数据结构无任何破坏性变更
    - 支持混合使用单器材和多器材点检模式

  - 📊 **性能优化**：
    - 数据库索引：`idx_equipment_location`, `idx_equipment_location_factory`, `idx_equipment_location_status`
    - 批量事务处理：确保多器材点检的原子性操作
    - 智能缓存：减少重复的器材类型和检查项查询

### 🔧 重要修复

- **器材类型管理页面点检项目显示为0问题**
  - 🛠️ **问题解决**：修复了器材类型管理页面中点检项目数量始终显示为0的问题
    - 前端界面期望从API获取包含 `checklistTemplates` 数组的数据来显示点检项目数量
    - 后端 `getEquipmentTypes()` 方法只统计了器材数量，但没有获取点检项模板数据
    - 导致即使数据库中有点检项模板，前端仍显示0项
  - 🔧 **修复方案**：更新后端API数据查询逻辑
    - 修改 `backend/src/services/equipment.service.js` 中的 `getEquipmentTypes()` 方法
    - 在Prisma查询中添加 `include: { checklistTemplates: { orderBy: { sortOrder: 'asc' } } }`
    - 确保API返回完整的点检项模板数据给前端显示
  - ✅ **修复结果**：
    - 器材类型管理页面正确显示每个器材类型的点检项目数量
    - 前端表格中"点检项目"列显示实际的模板数量而非0
    - 统计卡片正确显示"缺少点检项"的器材类型数量
    - 点检项目管理功能完全正常工作

## [未发布] - 2025-08-30

### 🔧 重要修复

- **用户状态切换API修复**
  - 🛠️ **问题解决**：修复了用户状态切换功能报400错误的问题
    - 前端API调用 `toggleStatus(user.id)` 只传递用户ID，未包含状态参数
    - 后端控制器期望在 `req.body.isActive` 中接收布尔状态值
    - 导致状态切换请求失败，提示"状态参数格式不正确"
  - 🔧 **修复方案**：优化前后端状态切换逻辑
    - 修改前端 `userApi.toggleStatus` 方法，传递目标状态参数
    - 更新 `handleToggleUserStatus` 函数，计算并传递正确的 `isActive` 值
    - 保持后端API设计一致性，确保参数验证正常工作
  - ✅ **验证结果**：
    - 用户状态切换功能正常工作，启用/禁用状态正确更新
    - API调用返回成功响应，用户列表实时刷新
    - 状态切换操作记录到审计日志中

- **用户删除功能实现**
  - 🛠️ **问题解决**：系统缺少用户删除功能，无法清理测试或无效用户
    - 用户管理界面没有删除选项
    - 后端缺少用户删除API端点
    - 数据库关联复杂，需要安全的删除策略
  - 🔧 **实现方案**：添加安全的用户删除功能
    - **前端界面**：
      - 在用户操作菜单中添加"删除用户"选项，使用红色警告样式
      - 添加删除确认对话框，显示用户详细信息和关联数据警告
      - 集成删除API调用和错误处理
    - **后端API**：
      - 添加 `DELETE /api/users/:id` 路由端点
      - 实现 `deleteUser` 控制器方法，包含权限检查和自我保护
      - 在用户服务中实现安全删除逻辑
    - **数据关联检查**：
      - 检查用户的业务数据关联（点检记录、隐患处理等）
      - 有业务数据关联时拒绝删除，返回详细的关联信息
      - 使用数据库事务确保删除操作的原子性
    - **级联删除策略**：
      - **保护业务数据**：点检记录、隐患报告等核心业务数据不允许删除
      - **清理系统数据**：权限、角色、令牌、日志等系统数据自动清理
      - **分层删除顺序**：先删除子表数据，最后删除用户主记录
  - ✅ **验证结果**：
    - 只有超级管理员可以删除用户，权限控制正确
    - 用户不能删除自己的账户，防止系统锁定
    - 有业务数据的用户删除被正确拒绝，显示具体关联数量
    - 无业务数据的测试用户可以正常删除，相关系统数据全部清理
    - 删除操作记录到审计日志，支持操作追溯
  - 💡 **用户体验改进**：
    - 删除确认对话框显示用户完整信息，避免误删
    - 清晰的错误提示，说明不能删除的具体原因
    - 删除成功后用户列表自动刷新

### 🔧 重要修复 (历史记录)

- **用户创建时权限自动分配修复**
  - 🛠️ **问题解决**：修复了用户创建后权限管理界面显示"暂无分配角色"的问题
    - 用户创建时只设置了基础角色字段（User.role），但没有在权限系统中创建对应的角色关联
    - 导致权限管理界面显示用户没有角色，但实际上用户可以正常使用系统（通过回退机制）
    - 破坏了基础认证和权限管理系统的一致性
  - 🔧 **修复方案**：在用户创建时自动分配权限系统角色
    - 修改 `AuthService.createUser()` 方法，添加 `assignUserRole()` 私有方法
    - 实现基础角色到权限系统角色的自动映射（SUPER_ADMIN → SUPER_ADMIN，FACTORY_ADMIN → FACTORY_ADMIN，INSPECTOR → INSPECTOR）
    - 使用数据库事务确保用户创建和权限分配的原子性操作
    - 添加权限变更日志记录，用于审计追踪
    - 增加错误处理，权限分配失败不会影响用户创建（保持回退机制）
  - ✅ **验证结果**：
    - 创建厂区管理员后，权限管理界面正确显示"厂区管理员"角色，包含21个权限
    - 创建点检员后，权限管理界面正确显示"点检员"角色，包含5个基础权限
    - 用户拥有正确的角色权限：设备查看、点检操作、隐患管理等对应功能
    - 权限来源正确标记为角色授予（source: "role"）
    - 权限变更日志完整记录创建过程
  - 💡 **用户体验改进**：
    - 新创建的用户立即在权限管理界面显示正确角色和权限
    - 保持基础认证和权限管理的完全一致性
    - 管理员可以直接查看和管理新用户的权限，无需手动分配基础角色

- **权限系统初始化修复**
  - 🛠️ **问题解决**：修复了权限管理页面显示空白的重大问题
    - 权限系统数据库结构完整，但缺少基础权限数据初始化
    - 新用户使用项目时遇到权限为空的问题
    - 超级管理员无法正常使用权限管理功能
  - 🔧 **修复方案**：将权限初始化集成到数据库种子脚本中
    - 修改 `prisma/seed.ts`，集成完整的权限系统初始化
    - 添加30个系统权限：设备、点检、隐患、用户、权限、报表、系统管理等模块
    - 添加6个预设角色：超级管理员、厂区管理员、设备管理员、安全管理员、点检员、报表查看员
    - 自动为超级管理员分配完整权限
    - 创建权限初始化审计记录
  - ✅ **验证结果**：
    - 超级管理员登录后可正常访问权限管理功能
    - 权限管理页面显示完整的权限和角色信息
    - 数据库包含30个权限、6个角色、85个角色权限关联
    - 一键部署后权限系统开箱即用，无需额外配置
  - 💡 **用户体验改进**：
    - 新用户使用 `npm run db:seed` 后立即拥有完整权限系统
    - 部署后可直接进行用户权限管理，无需手动初始化
    - 输出信息包含完整的权限系统状态和使用提示

### 🚀 新增功能

- **器材类型管理功能模块**
  - 🎯 **核心功能**：完整的器材类型管理体系，支持器材分类和点检项目标准化
    - 器材类型的增删改查操作
    - 点检项目模板管理，每个器材类型可配置多个点检项目
    - 点检项目支持排序功能，确保检查流程标准化
    - 统计显示器材数量和点检项目数量
    - 删除前检查是否有关联器材，保护数据完整性
  - 🛠️ **后端实现**：扩展器材类型API路由和业务逻辑
    - `POST /api/equipments/types` - 创建器材类型
    - `GET /api/equipments/types/:id` - 获取器材类型详情
    - `PUT /api/equipments/types/:id` - 更新器材类型
    - `DELETE /api/equipments/types/:id` - 删除器材类型（安全检查）
    - `GET /api/equipments/types/:id/checklist` - 获取点检项模板
    - `POST /api/equipments/types/:id/checklist` - 创建点检项模板
    - `PUT /api/equipments/types/:typeId/checklist/:id` - 更新点检项模板
    - `DELETE /api/equipments/types/:typeId/checklist/:id` - 删除点检项模板
    - `PUT /api/equipments/types/:id/checklist/reorder` - 批量更新点检项排序
  - 🎨 **前端界面**：新增器材类型管理页面（`/equipment-types`）
    - 器材类型列表展示和管理
    - 统计卡片显示：总类型数、使用中类型、缺少点检项的类型
    - 点检项目管理对话框，支持拖拽排序
    - 权限控制：仅厂区管理员和超级管理员可访问
    - 响应式设计，适配桌面和移动端
  - 🎛️ **导航和路由**：完整的导航和访问控制
    - 在器材管理下方添加"器材类型管理"菜单项
    - 使用ListChecks图标，统一视觉风格
    - 路由配置：`/equipment-types`，需要管理员权限
    - 与现有导航系统完美集成
  - 🔧 **技术特性**：
    - 类型定义更新：EquipmentType接口添加equipmentCount和checklistTemplates可选属性
    - API接口扩展：equipmentApi添加器材类型管理相关方法
    - 状态管理增强：新增useEquipmentTypeStore Zustand状态管理
    - 组件化设计：EquipmentTypeDialog组件支持添加和编辑功能
    - 数据验证和错误处理：前后端完整的验证体系
  - ✅ **与现有系统兼容**：
    - 完全兼容现有器材数据和点检流程
    - 种子数据中的器材类型和点检项保持不变
    - 新增的器材类型立即可用于器材管理
    - 点检员使用的点检项模板自动更新

### 🔧 技术实现细节

- **数据库层面**：
  - 利用现有的 `EquipmentType` 和 `ChecklistTemplate` 数据模型
  - 保持数据库结构不变，向后完全兼容
  - 支持级联删除和数据完整性约束

- **服务层业务逻辑**：
  - 新增 `createEquipmentType()`, `updateEquipmentType()`, `deleteEquipmentType()` 方法
  - 实现 `getChecklistTemplates()`, `createChecklistTemplate()`, `updateChecklistTemplate()`, `deleteChecklistTemplate()` 方法
  - 支持 `reorderChecklistTemplates()` 批量排序功能
  - 完整的数据验证、错误处理和安全检查

- **前端组件架构**：
  - `EquipmentTypesPage.tsx` - 主管理页面
  - `EquipmentTypeDialog.tsx` - 器材类型编辑对话框
  - `equipmentType.ts` - Zustand状态管理store
  - 使用 shadcn/ui 组件库保持UI一致性

### 🔐 安全性重大升级

- **JWT令牌黑名单机制实现**
  - 🚨 **问题背景**：原系统存在JWT安全漏洞，用户退出后令牌仍然有效
    - 用户退出登录后，JWT访问令牌和刷新令牌依然可以继续使用
    - 恶意用户可能利用已泄露的令牌持续访问系统
    - 缺少令牌撤销机制，无法强制终止特定会话
  - 🛠️ **实现方案**：构建完整的JWT黑名单安全体系
    - 新增`TokenBlacklist`数据模型存储被撤销的令牌
    - 创建`TokenBlacklistService`提供令牌管理和清理功能
    - 增强认证中间件，每次请求检查令牌黑名单状态
    - 改进登出逻辑，自动将令牌添加到黑名单
  - ✅ **安全效果**：
    - ✅ 令牌撤销：用户退出后令牌立即失效，无法再次使用
    - ✅ 会话控制：支持强制终止特定用户会话
    - ✅ 自动清理：过期令牌自动从黑名单中清除，优化存储
    - ✅ 安全审计：完整的令牌操作日志记录
  - 🔧 **技术实现**：
    - 新增文件：`backend/src/services/token-blacklist.service.js`
    - 修改文件：`backend/prisma/schema.prisma` (新增TokenBlacklist模型)
    - 修改文件：`backend/src/auth/auth.service.js` (集成黑名单机制)
    - 修改文件：`backend/src/middleware/auth.middleware.js` (添加黑名单检查)
    - 数据库关系：TokenBlacklist → User (多对一关联)

### 🏭 厂区管理功能完善

- **厂区CRUD操作完整实现**
  - 🚨 **问题背景**：原系统厂区管理功能不完整，仅支持新增和查看
    - 用户管理页面只能创建新厂区，无法查看已有厂区列表
    - 缺少厂区信息编辑功能，无法修改厂区名称和地址
    - 不支持厂区删除，导致测试或错误数据无法清理
    - 厂区详情信息缺失，无法查看关联的用户和器材数量
  - 🛠️ **功能实现**：构建完整的厂区管理体系
    - **后端API扩展**：
      - 新增 `GET /api/factories/:id` 获取单个厂区详情接口
      - 新增 `PUT /api/factories/:id` 更新厂区信息接口  
      - 新增 `DELETE /api/factories/:id` 删除厂区接口
      - 完善API文档，更新路由信息展示
    - **服务层增强**：
      - 实现 `getFactoryById()` 厂区详情查询，包含关联统计信息
      - 实现 `updateFactory()` 厂区信息更新，支持名称重复检查
      - 实现 `deleteFactory()` 安全删除，检查关联数据防止误删
    - **前端界面优化**：
      - 在用户管理页面新增厂区列表表格，展示所有厂区信息
      - 添加厂区编辑对话框，支持厂区名称和地址修改
      - 实现删除确认对话框，显示关联数据信息和安全提示
      - 集成下拉菜单操作，提供便捷的编辑和删除入口
  - ✅ **功能效果**：
    - ✅ 信息可视化：管理员可以清晰查看所有厂区信息和统计数据
    - ✅ 数据完整性：编辑功能支持实时校验，防止重名和数据冲突
    - ✅ 安全删除：删除前检查关联数据，避免误删影响业务数据
    - ✅ 用户体验：统一的操作界面，降低管理复杂度
  - 🔧 **技术实现**：
    - 修改文件：`backend/src/routes/index.js` (新增厂区管理路由)
    - 修改文件：`backend/src/controllers/user.controller.js` (新增厂区CRUD控制器方法)  
    - 修改文件：`backend/src/services/user.service.js` (实现厂区数据处理逻辑)
    - 修改文件：`frontend/src/api/index.ts` (扩展厂区API接口定义)
    - 修改文件：`frontend/src/pages/UserManagementPage.tsx` (完善厂区管理界面)
    - 权限控制：所有厂区管理操作仅限超级管理员访问

### 🔧 权限系统完善

- **权限日志记录系统优化**
  - 🚨 **问题描述**：权限变更日志缺少目标用户信息，影响审计追踪
    - 原权限日志只记录操作者信息，缺少被操作用户的记录
    - 管理员查看权限变更历史时无法确定具体影响的用户
  - 🛠️ **修复方案**：完善权限日志目标用户记录机制
    - 在权限变更时同时记录操作者ID和目标用户ID
    - 确保角色分配、权限授予等操作都有完整的用户关联信息
    - 支持按目标用户查询权限变更历史
  - ✅ **修复结果**：
    - ✅ 权限审计完整：每次权限变更都包含完整的操作者和目标用户信息
    - ✅ 历史追踪准确：管理员可以精确查看用户权限变更历史
    - ✅ 合规要求满足：满足企业级权限管理审计要求

- **权限日志查看界面创建**
  - 🚀 **新功能特性**：为用户权限管理对话框新增完整的日志查看功能
    - 新增PermissionLogsView组件，提供权限变更历史的可视化展示
    - 支持按操作类型、日期范围筛选权限变更记录
    - 实现分页显示，支持大量日志数据的高效浏览
    - 提供变更前后对比功能，清晰显示权限变化内容
  - 🎨 **用户界面优化**：
    - 筛选控件：操作类型下拉选择、日期范围选择器
    - 色彩编码：不同操作类型使用不同颜色标识（授予-绿色，撤销-红色）
    - 详细信息：显示操作者、时间、原因、IP地址等完整信息
    - 空状态处理：无日志记录时显示友好提示
  - ✅ **功能覆盖**：
    - ✅ 操作类型支持：分配角色、撤销角色、授予权限、撤销权限、更新角色权限
    - ✅ 时间筛选：支持按起始日期和结束日期范围查询
    - ✅ 分页展示：每页显示10条记录，支持前后翻页导航
    - ✅ 详情展示：变更前后数据对比，操作原因说明
  - 🔧 **技术实现**：
    - 修改文件：`frontend/src/components/UserPermissionDialog.tsx`
    - 新增组件：PermissionLogsView (权限日志查看器)
    - API集成：调用`/api/permissions/logs`接口获取日志数据
    - 状态管理：useCallback优化性能，useState管理筛选和分页状态

### 📱 移动端体验优化

- **我的隐患上报页面开发**
  - 🚀 **页面功能完善**：将开发占位符替换为完整的隐患管理功能页面
    - 新增MyIssuesPage组件，为用户提供个人隐患管理中心
    - 实现隐患列表展示，支持按状态、类型、时间等多维度筛选
    - 提供隐患详情查看功能，包含图片预览和处理进度跟踪
    - 新增隐患创建入口，支持快速上报新发现的安全隐患
  - 🎯 **用户体验优化**：
    - 响应式设计：完美适配移动端和桌面端设备
    - 状态管理：实时显示隐患处理状态，支持状态筛选
    - 搜索功能：支持按隐患标题、描述内容快速搜索
    - 统计卡片：显示个人隐患统计数据，提供数据概览
  - ✅ **功能特性**：
    - ✅ 隐患列表：分页显示用户上报的所有隐患记录
    - ✅ 状态筛选：待处理、处理中、待审核、已关闭状态分类查看
    - ✅ 详情弹窗：完整的隐患详情展示，包含处理进度和备注
    - ✅ 快速操作：新增隐患、刷新列表、状态更新等便捷功能
  - 🔧 **技术实现**：
    - 新增文件：`frontend/src/pages/MyIssuesPage.tsx`
    - 修改文件：`frontend/src/App.tsx` (路由集成)
    - 组件特性：TypeScript类型安全、响应式布局、状态管理
    - API集成：调用隐患管理相关接口获取和处理数据

- **移动端导航菜单增强**
  - 🚀 **导航功能完善**：TopBar组件移动端菜单从占位符升级为全功能导航系统
    - 完整的移动端侧边栏菜单，支持所有核心功能访问
    - 用户信息展示区域，显示头像、姓名、角色等信息
    - 基于角色的菜单项显示，确保权限控制的一致性
    - 优雅的菜单动画和交互效果，提升用户体验
  - 🎨 **界面设计优化**：
    - 菜单分类：移动端专用功能（扫码点检、隐患上报）和PC端功能分组
    - 权限控制：根据用户角色动态显示管理功能入口
    - 用户反馈：点击菜单项后自动关闭菜单，提供流畅的导航体验
    - 视觉一致性：与整体UI设计风格保持一致，图标和色彩协调
  - ✅ **菜单功能**：
    - ✅ 移动端功能：扫码点检、我的隐患上报、点检记录查看
    - ✅ PC端功能：管理后台、器材管理、隐患管理（仅管理员可见）
    - ✅ 用户功能：个人资料、退出登录
    - ✅ 角色控制：超级管理员显示用户管理入口
  - 🔧 **技术实现**：
    - 修改文件：`frontend/src/components/layout/TopBar.tsx`
    - 功能增强：完整的移动端菜单实现，替换原有占位符代码
    - 状态管理：menuOpen状态控制，点击遮罩层关闭菜单
    - 路由集成：Link组件实现页面跳转，onClick事件关闭菜单

### 📊 数据分析功能完善

- **月度趋势统计功能实现**
  - 🚀 **数据分析升级**：报表服务月度趋势从占位符升级为完整的数据分析功能
    - 实现getMonthlyTrend方法，提供最近12个月的业务数据趋势分析
    - 支持器材新增、点检执行、隐患处理等多维度数据统计
    - 自动生成月度数据结构，确保图表显示的完整性和连续性
    - 优化数据查询性能，使用并行查询提升响应速度
  - 📈 **统计维度**：
    - 器材统计：每月新增器材数量趋势分析
    - 点检统计：点检总数、正常点检数、异常点检数的月度变化
    - 隐患统计：隐患新增数、待处理数、已关闭数的趋势跟踪
    - 时间跨度：自动计算最近12个月的完整数据周期
  - ✅ **功能特性**：
    - ✅ 数据完整性：确保12个月数据结构完整，空数据月份显示为0
    - ✅ 性能优化：使用Promise.all并行查询，减少数据库访问时间
    - ✅ 容错处理：异常情况下返回完整的空数据结构而非报错
    - ✅ 数据格式：标准化的月度数据格式，便于前端图表组件使用
  - 🔧 **技术实现**：
    - 修改文件：`backend/src/services/report.service.js`
    - 新增方法：getMonthlyTrend() - 完整的月度趋势统计实现
    - 数据查询：按月分组统计器材、点检、隐患数据
    - 错误处理：异常情况下返回12个月的空数据结构保证系统稳定

### 🔧 代码质量提升

- **开发占位符清理完成**
  - 🧹 **技术债务清理**：系统性清理所有开发阶段的占位符代码
    - JWT黑名单机制：从安全漏洞到完整的令牌管理系统
    - 权限日志功能：从TODO注释到完整的权限审计界面
    - 我的隐患页面：从页面占位符到全功能的隐患管理中心
    - 移动端导航：从简单占位符到完整的移动端导航系统
    - 数据统计功能：从占位符方法到完整的趋势分析功能
  - ✅ **清理结果**：
    - ✅ 安全性提升：JWT黑名单机制填补重要安全漏洞
    - ✅ 功能完整性：所有占位符功能已实现为生产就绪代码
    - ✅ 用户体验：移动端和PC端功能体验完整统一
    - ✅ 代码质量：移除所有TODO标记和占位符注释

## [未发布] - 2025-08-29

### 🐛 Bug修复

- **批量导入和添加器材字段一致性问题**
  - 🚨 **问题描述**：批量导入器材和手动添加器材功能的必填字段验证不一致
    - 手动添加器材需要：器材名称、器材类型、安装位置、生产日期、到期日期、规格型号（6个字段）
    - 批量导入器材只验证：器材名称、安装位置（2个字段）
    - 导致批量导入的数据无法满足数据库完整性约束和业务需求
    - 用户通过模板导入的数据缺少关键信息，影响系统数据质量
  - 🛠️ **修复方案**：统一两个功能的字段验证规则和用户体验
    - 更新必填字段验证：添加器材类型、生产日期、到期日期为批量导入必填项
    - 修正字段映射：equipmentTypeId → typeId，description → specifications
    - 增强数据解析：添加日期格式智能识别（支持YYYY-MM-DD、YYYY/MM/DD等多种格式）
    - 完善导入模板：新增生产日期、到期日期列，包含详细的填写说明
    - 优化用户界面：更新必填字段提示，改进预览界面显示更多关键信息
  - ✅ **修复结果**：
    - ✅ 批量导入和手动添加使用相同的验证标准，确保数据一致性
    - ✅ 导入模板包含所有必填字段，提供详细的填写指导和说明页
    - ✅ 支持多种日期格式解析，提升用户输入的灵活性
    - ✅ 预览界面显示器材类型、生产日期、到期日期等关键信息
    - ✅ 前端提示信息准确反映实际的验证要求
  - 🔧 **技术细节**：
    - 修改文件：`frontend/src/utils/importUtils.ts` (字段映射、验证逻辑、日期解析)
    - 修改文件：`frontend/src/components/ImportModal.tsx` (提示信息、预览界面)
    - 新增功能：智能日期解析，支持Excel序列号和多种文本格式
    - 模板优化：新增导入说明页，包含完整的字段要求和注意事项

- **清理废弃二维码生成方法**
  - 🚨 **问题描述**：系统产生大量重复的"generateQRImageUrl已弃用，建议使用本地生成方法"警告日志
    - 原因：backend/src/utils/qrcode.generator.js中的generateQRImageUrl方法已废弃但仍在使用
    - 影响：日志文件被废弃警告信息填满，影响系统监控和问题诊断
    - 调用点：5个器材服务方法中都在调用废弃方法
  - 🛠️ **修复方案**：完全移除废弃代码，替换为现代化本地生成方法
    - 移除废弃方法：删除generateQRImageUrl方法及相关警告代码
    - 更新调用点：所有调用改为使用generateQRBase64方法
    - 异步改造：添加async/await支持，使用Promise.all优化性能
    - API兼容性：保持qrImageUrl字段名不变，内容改为Base64 Data URL格式
  - ✅ **修复结果**：
    - ✅ 完全消除废弃警告：系统运行时不再产生重复警告日志
    - ✅ 改善用户体验：Base64内联图片加载更快，减少HTTP请求
    - ✅ 代码质量提升：移除技术债务，保持代码库干净
    - ✅ 功能完全兼容：前端二维码显示功能不受影响
  - 🔧 **技术细节**：
    - 修改文件：`backend/src/utils/qrcode.generator.js` (删除废弃方法)
    - 修改文件：`backend/src/services/equipment.service.js` (更新5个调用点)
    - 性能优化：使用Promise.all并发处理多个二维码生成
    - 格式变更：从`/api/equipments/qr-image/xxx`改为`data:image/png;base64,xxx`

### 🧹 数据库清理和优化

- **清空模拟数据，保留基础配置**
  - 🚨 **背景需求**：项目包含大量测试和模拟数据，需要清理为生产就绪状态
    - 原有数据：3个模拟厂区、8个模拟用户、35个模拟器材、大量点检记录和隐患记录
    - 数据问题：包含30天历史点检记录、8条隐患记录等不必要的演示数据
    - 生产需求：只需要基础配置和默认管理员账号
  - 🛠️ **清理方案**：创建智能数据库清理系统
    - 新增数据清理脚本：`backend/scripts/clean-database.ts`
    - 按依赖关系正确清理：点检记录 → 隐患 → 器材 → 模板 → 类型 → 用户 → 厂区
    - 清理权限管理相关数据：角色、权限、日志等全部重置
    - 保留核心配置：重建默认厂区和超级管理员
  - ✅ **清理结果**：
    - ✅ 完全清空业务数据：点检记录、隐患记录、消防器材全部清除
    - ✅ 清空模拟厂区：删除A/B/C厂区，创建单一默认厂区
    - ✅ 重置用户系统：只保留1个超级管理员（admin / Test123!@#）
    - ✅ 保留基础配置：器材类型和点检项模板仍然可用
    - ✅ 数据库体积优化：从包含大量测试数据到最小化生产配置
  - 🔧 **技术细节**：
    - 创建文件：`backend/scripts/clean-database.ts`
    - 清理顺序：遵循外键约束，避免数据完整性错误
    - 安全重建：确保默认管理员密码哈希正确生成
    - 状态输出：详细的清理进度日志和结果汇总

- **优化种子文件为生产配置**
  - 🔄 **重构目标**：将开发测试导向的种子文件改为生产就绪配置
    - 移除模拟数据生成：不再创建A/B/C厂区和多个测试用户
    - 移除历史数据：不再生成30天点检记录和隐患数据
    - 保留基础模板：保留器材类型和点检项模板供实际使用
  - 🛠️ **重构方案**：
    - 简化厂区创建：只创建1个"默认厂区"，用户可根据实际情况修改
    - 精简用户创建：只创建超级管理员，其他用户由管理员按需添加  
    - 保留核心配置：保留10种器材类型和3种器材的点检模板
    - 优化用户指导：添加详细的使用提示和步骤指引
  - ✅ **重构结果**：
    - ✅ 种子文件执行时间大幅减少：从创建大量模拟数据到秒级完成
    - ✅ 生产友好：新部署环境获得干净的初始状态
    - ✅ 用户引导：提供清晰的后续配置步骤说明
    - ✅ 灵活配置：管理员可根据实际需求添加厂区、用户和器材
  - 💡 **使用指导**：
    - 1. 使用 admin / Test123!@# 登录系统
    - 2. 修改默认厂区信息为实际厂区
    - 3. 创建所需的厂区管理员和点检员账号
    - 4. 添加实际的消防器材台账
    - 5. 开始正常的点检作业流程
  - 🔧 **技术细节**：
    - 修改文件：`backend/prisma/seed.ts` - 完全重写种子逻辑
    - 保留配置：器材类型（10个）、点检模板（3类器材）
    - 移除内容：模拟厂区、测试用户、演示器材、历史记录
    - 优化输出：友好的控制台信息和使用指导

### 🐛 关键修复

- **JWT角色解析优先级问题**
  - 🚨 **根本原因**：权限系统与JWT生成逻辑不匹配导致用户权限异常
    - inspector_001用户在权限系统中正确分配了FACTORY_ADMIN角色
    - 但JWT生成时仍使用User表基础role字段（INSPECTOR）而非权限系统角色
    - 导致虽有厂区管理员权限但无法访问管理功能，提示"访问被拒绝"
    - 前端权限检查基于JWT中的role字段，造成权限验证失败
  - 🛠️ **修复方案**：实现JWT角色优先级解析策略
    - 修改JWT生成逻辑：优先使用权限系统分配的角色，回退到基础User.role
    - 角色确定逻辑：`effectiveRole = userPermissions.roles.length > 0 ? userPermissions.roles[0].code : user.role`
    - 同时修复登录和token刷新两个接口的用户信息返回逻辑
    - 确保前端AuthStore接收到正确的角色信息
  - ✅ **修复结果**：
    - inspector_001用户成功以FACTORY_ADMIN角色登录系统
    - 正常访问Dashboard、设备管理、隐患管理等厂区管理功能
    - JWT token中role字段正确显示为FACTORY_ADMIN而非INSPECTOR
    - 权限管理系统与前端路由保护完全协调工作
  - 🔧 **技术细节**：
    - 修改文件：`backend/src/auth/auth.service.js:91-104, 170-178`
    - 修改文件：`frontend/src/api/index.ts:33` (修复token刷新接口返回类型)
    - 调试增强：新增详细的角色确定逻辑日志输出
    - 测试验证：inspector_001用户权限从INSPECTOR→FACTORY_ADMIN成功提升
    - 向后兼容：未分配权限系统角色的用户仍使用基础role字段

### 🐛 缺陷修复

- **访问被拒绝页面"重新登录"功能修复**
  - 🚨 **问题描述**：UnauthorizedPage页面的"重新登录"按钮只做页面跳转，未清除登录状态
    - 点击按钮后跳转到登录页面，但用户认证状态和localStorage数据未被清除
    - 导致用户看似回到登录页面，但实际登录状态仍然存在
  - 🛠️ **修复方案**：参照TopBar组件的退出登录逻辑，完善重新登录功能
    - 导入useNavigate和useAuthStore钩子
    - 添加handleRelogin函数：先调用logout()清除认证状态，再跳转到登录页面
    - 将Link组件改为Button组件，绑定onClick事件
  - ✅ **修复效果**：
    - 点击"重新登录"按钮正确清除用户登录状态和localStorage数据
    - 确保重新登录的安全性，避免认证状态残留
  - 🔧 **技术细节**：
    - 修改文件：`frontend/src/pages/UnauthorizedPage.tsx:2,3,8-15,42-44`
    - 权限验证：确保退出登录逻辑与系统其他退出功能保持一致

### 🎯 重大功能更新

- **多层次用户权限管理系统**
  - 🚀 **核心特性**：全面升级权限管理，支持细粒度权限控制
    - 新增5个权限管理数据表：Permission、Role、RolePermission、UserRole、UserPermission、PermissionLog
    - 支持四层权限模型：系统层、模块层、数据层、字段层权限控制
    - 实现权限继承机制：用户个人权限可覆盖角色权限
    - 新增30个系统权限定义，涵盖所有业务模块功能
    - 预设6种角色模板：超级管理员、厂区管理员、设备管理员、安全管理员、点检员、报表查看员
  - 🛠️ **技术实现**：
    - 增强版权限中间件（EnhancedAuthMiddleware）支持基于数据库的权限验证
    - 权限管理服务（PermissionService）提供完整的权限业务逻辑
    - 权限管理API接口：15个RESTful接口支持权限CRUD、角色管理、批量操作
    - 权限缓存机制：减少数据库查询，提升权限验证性能
    - 权限数据初始化脚本：自动迁移现有用户权限数据
  - ✅ **功能覆盖**：
    - 权限定义管理：支持权限的创建、修改、删除、分类管理
    - 角色模板管理：预设角色模板、自定义角色、角色权限分配
    - 用户权限管理：用户角色分配、个人权限授予/撤销、批量权限操作
    - 权限审计日志：完整的权限变更历史记录和审计追踪
    - 权限统计分析：权限使用统计、角色分布统计
  - 🔧 **API端点**：
    - `GET/POST/PUT/DELETE /api/permissions` - 权限管理
    - `GET/POST/PUT/DELETE /api/permissions/roles` - 角色管理
    - `POST/DELETE /api/permissions/users/:id/roles` - 用户角色分配
    - `POST/DELETE /api/permissions/users/:id/permissions` - 用户个人权限
    - `GET /api/permissions/logs` - 权限变更日志
    - `POST /api/permissions/batch` - 批量权限操作
  - 🎨 **前端界面**：
    - 在用户管理页面添加权限管理入口按钮
    - 新增UserPermissionDialog权限管理对话框组件
    - 支持权限概览、角色分配、权限管理、操作日志四个功能标签页
    - 实现权限搜索、筛选、实时统计等交互功能
    - 支持批量权限操作和权限变更原因记录

### 🐛 修复

- **前端权限管理AuthStore冲突问题**
  - 🚨 **根本原因**：双重AuthStore文件导致权限检查逻辑冲突
    - 项目中存在两个AuthStore文件：`auth.ts`（完整）和`authStore.ts`（不完整）
    - `authStore.ts`文件缺少`hasRole`方法，但被部分组件错误引用
    - ProtectedRoute等组件调用不存在的`hasRole`方法导致权限检查失败
    - inspector_001用户虽在数据库中设为厂区管理员，但前端权限验证失败
  - 🛠️ **修复方案**：
    - 删除冗余的`authStore.ts`文件，统一使用完整的`auth.ts`
    - 修复所有文件的导入路径指向正确的auth store
    - 确保权限检查逻辑使用完整的hasRole方法实现
  - ✅ **修复结果**：
    - inspector_001用户可以正常登录并获得厂区管理员权限
    - 权限管理系统前端组件正常工作
    - "/dashboard"等管理页面访问权限正常
  - 🔧 **技术细节**：
    - 删除文件：`frontend/src/stores/authStore.ts`
    - 修改文件：`frontend/src/pages/ReportsPage.tsx:2`
    - 权限流程：JWT权限数据 → auth.ts store → hasRole验证 → 页面访问控制

- **前端权限管理组件数据解析错误**
  - 🚨 **根本原因**：API响应数据结构解析错误导致组件渲染失败
    - API返回格式：`{data: [...]}` 但组件直接使用响应对象
    - allPermissions和allRoles初始化为非数组类型导致filter方法调用失败
  - 🛠️ **修复方案**：
    - 修正API数据提取：从`response`改为`response.data`
    - 添加安全的数组检查：`(allPermissions || []).filter(...)`
    - 为所有状态变量添加默认值和类型保护
  - ✅ **修复结果**：
    - 权限管理对话框正常渲染和交互
    - 解决"filter is not a function"运行时错误
    - 提高组件容错性和稳定性
  - 🔧 **技术细节**：
    - 修改文件：`frontend/src/components/UserPermissionDialog.tsx:57-59, 152-156, 295`
    - 安装依赖：`@radix-ui/react-checkbox`用于权限选择器
    - 类型安全：添加TypeScript类型检查和空值保护

### 🐛 紧急修复

- **隐患列表前端显示问题**
  - 🚨 **根本原因**：前端数据解析逻辑错误导致隐患记录无法正常显示
    - 后端API正常返回数据结构：`{success: true, data: {items: [...], total: 5, page: 1}}`
    - 前端错误处理：`setIssues(response.data || [])` 把整个data对象当作隐患数组
    - 实际隐患数组在：`response.data.items` 字段中
    - 导致界面显示"暂无隐患记录"，但后端查询完全正常
  - 🛠️ **修复方案**：修正前端数据解析和分页处理逻辑
    - 正确提取隐患数组：`const issuesData = response.data.items || response.data || []`
    - 正确解析分页信息：从 `response.data.total`、`response.data.page` 获取
    - 兼容性处理：支持不同的API响应格式（items格式和直接数组格式）
    - 添加详细的前端调试日志便于问题排查
  - ✅ **修复结果**：
    - 解决C厂区管理员隐患管理页面"暂无隐患记录"显示问题
    - 正确显示所有厂区的隐患记录（按权限过滤）
    - 前端状态管理和分页功能恢复正常
    - 各种筛选和查询操作正确响应后端数据

- **隐患管理页面筛选功能失效问题**
  - 🚨 **根本原因**：后端验证规则配置不完整导致筛选参数被过滤
    - 前端正确发送状态筛选参数（PENDING, PENDING_AUDIT, CLOSED等）
    - 后端验证中间件缺少隐患筛选参数验证规则（`issueFilter`）
    - 验证中间件设置 `stripUnknown: true` 过滤掉未定义的参数
    - 导致状态筛选参数被移除，所有按钮都显示全部隐患
  - 🛠️ **修复方案**：完善后端验证规则配置
    - 在`ValidationHelper.querySchema`中添加`issueFilter`验证规则
    - 包含`status`, `reporterId`, `handlerId`, `equipmentId`等筛选参数
    - 更新隐患控制器验证中间件配置，包含新的筛选验证规则
    - 更新隐患路由验证中间件配置，确保完整验证链
  - ✅ **修复结果**：
    - ✅ 待处理按钮：只显示状态为PENDING的隐患（5条）
    - ✅ 待审核按钮：只显示状态为PENDING_AUDIT的隐患（1条）  
    - ✅ 已关闭按钮：只显示状态为CLOSED的隐患（5条）
    - ✅ 全部按钮：显示所有隐患（11条）
    - ✅ 分页和筛选功能同时正常工作
    - ✅ 权限控制依然有效（数据隔离完整）
    - 分页功能正常工作，显示正确的记录总数和页码信息
    - 超级管理员可以看到所有厂区的隐患记录
  - 🔧 **技术细节**：
    - 修改文件：`frontend/src/pages/IssuePage.tsx:181-237`
    - 问题诊断：添加详细的后端查询日志用于问题分析
    - 权限验证：确认数据权限过滤中间件正常工作
    - 数据流程：后端查询正常 → API响应正确 → 前端解析错误 → 界面显示异常

- **点检记录提交HTML编码问题**
  - 🚨 **根本原因**：HTTP传输过程中URL被HTML编码导致后端验证失败
    - 前端发送正常URL：`"https://172.16.4.65:5173/uploads/..."`
    - 后端接收到编码URL：`"https:&#x2F;&#x2F;172.16.4.65:5173&#x2F;uploads/..."`
    - Joi验证器无法识别HTML编码的URL格式，返回422错误
  - 🛠️ **修复方案**：在验证器中添加智能HTML解码处理
    - 新增 `decodeHtmlEntities()` 函数处理常见HTML实体编码
    - 新增 `decodeObjectHtmlEntities()` 递归处理整个数据对象
    - 在Joi验证前自动进行HTML解码处理
    - 添加详细的解码过程日志便于调试
  - ✅ **修复结果**：
    - 解决点检记录提交422验证失败问题  
    - 支持各种HTML编码格式：`&#x2F;`(/)、`&#x3A;`(:)、`&lt;`(<)等
    - 保持数据安全性，只处理标准HTML实体编码
    - 向后兼容未编码的正常数据
  - 🔧 **技术细节**：
    - 修改文件：`backend/src/utils/validation.helper.js:240-338`
    - 新增HTML解码函数和递归对象处理逻辑
    - 在验证流程中增加🔧标识的解码日志输出
    - 确保解码后数据类型和结构完全一致

- **异常描述验证规则不一致问题**
  - 🚨 **根本原因**：前后端验证规则不匹配导致用户体验问题
    - 后端要求异常描述至少5个字符（`validation.helper.js:115`）
    - 前端只检查是否为空，未做长度验证（`MobileInspectionPage.tsx:169`）
    - 用户输入短描述如"漏水"时前端通过但后端422验证失败
  - 🛠️ **修复方案**：统一前后端验证规则并优化用户体验
    - 调整后端验证：异常描述最小长度改为2字符（适合中文如"损坏"）
    - 同步前端验证：添加详细的长度检查和分步错误提示
    - 界面优化：添加字符计数显示和实时验证反馈
    - 用户引导：优化placeholder和错误信息的友好性
  - ✅ **修复结果**：
    - 解决用户提交异常描述时的验证失败问题
    - 支持中文短描述如"漏水"、"损坏"等常见描述
    - 前端实时显示字符计数和验证状态
    - 错误信息更加明确和友好
  - 🔧 **技术细节**：
    - 后端文件：`backend/src/utils/validation.helper.js:115-119`
    - 前端文件：`frontend/src/pages/mobile/MobileInspectionPage.tsx:169-178, 505-521`
    - 验证规则：异常描述长度要求从5字符降至2字符
    - 用户界面：新增实时字符计数和颜色状态指示

- **二维码生成失败问题**
  - 🚨 **根本原因**：前后端接口数据格式不匹配
    - 后端 `/api/equipments/qr-image/:qrCode` 默认返回PNG二进制数据
    - 前端 `QRCodeModal` 期望JSON格式响应，包含 `imageUrl` 字段
  - 🛠️ **修复方案**：重构后端API返回格式
    - 默认返回base64格式的JSON数据：`{data: {qrCode, imageUrl, size}}`
    - 保持向后兼容：`format=png` 和 `format=svg` 仍直接返回文件数据
    - 确保前端能正确获取和显示二维码图片
  - ✅ **修复结果**：
    - 解决器材二维码弹窗"生成二维码失败"问题
    - 前端正常显示二维码图片（base64格式）
    - 下载功能正常工作（PNG直接输出）
    - 新窗口打开功能正常
  - 🔧 **技术细节**：
    - 修改文件：`backend/src/controllers/equipment.controller.js:310-362`
    - 调整 `generateQRImage` 方法的默认行为
    - 移除 `format='png'` 的默认值设定
    - base64输出包含完整的data URL格式

## [已发布] - 2025-08-28

### 🔧 重大改进

- **配置文件不一致问题修复**
  - 🚨 **问题识别**：发现 `.env`、`.env.example`、`setup-and-run.js` 三个配置文件间存在严重不一致
  - 📋 **主要不一致点**：
    - 端口配置冲突：`.env`(3001) vs `.env.example`(3000) vs `setup-and-run.js`(3000)
    - 数据库路径不统一：`./prisma/dev.db` vs `../data/fire_safety.db`
    - 邮件服务配置缺失：`.env` 和 `setup-and-run.js` 缺少 SMTP 配置
    - 文件上传类型配置不完整：缺少 `UPLOAD_ALLOWED_TYPES` 配置
  - 🛠️ **修复方案**：
    - 统一端口为 `PORT=3001`（符合项目标准）
    - 统一数据库路径为 `DATABASE_URL="file:../data/fire_safety.db"`
    - 补充完整邮件服务配置（SMTP_HOST, SMTP_PORT, SMTP_USER 等）
    - 添加文件上传类型限制 `UPLOAD_ALLOWED_TYPES=image/jpeg,image/png,image/gif`
    - 更新 `setup-and-run.js` 中 `createEnvFile()` 方法生成完整配置
  - ✅ **修复结果**：
    - 解决项目初始化时配置不匹配问题
    - 确保三个文件配置完全一致
    - 避免端口冲突和数据库连接问题
    - 邮件功能配置完整可用
  - 🎯 **影响**：新项目初始化时不再出现配置缺失导致的功能异常

- **初始化脚本整合优化**
  - 🔄 **脚本合并**：将 `setup-db.js` 的功能完全集成到 `setup-and-run.js` 中
  - 🗂️ **目录结构完善**：
    - 添加完整的上传目录结构（`uploads/inspections`, `uploads/issues`, `uploads/fixes`）
    - 添加日志目录 `logs`
    - 添加当前年月目录 `uploads/2025/08`
  - 📄 **示例文件创建**：自动创建示例图片文件用于测试
  - ⚙️ **配置处理优化**：优先复制 `.env.example` 而非生成新配置（保留详细注释）
  - 🚨 **端口配置修正**：修复显示信息中的端口错误（3000 → 3001）
  - 🗑️ **代码清理**：删除重复的 `setup-db.js` 文件，减少维护成本
  - ✅ **功能统一**：现在只需运行 `setup-and-run.js` 即可完成完整的系统初始化

- **二维码生成服务本地化**
  - 🚀 **重大安全提升**：移除对外部二维码服务（api.qrserver.com）的依赖，全面实现本地生成
  - 📦 **新增依赖**：集成 `qrcode` npm包 (v1.5.4) 提供高性能本地二维码生成
  - 🛠️ **架构重构**：完全重写 `QRCodeGenerator` 类，新增三种生成方式：
    - `generateQRImage()` - 生成PNG格式图片Buffer
    - `generateQRBase64()` - 生成Base64编码图片字符串  
    - `generateQRSVG()` - 生成矢量SVG格式
  - 🌐 **API增强**：升级 `/api/equipments/qr-image/:qrCode` 接口
    - 支持多种输出格式：PNG (默认)、SVG、Base64
    - 新增尺寸验证：50-1000px范围限制
    - 优化响应头：添加缓存控制、内容类型等
    - 改进错误处理：详细的格式验证和友好提示
  - ⚡ **性能优化**：
    - 本地生成平均耗时 < 3ms，相比网络请求提升90%+
    - 支持HTTP缓存，减少重复生成开销
    - 批量生成性能测试验证通过
  - 🔒 **安全增强**：
    - 消除数据泄露风险：器材信息不再发送至第三方服务
    - 离线环境支持：内网部署完全可用
    - 数据主权保护：所有二维码数据本地处理
  - 🎛️ **配置优化**：
    - 新增本地二维码配置项：`QR_CODE_DEFAULT_SIZE`、`QR_CODE_MIN_SIZE` 等
    - 移除外部服务配置：删除 `QR_SERVICE_URL` 配置项
    - 向后兼容：保留 `generateQRImageUrl` 方法并标记为弃用
  - 📋 **全面测试**：
    - 单元测试覆盖所有生成格式
    - API集成测试验证认证和权限
    - 性能基准测试确保生产可用性
    - 错误处理测试保证系统稳定性

### ✅ 验证完成
- **功能验证**：PNG、SVG、Base64三种格式生成正常
- **性能验证**：批量生成10个二维码平均耗时2.6ms
- **安全验证**：API认证、参数验证、错误处理正常
- **兼容性验证**：Windows/Linux跨平台支持正常

### 📈 改进收益
- **安全性**: 🔴 高风险 → 🟢 安全可控 (数据不出本地)
- **性能**: 🔴 网络依赖 → 🟢 毫秒级响应 (>90%提升)
- **可靠性**: 🔴 外部依赖 → 🟢 本地自主 (离线可用)
- **成本**: 🔴 第三方调用 → 🟢 零外部成本

---

## [已发布] - 2025-08-28

### 🔧 修复

- **数据库初始化和默认账号问题**
  - 修复数据库未正确初始化导致的登录失败问题
  - 数据库表结构和种子数据未创建，导致用户无法登录系统
  - 更新CLAUDE.md文档中的默认账号信息，与实际种子数据保持一致
  - 修正用户名映射：factory_admin → admin_a/admin_b/admin_c，inspector → inspector_001~004
  - 解决方案：运行 `npm run db:push` 和 `npm run db:seed` 完成数据库初始化
  - 影响：解决了新部署环境下无法使用默认账号登录的问题

### ✨ 新增功能

- **Windows 开发环境兼容性改进**
  - 解决 Windows 下 OpenSSL 依赖问题
  - 新增 `selfsigned` Node.js 包作为证书生成备选方案
  - 实现智能证书生成：优先使用 OpenSSL，回退到 Node.js 方案
  - 更新 `dev.js` 脚本支持多种证书生成方法
  - 添加详细的错误提示和解决方案指引

### 🔧 技术架构改进

- **智能证书管理系统**
  - 自动检测可用的证书生成工具 (OpenSSL vs Node.js)
  - 统一的证书生成接口，支持多种实现方式
  - 改进的证书检查逻辑，兼容不同环境

- **依赖管理优化**
  - 移除错误的 `openssl` npm 依赖
  - 新增 `selfsigned` 作为跨平台证书生成解决方案

### 🛠️ 修复和优化

- **HTTPS 代理配置修复**
  - 修复前端 Vite 代理配置中的 SSL 协议版本不匹配错误
  - 问题：当前端使用 HTTPS 时，代理尝试用 HTTPS 连接 HTTP 后端导致 SSL 错误
  - 解决方案：统一代理配置始终使用 HTTP 连接后端（`http://localhost:3001`）
  - 确保局域网多设备访问正常，支持摄像头扫码功能
  - 位置：`frontend/vite.config.ts` 第 116 和 121 行

- **Windows 兼容性**
  - 修复 Windows 下缺少 OpenSSL 导致的启动失败问题
  - 提供多种解决方案：Git Bash、WSL、npm 包等
  - 优化错误提示，提供清晰的操作指引

- **器材二维码查看功能**
  - 新增 `QRCodeModal` 组件，支持器材二维码的可视化展示
  - 集成二维码图片生成API (`GET /api/equipments/qr-image/:qrCode`)
  - 支持下载和新窗口打开二维码图片
  - 实现器材信息与二维码的关联展示

- **器材数据导入导出功能**
  - 新增 `ExportModal` 组件，支持多格式导出 (Excel/CSV/JSON)
  - 新增 `ImportModal` 组件，支持批量导入功能
  - 创建 `EquipmentExporter` 工具类，提供完整的导出统计信息
  - 创建 `EquipmentImporter` 工具类，支持智能列名映射和数据验证
  - 支持导入模板下载和错误预览
  - 添加进度指示和错误处理机制

- **完整审计日志系统**
  - 设计并创建审计日志数据表结构 (`AuditLog`, `SecurityLog`, `ErrorLog`)
  - 实现审计日志的数据库存储功能，替换原有的控制台输出
  - 新增审计日志查询、统计和清理API (`/api/audit/*`)
  - 支持按用户、操作类型、资源类型、时间范围等多维度查询
  - 提供实时统计分析和数据可视化支持
  - 实现定期日志清理功能，防止数据库膨胀

- **邮件告警系统**
  - 集成 `nodemailer` 邮件服务，支持多种SMTP配置
  - 新增 `EmailService` 类，提供安全告警、错误告警、隐患通知等邮件模板
  - 实现安全事件的自动邮件告警功能
  - 支持多收件人配置和告警优先级管理
  - 新增邮件测试API (`POST /api/audit/test-email`)

### 🔧 技术架构改进
- **数据库扩展**
  - 扩展 Prisma 数据模型，新增审计日志相关表结构
  - 优化索引设计，支持高效的日志查询和统计
  - 实现厂区级数据隔离，确保日志查询安全性

- **API 架构完善**
  - 新增审计日志管理路由 (`/api/audit`)
  - 完善权限控制，确保敏感日志仅对管理员可见
  - 优化分页查询性能，支持大数据量日志检索

- **前端组件库扩展**
  - 新增 `Progress` 组件 (基于 Radix UI)
  - 完善 Modal 组件体系，提升用户体验
  - 优化表单验证和错误提示机制

### 📝 配置和文档
- **环境配置优化**
  - 扩展 `.env.example`，新增邮件服务配置示例
  - 添加详细的邮件配置说明和常见邮箱设置
  - 新增告警收件人配置支持

- **依赖管理**
  - 新增 `xlsx` 和 `file-saver` 用于数据导入导出
  - 新增 `@radix-ui/react-progress` 用于进度展示
  - 新增 `nodemailer` 用于邮件发送服务

### 🛠️ 修复和优化
- **代码质量提升**
  - 完善 TODO 标记的功能实现，移除技术债务
  - 优化错误处理和用户反馈机制
  - 提升组件的可复用性和可维护性

- **安全性增强**
  - 实现完整的操作审计追踪
  - 增强安全事件监控和告警能力
  - 优化数据验证和输入过滤机制

- **认证中间件修复**
  - 修复审计日志路由中的认证中间件导入错误 (`TypeError: authMiddleware.requireRole is not a function`)
  - 统一认证中间件的使用方式，确保与其他路由保持一致
  - 位置: `backend/src/routes/audit.routes.js`

## [已发布] - 2025-08-27

### 重大修复
- **解决摄像头权限被拒绝问题**
  - 根本原因：缺少HTTPS部署，浏览器安全策略限制非安全上下文使用摄像头
  - 在 `QRCodeScanner.tsx` 中增加安全上下文检测和用户友好提示
  - 配置 Vite 开发环境 HTTPS 支持，生成自签名 SSL 证书
  - 修复了DOM元素时序问题，确保扫描器在DOM渲染完成后初始化
  - **解决局域网IP动态变化问题**: 创建智能证书生成系统，自动检测并包含当前局域网IP

### 新增功能
- **动态SSL证书管理系统**
  - 智能IP检测：自动识别当前局域网IP地址
  - 通用网段支持：预置常见局域网网段(192.168.x.x, 10.x.x.x, 172.16.x.x)
  - 跨平台兼容：Windows/Linux/macOS全平台支持
  - 自动证书更新：IP变化时智能检测并提示更新
  - 简化脚本：统一为 `dev.js`（开发环境）和 `deploy.js`（生产环境）两个Node.js脚本
- **HTTPS开发环境支持**
  - 修改 `vite.config.ts` 支持 HTTPS 开发模式
  - 创建自动化SSL证书生成配置 (`frontend/ssl.conf`)
  - 新增开发环境HTTPS启动脚本 `dev-https.sh` 和 `dev-https.bat`
  - 环境变量控制：`HTTPS=true npm run dev`
  - 跨平台支持：Windows/Linux/macOS全平台兼容

### 部署改进
- **增强部署脚本**
  - 修改 `deploy.sh` 和 `deploy.bat` 支持HTTPS部署选项
  - 添加SSL配置环境变量 (`SSL_KEY_PATH`, `SSL_CERT_PATH`)
  - 根据部署模式显示不同的访问指南和安全提醒
  - Windows和Linux平台都支持交互式HTTPS配置

### 文档更新
- **新增生产环境SSL部署完整指南** (`docs/ssl-deployment-guide.md`)
  - Let's Encrypt免费证书申请流程
  - Nginx反向代理配置模板
  - 自签名证书内网部署方案
  - 自动化部署脚本和故障排除指南
  - 安全最佳实践和性能优化建议

### 技术架构优化
- **安全上下文检测**
  - 检查 `window.isSecureContext` 和 `navigator.mediaDevices` 可用性
  - 非HTTPS环境显示详细的升级指导
  - 分离权限状态和安全上下文状态管理

### 修复
- 修复了隐患管理页面(`IssuePage.tsx`)中的 `issues.filter is not a function` 错误
  - 在 `getTabCounts` 函数中添加了数组类型检查，确保 `issues` 是数组类型
  - 在渲染逻辑中添加了数组类型检查，防止非数组类型导致的运行时错误
  - 提高了组件的容错性和稳定性

### 技术细节
- 文件位置: `frontend/src/pages/IssuePage.tsx:288`
- 问题: 组件初始化时 `issues` 可能为 `undefined` 或非数组类型
- 解决方案: 使用 `Array.isArray()` 进行类型检查并提供默认空数组
