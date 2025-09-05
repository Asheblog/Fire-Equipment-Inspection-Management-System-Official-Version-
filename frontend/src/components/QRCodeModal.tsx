import React, { useState, useEffect } from 'react'
import { equipmentApi } from '@/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { QrCode, Download, ExternalLink } from 'lucide-react'
import type { Equipment } from '@/types'
import { formatQrCodeDisplay } from '@/utils/qrCode'

interface QRCodeModalProps {
  open: boolean
  onClose: () => void
  equipment: Equipment | null
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({
  open,
  onClose,
  equipment
}) => {
  const [qrImageUrl, setQrImageUrl] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    if (open && equipment?.qrCode) {
      generateQRImage()
    }
  }, [open, equipment])

  const generateQRImage = async () => {
    if (!equipment?.qrCode) return

    setLoading(true)
    setError('')
    
    try {
      const response = await equipmentApi.generateQRImage(equipment.qrCode, 300)
      if (response.success && response.data) {
        setQrImageUrl(response.data.imageUrl)
      } else {
        setError('生成二维码失败')
      }
    } catch (err) {
      console.error('生成二维码失败:', err)
      setError('生成二维码失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!qrImageUrl) return
    
    const link = document.createElement('a')
    link.href = qrImageUrl
    link.download = `QR_${equipment?.name || equipment?.qrCode}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleOpenInNewTab = () => {
    if (!qrImageUrl) return
    window.open(qrImageUrl, '_blank')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md w-[92vw] overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <QrCode className="h-5 w-5" />
            <span>器材二维码</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* 器材信息 */}
          {equipment && (
            <div className="border rounded-lg p-3 bg-gray-50">
              <h3 className="font-medium text-sm text-gray-600 mb-2">器材信息</h3>
              <div className="space-y-1 text-sm">
                <div><span className="text-gray-500">名称:</span> {equipment.name}</div>
                <div><span className="text-gray-500">二维码:</span>{' '}
                  <span className="font-mono text-xs break-all" title={equipment.qrCode}>
                    {formatQrCodeDisplay(equipment.qrCode)}
                  </span>
                </div>
                <div><span className="text-gray-500">位置:</span> {equipment.location}</div>
                <div className="text-xs mt-2">
                  {equipment.qrCode.includes('/m/inspection/') ? (
                    <span className="text-blue-600">📱 扫码可直接跳转到点检页面</span>
                  ) : (
                    <span className="text-amber-600">当前存储为纯码，生成的二维码已自动转换为可跳转链接</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 二维码图片 */}
          <div className="flex flex-col items-center space-y-4">
            {loading && (
              <div className="flex items-center justify-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span className="ml-2 text-sm text-gray-600">生成中...</span>
              </div>
            )}
            
            {error && (
              <div className="text-center text-red-500 text-sm p-4">
                {error}
                <br />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={generateQRImage}
                  className="mt-2"
                >
                  重试
                </Button>
              </div>
            )}
            
            {qrImageUrl && !loading && (
              <>
                <div className="border rounded-lg p-4 bg-white">
                  <img 
                    src={qrImageUrl} 
                    alt="设备二维码"
                    className="w-64 h-64 object-contain"
                  />
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownload}
                    className="flex items-center space-x-1"
                  >
                    <Download className="h-4 w-4" />
                    <span>下载</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleOpenInNewTab}
                    className="flex items-center space-x-1"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>新窗口打开</span>
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
