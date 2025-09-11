import React, { useState, useEffect } from 'react'
import { createLogger } from '@/lib/logger'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/api/client'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/layout/PageHeader'
import { ContentSection } from '@/components/layout/ContentSection'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Settings, Shield, Database, AlertTriangle, Trash2, RotateCcw } from 'lucide-react'
import { Navigate } from 'react-router-dom'

interface SystemSettings {
  systemName: string
  systemVersion: string
  dataRetentionDays: number
  autoCleanupEnabled: boolean
  cleanupCategories: string[]
  lastCleanupAt?: string
  sessionTimeoutMinutes: number
  passwordExpiryDays: number
  maxLoginAttempts: number
  enableAuditLogging: boolean
  allowPasswordReset: boolean
  qrBaseUrl: string
  rememberMeEnabled: boolean
  rememberMeDays: number
}

export const SystemSettingsPage: React.FC = () => {
  const log = createLogger('SysSettings')
  const { isSuperAdmin, token } = useAuthStore()
  const [settings, setSettings] = useState<SystemSettings>({
    systemName: '消防器材点检管理系统',
    systemVersion: 'v1.1.0',
    dataRetentionDays: 365,
    autoCleanupEnabled: false,
    cleanupCategories: [],
    lastCleanupAt: undefined,
    sessionTimeoutMinutes: 480,
    passwordExpiryDays: 90,
    maxLoginAttempts: 5,
    enableAuditLogging: true,
    allowPasswordReset: true,
    qrBaseUrl: '',
    rememberMeEnabled: true,
    rememberMeDays: 90
  })

  const [isModified, setIsModified] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const [isCleaning, setIsCleaning] = useState(false)
  const [sysStatus, setSysStatus] = useState<any>(null)

  // 如果不是超级管理员，重定向到未授权页面
  if (!isSuperAdmin()) {
    return <Navigate to="/unauthorized" replace />
  }

  const handleSettingChange = (key: keyof SystemSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
    setIsModified(true)
  }

  const handleSaveSettings = async () => {
    setIsSaving(true)
    try {
      // 保存二维码基础URL（使用统一api封装，自动携带token与刷新逻辑）
      await api.put('/system-settings/qr-base-url', { qrBaseUrl: settings.qrBaseUrl || null })

      // 保存清理相关设置
      await api.put('/system-settings/cleanup', {
        autoCleanupEnabled: settings.autoCleanupEnabled,
        dataRetentionDays: settings.dataRetentionDays,
        categories: settings.cleanupCategories
      })

      // 保存安全设置（会话超时/登录尝试/审计/重置密码/记住我）
      await api.put('/system-settings/security', {
        sessionTimeoutMinutes: settings.sessionTimeoutMinutes,
        maxLoginAttempts: settings.maxLoginAttempts,
        enableAuditLogging: settings.enableAuditLogging,
        allowPasswordReset: settings.allowPasswordReset,
        rememberMeEnabled: settings.rememberMeEnabled,
        rememberMeDays: settings.rememberMeDays
      })

      // 模拟API调用
      await new Promise(resolve => setTimeout(resolve, 300))

      setIsModified(false)
      toast.success("系统设置已成功更新")
    } catch (error: any) {
      toast.error(error.message || "保存系统设置时发生错误")
    } finally {
      setIsSaving(false)
    }
  }

  const handleResetSettings = () => {
    setSettings({
      systemName: '消防器材点检管理系统',
      systemVersion: 'v1.1.0',
      dataRetentionDays: 365,
      autoCleanupEnabled: false,
      cleanupCategories: [],
      lastCleanupAt: undefined,
      sessionTimeoutMinutes: 480,
      passwordExpiryDays: 90,
      maxLoginAttempts: 5,
      enableAuditLogging: true,
      allowPasswordReset: true,
      qrBaseUrl: '',
      rememberMeEnabled: true,
      rememberMeDays: 90
    })
    setIsModified(false)
    toast.success("所有设置已恢复为默认值")
  }

  const handleSystemCleanup = async () => {
    if (!Array.isArray(settings.cleanupCategories) || settings.cleanupCategories.length === 0) {
      toast.warning?.('请先选择至少一种“清理内容”') || toast.info('请先选择至少一种“清理内容”')
      return
    }
    setIsCleaning(true)
    try {
      const payload = {
        dataRetentionDays: settings.dataRetentionDays,
        categories: settings.cleanupCategories
      }
      const resp: any = await api.post('/system-settings/cleanup/execute', payload)
      const data = resp?.data || resp
      const counts = data?.counts || {}
      const total = data?.total || 0
      const last = data?.lastCleanupAt
      if (last) setSettings(prev => ({ ...prev, lastCleanupAt: last }))
      toast.success(`已清理完成，共 ${total} 条；明细：` +
        `${counts.inspectionLogs ? ` 点检${counts.inspectionLogs}` : ''}` +
        `${counts.auditLogs ? ` 审计${counts.auditLogs}` : ''}` +
        `${counts.securityLogs ? ` 安全${counts.securityLogs}` : ''}` +
        `${counts.errorLogs ? ` 错误${counts.errorLogs}` : ''}`)
    } catch (error: any) {
      toast.error(error.message || "执行系统清理时发生错误")
    } finally {
      setIsCleaning(false)
    }
  }

  // 当 token 就绪且用户为超级管理员时再拉取全部系统设置
  useEffect(() => {
    if (!token) return
    if (!isSuperAdmin()) return
    (async () => {
      setIsLoadingSettings(true)
      try {
        const data: any = await api.get('/system-settings')
        if (data?.data) {
          setSettings(prev => ({
            ...prev,
            qrBaseUrl: data.data.qrBaseUrl ?? prev.qrBaseUrl,
            autoCleanupEnabled: typeof data.data.autoCleanupEnabled === 'boolean' ? data.data.autoCleanupEnabled : prev.autoCleanupEnabled,
            dataRetentionDays: typeof data.data.dataRetentionDays === 'number' ? data.data.dataRetentionDays : prev.dataRetentionDays,
            cleanupCategories: Array.isArray(data.data.cleanupCategories) ? data.data.cleanupCategories : prev.cleanupCategories,
            lastCleanupAt: data.data.lastCleanupAt || prev.lastCleanupAt,
            sessionTimeoutMinutes: typeof data.data.sessionTimeoutMinutes === 'number' ? data.data.sessionTimeoutMinutes : prev.sessionTimeoutMinutes,
            maxLoginAttempts: typeof data.data.maxLoginAttempts === 'number' ? data.data.maxLoginAttempts : prev.maxLoginAttempts,
            enableAuditLogging: typeof data.data.enableAuditLogging === 'boolean' ? data.data.enableAuditLogging : prev.enableAuditLogging,
            allowPasswordReset: typeof data.data.allowPasswordReset === 'boolean' ? data.data.allowPasswordReset : prev.allowPasswordReset,
            rememberMeEnabled: typeof data.data.rememberMeEnabled === 'boolean' ? data.data.rememberMeEnabled : prev.rememberMeEnabled,
            rememberMeDays: typeof data.data.rememberMeDays === 'number' ? data.data.rememberMeDays : prev.rememberMeDays
          }))
        }
      } catch (e: any) {
        log.warn('加载系统设置失败', e?.message || e)
      } finally {
        setIsLoadingSettings(false)
      }
    })()
  }, [token, isSuperAdmin]);

  // 加载系统状态（数据库健康、上传目录占用等）
  useEffect(() => {
    (async () => {
      try {
        const s: any = await api.get('/status', { baseURL: '' })
        setSysStatus(s?.data || s)
      } catch (e: any) {
        log.warn('加载系统状态失败', e?.message || e)
      }
    })()
  }, []);

  return (
    <PageContainer>
      <PageHeader
        title="系统设置"
        description="管理系统配置和维护选项"
        icon={<Settings className="h-6 w-6" />}
      />

      <ContentSection>
        <div className="grid gap-6 max-w-4xl">
          {isLoadingSettings && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  系统信息
                </CardTitle>
                <CardDescription>正在加载系统配置...</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>系统名称</Label>
                    <Skeleton className="h-9 w-full" />
                  </div>
                  <div className="space-y-2">
                    <Label>系统版本</Label>
                    <Skeleton className="h-9 w-full" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>二维码基础URL</Label>
                    <Skeleton className="h-9 w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {/* 系统信息卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                系统信息
              </CardTitle>
              <CardDescription>
                系统基本信息和版本配置
              </CardDescription>
            </CardHeader>
              <CardContent className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="systemName">系统名称</Label>
                  <Input
                    id="systemName"
                    value={settings.systemName}
                    onChange={(e) => handleSettingChange('systemName', e.target.value)}
                    placeholder="请输入系统名称"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="systemVersion">系统版本</Label>
                  <Input
                    id="systemVersion"
                    value={settings.systemVersion}
                    readOnly
                    className="bg-gray-50"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="qrBaseUrl">二维码基础URL (覆盖环境变量)</Label>
                  <Input
                    id="qrBaseUrl"
                    placeholder="例如 https://equip.example.com 或留空使用环境配置"
                    value={settings.qrBaseUrl}
                    onChange={(e) => handleSettingChange('qrBaseUrl', e.target.value)}
                  />
                  <p className="text-sm text-gray-500">
                    扫码后跳转的根地址。留空则使用 BASE_URL / DOMAIN 兜底逻辑。自动强制使用 HTTPS。
                  </p>
                </div>
              </div>
             </CardContent>
          </Card>

          {/* 数据管理卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                数据管理
              </CardTitle>
              <CardDescription>
                数据保留策略和自动清理配置
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dataRetentionDays">数据保留天数</Label>
                  <Input
                    id="dataRetentionDays"
                    type="number"
                    min="30"
                    max="3650"
                    value={settings.dataRetentionDays}
                    onChange={(e) => {
                      const v = parseInt(e.target.value)
                      const next = Number.isFinite(v) ? Math.max(30, Math.min(3650, v)) : 365
                      handleSettingChange('dataRetentionDays', next)
                    }}
                  />
                  <p className="text-sm text-gray-500">
                    系统将保留指定天数内的数据，超期数据将被自动清理
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="autoCleanup">自动清理</Label>
                    <Switch
                      id="autoCleanup"
                      checked={settings.autoCleanupEnabled}
                      onCheckedChange={(checked) => handleSettingChange('autoCleanupEnabled', checked)}
                    />
                  </div>
                  <p className="text-sm text-gray-500">
                    启用后系统将每日自动清理过期数据
                  </p>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>清理内容</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      { key: 'inspectionLogs', label: '点检记录' },
                      { key: 'auditLogs', label: '审计日志' },
                      { key: 'securityLogs', label: '安全日志' },
                      { key: 'errorLogs', label: '错误日志' }
                    ].map(item => (
                      <label key={item.key} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={settings.cleanupCategories.includes(item.key)}
                          onChange={(e) => {
                            const set = new Set(settings.cleanupCategories)
                            if (e.target.checked) set.add(item.key)
                            else set.delete(item.key)
                            handleSettingChange('cleanupCategories', Array.from(set))
                          }}
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                  <p className="text-sm text-gray-500">
                    可选择要参与自动/手动清理的数据类别；默认不选中任何项。
                  </p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">手动一键清理（使用以上清理内容与保留天数）</div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={isCleaning || settings.cleanupCategories.length === 0}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      一键清理
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认执行一键清理</AlertDialogTitle>
                      <AlertDialogDescription>
                        将根据“清理内容”和“数据保留天数”清理过期数据、日志，操作不可撤销。是否继续？
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSystemCleanup} disabled={isCleaning}>
                        {isCleaning ? '清理中...' : '确认清理'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <Separator />

              {/* 记住我设置 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="rememberMeEnabled">启用“记住我”</Label>
                    <Switch
                      id="rememberMeEnabled"
                      checked={settings.rememberMeEnabled}
                      onCheckedChange={(checked) => handleSettingChange('rememberMeEnabled', checked)}
                    />
                  </div>
                  <p className="text-sm text-gray-500">允许长效登录（刷新令牌），适合受信任设备</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rememberMeDays">“记住我”天数</Label>
                  <Input
                    id="rememberMeDays"
                    type="number"
                    min={7}
                    max={365}
                    value={settings.rememberMeDays}
                    onChange={(e) => {
                      const v = parseInt(e.target.value)
                      const next = Number.isFinite(v) ? Math.max(7, Math.min(365, v)) : 90
                      handleSettingChange('rememberMeDays', next)
                    }}
                    disabled={!settings.rememberMeEnabled}
                  />
                  <p className="text-sm text-gray-500">建议7-180天，默认90天</p>
                </div>
              </div>

            </CardContent>
          </Card>

          {/* 安全设置卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                安全设置
              </CardTitle>
              <CardDescription>
                用户认证和会话管理配置
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sessionTimeout">会话超时（分钟）</Label>
                  <Input
                    id="sessionTimeout"
                    type="number"
                    min="15"
                    max="1440"
                    value={settings.sessionTimeoutMinutes}
                    onChange={(e) => handleSettingChange('sessionTimeoutMinutes', parseInt(e.target.value) || 480)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="passwordExpiry">密码有效期（天）</Label>
                  <Input
                    id="passwordExpiry"
                    type="number"
                    min="30"
                    max="365"
                    value={settings.passwordExpiryDays}
                    onChange={(e) => handleSettingChange('passwordExpiryDays', parseInt(e.target.value) || 90)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxLoginAttempts">最大登录尝试次数</Label>
                  <Input
                    id="maxLoginAttempts"
                    type="number"
                    min="3"
                    max="10"
                    value={settings.maxLoginAttempts}
                    onChange={(e) => handleSettingChange('maxLoginAttempts', parseInt(e.target.value) || 5)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auditLogging">启用审计日志</Label>
                    <Switch
                      id="auditLogging"
                      checked={settings.enableAuditLogging}
                      onCheckedChange={(checked) => handleSettingChange('enableAuditLogging', checked)}
                    />
                  </div>
                  <p className="text-sm text-gray-500">
                    记录用户操作和系统事件
                  </p>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="passwordReset">允许密码重置</Label>
                  <Switch
                    id="passwordReset"
                    checked={settings.allowPasswordReset}
                    onCheckedChange={(checked) => handleSettingChange('allowPasswordReset', checked)}
                  />
                </div>
                <p className="text-sm text-gray-500">
                  允许用户自助重置密码功能
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 系统维护卡片 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                系统维护
              </CardTitle>
              <CardDescription>
                系统清理和维护工具
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-medium">数据清理</h4>
                  <p className="text-sm text-gray-500">
                    清理过期的日志文件、临时数据和缓存
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={isCleaning || settings.cleanupCategories.length === 0}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        执行清理
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>确认执行系统清理</AlertDialogTitle>
                        <AlertDialogDescription>
                          此操作将清理过期数据和临时文件，无法撤销。请确认是否继续？
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>取消</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSystemCleanup} disabled={isCleaning}>
                          {isCleaning ? '清理中...' : '确认清理'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium">系统状态</h4>
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">数据库状态</span>
                      <Badge variant={sysStatus?.database?.status === 'up' ? 'default' : 'secondary'}>
                        {sysStatus?.database?.status === 'up' ? '正常' : '异常'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">上传目录占用</span>
                      <Badge variant="secondary">
                        {(sysStatus?.upload?.totalSizeMB ?? 0) + ' MB / ' + (sysStatus?.upload?.totalFiles ?? 0) + ' 文件'}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">上次清理</span>
                      <span className="text-sm text-gray-500">{settings.lastCleanupAt ? new Date(settings.lastCleanupAt).toLocaleString() : '从未'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 操作按钮 */}
          <div className="flex gap-2 justify-end">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  重置设置
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认重置设置</AlertDialogTitle>
                  <AlertDialogDescription>
                    此操作将恢复所有设置为默认值，确认继续吗？
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={handleResetSettings}>
                    确认重置
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            
            <Button 
              onClick={handleSaveSettings}
              disabled={!isModified || isSaving}
            >
              {isSaving ? '保存中...' : '保存设置'}
            </Button>
          </div>
        </div>
      </ContentSection>
    </PageContainer>
  )
}
