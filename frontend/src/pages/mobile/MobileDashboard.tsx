import React from 'react'
import { createLogger } from '@/lib/logger'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { QRCodeScanner } from '@/components/QRCodeScanner'
import { extractQrCode } from '@/utils/qrCode'
import { equipmentApi } from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageContainer } from '@/components/layout'
import { 
  Scan, 
  User, 
  Building2, 
  LogOut, 
  Settings,
  Activity,
  Clock
} from 'lucide-react'

export const MobileDashboard: React.FC = () => {
  const log = createLogger('MobileDash')
  const navigate = useNavigate()
  const { user, factory, logout } = useAuthStore()

  const handleScanSuccess = async (raw: string) => {
    log.debug('扫描成功原始值', { raw })
    const code = extractQrCode(raw)
    try {
      // 可调用后端解析接口快速校验
      const resolve = await equipmentApi.getByQR(code) // 直接尝试获取器材，若失败再用 resolve 接口
      if (resolve.success) {
        navigate(`/m/inspection/${encodeURIComponent(code)}`)
      } else {
        log.warn('二维码未找到关联器材')
        navigate(`/m/inspection/${encodeURIComponent(code)}`)
      }
    } catch (e) {
      log.error('二维码识别失败', e)
      navigate(`/m/inspection/${encodeURIComponent(code)}`)
    }
  }

  const handleScanError = (error: string) => {
    log.error('扫描错误', error)
  }

  const handleLogout = async () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航栏 */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <Activity className="h-6 w-6 text-primary" />
                <span className="font-semibold text-lg">消防点检</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              title="退出登录"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <PageContainer variant="mobile">
        {/* 用户信息卡片 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <User className="h-5 w-5 text-primary-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center space-x-2 mb-1">
                  <span className="font-medium">{user?.fullName}</span>
                  <Badge variant="secondary" className="text-xs">
                    {user?.role === 'INSPECTOR' ? '点检员' : 
                     user?.role === 'FACTORY_ADMIN' ? '厂区管理员' : '超级管理员'}
                  </Badge>
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <Building2 className="h-3 w-3 mr-1" />
                  {factory?.name}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 扫码区域 */}
        <QRCodeScanner
          onScanSuccess={handleScanSuccess}
          onScanError={handleScanError}
          className="mb-4"
        />

        {/* 快捷操作 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">快捷操作</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start h-12"
              onClick={() => navigate('/m/inspections')}
            >
              <Clock className="mr-3 h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">我的点检记录</div>
                <div className="text-xs text-muted-foreground">查看历史点检</div>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-12"
              onClick={() => navigate('/m/issues')}
            >
              <Settings className="mr-3 h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">我的隐患上报</div>
                <div className="text-xs text-muted-foreground">查看处理状态</div>
              </div>
            </Button>
          </CardContent>
        </Card>

        {/* 扫码提示 */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Scan className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-blue-900 mb-1">
                  如何进行点检？
                </p>
                <p className="text-xs text-blue-700">
                  1. 点击上方"开始扫描"按钮
                  <br />
                  2. 将摄像头对准器材二维码
                  <br />
                  3. 等待自动识别后进入点检界面
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </PageContainer>
    </div>
  )
}
