# 生产环境HTTPS/SSL部署完整指南

本指南将帮助您为消防器材点检管理系统配置HTTPS支持，解决摄像头权限问题并提升系统安全性。

## 🔧 快速开始 - 开发环境HTTPS

### 方式1：使用已配置的开发环境

项目已经配置好了开发环境的HTTPS支持：

```bash
# Windows
set HTTPS=true && npm run dev

# Linux/macOS
HTTPS=true npm run dev
```

访问: `https://localhost:5173`

**注意**: 首次访问会提示证书不安全，选择"继续访问"或"高级" -> "继续前往localhost"

### 方式2：移动设备访问

1. 确保电脑和手机在同一WiFi网络
2. 查看电脑IP地址：
   ```bash
   # Windows
   ipconfig | findstr IPv4
   
   # Linux/macOS  
   ifconfig | grep inet
   ```
3. 启动HTTPS开发服务器：
   ```bash
   HTTPS=true npm run dev
   ```
4. 手机访问：`https://你的IP:5173`（如 `https://192.168.1.100:5173`）

---

## 🚀 生产环境SSL部署

### 部署架构概览

```
互联网 → Nginx (443/80) → Node.js应用 (3001)
         ↑ SSL终端      ↑ 应用服务器
```

### 前置要求

- Ubuntu 20.04+ / CentOS 8+ / Windows Server 2019+
- 有效域名（如 `fire-safety.yourdomain.com`）
- 域名DNS指向您的服务器IP

---

## 📋 方案1：使用Let's Encrypt免费证书 (推荐)

### 步骤1：安装Nginx和Certbot

**Ubuntu/Debian:**
```bash
# 更新包管理器
sudo apt update

# 安装Nginx
sudo apt install nginx -y

# 安装Certbot
sudo apt install certbot python3-certbot-nginx -y

# 启动并启用Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

**CentOS/RHEL:**
```bash
# 安装EPEL仓库
sudo yum install epel-release -y

# 安装Nginx和Certbot
sudo yum install nginx certbot python3-certbot-nginx -y

# 启动并启用Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 步骤2：配置域名DNS

确保您的域名DNS A记录指向服务器IP：
```
A    fire-safety    YOUR_SERVER_IP
A    www.fire-safety    YOUR_SERVER_IP
```

### 步骤3：申请SSL证书

```bash
# 为域名申请证书
sudo certbot --nginx -d fire-safety.yourdomain.com -d www.fire-safety.yourdomain.com

# 按提示输入邮箱地址
# 同意服务条款
# 选择是否分享邮箱（可选No）
```

### 步骤4：配置Nginx反向代理

创建Nginx配置文件：
```bash
sudo nano /etc/nginx/sites-available/fire-safety
```

配置内容：
```nginx
server {
    listen 80;
    server_name fire-safety.yourdomain.com www.fire-safety.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name fire-safety.yourdomain.com www.fire-safety.yourdomain.com;

    # SSL证书配置 (Certbot会自动添加)
    ssl_certificate /etc/letsencrypt/live/fire-safety.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/fire-safety.yourdomain.com/privkey.pem;
    
    # SSL安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS安全头
    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";

    # 文件上传大小限制
    client_max_body_size 50M;

    # 静态文件缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri @proxy;
    }

    # API和主要内容代理到Node.js应用
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    # 健康检查
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

### 步骤5：启用站点配置

```bash
# 创建软链接启用站点
sudo ln -s /etc/nginx/sites-available/fire-safety /etc/nginx/sites-enabled/

# 测试Nginx配置
sudo nginx -t

# 重载Nginx配置
sudo systemctl reload nginx
```

### 步骤6：配置防火墙

```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### 步骤7：配置证书自动续期

```bash
# 测试续期
sudo certbot renew --dry-run

# 如果测试成功，Certbot会自动设置cron任务
# 可以手动检查cron任务
sudo crontab -l
```

---

## 📋 方案2：使用自签名证书 (内网环境)

### 步骤1：生成根证书

```bash
# 创建证书目录
sudo mkdir -p /etc/ssl/private
sudo mkdir -p /etc/ssl/certs

# 生成根证书私钥
sudo openssl genrsa -out /etc/ssl/private/ca-key.pem 4096

# 生成根证书
sudo openssl req -new -x509 -key /etc/ssl/private/ca-key.pem -out /etc/ssl/certs/ca.pem -days 3650 -subj "/C=CN/ST=Beijing/L=Beijing/O=FireSafety/OU=IT/CN=FireSafety-CA"
```

### 步骤2：生成服务器证书

创建配置文件：
```bash
sudo cat > /etc/ssl/server.conf << EOF
[req]
distinguished_name = req_distinguished_name
req_extensions = v3_req
prompt = no

[req_distinguished_name]
C = CN
ST = Beijing
L = Beijing
O = FireSafety
OU = IT
CN = fire-safety.local

[v3_req]
keyUsage = keyEncipherment, dataEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = fire-safety.local
DNS.2 = *.fire-safety.local
DNS.3 = localhost
IP.1 = 127.0.0.1
IP.2 = YOUR_SERVER_IP
EOF
```

生成服务器证书：
```bash
# 生成服务器私钥
sudo openssl genrsa -out /etc/ssl/private/server-key.pem 2048

# 生成证书签名请求
sudo openssl req -new -key /etc/ssl/private/server-key.pem -out /etc/ssl/server.csr -config /etc/ssl/server.conf

# 使用根证书签名
sudo openssl x509 -req -in /etc/ssl/server.csr -CA /etc/ssl/certs/ca.pem -CAkey /etc/ssl/private/ca-key.pem -CAcreateserial -out /etc/ssl/certs/server.pem -days 365 -extensions v3_req -extfile /etc/ssl/server.conf

# 清理临时文件
sudo rm /etc/ssl/server.csr
```

### 步骤3：配置Nginx（自签名证书）

```nginx
server {
    listen 443 ssl http2;
    server_name fire-safety.local YOUR_SERVER_IP;

    ssl_certificate /etc/ssl/certs/server.pem;
    ssl_certificate_key /etc/ssl/private/server-key.pem;
    
    # 其他配置同上...
}
```

---

## 🔧 Node.js应用HTTPS支持

### 方式1：Nginx代理模式（推荐）

保持现有Node.js应用不变，所有HTTPS由Nginx处理。这是最常见和推荐的方式。

### 方式2：Node.js原生HTTPS

如果需要Node.js直接提供HTTPS：

创建 `backend/src/https-server.js`：
```javascript
const https = require('https');
const fs = require('fs');
const path = require('path');
const app = require('./app'); // 您的Express应用

const options = {
  key: fs.readFileSync('/etc/ssl/private/server-key.pem'),
  cert: fs.readFileSync('/etc/ssl/certs/server.pem')
};

const httpsServer = https.createServer(options, app);

const PORT = process.env.HTTPS_PORT || 3443;
httpsServer.listen(PORT, () => {
  console.log(`HTTPS Server running on port ${PORT}`);
});

// 同时保持HTTP服务器用于健康检查
const http = require('http');
const httpServer = http.createServer(app);
httpServer.listen(3001, () => {
  console.log('HTTP Server running on port 3001');
});
```

---

## 📜 自动化部署脚本

### 增强的部署脚本

创建 `deploy-production.sh`：
```bash
#!/bin/bash

echo "🚀 开始生产环境SSL部署..."

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
  echo "请使用sudo运行此脚本"
  exit 1
fi

# 配置变量
DOMAIN="fire-safety.yourdomain.com"
EMAIL="admin@yourdomain.com"
APP_DIR="/opt/fire-safety"
NGINX_CONF="/etc/nginx/sites-available/fire-safety"

# 1. 安装依赖
echo "📦 安装系统依赖..."
apt update
apt install -y nginx certbot python3-certbot-nginx nodejs npm git

# 2. 部署应用代码
echo "📁 部署应用代码..."
mkdir -p $APP_DIR
cd $APP_DIR

# 如果是从Git仓库部署
# git clone https://github.com/yourusername/fire-safety-system.git .
# 如果是从本地复制
# cp -r /path/to/your/code/* .

# 3. 安装应用依赖
echo "📦 安装应用依赖..."
cd backend && npm install --production
cd ../frontend && npm install && npm run build

# 4. 配置PM2
echo "⚙️ 配置PM2..."
npm install -g pm2
cd $APP_DIR/backend

# 创建PM2配置文件
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'fire-safety-backend',
    script: 'setup-and-run.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};
EOF

# 5. 申请SSL证书
echo "🔒 申请SSL证书..."
certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos --non-interactive

# 6. 配置Nginx
echo "🌐 配置Nginx..."
# [这里是完整的Nginx配置，参考上面的配置]

# 7. 启动服务
echo "🏃 启动服务..."
systemctl enable nginx
systemctl start nginx
cd $APP_DIR/backend
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 8. 配置防火墙
echo "🔥 配置防火墙..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "✅ 部署完成！"
echo "🌐 访问地址: https://$DOMAIN"
echo "📊 PM2状态: pm2 status"
echo "📋 查看日志: pm2 logs"
```

使用方法：
```bash
sudo chmod +x deploy-production.sh
sudo ./deploy-production.sh
```

---

## 🔍 故障排除

### 常见问题和解决方案

#### 1. 证书申请失败
```bash
# 检查域名DNS是否正确指向
nslookup fire-safety.yourdomain.com

# 检查80端口是否被占用
sudo netstat -tlnp | grep :80

# 手动申请证书
sudo certbot certonly --standalone -d fire-safety.yourdomain.com
```

#### 2. Nginx配置错误
```bash
# 测试Nginx配置
sudo nginx -t

# 查看Nginx错误日志
sudo tail -f /var/log/nginx/error.log

# 重载配置
sudo systemctl reload nginx
```

#### 3. PM2应用问题
```bash
# 查看PM2状态
pm2 status

# 查看应用日志
pm2 logs fire-safety-backend

# 重启应用
pm2 restart fire-safety-backend
```

#### 4. 防火墙问题
```bash
# 检查防火墙状态
sudo ufw status

# 检查端口监听
sudo netstat -tlnp | grep -E ':(80|443|3001)'
```

#### 5. SSL证书问题
```bash
# 检查证书有效期
sudo certbot certificates

# 测试证书续期
sudo certbot renew --dry-run

# 手动续期
sudo certbot renew
```

---

## 📈 性能优化建议

### 1. Nginx优化

在 `/etc/nginx/nginx.conf` 中添加：
```nginx
# 工作进程数
worker_processes auto;

# 连接数限制
events {
    worker_connections 1024;
    use epoll;
}

http {
    # 启用gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/javascript application/xml+rss 
               application/json image/svg+xml;

    # 缓存配置
    open_file_cache max=1000 inactive=20s;
    open_file_cache_valid 30s;
    open_file_cache_min_uses 2;
    open_file_cache_errors on;
}
```

### 2. 应用优化

- 启用应用级缓存
- 使用CDN加速静态资源
- 数据库连接池优化
- 定期清理日志文件

### 3. 监控配置

安装监控工具：
```bash
# 安装htop和iotop
sudo apt install htop iotop

# 配置logrotate
sudo nano /etc/logrotate.d/fire-safety
```

---

## 🔐 安全最佳实践

### 1. 定期更新
```bash
# 系统更新
sudo apt update && sudo apt upgrade

# 应用依赖更新
npm audit fix
```

### 2. 备份策略
```bash
# 数据库备份
cp /path/to/database.db /backup/database-$(date +%Y%m%d).db

# 应用备份
tar -czf /backup/app-$(date +%Y%m%d).tar.gz /opt/fire-safety
```

### 3. 访问控制
- 配置SSH密钥认证
- 禁用root直接登录
- 使用fail2ban防护暴力破解

---

## 📞 技术支持

如果在部署过程中遇到问题：

1. 查看项目README.md文档
2. 检查系统日志：`sudo journalctl -u nginx`
3. 查看应用日志：`pm2 logs`
4. 确认网络和DNS配置

部署完成后，您的消防器材点检管理系统将完全支持HTTPS，摄像头扫码功能将正常工作。