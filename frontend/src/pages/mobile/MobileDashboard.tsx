import React, { useEffect, useRef, useState } from 'react'
import { createLogger } from '@/lib/logger'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { QRCodeScanner } from '@/components/QRCodeScanner'
import { extractQrCode } from '@/utils/qrCode'
import { equipmentApi, inspectionApi } from '@/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageContainer } from '@/components/layout'
import { useCancelableDialog } from '@/hooks/useCancelableDialog'
import { 
  Scan, 
  User, 
  Building2, 
  LogOut, 
  Settings,
  Activity,
  Clock,
  Search
} from 'lucide-react'

type MonthlyProgress = {
  month: string
  total: number
  completed: number
  pending: number
  factories: Array<{ factoryId: number; factoryName: string; total: number; completed: number; pending: number }>
}

export const MobileDashboard: React.FC = () => {
  const log = createLogger('MobileDash')
  const navigate = useNavigate()
  const { user, factory, factories, logout } = useAuthStore()
  const [progress, setProgress] = useState<MonthlyProgress | null>(null)
  const [pendingFactoryId, setPendingFactoryId] = useState<number | null>(null)
  const { open: pendingOpen, loading: pendingLoading, data: pendingList, openWith: openPendingWith, close: closePending } = useCancelableDialog<any[], number>(
    async (fid, signal) => {
      const res = await inspectionApi.getMonthlyPending(fid, undefined, { signal })
      if (res.success) return (res.data as any[]) || []
      return []
    }
  )
  const pendingRef = useRef<HTMLDivElement | null>(null)

  // 手动编号搜索
  type EquipmentSearchItem = { id: number; name: string; qrCode: string; location: string; equipmentType?: { id: number; name: string } }
  const [codeQuery, setCodeQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<EquipmentSearchItem[]>([])
  const [searchError, setSearchError] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const res = await inspectionApi.getMonthlyProgress()
        if (res.success) setProgress(res.data as any)
      } catch (e) {
        log.error('加载月度进度失败', e)
      }
    }
    load()
  }, [])

  const openPending = async (fid: number) => {
    setPendingFactoryId(fid)
    // 立即打开并显示加载状态，由 hook 管理取消
    openPendingWith(fid)
  }

  // 当未完成列表打开时，自动滚动到对应位置
  useEffect(() => {
    if (pendingOpen && pendingRef.current) {
      pendingRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [pendingOpen])

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

  const doSearch = async () => {
    setSearchError('')
    const keyword = (codeQuery || '').trim()
    if (keyword.length < 3) {
      setSearchResults([])
      setSearchError('请至少输入3个字符，例如后四位 B77A')
      return
    }
    try {
      setSearching(true)
      const res = await equipmentApi.searchByCode(keyword.toUpperCase(), 10)
      if (res.success) {
        setSearchResults((res.data as any) || [])
        if (((res.data as any[]) || []).length === 0) {
          setSearchError('未找到匹配器材，请核对编号片段')
        }
      } else {
        setSearchResults([])
        setSearchError(res.message || '搜索失败')
      }
    } catch (e: any) {
      setSearchResults([])
      setSearchError(e?.message || '搜索失败')
    } finally {
      setSearching(false)
    }
  }

  const highlight = (text: string, needle: string) => {
    if (!needle) return text
    const t = text || ''
    const i = t.toUpperCase().indexOf(needle.toUpperCase())
    if (i < 0) return t
    return (
      <>
        {t.slice(0, i)}
        <mark className="bg-yellow-200 px-0.5 rounded-sm">{t.slice(i, i + needle.length)}</mark>
        {t.slice(i + needle.length)}
      </>
    )
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

        {/* 手动输入编号搜索（光线差时使用） */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">手动输入编号</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="输入器材编号片段，如 B77A 或 FIRE-..."
                  value={codeQuery}
                  onChange={(e) => setCodeQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                  className="pl-9"
                  inputMode="text"
                  autoCapitalize="characters"
                />
              </div>
              <Button onClick={doSearch} disabled={searching || (codeQuery.trim().length < 3)}>
                {searching ? '搜索中...' : '搜索'}
              </Button>
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              无法扫码时可输入编号片段（建议输入后四位校验段，如 B77A）
            </div>
            {searchError && (
              <div className="mt-2 text-xs text-red-600">{searchError}</div>
            )}
            {searchResults.length > 0 && (
              <div className="mt-3 space-y-2">
                {searchResults.map(item => (
                  <button
                    key={item.id}
                    className="w-full text-left border rounded p-2 hover:bg-gray-50"
                    onClick={() => navigate(`/m/inspection/${encodeURIComponent(item.qrCode)}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-gray-500">{item.equipmentType?.name}</div>
                    </div>
                    <div className="text-xs text-gray-600">位置：{item.location}</div>
                    <div className="font-mono text-xs break-all">
                      编号：{highlight(item.qrCode, codeQuery.trim())}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 本月巡检进度 */}
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-lg">本月巡检进度</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {progress ? (
              <>
                <div className="text-sm text-muted-foreground">{progress.month}</div>
                <div className="flex items-center justify-between">
                  <div>总进度</div>
                  <div className="text-sm">{progress.completed} / {progress.total}</div>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {(progress.factories || []).map((f) => (
                    <div key={f.factoryId} className="flex items-center justify-between border rounded p-2">
                      <div>
                        <div className="font-medium text-sm">{f.factoryName}</div>
                        <div className="text-xs text-muted-foreground">已完成 {f.completed} / {f.total}，未完成 {f.pending}</div>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => openPending(f.factoryId)}>查看未完成</Button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">加载中...</div>
            )}
          </CardContent>
        </Card>

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

            <Button
              variant="outline"
              className="w-full justify-start h-12"
              onClick={() => navigate('/m/issue-manage')}
            >
              <Settings className="mr-3 h-5 w-5" />
              <div className="text-left">
                <div className="font-medium">隐患管理（查看与整改）</div>
                <div className="text-xs text-muted-foreground">处理厂区内未完成整改的隐患</div>
              </div>
            </Button>
          </CardContent>
        </Card>

        {/* 未完成列表对话框（简单实现）*/}
        {pendingOpen && (
          <Card className="mt-4" ref={pendingRef}>
            <CardHeader>
              <CardTitle className="text-lg">未完成点检（{(factories||[]).find(f=>f.id===pendingFactoryId)?.name || factory?.name}）</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {pendingLoading && (
                <div className="text-sm text-muted-foreground">加载中...</div>
              )}
              {!pendingLoading && ((pendingList || []).length === 0) && (
                <div className="text-sm text-muted-foreground">该厂区本月已全部完成</div>
              )}
              {!pendingLoading && (pendingList || []).length > 0 && (
                <>
                  {(pendingList || []).slice(0, 20).map((e: any) => (
                    <div key={e.id} className="text-sm flex items-center justify-between">
                      <div>
                        <div className="font-medium">{e.name}</div>
                        <div className="text-xs text-muted-foreground">位置：{e.location}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
              <div className="pt-2">
                <Button className="w-full" variant="secondary" onClick={() => closePending()}>关闭</Button>
              </div>
            </CardContent>
          </Card>
        )}

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
