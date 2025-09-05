import React, { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Camera, CameraOff, Lightbulb, RotateCcw, SwitchCamera } from 'lucide-react'

interface QRCodeScannerProps {
  onScanSuccess: (qrCode: string) => void
  onScanError?: (error: string) => void
  className?: string
}

export const QRCodeScanner: React.FC<QRCodeScannerProps> = ({
  onScanSuccess,
  onScanError,
  className = ''
}) => {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string>('')
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [isSecureContext, setIsSecureContext] = useState<boolean>(true)
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([])
  const [currentCameraId, setCurrentCameraId] = useState<string>('')

  // 检查安全上下文
  useEffect(() => {
    const checkSecureContext = () => {
      // 检查是否为安全上下文
      const isSecure = window.isSecureContext
      // 检查 MediaDevices API 是否可用
      const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      
      setIsSecureContext(isSecure && hasMediaDevices)
      
      if (!isSecure || !hasMediaDevices) {
        console.warn('Insecure context detected:', { isSecure, hasMediaDevices })
        setError('需要HTTPS环境才能使用摄像头功能')
        if (onScanError) {
          onScanError('不安全的上下文环境，摄像头功能不可用')
        }
      }
    }
    
    checkSecureContext()
  }, [])

  const qrCodeSuccessCallback = (decodedText: string) => {
    console.log('QR Code scanned:', decodedText)
    onScanSuccess(decodedText)
    stopScanner()
  }

  const qrCodeErrorCallback = (error: string) => {
    // 忽略常见的扫描错误（避免过多日志）
    if (!error.includes('QR code parse error') && !error.includes('No MultiFormat Readers')) {
      console.warn('QR Code scan error:', error)
    }
  }

  const getCameras = async () => {
    try {
      const devices = await Html5Qrcode.getCameras()
      console.log('Available cameras:', devices)
      setCameras(devices)
      
      // 优先选择后置摄像头
      let preferredCamera = devices.find(camera => 
        camera.label.toLowerCase().includes('back') || 
        camera.label.toLowerCase().includes('rear') ||
        camera.label.toLowerCase().includes('environment')
      )
      
      // 如果没有找到后置摄像头，选择第一个
      if (!preferredCamera && devices.length > 0) {
        preferredCamera = devices[0]
      }
      
      if (preferredCamera) {
        setCurrentCameraId(preferredCamera.id)
        return preferredCamera.id
      }
      
      return null
    } catch (err: any) {
      console.error('获取摄像头列表失败:', err)
      setError('无法获取摄像头列表')
      return null
    }
  }

  const startScanningWithCamera = async (cameraId: string) => {
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode('qr-reader')
    }

    try {
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
        disableFlip: false
      }

      await scannerRef.current.start(
        cameraId,
        config,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      )
      
      setError('')
    } catch (err: any) {
      console.error('开始扫描失败:', err)
      setError('启动摄像头失败，请重试')
      setIsScanning(false)
    }
  }

  const startScanner = async () => {
    // 首先检查安全上下文
    if (!isSecureContext) {
      setError('需要HTTPS环境才能使用摄像头功能')
      if (onScanError) {
        onScanError('不安全的上下文环境')
      }
      return
    }

    try {
      // 检查摄像头权限
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(track => track.stop()) // 立即停止测试流
      setHasPermission(true)
      setError('')
      
      // 获取摄像头列表
      const cameraId = await getCameras()
      if (cameraId) {
        // 先设置扫描状态，让DOM元素渲染出来
        setIsScanning(true)
      } else {
        setError('未找到可用的摄像头')
      }
    } catch (err: any) {
      console.error('Camera permission error:', err)
      setHasPermission(false)
      setError('无法访问摄像头，请检查浏览器权限设置')
      if (onScanError) {
        onScanError('摄像头权限被拒绝')
      }
    }
  }

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
      } catch (err) {
        console.warn('停止扫描时出现警告:', err)
      }
    }
    setIsScanning(false)
  }

  const resetScanner = async () => {
    await stopScanner()
    setError('')
    setHasPermission(null)
    setCameras([])
    setCurrentCameraId('')
  }

  const switchCamera = async () => {
    if (cameras.length <= 1) return
    
    await stopScanner()
    
    const currentIndex = cameras.findIndex(camera => camera.id === currentCameraId)
    const nextIndex = (currentIndex + 1) % cameras.length
    const nextCamera = cameras[nextIndex]
    
    setCurrentCameraId(nextCamera.id)
    await startScanningWithCamera(nextCamera.id)
  }

  // 监听扫描状态变化，DOM渲染完成后启动摄像头
  useEffect(() => {
    if (isScanning && currentCameraId && hasPermission) {
      // 使用setTimeout确保DOM元素已经渲染
      const timer = setTimeout(async () => {
        const element = document.getElementById('qr-reader')
        if (element) {
          await startScanningWithCamera(currentCameraId)
        } else {
          console.error('qr-reader element not found after timeout')
          setError('扫描器DOM元素未找到')
          setIsScanning(false)
        }
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [isScanning, currentCameraId, hasPermission])

  // 清理资源
  useEffect(() => {
    return () => {
      stopScanner()
    }
  }, [])

  // 如果不是安全上下文，显示HTTPS升级提示
  if (!isSecureContext) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <CameraOff className="h-5 w-5" />
            需要HTTPS环境
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            摄像头功能需要在安全的HTTPS环境下才能使用。
          </p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium">开发环境解决方案：</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>使用 HTTPS=true npm run dev 启动开发服务器</li>
              <li>信任自签名证书后访问 https://localhost:5173</li>
              <li>或者在移动设备上使用 https://your-ip:5173</li>
            </ol>
            <p className="font-medium mt-4">生产环境解决方案：</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>配置SSL证书</li>
              <li>使用HTTPS域名访问</li>
              <li>参考项目文档中的SSL部署指南</li>
            </ol>
          </div>
          <Button onClick={() => window.location.reload()} className="w-full">
            <RotateCcw className="mr-2 h-4 w-4" />
            重新检测
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (hasPermission === false) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <CameraOff className="h-5 w-5" />
            摄像头权限被拒绝
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            请在浏览器设置中允许访问摄像头，然后重试。
          </p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>Chrome浏览器：</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>点击地址栏左侧的锁图标</li>
              <li>选择"摄像头" → "允许"</li>
              <li>刷新页面</li>
            </ol>
          </div>
          <Button onClick={() => resetScanner()} className="w-full">
            <RotateCcw className="mr-2 h-4 w-4" />
            重新尝试
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          扫描二维码
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="bg-destructive/15 border border-destructive/20 text-destructive text-sm rounded-md p-3">
            {error}
          </div>
        )}

        {!isScanning ? (
          <div className="text-center space-y-4">
            <div className="bg-muted rounded-lg p-8 border-2 border-dashed border-gray-300">
              <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">
                点击下方按钮开始扫描器材二维码
              </p>
              <p className="text-xs text-muted-foreground">
                请确保二维码清晰可见，保持适当距离
              </p>
            </div>
            <Button onClick={startScanner} className="w-full" size="lg">
              <Camera className="mr-2 h-5 w-5" />
              开始扫描
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div id="qr-reader" className="w-full max-w-md mx-auto"></div>
            <div className="flex gap-2">
              <Button
                onClick={stopScanner}
                variant="outline"
                className="flex-1"
              >
                <CameraOff className="mr-2 h-4 w-4" />
                停止扫描
              </Button>
              {cameras.length > 1 && (
                <Button
                  onClick={switchCamera}
                  variant="outline"
                  size="icon"
                  title="切换摄像头"
                >
                  <SwitchCamera className="h-4 w-4" />
                </Button>
              )}
              <Button
                onClick={() => {
                  resetScanner()
                  setTimeout(startScanner, 100)
                }}
                variant="outline"
                size="icon"
                title="重新开始扫描"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            {currentCameraId && (
              <div className="text-center text-sm text-muted-foreground">
                当前摄像头: {cameras.find(c => c.id === currentCameraId)?.label || '未知'}
                {cameras.length > 1 && ' (点击切换按钮更换摄像头)'}
              </div>
            )}
            <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-md p-3">
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb className="h-3 w-3" />
                <span className="font-medium">扫描提示</span>
              </div>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>将摄像头对准器材二维码</li>
                <li>保持适当距离，确保二维码完整清晰</li>
                <li>如果光线不足，可以开启手电筒</li>
                <li>避免手抖，等待自动识别</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}