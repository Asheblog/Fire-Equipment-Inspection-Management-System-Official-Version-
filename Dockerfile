# 基于 Debian（bookworm-slim）以避免 Prisma 在 Alpine 下的 musl 兼容问题
FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# 先拷贝依赖清单，利用 Docker 层缓存
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

RUN npm ci --prefix backend --no-fund --audit=false \
  && npm ci --prefix frontend --no-fund --audit=false

# 再拷贝源码并执行构建
COPY backend ./backend
COPY frontend ./frontend

RUN npm run db:generate --prefix backend \
  && npm run build --prefix frontend

# 运行时镜像：仅保留后端与启动脚本
FROM node:20-bookworm-slim

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY scripts ./scripts
COPY --from=builder /app/backend ./backend

# 创建运行时目录（配合 1Panel 挂载持久化）
RUN mkdir -p /app/backend/data /app/backend/uploads /app/backend/logs

EXPOSE 3001

# 启动时仅做数据库初始化与服务启动，不再运行 npm install / 前端构建
CMD ["npm", "start"]
