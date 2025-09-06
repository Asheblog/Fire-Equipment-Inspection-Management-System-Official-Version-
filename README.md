# 消防器材点检管理系统 🔥

> 基于React 19 + Node.js 20的现代化消防安全管理平台，采用企业级架构设计

[![React](https://img.shields.io/badge/React-19.x-blue.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.7-blueviolet.svg)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 🎯 系统概述

消防器材点检管理系统是一套完整的数字化消防安全管理解决方案，采用**前后端集成部署架构**，支持移动端扫码点检和PC端集中管理。系统特色在于完整的自动化部署体系、企业级安全防护和智能化运维管理。

### 🌟 核心特色
- 📱 **移动端扫码点检** - HTML5-QRCode技术，支持离线缓存
- 🖥️ **PC端管理后台** - 基于shadcn/ui的现代化界面
- 🔐 **企业级权限系统** - RBAC权限模型，支持细粒度控制
- 📊 **实时数据看板** - Recharts图表，关键指标实时监控
- 🔄 **隐患闭环管理** - 发现→处理→审核→关闭的完整工作流
- 🚀 **一键部署体系** - 智能化部署、更新、同步脚本
- 🔒 **完整安全体系** - JWT认证、HTTPS支持、安全审计

## 🏗️ 技术架构

### 前端技术栈 (React 19 生态)
```bash
├── React 19.1.1          # 最新React特性支持
├── TypeScript 5.8        # 类型安全开发
├── Vite 7.1             # 极速构建工具
├── Tailwind CSS 4.1     # 现代化CSS框架
├── shadcn/ui            # 企业级组件库
├── Zustand 5.0          # 轻量级状态管理
├── React Router 7.8     # 客户端路由
├── html5-qrcode 2.3     # 移动端扫码
├── Recharts 3.1         # 数据可视化
└── Axios 1.11           # HTTP客户端
```

### 后端技术栈 (Node.js 企业级)
```bash
├── Node.js 20+           # 服务端运行时
├── Express.js 4.18       # Web框架
├── Prisma 5.7           # 现代化ORM
├── SQLite 3             # 轻量级数据库
├── JWT + Refresh Token  # 双令牌认证
├── bcryptjs 2.4         # 密码加密
├── Multer 1.4           # 文件上传
├── Helmet 7.2           # 安全防护
├── Express Rate Limit   # API限流
├── Morgan + Winston     # 日志系统
└── PM2                  # 进程管理
```

### 部署架构 (DevOps完整方案)
- **🔄 集成部署模式** - 后端托管前端静态文件，单端口统一访问
- **⚡ 智能脚本体系** - 开发/部署/同步/更新全自动化
- **🌐 跨平台支持** - Windows/Linux/macOS原生兼容
- **📈 PM2集群管理** - 进程守护、负载均衡、日志管理
- **🔒 HTTPS开发环境** - 智能证书生成，支持局域网访问

## 🚀 快速开始

### 环境要求
```bash
# 必需环境
Node.js >= 18.0.0
npm >= 9.0.0

# 可选工具
PM2 (生产环境推荐)
OpenSSL (HTTPS证书生成)
Git (代码同步)
```

### ⚡ 一键启动 (推荐)

```bash
# 方式1：使用npm命令（推荐）
npm run dev          # 自动启动开发环境（支持HTTPS + 局域网）
npm run deploy       # 一键部署生产环境
npm run sync         # 同步远程代码更新

# 方式2：直接运行脚本
node dev.js          # 开发环境，支持HTTPS和移动设备访问
node deploy.js       # 生产部署，支持参数化配置
node start-pm2.js    # PM2生产环境管理
node sync-remote.js  # 远程代码同步更新
```

### 💻 开发环境快速启动
```bash
# 1. 克隆项目（或下载源码）
git clone <repository-url>
cd fire-safety-system

# 2. 一键启动开发环境（自动处理依赖、数据库、HTTPS证书）
npm run dev

# 等待启动完成后访问：
# 🖥️ PC端：   https://localhost:5173
# 📱 手机端： https://[your-ip]:5173
```

### 🚀 生产环境部署
```bash
# 交互式部署（适合初次部署）
node deploy.js

# 非交互式部署（适合自动化部署）
node deploy.js --non-interactive --domain your-domain.com --port 3001 --pm2 true

# PM2生产环境管理
node start-pm2.js    # 启动/重启应用
pm2 status           # 查看运行状态
pm2 logs             # 查看应用日志
pm2 restart all      # 重启所有服务
```

### 🔄 远程同步更新
```bash
# 同步远程代码到本地（适合生产环境更新）
node sync-remote.js

# 指定分支同步
node sync-remote.js --branch main

# 强制覆盖本地修改
node sync-remote.js --force --hard
```

## 📁 项目结构

```
fire-safety-system/
├── 📁 backend/                 # 后端应用
│   ├── src/
│   │   ├── controllers/        # API控制器
│   │   ├── services/           # 业务逻辑层
│   │   ├── routes/             # 路由定义
│   │   ├── middleware/         # 中间件
│   │   └── security/           # 安全模块
│   ├── prisma/             # 数据库模型和迁移
│   ├── public/             # 前端构建输出目录
│   ├── uploads/            # 文件上传存储
│   ├── data/               # SQLite数据库文件
│   ├── logs/               # 应用日志
│   └── app.js              # 应用入口
│
├── 📁 frontend/               # 前端应用
│   ├── src/
│   │   ├── pages/              # 页面组件
│   │   │   └── mobile/         # 移动端特化页面
│   │   ├── components/         # UI组件
│   │   │   └── ui/             # shadcn/ui基础组件
│   │   ├── stores/             # Zustand状态管理
│   │   ├── api/                # API接口层
│   │   └── types/              # TypeScript类型
│   ├── certs/              # HTTPS开发证书
│   └── vite.config.ts      # Vite构建配置
│
├── 🔧 核心脚本/
│   ├── dev.js              # 开发环境启动（HTTPS+局域网）
│   ├── deploy.js           # 生产环境一键部署
│   ├── start-pm2.js        # PM2生产环境管理
│   ├── sync-remote.js      # 远程代码同步
│   └── scripts/shared-env.js # 环境变量统一管理
│
├── 📄 文档目录/
│   ├── CHANGELOG.md        # 更新日志
│   ├── CLAUDE.md           # AI开发指导
│   └── docs/               # 项目文档
│
└── package.json            # 项目主配置
```

## 🛠️ 开发指南

### 本地开发环境

#### 1. 前端开发
```bash
cd frontend
npm install
npm run dev        # 开发服务器 (http://localhost:5173)
npm run build      # 构建生产版本
npm run lint       # 代码检查
```

#### 2. 后端开发
```bash
cd backend
npm install
npm run dev        # 开发服务器 (nodemon)
npm start          # 生产服务器
npm test           # 运行API测试
npm run test:security # 安全测试
```

#### 3. 数据库管理
```bash
cd backend

# 初始化数据库
npm run db:setup      # = generate + push + seed

# 单独命令
npm run db:generate   # 生成Prisma客户端
npm run db:push       # 同步数据库结构
npm run db:seed       # 填充种子数据
npm run db:studio     # 打开数据库管理界面

# 迁移管理
npm run db:migrate    # 创建迁移文件
npm run db:migrate:deploy # 应用迁移（生产）
```

### 智能化脚本系统说明

#### 💻 `dev.js` - 开发环境启动
- **自动HTTPS证书管理**：智能生成支持局域网IP的SSL证书
- **局域网访问**：支持手机设备通过IP地址访问
- **数据库自动初始化**：检测并自动创建数据库
- **双服务启动**：同时启动前后端开发服务器

#### 🚀 `deploy.js` - 生产部署
- **幂等部署**：多次执行仅增量更新
- **环境变量智能管理**：自动生成和更新.env文件
- **CORS自动配置**：根据域名自动设置跨域策略
- **数据库安全迁移**：优先使用Prisma迁移，备选db push
- **PM2集成**：智能检测并管理PM2进程

#### 🌀 `start-pm2.js` - PM2生产管理
- **前端重新构建**：清空并重新构建前端资源
- **智能进程管理**：自动检测并选择重启/新启
- **构建结果验证**：确保前端资源正确输出

#### 🔄 `sync-remote.js` - 远程同步
- **自动初始化**：非仓库目录自动初始化为Git仓库
- **安全覆盖策略**：防止意外覆盖未提交修改
- **增量同步**：智能选择fast-forward或hard reset
- **详细反馈**：显示变更文件列表和统计信息

## 🔐 默认账户信息

| 角色 | 用户名 | 密码 | 权限范围 | 描述 |
|------|---------|------|----------|------|
| **超级管理员** | admin | Test123!@# | 全系统管理 | 系统级权限，可管理所有厂区 |

> ⚠️ **安全提示**：生产环境部署后请立即修改默认密码！

## ⚡ 性能优化

### 数据库优化
- **索引策略**：工厂ID、用户角色、设备状态等关键字段索引
- **分页查询**：所有列表接口支持分页和筛选
- **连接池管理**：Prisma内置连接池优化

### 前端优化
- **代码分割**：路由级别的懒加载
- **图片压缩**：上传图片自动压缩和优化
- **静态资源缓存**：合理的缓存策略

### 服务端优化
- **缓存机制**：二维码和静态数据缓存
- **请求限流**：API级别的智能限流
- **日志优化**：结构化日志和自动轮转

## 🔒 安全特性

### 身份认证
- **双令牌JWT**：Access Token + Refresh Token机制
- **令牌黑名单**：支持强制登出和令牌失效
- **密码加密**：bcrypt高强度加密（默认12rounds）

### API安全
- **请求限流**：普通API 100次/15分钟，登录API 5次/15分钟
- **输入验证**：Joi + express-validator双层验证
- **SQL注入防护**：Prisma ORM天然防止SQL注入
- **XSS防护**：Helmet中间件全套安全头

### 文件安全
- **上传类型限制**：仅允许图片格式（JPEG/PNG/GIF）
- **文件大小限制**：默认5MB上限
- **文件名随机化**：防止路径遭受攻击

### 审计日志
- **操作审计**：所有关键操作自动记录
- **安全事件**：异常登录和权限变更监控
- **日志轮转**：自动清理过期日志文件

## 📊 系统监控

### 运行时状态
```bash
# PM2监控
pm2 status           # 进程状态
pm2 monit            # 实时监控
pm2 logs             # 日志查看

# 系统资源
npm run test:api     # API健康检查
npm run test:security # 安全检查
```

### 关键指标
- **响应时间**：API平均响应时间 < 200ms
- **并发处理**：支持500+并发访问
- **数据库性能**：SQLite单次查询 < 50ms
- **内存使用**：正常运行 < 512MB

## 📝 常见问题

### 部署相关

**Q: Node.js版本要求？**
A: 需要Node.js 20.0.0或更高版本。可使用`node --version`检查当前版本。

**Q: Windows系统如何生成SSL证书？**
A: 系统会自动尝试使用selfsigned包生成证书。如果失败，请安装Git Bash或WSL。

**Q: 数据库文件位置？**
A: 默认位于`backend/data/fire_safety.db`，可在.env文件中修改DATABASE_URL。

### 开发相关

**Q: 前端开发服务器端口冲突？**
A: 默认端口为5173。可修改`frontend/vite.config.ts`中的端口配置。

**Q: 如何添加新的设备类型？**
A: 1)修改Prisma schema 2)运行db:push更新结构 3)在管理后台添加设备类型和检查项模板。

### 生产环境

**Q: 如何配置反向代理？**
A: 推荐使用Nginx或Caddy配置反向代理到应用端口（默认3001）。

**Q: 如何备份SQLite数据库？**
A: 直接复制`backend/data/fire_safety.db`文件即可。建议定期自动备份。

**Q: PM2集群模式如何配置？**
A: 修改`backend/ecosystem.config.js`，设置instances: 'max'。注意SQLite不支持真正的并发写入。

---

## 🔗 相关资源

- [📄 API文档](backend/docs/API_DOCUMENTATION.md)
- [🔄 更新日志](CHANGELOG.md)
- [🤖 AI开发指导](CLAUDE.md)
- [🔧 部署指南](docs/deployment-guide.md)

## 📝 许可证

MIT License - 详情参见 [LICENSE](LICENSE) 文件

## 👥 贡献

欢迎提交Issue和Pull Request！请遵循项目的代码规范和提交规范。