import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'

// 智能证书检查和生成函数
function ensureSSLCertificate() {
  const keyPath = './certs/localhost-key.pem'
  const certPath = './certs/localhost.pem'
  
  // 检查证书是否存在
  const keyExists = fs.existsSync(keyPath)
  const certExists = fs.existsSync(certPath)
  
  if (!keyExists || !certExists) {
    console.log('🔐 SSL证书不存在，正在生成...')
    generateSSLCertificate()
    return
  }
  
  // 检查证书是否过期（如果创建时间超过30天，重新生成）
  try {
    const certStats = fs.statSync(certPath)
    const daysSinceCreated = (Date.now() - certStats.mtime.getTime()) / (1000 * 60 * 60 * 24)
    
    if (daysSinceCreated > 30) {
      console.log('🔄 SSL证书即将过期，正在更新...')
      generateSSLCertificate()
      return
    }
  } catch (error) {
    console.log('⚠️ 证书检查失败，重新生成...')
    generateSSLCertificate()
    return
  }
  
  // 检查证书是否包含当前IP（简单检查）
  try {
    const certContent = fs.readFileSync(certPath, 'utf8')
    const currentIP = getCurrentIP()
    
    if (currentIP && !certContent.includes(currentIP)) {
      console.log(`🌐 检测到新的IP地址 ${currentIP}，更新证书...`)
      generateSSLCertificate()
      return
    }
  } catch (error) {
    // 忽略IP检查错误，使用现有证书
  }
  
  console.log('✅ SSL证书检查通过')
}

// 获取当前主要IP地址
function getCurrentIP() {
  try {
    if (process.platform === 'win32') {
      const result = execSync('powershell -Command "Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like \'192.168.*\'} | Select-Object -First 1 -ExpandProperty IPAddress"', { encoding: 'utf8' })
      return result.trim()
    } else {
      // Linux/macOS
      const result = execSync("ip route get 1.1.1.1 2>/dev/null | grep -oP 'src \\K\\S+' 2>/dev/null || ifconfig 2>/dev/null | grep -oE 'inet [0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+' | grep -oE '[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+' | grep '^192\\.168\\.' | head -1", { encoding: 'utf8' })
      return result.trim()
    }
  } catch (error) {
    return null
  }
}

// 生成SSL证书
function generateSSLCertificate() {
  try {
    console.log('🔐 SSL证书将在下次启动时更新...')
    console.log('💡 请手动运行证书生成脚本以立即更新:')
    if (process.platform === 'win32') {
      console.log('   generate-ssl-cert.bat')
    } else {
      console.log('   ./generate-ssl-cert.sh')
    }
    
    // 简化的证书生成，避免在Vite启动过程中执行复杂脚本
    // 用户可以手动运行生成脚本，或者使用dev-https-smart.sh自动处理
  } catch (error: unknown) {
    const msg = (error as any)?.message || String(error)
    console.error('❌ SSL证书检查失败:', msg)
  }
}

// 在HTTPS模式下确保证书可用
if (process.env.HTTPS === 'true') {
  ensureSSLCertificate()
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0', // 允许局域网访问
    port: 5173,
    // HTTPS 开发环境配置（避免返回 false 触发类型错误）
    https: process.env.HTTPS === 'true'
      ? (fs.existsSync('./certs/localhost-key.pem') && fs.existsSync('./certs/localhost.pem')
          ? {
              key: fs.readFileSync('./certs/localhost-key.pem'),
              cert: fs.readFileSync('./certs/localhost.pem')
            }
          : undefined)
      : undefined,
    proxy: {
      '/api': {
        target: 'http://localhost:3001', // 后端始终使用HTTP，避免SSL协议不匹配
        changeOrigin: true,
        secure: false, // 允许自签名证书
      },
      '/uploads': {
        target: 'http://localhost:3001', // 后端始终使用HTTP，避免SSL协议不匹配
        changeOrigin: true,
        secure: false, // 允许自签名证书
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // 转发原始请求的Authorization头
            if (req.headers.authorization) {
              proxyReq.setHeader('Authorization', req.headers.authorization);
            }
          });
        }
      }
    }
  },
  build: {
    outDir: '../backend/public',
    emptyOutDir: true,
  }
})
