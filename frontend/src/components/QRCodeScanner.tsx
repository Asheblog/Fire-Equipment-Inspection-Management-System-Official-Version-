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

  // iOS 兼容：使用 facingMode 方案 + 放宽 aspectRatio
  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent || '')
  const baseScanConfig: any = { fps: 10, qrbox: { width: 250, height: 250 }, disableFlip: false }
  if (!isIOS) { baseScanConfig.aspectRatio = 1.0 }

  // 检查安全上下文(非 https / localhost 会被禁用)
  useEffect(() => {
    const checkSecureContext = () => {
      const secure = window.isSecureContext
      const hasMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      setIsSecureContext(secure && hasMedia)
      if (!secure || !hasMedia) {
        setError('需要 HTTPS 或 localhost 环境才能使用摄像头')
        onScanError?.('不安全的上下文或缺少 MediaDevices API')
      }
    }
    checkSecureContext()
  }, [onScanError])

  const qrCodeSuccessCallback = (decodedText: string) => {
    onScanSuccess(decodedText)
    stopScanner()
  }

  const qrCodeErrorCallback = (err: string) => {
    if (!err.includes('QR code parse error') && !err.includes('No MultiFormat Readers')) {
      // 仅输出重要错误
      console.warn('QR Code scan warn:', err)
    }
  }

  const getCameras = async () => {
    try {
      let devices = await Html5Qrcode.getCameras()
      // iOS 首次 label 可能为空，再试一次
      if (isIOS && devices.every(d => !d.label) && devices.length) {
        try {
          const retry = await Html5Qrcode.getCameras()
          if (retry.length === devices.length) devices = retry
        } catch {}
      }
      setCameras(devices)
      const labelMatch = (label: string) => {
        const l = label.toLowerCase()
        return /back|rear|environment/.test(l) || /后|外/.test(label)
      }
      let preferred = devices.find(d => d.label && labelMatch(d.label))
      if (!preferred && devices.length === 2) preferred = devices[1]
      if (!preferred && devices.length) preferred = devices[0]
      if (preferred) {
        setCurrentCameraId(preferred.id)
        return preferred.id
      }
      return null
    } catch (e: any) {
      console.error('获取摄像头列表失败:', e)
      setError('无法获取摄像头列表')
      return null
    }
  }

  const startScanningWithCamera = async (cameraIdOrConfig: any) => {
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode('qr-reader')
    }
    try {
      await scannerRef.current.start(
        cameraIdOrConfig,
        baseScanConfig,
        qrCodeSuccessCallback,
        qrCodeErrorCallback
      )
      setError('')
      return true
    } catch (err: any) {
      console.error('开始扫描失败:', { name: err?.name, message: err?.message, cameraIdOrConfig })
      return false
    }
  }

  const startWithStrategy = async (cameraId: string) => {
    let ok = false
    if (isIOS) {
      // html5-qrcode 期望直接传 { facingMode: 'environment' } 而不是内层再包 video
      for (const cfg of [{ facingMode: { exact: 'environment' } }, { facingMode: 'environment' }]) {
        ok = await startScanningWithCamera(cfg)
        if (ok) return
      }
    }
    // 尝试使用 deviceId
    ok = await startScanningWithCamera(cameraId)
    if (ok) return

    // 再次尝试使用 facingMode（宽松模式）
    ok = await startScanningWithCamera({ facingMode: 'environment' })
    if (ok) return

    // 逐个遍历所有摄像头尝试（调试/兜底）
    for (const cam of cameras) {
      if (cam.id === cameraId) continue
      const success = await startScanningWithCamera(cam.id)
      if (success) {
        setCurrentCameraId(cam.id)
        return
      }
    }
    setError('启动摄像头失败，请重试 (iOS XR 可尝试刷新或添加到主屏后再试)')
    setIsScanning(false)
  }

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop()
        scannerRef.current.clear()
        scannerRef.current = null
      } catch (err) {
        console.warn('停止扫描时警告:', err)
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
    const currentIndex = cameras.findIndex(c => c.id === currentCameraId)
    const nextIndex = (currentIndex + 1) % cameras.length
    const next = cameras[nextIndex]
    setCurrentCameraId(next.id)
    setTimeout(() => setIsScanning(true), 150)
  }

  const startScanner = async () => {
    if (!isSecureContext) {
      setError('需要 HTTPS 环境才能使用摄像头')
      onScanError?.('不安全上下文')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(t => t.stop())
      setHasPermission(true)
      const cameraId = await getCameras()
      if (cameraId) {
        setIsScanning(true)
      } else {
        setError('未找到可用摄像头')
      }
    } catch (e: any) {
      console.error('Camera permission error:', e)
      setHasPermission(false)
      setError('无法访问摄像头，请在系统/浏览器中授权')
      onScanError?.('摄像头权限被拒绝')
    }
  }

  // 当 isScanning + currentCameraId 就绪后启动（延迟等待 DOM）
  useEffect(() => {
    if (isScanning && currentCameraId && hasPermission) {
      const timer = setTimeout(async () => {
        const el = document.getElementById('qr-reader')
        if (el) {
          await startWithStrategy(currentCameraId)
        } else {
          setError('扫描容器未找到')
          setIsScanning(false)
        }
      }, 120)
      return () => clearTimeout(timer)
    }
  }, [isScanning, currentCameraId, hasPermission])

  // 卸载释放资源
  useEffect(() => {
    return () => { stopScanner() }
  }, [])

  if (!isSecureContext) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-destructive'>
            <CameraOff className='h-5 w-5' />
            摄像头不可用
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <p className='text-sm text-muted-foreground'>当前环境不安全或不支持 MediaDevices。</p>
          <Button onClick={() => window.location.reload()} className='w-full'>
            <RotateCcw className='mr-2 h-4 w-4' />重新检测
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (hasPermission === false) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className='flex items-center gap-2 text-destructive'>
            <CameraOff className='h-5 w-5' />摄像头权限被拒绝
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <p className='text-sm text-muted-foreground'>请在浏览器或系统设置中允许访问摄像头后重试。</p>
          <Button onClick={() => resetScanner()} className='w-full'>
            <RotateCcw className='mr-2 h-4 w-4' />重新尝试
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className='flex items-center gap-2'>
          <Camera className='h-5 w-5' />扫描二维码
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-4'>
        {error && (
          <div className='bg-destructive/15 border border-destructive/20 text-destructive text-sm rounded-md p-3'>
            {error}
          </div>
        )}

        {!isScanning ? (
          <div className='text-center space-y-4'>
            <div className='bg-muted rounded-lg p-8 border-2 border-dashed border-gray-300'>
              <Camera className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
              <p className='text-muted-foreground mb-2'>点击下方按钮开始扫描器材二维码</p>
              <p className='text-xs text-muted-foreground'>保持二维码清晰完整于取景框内</p>
            </div>
            <Button onClick={startScanner} className='w-full' size='lg'>
              <Camera className='mr-2 h-5 w-5' />开始扫描
            </Button>
          </div>
        ) : (
          <div className='space-y-4'>
            <div id='qr-reader' className='w-full max-w-md mx-auto' />
            <div className='flex gap-2'>
              <Button onClick={stopScanner} variant='outline' className='flex-1'>
                <CameraOff className='mr-2 h-4 w-4' />停止
              </Button>
              {cameras.length > 1 && (
                <Button
                  onClick={switchCamera}
                  variant='outline'
                  size='icon'
                  title='切换摄像头'
                >
                  <SwitchCamera className='h-4 w-4' />
                </Button>
              )}
              <Button
                onClick={() => { resetScanner(); setTimeout(startScanner, 100) }}
                variant='outline'
                size='icon'
                title='重新开始'
              >
                <RotateCcw className='h-4 w-4' />
              </Button>
            </div>
            {currentCameraId && (
              <div className='text-center text-sm text-muted-foreground'>
                当前摄像头: {cameras.find(c => c.id === currentCameraId)?.label || '未知'}
                {cameras.length > 1 && ' (可切换)'}
              </div>
            )}
            <div className='bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-md p-3'>
              <div className='flex items-center gap-2 mb-1'>
                <Lightbulb className='h-3 w-3' />
                <span className='font-medium'>提示</span>
              </div>
              <ul className='list-disc list-inside space-y-1 ml-2'>
                <li>保持镜头对准二维码</li>
                <li>适当距离避免失焦</li>
                <li>光线不足可开手电筒</li>
                <li>保持稳定等待识别</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
