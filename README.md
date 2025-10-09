# 消防器材点检管理系统 🔥

现代化消防安全管理平台，基于 React 19 + Node.js（18+，推荐 20+），前后端集成部署，支持移动端扫码点检与 PC 管理后台。

## 系统截图
<img width="1920" height="879" alt="image" src="https://github.com/user-attachments/assets/b8cb0603-272b-451d-985d-8ce778149c60" />
<img width="1920" height="879" alt="image" src="https://github.com/user-attachments/assets/52533d3c-89ce-4460-be69-26d445f300e4" />

## 架构总览
- 前端：React + TypeScript + Vite + Tailwind + shadcn/ui；移动端扫码（html5‑qrcode）、可视化（Recharts）。
- 后端：Node.js + Express；Prisma ORM；JWT 认证（Access/Refresh）。
- 数据库：默认 SQLite，可通过 `DATABASE_URL` 切换其他数据库。
- 部署：后端托管前端静态资源，单端口统一访问；支持 Docker Compose 与原生 Node 部署。

## 核心功能
- 移动端扫码点检，支持离线缓存。
- 管理后台：设备、点检、隐患、报表一体化。
- RBAC 权限与多厂区数据隔离。
- 隐患闭环：上报 → 处理 → 审核 → 关闭。
- 实时看板与报表导出（Excel）。
- 本地二维码生成与批量打印。
- 相机增强（手电筒/对焦/设备选择）。
- 编号模糊搜索（无法扫码时快速定位）。

## 快速开始
- 环境：Node.js ≥ 18（推荐 20+），npm ≥ 9。
- 一键启动（推荐）
  ```bash
  npm run dev
  ```
  访问：PC `https://localhost:5173`，或手机 `https://[your-ip]:5173`
- 如首次运行失败，可分别在 `frontend/` 与 `backend/` 执行 `npm install` 后再重试。

## 生产部署（简版）
- Docker Compose（推荐）
  ```bash
  docker compose up -d --build
  docker compose logs -f --tail=200
  docker compose down
  ```
- 非 Docker（原生）
  ```bash
  # 交互式
  node deploy.js
  # 或一键脚本
  npm run deploy
  ```
- 重要：请在 `backend/.env` 设置强随机的 `JWT_SECRET` 与 `JWT_REFRESH_SECRET`；默认端口 `3001`，部署后访问 `http://<host>:3001/`。

## 项目结构（简版）
- `backend/`：API、ORM、静态托管
- `frontend/`：Web 前端
- `dev.js`、`deploy.js`、`sync-remote.js`：开发/部署/同步脚本
- `docker-compose.yml`、`Dockerfile`：容器化部署

更多细节：见 `backend/README.md` 与 `frontend/README.md`。

## 许可证与贡献
- 许可证：MIT（见 `LICENSE`）。
- 欢迎提交 Issue/PR；建议遵循约定式提交与项目代码规范。
