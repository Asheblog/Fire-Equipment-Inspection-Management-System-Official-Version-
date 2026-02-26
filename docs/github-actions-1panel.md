# GitHub Actions 构建 + 1Panel 编排部署

## 目标
- 镜像由 GitHub Actions 自动构建并推送到 GHCR。
- 1Panel 仅负责拉取镜像与编排运行，不再在服务器本地构建。
- 持久化目录强制挂载：数据库、上传图片、运行日志。

## CI 工作流
- 文件：`.github/workflows/docker-image.yml`
- 触发：
  - `push` 到 `main/master`
  - `push` 标签 `v*`
  - `pull_request`（仅构建，不推送）
  - `workflow_dispatch`
- 产物镜像：
  - `ghcr.io/<owner>/<repo>:latest`（默认分支）
  - `ghcr.io/<owner>/<repo>:<branch>`
  - `ghcr.io/<owner>/<repo>:<tag>`
  - `ghcr.io/<owner>/<repo>:sha-<commit>`

## 1Panel 编排文件
- 文件：`deploy/1panel-compose.yml`
- 环境变量模板：`deploy/1panel.env.example`
- 持久化目录映射：
  - `./storage/data -> /app/backend/data`（SQLite 数据库）
  - `./storage/uploads -> /app/backend/uploads`（上传图片）
  - `./storage/logs -> /app/backend/logs`（运行日志）

## 1Panel / 命令行部署命令

### Linux / WSL（bash）
```bash
mkdir -p storage/data storage/uploads storage/logs

cp deploy/1panel.env.example .env
# 编辑 .env：填入 APP_IMAGE/JWT_SECRET/JWT_REFRESH_SECRET

docker compose --env-file .env -f deploy/1panel-compose.yml pull
docker compose --env-file .env -f deploy/1panel-compose.yml up -d
docker compose --env-file .env -f deploy/1panel-compose.yml logs -f --tail=200
```

### Windows PowerShell
```powershell
New-Item -ItemType Directory -Force -Path storage/data,storage/uploads,storage/logs | Out-Null

Copy-Item deploy/1panel.env.example .env
# 编辑 .env：填入 APP_IMAGE/JWT_SECRET/JWT_REFRESH_SECRET

docker compose --env-file .env -f deploy/1panel-compose.yml pull
docker compose --env-file .env -f deploy/1panel-compose.yml up -d
docker compose --env-file .env -f deploy/1panel-compose.yml logs -f --tail=200
```

## 升级命令（同版本结构）
```bash
docker compose --env-file .env -f deploy/1panel-compose.yml pull
docker compose --env-file .env -f deploy/1panel-compose.yml up -d
```

## 迁移策略
- 本次为**无迁移、直接替换**。
- 前提：保留 `storage/data`、`storage/uploads`、`storage/logs` 三个持久化目录。
- 若需回滚：切换 `APP_IMAGE` 到旧标签后重新 `up -d`。
