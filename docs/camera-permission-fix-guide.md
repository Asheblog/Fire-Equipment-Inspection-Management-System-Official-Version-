# 摄像头权限问题解决方案使用指南

## 问题现象
- 移动端访问扫码功能时，摄像头权限直接被拒绝
- 控制台错误：`Camera permission error` 或 `HTML Element with id=qr-reader not found`
- 扫码按钮点击后没有响应或显示权限错误

## 根本原因
现代浏览器的安全策略要求摄像头功能只能在安全上下文(HTTPS)中使用。在HTTP环境下，`navigator.mediaDevices.getUserMedia()` API被禁用。

**特别问题**: 局域网IP地址经常变化，导致SSL证书不匹配，出现`ERR_SSL_PROTOCOL_ERROR`错误。

## 解决方案

### 🚀 快速修复局域网IP问题（推荐）

#### 一键修复工具
```bash
# Linux/macOS
./fix-ip-cert.sh

# Windows
fix-ip-cert.bat
```

这个工具会：
- 自动检测当前局域网IP
- 检查SSL证书是否包含该IP
- 如果不包含，自动更新证书
- 提供正确的访问地址

#### 手动生成支持当前IP的证书
```bash
# Linux/macOS
./generate-ssl-cert.sh

# Windows  
generate-ssl-cert.bat
```

### 1. 开发环境快速解决

#### 方式1：使用自动化脚本（推荐）
```bash
# 一键启动HTTPS开发环境
./dev-https.sh
```

#### 方式2：手动启动HTTPS
```bash
# 前端HTTPS开发服务器
cd frontend
HTTPS=true npm run dev

# 访问 https://localhost:5173
```

#### 方式3：移动设备访问
1. 确保电脑和手机在同一WiFi网络
2. 查看电脑IP地址：`ipconfig`（Windows）或 `ifconfig`（Linux/macOS）
3. 手机访问：`https://你的IP:5173`
4. 信任自签名证书

### 2. 生产环境部署

#### 自动化部署（推荐）
```bash
./deploy.sh
# 选择 "y" 启用HTTPS支持
# 按照提示配置SSL证书
```

#### 完整SSL部署
参考详细指南：[docs/ssl-deployment-guide.md](docs/ssl-deployment-guide.md)

包含：
- Let's Encrypt免费证书申请
- Nginx反向代理配置
- 自动化部署脚本
- 故障排除指南

## 验证解决效果

### 1. 检查安全上下文
在浏览器开发者工具中输入：
```javascript
console.log('isSecureContext:', window.isSecureContext);
console.log('mediaDevices:', !!navigator.mediaDevices);
```

应该显示：
```
isSecureContext: true
mediaDevices: true
```

### 2. 测试摄像头权限
1. 访问移动端页面：`https://localhost:5173/m`
2. 点击"开始扫描"按钮
3. 浏览器应该弹出摄像头权限请求
4. 允许权限后，摄像头画面正常显示

### 3. 测试扫码功能
1. 准备一个二维码（可以是任意网址）
2. 将二维码对准摄像头
3. 系统应该能够成功识别并跳转

## 常见问题排除

### 证书不被信任
- **现象**：浏览器显示"您的连接不是私密连接"
- **解决**：点击"高级" → "继续前往localhost（不安全）"
- **原因**：自签名证书未被浏览器信任

### 摄像头仍然无法访问
- **检查1**：确认正在使用HTTPS协议（地址栏显示🔒图标）
- **检查2**：清除浏览器缓存和权限设置
- **检查3**：重启浏览器后重试
- **检查4**：在其他设备/浏览器上测试

### 移动设备无法访问
- **检查1**：确保设备在同一网络
- **检查2**：防火墙是否阻止了5173端口
- **检查3**：使用IP地址而不是localhost访问
- **检查4**：手动信任证书后重试

### 开发服务器启动失败
- **检查1**：端口是否被占用（5173、5174、5175等）
- **检查2**：SSL证书文件是否存在
- **检查3**：OpenSSL是否正确安装
- **检查4**：查看具体错误信息

## 技术说明

### 安全上下文要求
根据Web标准，以下API只能在安全上下文中使用：
- `navigator.mediaDevices.getUserMedia()`
- `navigator.geolocation`
- `navigator.serviceWorker`
- `window.crypto.subtle`

### HTTPS部署的额外好处
- 保护用户数据传输安全
- 提升SEO排名
- 支持HTTP/2协议
- 符合现代Web标准
- 提高用户信任度

### 证书类型对比

| 证书类型 | 适用场景 | 成本 | 安全性 | 部署难度 |
|----------|----------|------|--------|----------|
| 自签名证书 | 开发/内网环境 | 免费 | 中等 | 简单 |
| Let's Encrypt | 生产环境 | 免费 | 高 | 中等 |
| 商业证书 | 企业级应用 | 付费 | 最高 | 中等 |

## 后续维护

### 证书更新
- Let's Encrypt证书有效期90天，需要定期更新
- 自动续期配置：`sudo certbot renew --dry-run`
- 监控证书到期时间

### 性能监控
- 定期检查HTTPS性能影响
- 监控SSL握手时间
- 优化证书链长度

## 联系支持

如果问题仍未解决：
1. 查看项目README.md文档
2. 检查CHANGELOG.md更新日志
3. 查阅SSL部署指南详细说明