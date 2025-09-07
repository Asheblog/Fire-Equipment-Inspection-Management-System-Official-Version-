import React, { useState, useEffect, useCallback } from 'react'
import { createLogger } from '@/lib/logger'
import { permissionApi } from '@/api'
import type { Permission, Role, UserPermission } from '@/api/permissions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { isValidationError, extractValidationErrors, showValidationSummary, focusFirstError } from '@/utils/validation'
import { 
  Shield, 
  ShieldCheck, 
  Settings, 
  Users, 
  Plus,
  Minus,
  History,
  Search,
  FileText
} from 'lucide-react'

interface UserPermissionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number
  userName: string
  onPermissionChange?: () => void
}

export const UserPermissionDialog: React.FC<UserPermissionDialogProps> = ({
  open,
  onOpenChange,
  userId,
  userName,
  onPermissionChange
}) => {
  const log = createLogger('UserPermDialog')
  const [userPermissions, setUserPermissions] = useState<UserPermission | null>(null)
  const [allRoles, setAllRoles] = useState<Role[]>([])
  const [allPermissions, setAllPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const [reason, setReason] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // 获取用户权限信息
  const loadUserPermissions = async () => {
    setLoading(true)
    try {
      const [userPermsRes, rolesRes, permsRes] = await Promise.all([
        permissionApi.getUserPermissions(userId),
        permissionApi.getRoles({ isActive: true }),
        permissionApi.getPermissions({ isActive: true })
      ])
      
      // 后端接口按约定应返回 data 数组/对象；若封装层未解包则这里兼容两种形态，避免出现 filter 不是函数错误
      const resolvedUserPerms: any = (userPermsRes as any)?.roles
        ? userPermsRes
        : (userPermsRes as any)?.data || null
      const resolvedRoles: any[] = Array.isArray(rolesRes)
        ? rolesRes
        : (rolesRes as any)?.data && Array.isArray((rolesRes as any).data)
          ? (rolesRes as any).data
          : []
      const resolvedPerms: any[] = Array.isArray(permsRes)
        ? permsRes
        : (permsRes as any)?.data && Array.isArray((permsRes as any).data)
          ? (permsRes as any).data
          : []

      setUserPermissions(resolvedUserPerms || null)
      setAllRoles(resolvedRoles as Role[])
      setAllPermissions(resolvedPerms as Permission[])
    } catch (error) {
      log.error('获取用户权限失败', error)
      toast.error('获取权限信息失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open && userId) {
      loadUserPermissions()
    }
  }, [open, userId])

  // 分配角色
  const handleAssignRole = async (roleId: number) => {
    try {
      await permissionApi.assignUserRole(userId, {
        roleId,
        reason: reason || `管理员为用户分配角色`
      })
      toast.success('角色分配成功')
      loadUserPermissions()
      onPermissionChange?.()
      setReason('')
    } catch (error: any) {
      log.error('分配角色失败', error)
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
      } else {
        toast.error(error.response?.data?.message || '分配角色失败')
      }
    }
  }

  // 撤销角色
  const handleRevokeRole = async (roleId: number) => {
    try {
      await permissionApi.revokeUserRole(userId, roleId, reason || '管理员撤销用户角色')
      toast.success('角色撤销成功')
      loadUserPermissions()
      onPermissionChange?.()
      setReason('')
    } catch (error: any) {
      log.error('撤销角色失败', error)
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
      } else {
        toast.error(error.response?.data?.message || '撤销角色失败')
      }
    }
  }

  // 授予个人权限
  const handleGrantPermission = async (permissionId: number) => {
    try {
      await permissionApi.grantUserPermission(userId, {
        permissionId,
        reason: reason || '管理员授予个人权限'
      })
      toast.success('权限授予成功')
      loadUserPermissions()
      onPermissionChange?.()
      setReason('')
    } catch (error: any) {
      log.error('授予权限失败', error)
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
      } else {
        toast.error(error.response?.data?.message || '授予权限失败')
      }
    }
  }

  // 撤销个人权限
  const handleRevokePermission = async (permissionId: number) => {
    try {
      await permissionApi.revokeUserPermission(userId, permissionId, reason || '管理员撤销个人权限')
      toast.success('权限撤销成功')
      loadUserPermissions()
      onPermissionChange?.()
      setReason('')
    } catch (error: any) {
      log.error('撤销权限失败', error)
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
      } else {
        toast.error(error.response?.data?.message || '撤销权限失败')
      }
    }
  }

  // 检查用户是否拥有角色
  const hasRole = (roleId: number) => {
    return userPermissions?.roles.some(role => role.id === roleId) || false
  }

  // 检查用户是否拥有权限（包括角色权限和个人权限）
  const hasEffectivePermission = (permissionId: number) => {
    return userPermissions?.effectivePermissions.some(perm => perm.id === permissionId) || false
  }

  // 检查用户是否有个人权限（覆盖角色权限）
  const hasPersonalPermission = (permissionId: number) => {
    return userPermissions?.personalPermissions.some(perm => perm.id === permissionId) || false
  }

  // 过滤权限
  const filteredPermissions = (allPermissions || []).filter(perm =>
    perm.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    perm.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    perm.module.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // 按模块分组权限
  const permissionsByModule = filteredPermissions.reduce((acc, perm) => {
    if (!acc[perm.module]) {
      acc[perm.module] = []
    }
    acc[perm.module].push(perm)
    return acc
  }, {} as Record<string, Permission[]>)

  const moduleNames: Record<string, string> = {
    equipment: '设备管理',
    inspection: '点检管理',
    issue: '隐患管理',
    user: '用户管理',
    permission: '权限管理',
    report: '报表管理',
    system: '系统管理'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[98vw] overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {userName} 的权限管理
          </DialogTitle>
          <DialogDescription>
            管理用户的角色分配和个人权限设置
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">加载中...</div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">权限概览</TabsTrigger>
              <TabsTrigger value="roles">角色管理</TabsTrigger>
              <TabsTrigger value="permissions">个人权限</TabsTrigger>
              <TabsTrigger value="logs">变更日志</TabsTrigger>
            </TabsList>

            {/* 权限概览 */}
            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">拥有角色</CardTitle>
                    <Users className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{userPermissions?.roles.length || 0}</div>
                    <p className="text-xs text-muted-foreground">个角色</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">有效权限</CardTitle>
                    <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{userPermissions?.effectivePermissions.length || 0}</div>
                    <p className="text-xs text-muted-foreground">个权限</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">个人权限</CardTitle>
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{userPermissions?.personalPermissions.length || 0}</div>
                    <p className="text-xs text-muted-foreground">个自定义权限</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>当前角色</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {userPermissions?.roles.map(role => (
                        <Badge key={role.id} variant="default">
                          {role.name}
                        </Badge>
                      ))}
                      {!userPermissions?.roles.length && (
                        <p className="text-sm text-muted-foreground">暂无分配角色</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>权限统计</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(
                        userPermissions?.effectivePermissions.reduce((acc, perm) => {
                          acc[perm.module] = (acc[perm.module] || 0) + 1
                          return acc
                        }, {} as Record<string, number>) || {}
                      ).map(([module, count]) => (
                        <div key={module} className="flex justify-between">
                          <span className="text-sm">{moduleNames[module] || module}</span>
                          <Badge variant="outline">{count}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* 角色管理 */}
            <TabsContent value="roles" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">角色分配</h3>
                <div className="flex gap-2">
                  <Input
                    placeholder="操作原因（可选）"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-64"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {(allRoles || []).map(role => (
                  <Card key={role.id}>
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-sm">{role.name}</CardTitle>
                          <CardDescription className="text-xs">
                            {role.description}
                          </CardDescription>
                        </div>
                        <Badge variant={hasRole(role.id) ? 'default' : 'outline'}>
                          级别 {role.level}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-muted-foreground">
                          {role.rolePermissions?.length || 0} 个权限
                        </div>
                        {hasRole(role.id) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRevokeRole(role.id)}
                          >
                            <Minus className="h-3 w-3 mr-1" />
                            撤销
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => handleAssignRole(role.id)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            分配
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* 个人权限 */}
            <TabsContent value="permissions" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">个人权限设置</h3>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="搜索权限..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 w-64"
                    />
                  </div>
                  <Input
                    placeholder="操作原因（可选）"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-64"
                  />
                </div>
              </div>

              <div className="space-y-6">
                {Object.entries(permissionsByModule).map(([module, permissions]) => (
                  <Card key={module}>
                    <CardHeader>
                      <CardTitle className="text-base">
                        {moduleNames[module] || module}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-3 md:grid-cols-2">
                        {permissions.map(permission => {
                          const effective = hasEffectivePermission(permission.id)
                          const personal = hasPersonalPermission(permission.id)
                          
                          return (
                            <div
                              key={permission.id}
                              className="flex items-center justify-between p-3 border rounded-lg"
                            >
                              <div className="flex items-center space-x-3">
                                <Checkbox
                                  checked={effective}
                                  disabled={personal}
                                />
                                <div>
                                  <Label className="text-sm font-medium">
                                    {permission.name}
                                  </Label>
                                  <p className="text-xs text-muted-foreground">
                                    {permission.code}
                                  </p>
                                  {permission.description && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {permission.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {personal && (
                                  <Badge variant="secondary" className="text-xs">
                                    个人
                                  </Badge>
                                )}
                                {effective && !personal && (
                                  <Badge variant="outline" className="text-xs">
                                    角色
                                  </Badge>
                                )}
                                {effective ? (
                                  personal ? (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleRevokePermission(permission.id)}
                                    >
                                      <Minus className="h-3 w-3 mr-1" />
                                      撤销
                                    </Button>
                                  ) : null
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => handleGrantPermission(permission.id)}
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    授予
                                  </Button>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* 变更日志 */}
            <TabsContent value="logs" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">权限变更日志</h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <History className="h-4 w-4" />
                  最近操作记录
                </div>
              </div>
              <Card>
                <CardContent className="p-6">
                  <PermissionLogsView targetUserId={userId} />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// 权限日志查看组件
const PermissionLogsView: React.FC<{ targetUserId?: number }> = ({ targetUserId }) => {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    actionType: '',
    startDate: '',
    endDate: ''
  })
  const [pagination, setPagination] = useState({
    limit: 10,
    offset: 0,
    total: 0
  })

  // 加载权限日志
  const loadLogs = useCallback(async () => {
    if (!targetUserId) return
    
    setLoading(true)
    try {
      const params = new URLSearchParams({
        targetUserId: targetUserId.toString(),
        limit: pagination.limit.toString(),
        offset: pagination.offset.toString(),
        ...(filters.actionType && { actionType: filters.actionType }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate })
      })

      const response = await fetch(`/api/permissions/logs?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setLogs(data.data || [])
        setPagination(prev => ({ 
          ...prev, 
          total: data.total || 0 
        }))
      }
    } catch (error) {
      console.error('加载权限日志失败:', error)
    } finally {
      setLoading(false)
    }
  }, [targetUserId, pagination.limit, pagination.offset, filters])

  useEffect(() => {
    loadLogs()
  }, [loadLogs])

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }))
    setPagination(prev => ({ ...prev, offset: 0 }))
  }

  const handlePageChange = (newOffset: number) => {
    setPagination(prev => ({ ...prev, offset: newOffset }))
  }

  const getActionTypeText = (actionType: string) => {
    switch (actionType) {
      case 'GRANT_ROLE': return '分配角色'
      case 'REVOKE_ROLE': return '撤销角色'  
      case 'GRANT_PERMISSION': return '授予权限'
      case 'REVOKE_PERMISSION': return '撤销权限'
      case 'UPDATE_ROLE_PERMISSIONS': return '更新角色权限'
      default: return actionType
    }
  }

  const getActionTypeColor = (actionType: string) => {
    switch (actionType) {
      case 'GRANT_ROLE':
      case 'GRANT_PERMISSION': return 'text-green-600 bg-green-50'
      case 'REVOKE_ROLE':
      case 'REVOKE_PERMISSION': return 'text-red-600 bg-red-50'
      case 'UPDATE_ROLE_PERMISSIONS': return 'text-blue-600 bg-blue-50'
      default: return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="space-y-4">
      {/* 筛选器 */}
      <div className="flex flex-wrap gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-sm font-medium">操作类型</Label>
          <select
            value={filters.actionType}
            onChange={(e) => handleFilterChange('actionType', e.target.value)}
            className="w-full mt-1 p-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="">全部</option>
            <option value="GRANT_ROLE">分配角色</option>
            <option value="REVOKE_ROLE">撤销角色</option>
            <option value="GRANT_PERMISSION">授予权限</option>
            <option value="REVOKE_PERMISSION">撤销权限</option>
            <option value="UPDATE_ROLE_PERMISSIONS">更新角色权限</option>
          </select>
        </div>
        
        <div className="flex-1 min-w-[150px]">
          <Label className="text-sm font-medium">开始日期</Label>
          <Input
            type="date"
            value={filters.startDate}
            onChange={(e) => handleFilterChange('startDate', e.target.value)}
            className="mt-1"
          />
        </div>
        
        <div className="flex-1 min-w-[150px]">
          <Label className="text-sm font-medium">结束日期</Label>
          <Input
            type="date"
            value={filters.endDate}
            onChange={(e) => handleFilterChange('endDate', e.target.value)}
            className="mt-1"
          />
        </div>
        
        <div className="flex items-end">
          <Button onClick={() => loadLogs()} className="h-10">
            <Search className="w-4 h-4 mr-2" />
            查询
          </Button>
        </div>
      </div>

      {/* 日志列表 */}
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="mt-2 text-sm text-gray-600">加载中...</p>
          </div>
        ) : logs.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {logs.map((log, index) => (
              <div key={log.id || index} className="p-4 hover:bg-gray-50">
                <div className="flex items-start space-x-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionTypeColor(log.actionType)}`}>
                        {getActionTypeText(log.actionType)}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(log.timestamp).toLocaleString('zh-CN')}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-700 mb-2">
                      {log.reason || '权限变更操作'}
                    </div>
                    
                    {/* 变更详情 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {log.oldValue && (
                        <div>
                          <span className="font-medium text-gray-600">变更前：</span>
                          <div className="mt-1 p-2 bg-red-50 rounded border">
                            {JSON.parse(log.oldValue).map((item: any, i: number) => (
                              <div key={i} className="text-red-700">
                                {item.name || item.code}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {log.newValue && (
                        <div>
                          <span className="font-medium text-gray-600">变更后：</span>
                          <div className="mt-1 p-2 bg-green-50 rounded border">
                            {JSON.parse(log.newValue).map((item: any, i: number) => (
                              <div key={i} className="text-green-700">
                                {item.name || item.code}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-xs text-gray-500 mt-2">
                      操作者ID: {log.operatorId} | IP: {log.ipAddress || 'N/A'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <FileText className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>暂无权限变更记录</p>
          </div>
        )}
      </div>

      {/* 分页 */}
      {pagination.total > pagination.limit && (
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-600">
            共 {pagination.total} 条记录，显示第 {pagination.offset + 1} - {Math.min(pagination.offset + pagination.limit, pagination.total)} 条
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline" 
              size="sm"
              disabled={pagination.offset === 0}
              onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm" 
              disabled={pagination.offset + pagination.limit >= pagination.total}
              onClick={() => handlePageChange(pagination.offset + pagination.limit)}
            >
              下一页
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
