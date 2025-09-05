# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🔥 项目概述

消防器材点检管理系统是一个基于React + Node.js的现代化消防安全管理平台，采用前后端集成部署架构。

### 技术栈
- **前端**: React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Zustand
- **后端**: Node.js 18+ + Express.js + Prisma ORM + SQLite3
- **部署**: PM2 进程管理 + 集成部署模式

## 🚀 开发命令

### 快速启动
```bash
# 一键部署 (Windows)
deploy.bat

# 一键部署 (Linux/macOS)
chmod +x deploy.sh && ./deploy.sh

# 开发模式初始化
cd backend && npm run setup
```

### 前端开发
```bash
cd frontend
npm install
npm run dev        # 启动开发服务器
npm run build      # 构建生产版本
npm run lint       # 代码检查
```

### 后端开发
```bash
cd backend
npm install
npm run dev        # 启动开发服务器 (nodemon)
npm start          # 启动生产服务器
npm test           # 运行API测试
npm run test:security  # 安全测试
```

### 数据库管理
```bash
cd backend
npm run db:generate     # 生成Prisma客户端
npm run db:push         # 同步数据库结构
npm run db:seed         # 填充种子数据
npm run db:studio       # 打开数据库管理界面
npm run db:setup        # 完整数据库初始化
```

### 生产环境管理
```bash
cd backend
pm2 status              # 查看应用状态
pm2 logs                # 查看日志
pm2 restart all         # 重启应用
pm2 stop all            # 停止应用
```

## 🏗️ 架构设计

### 部署架构
- **集成部署模式**: 后端服务器同时提供API服务和前端静态文件托管
- **单一端口访问**: 所有请求通过3001端口，API路由在/api/*，前端路由在根路径
- **跨平台支持**: Windows/Linux/macOS全平台兼容

### 目录结构
```
├── backend/                # 后端应用
│   ├── src/               # 源代码
│   │   ├── controllers/   # 控制器 (业务逻辑)
│   │   ├── services/      # 服务层 (数据处理)
│   │   ├── routes/        # 路由定义
│   │   ├── middleware/    # 中间件
│   │   ├── security/      # 安全模块
│   │   └── utils/         # 工具函数
│   ├── prisma/            # 数据库模型和迁移
│   ├── uploads/           # 文件上传存储
│   └── public/            # 前端构建文件 (自动生成)
├── frontend/              # 前端应用
│   ├── src/
│   │   ├── pages/         # 页面组件
│   │   ├── components/    # UI组件
│   │   ├── stores/        # Zustand状态管理
│   │   ├── api/           # API接口层
│   │   └── types/         # TypeScript类型
│   └── dist/              # 构建输出 (部署时复制到backend/public)
└── docs/                  # 文档目录
```

### 核心模块

#### 数据模型 (backend/prisma/schema.prisma)
- `User`: 用户系统 (超级管理员/厂区管理员/点检员)
- `Factory`: 厂区管理
- `Equipment`: 消防器材台账
- `EquipmentType` + `ChecklistTemplate`: 器材类型和检查项模板
- `InspectionLog`: 点检记录
- `Issue`: 隐患处理流程

#### API路由模块 (backend/src/routes/)
- `auth.routes.js`: 身份认证 (登录/刷新令牌)
- `equipment.routes.js`: 器材管理 (CRUD + 二维码生成)
- `inspection.routes.js`: 点检流程 (扫码点检 + 记录查询)
- `issue.routes.js`: 隐患管理 (上报 + 处理 + 审核)
- `user.routes.js`: 用户管理 (角色权限)
- `report.routes.js`: 数据报表 (统计分析)

#### 安全模块 (backend/src/security/)
- `security-config.js`: 整体安全配置 (CORS + Helmet + 限流)
- `auth.middleware.js`: JWT认证中间件
- `rate-limiter.js`: API限流
- `file-upload.js`: 文件上传安全过滤
- `input-validator.js`: 输入验证
- `audit-logger.js`: 操作审计日志

#### 前端页面组件 (frontend/src/pages/)
- `LoginPage.tsx`: 登录页面
- `DashboardPage.tsx`: PC端管理后台
- `mobile/MobileDashboard.tsx`: 移动端首页
- `mobile/MobileInspectionPage.tsx`: 移动端点检页面

## 🔐 权限系统

### 用户角色
- **SUPER_ADMIN**: 超级管理员 (系统全局管理)
- **FACTORY_ADMIN**: 厂区管理员 (所属厂区管理)
- **INSPECTOR**: 点检员 (扫码点检)

### 数据隔离
- 基于`factoryId`实现厂区级数据隔离
- 超级管理员可访问所有厂区数据
- 厂区管理员只能访问所属厂区数据
- 点检员只能进行点检操作

### 认证流程
1. 用户登录获取JWT访问令牌和刷新令牌
2. API请求需携带Authorization: Bearer <token>
3. 令牌过期时使用刷新令牌获取新的访问令牌

## 📱 功能特性

### 移动端功能
- 扫码点检: 调用html5-qrcode扫描器材二维码
- 动态表单: 根据器材类型加载检查项模板
- 异常上报: 发现问题时拍照上传和描述

### PC端管理
- 实时看板: 器材状态统计、点检进度、隐患数量
- 器材管理: 台账管理、二维码批量生成、Excel导入
- 隐患管理: 处理流程(待处理→处理中→待审核→已关闭)
- 数据报表: 月度统计、趋势分析、导出功能

## 🛠️ 开发指南

### 添加新功能模块
1. **数据模型**: 在`prisma/schema.prisma`中定义新表结构
2. **数据库同步**: 运行`npm run db:push`应用结构变更
3. **API层**: 在`src/routes/`创建路由文件
4. **服务层**: 在`src/services/`创建业务逻辑
5. **控制器**: 在`src/controllers/`创建控制器
6. **前端接口**: 在`frontend/src/api/`定义API调用
7. **页面组件**: 在`frontend/src/pages/`创建页面
8. **权限验证**: 确保添加适当的角色权限检查

### 代码风格
- 后端: Express.js标准模式，采用模块化结构
- 前端: React函数式组件 + TypeScript + Hooks
- 数据库: Prisma ORM，类型安全的数据访问
- 安全: 所有API都需要认证和权限验证

### 调试和测试
- 后端API测试: `npm run test:api`
- 安全测试: `npm run test:security`
- 数据库管理: `npm run db:studio`
- 日志查看: PM2日志在`backend/logs/`目录

### 环境配置
主要配置在`backend/.env`文件:
- DATABASE_URL: SQLite数据库文件路径
- JWT_SECRET: JWT签名密钥
- PORT: 服务端口 (默认3001)
- UPLOAD_DIR: 文件上传目录

## 📊 默认测试账户

| 角色 | 用户名 | 密码 | 权限范围 |
|------|--------|------|----------|
| 超级管理员 | admin | Test123!@# | 全系统管理 |
| A厂区管理员 | admin_a | Test123!@# | A厂区管理 |
| B厂区管理员 | admin_b | Test123!@# | B厂区管理 |
| C厂区管理员 | admin_c | Test123!@# | C厂区管理 |
| 点检员 | inspector_001~004 | Test123!@# | 扫码点检 |

## 🚦 常见问题

### 部署相关
- 确保Node.js版本 >= 18.0.0
- Windows用户运行`deploy.bat`，Linux/macOS运行`deploy.sh`
- 数据库文件位于`backend/data/fire_safety.db`
- 上传文件存储在`backend/uploads/`

### 开发相关
- 前端开发服务器: http://localhost:5173
- 后端API服务器: http://localhost:3001
- 数据库管理界面: http://localhost:5555 (运行db:studio时)
- API文档详见: `backend/API_DOCUMENTATION.md`

### 生产环境
- 使用PM2管理进程，支持自动重启和负载均衡
- 日志文件自动滚动，位于`backend/logs/`
- 支持集群模式部署以提高性能