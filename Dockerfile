# 基于 Debian（bookworm-slim）以避免 Prisma 在 Alpine 下的 musl 兼容问题
FROM node:20-bookworm-slim

WORKDIR /app

# 仅拷贝 package.json 以缓存依赖层（可选：实际安装在运行时由 npm start 完成）
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# 拷贝全部源码
COPY . .

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

# 使用仓库内的一键脚本，自动安装依赖、初始化数据库、构建前端并启动后端
CMD ["npm", "start"]

