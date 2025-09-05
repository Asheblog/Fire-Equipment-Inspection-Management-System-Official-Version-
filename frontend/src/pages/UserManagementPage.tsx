/**
 * 用户管理页面
 */

import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'
import { userApi, factoryApi } from '@/api'
import type { User, Factory, UserStats, UserRole } from '@/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { PageContainer, PageHeader, ContentSection } from '@/components/layout'
import { UserPermissionDialog } from '@/components/UserPermissionDialog'
import { toast } from 'sonner'
import { isValidationError, extractValidationErrors, showValidationSummary, focusFirstError } from '@/utils/validation'
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Users, 
  Building2, 
  Shield, 
  ShieldCheck,
  Edit,
  Key,
  UserCheck,
  UserX,
  Settings,
  Trash2
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const roleLabels = {
  INSPECTOR: '点检员',
  FACTORY_ADMIN: '厂区管理员',
  SUPER_ADMIN: '超级管理员'
}

const roleColors = {
  INSPECTOR: 'bg-blue-100 text-blue-800',
  FACTORY_ADMIN: 'bg-green-100 text-green-800',
  SUPER_ADMIN: 'bg-purple-100 text-purple-800'
}

export const UserManagementPage: React.FC = () => {
  const { isSuperAdmin } = useAuthStore()
  const [users, setUsers] = useState<User[]>([])
  const [factories, setFactories] = useState<Factory[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState<string>('all')
  const [selectedFactory, setSelectedFactory] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

  // 对话框状态
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false)
  const [showCreateFactoryDialog, setShowCreateFactoryDialog] = useState(false)
  const [showEditFactoryDialog, setShowEditFactoryDialog] = useState(false)
  const [showDeleteFactoryDialog, setShowDeleteFactoryDialog] = useState(false)
  const [showDeleteUserDialog, setShowDeleteUserDialog] = useState(false)
  const [showPermissionDialog, setShowPermissionDialog] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [selectedFactoryForEdit, setSelectedFactoryForEdit] = useState<Factory | null>(null)

  // 表单状态
  const [userForm, setUserForm] = useState({
    username: '',
    password: '',
    fullName: '',
    role: 'INSPECTOR' as UserRole,
    factoryId: 0
  })
  const [factoryForm, setFactoryForm] = useState({
    name: '',
    address: ''
  })
  const [newPassword, setNewPassword] = useState('')

  // 分页状态
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // 加载数据
  const loadData = async () => {
    setLoading(true)
    try {
      const [usersResponse, factoriesResponse, statsResponse] = await Promise.all([
        userApi.getList({
          page: currentPage,
          pageSize: 20,
          search: searchTerm || undefined,
          role: selectedRole && selectedRole !== 'all' ? selectedRole : undefined,
          factoryId: selectedFactory && selectedFactory !== 'all' ? parseInt(selectedFactory) : undefined
        }),
        factoryApi.getList(),
        userApi.getStats()
      ])

      setUsers(usersResponse.data?.items || [])
      setTotalCount(usersResponse.data?.total || 0)
      setTotalPages(Math.ceil((usersResponse.data?.total || 0) / 20))
      setFactories(factoriesResponse.data || [])
      setStats(statsResponse.data)
    } catch (error) {
      console.error('加载数据失败:', error)
      toast.error('加载数据失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [currentPage, searchTerm, selectedRole, selectedFactory, selectedStatus])

  // 创建用户
  const handleCreateUser = async () => {
    try {
      if (!userForm.username || !userForm.password || !userForm.fullName || !userForm.factoryId) {
        toast.error('请填写所有必填字段')
        return
      }

      await userApi.create(userForm)
      toast.success('用户创建成功')
      setShowCreateDialog(false)
      resetUserForm()
      loadData()
    } catch (error: any) {
      console.error('创建用户失败:', error)
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
      } else {
        toast.error(error.response?.data?.message || '创建用户失败')
      }
    }
  }

  // 更新用户
  const handleUpdateUser = async () => {
    if (!selectedUser) return

    try {
      const updateData = {
        username: userForm.username,
        fullName: userForm.fullName,
        role: userForm.role,
        factoryId: userForm.factoryId || selectedUser.factoryId
      }

      await userApi.update(selectedUser.id, updateData)
      toast.success('用户更新成功')
      setShowEditDialog(false)
      setSelectedUser(null)
      resetUserForm()
      loadData()
    } catch (error: any) {
      console.error('更新用户失败:', error)
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
      } else {
        toast.error(error.response?.data?.message || '更新用户失败')
      }
    }
  }

  // 切换用户状态
  const handleToggleUserStatus = async (user: User) => {
    try {
      const newStatus = !user.isActive
      await userApi.toggleStatus(user.id, newStatus)
      toast.success(`用户已${user.isActive ? '禁用' : '启用'}`)
      loadData()
    } catch (error: any) {
      console.error('切换用户状态失败:', error)
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
      } else {
        toast.error(error.response?.data?.message || '操作失败')
      }
    }
  }

  // 重置密码
  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword) return

    try {
      await userApi.resetPassword(selectedUser.id, newPassword)
      toast.success('密码重置成功')
      setShowResetPasswordDialog(false)
      setSelectedUser(null)
      setNewPassword('')
    } catch (error: any) {
      console.error('重置密码失败:', error)
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
      } else {
        toast.error(error.response?.data?.message || '重置密码失败')
      }
    }
  }

  // 删除用户
  const handleDeleteUser = async () => {
    if (!selectedUser) return

    try {
      await userApi.delete(selectedUser.id)
      toast.success('用户删除成功')
      setShowDeleteUserDialog(false)
      setSelectedUser(null)
      loadData()
    } catch (error: any) {
      console.error('删除用户失败:', error)
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
      } else {
        toast.error(error.response?.data?.message || '删除用户失败')
      }
    }
  }

  // 创建厂区
  const handleCreateFactory = async () => {
    try {
      if (!factoryForm.name) {
        toast.error('请输入厂区名称')
        return
      }

      await factoryApi.create(factoryForm)
      toast.success('厂区创建成功')
      setShowCreateFactoryDialog(false)
      setFactoryForm({ name: '', address: '' })
      
      // 重新加载厂区列表
      const factoriesResponse = await factoryApi.getList()
      setFactories(factoriesResponse.data || [])
    } catch (error: any) {
      console.error('创建厂区失败:', error)
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
      } else {
        toast.error(error.response?.data?.message || '创建厂区失败')
      }
    }
  }

  // 编辑厂区
  const handleEditFactory = async () => {
    if (!selectedFactoryForEdit) return
    
    try {
      if (!factoryForm.name) {
        toast.error('请输入厂区名称')
        return
      }

      await factoryApi.update(selectedFactoryForEdit.id, factoryForm)
      toast.success('厂区更新成功')
      setShowEditFactoryDialog(false)
      setSelectedFactoryForEdit(null)
      setFactoryForm({ name: '', address: '' })
      
      // 重新加载厂区列表
      const factoriesResponse = await factoryApi.getList()
      setFactories(factoriesResponse.data || [])
    } catch (error: any) {
      console.error('更新厂区失败:', error)
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
      } else {
        toast.error(error.response?.data?.message || '更新厂区失败')
      }
    }
  }

  // 删除厂区
  const handleDeleteFactory = async () => {
    if (!selectedFactoryForEdit) return
    
    try {
      await factoryApi.delete(selectedFactoryForEdit.id)
      toast.success('厂区删除成功')
      setShowDeleteFactoryDialog(false)
      setSelectedFactoryForEdit(null)
      
      // 重新加载厂区列表
      const factoriesResponse = await factoryApi.getList()
      setFactories(factoriesResponse.data || [])
    } catch (error: any) {
      console.error('删除厂区失败:', error)
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
      } else {
        toast.error(error.response?.data?.message || '删除厂区失败')
      }
    }
  }

  // 打开编辑厂区对话框
  const openEditFactoryDialog = (factory: Factory) => {
    setSelectedFactoryForEdit(factory)
    setFactoryForm({
      name: factory.name,
      address: factory.address || ''
    })
    setShowEditFactoryDialog(true)
  }

  // 打开删除厂区确认对话框
  const openDeleteFactoryDialog = (factory: Factory) => {
    setSelectedFactoryForEdit(factory)
    setShowDeleteFactoryDialog(true)
  }

  // 重置表单
  const resetUserForm = () => {
    setUserForm({
      username: '',
      password: '',
      fullName: '',
      role: 'INSPECTOR' as UserRole,
      factoryId: 0
    })
  }

  // 打开编辑对话框
  const openEditDialog = (user: User) => {
    setSelectedUser(user)
    setUserForm({
      username: user.username,
      password: '',
      fullName: user.fullName,
      role: user.role,
      factoryId: user.factoryId
    })
    setShowEditDialog(true)
  }

  // 打开权限管理对话框
  const openPermissionDialog = (user: User) => {
    setSelectedUser(user)
    setShowPermissionDialog(true)
  }

  // 打开重置密码对话框
  const openResetPasswordDialog = (user: User) => {
    setSelectedUser(user)
    setNewPassword('')
    setShowResetPasswordDialog(true)
  }

  // 打开删除用户对话框
  const openDeleteUserDialog = (user: User) => {
    setSelectedUser(user)
    setShowDeleteUserDialog(true)
  }

  // 权限变更回调
  const handlePermissionChange = () => {
    loadData() // 重新加载用户数据以更新显示
  }

  if (!isSuperAdmin()) {
    return (
      <PageContainer>
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">访问受限</h1>
          <p className="text-muted-foreground">只有超级管理员可以访问用户管理功能</p>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader 
        title="用户管理"
        description="管理系统用户和厂区信息"
      >
        <Button onClick={() => setShowCreateFactoryDialog(true)} variant="outline">
          <Building2 className="h-4 w-4 mr-2" />
          新增厂区
        </Button>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新增用户
        </Button>
      </PageHeader>

      <ContentSection>
        {/* 统计卡片 */}
        {stats && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总用户数</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                活跃率 {stats.activeRate}%
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">点检员</CardTitle>
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byRole.inspector}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">厂区管理员</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byRole.factoryAdmin}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">超级管理员</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byRole.superAdmin}</div>
            </CardContent>
          </Card>
          </div>
        )}

        {/* 厂区管理 */}
        <Card>
          <CardHeader>
            <CardTitle>厂区管理</CardTitle>
            <CardDescription>管理系统中的所有厂区信息</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>厂区名称</TableHead>
                    <TableHead>厂区地址</TableHead>
                    <TableHead>用户数量</TableHead>
                    <TableHead>器材数量</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6">
                        加载中...
                      </TableCell>
                    </TableRow>
                  ) : factories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-6">
                        暂无厂区数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    factories.map((factory) => (
                      <TableRow key={factory.id}>
                        <TableCell className="font-medium">{factory.name}</TableCell>
                        <TableCell>{factory.address || '未设置'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {factory.userCount || 0} 人
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {factory.equipmentCount || 0} 台
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(factory.createdAt).toLocaleDateString('zh-CN')}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditFactoryDialog(factory)}>
                                编辑
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => openDeleteFactoryDialog(factory)}
                                className="text-red-600"
                              >
                                删除
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* 筛选和搜索 */}
        <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
          <CardDescription>管理系统中的所有用户账户</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="搜索用户名或姓名..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={selectedRole} onValueChange={setSelectedRole}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="选择角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有角色</SelectItem>
                <SelectItem value="INSPECTOR">点检员</SelectItem>
                <SelectItem value="FACTORY_ADMIN">厂区管理员</SelectItem>
                <SelectItem value="SUPER_ADMIN">超级管理员</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedFactory} onValueChange={setSelectedFactory}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="选择厂区" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有厂区</SelectItem>
                {factories.map((factory) => (
                  <SelectItem key={factory.id} value={factory.id.toString()}>
                    {factory.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有状态</SelectItem>
                <SelectItem value="active">启用</SelectItem>
                <SelectItem value="inactive">禁用</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 用户表格 */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户信息</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>所属厂区</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>活动统计</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6">
                      加载中...
                    </TableCell>
                  </TableRow>
                ) : users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-6">
                      暂无用户数据
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{user.fullName}</div>
                          <div className="text-sm text-muted-foreground">{user.username}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={roleColors[user.role]}>
                          {roleLabels[user.role]}
                        </Badge>
                      </TableCell>
                      <TableCell>{user.factory?.name || '未分配'}</TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? 'default' : 'secondary'}>
                          {user.isActive ? '启用' : '禁用'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>点检: 暂无统计</div>
                          <div>上报: 暂无统计</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(user.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">打开菜单</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>操作</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => openEditDialog(user)}>
                              <Edit className="mr-2 h-4 w-4" />
                              编辑
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openResetPasswordDialog(user)}>
                              <Key className="mr-2 h-4 w-4" />
                              重置密码
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openPermissionDialog(user)}>
                              <Settings className="mr-2 h-4 w-4" />
                              权限管理
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleToggleUserStatus(user)}
                              className={user.isActive ? 'text-orange-600' : 'text-green-600'}
                            >
                              {user.isActive ? (
                                <>
                                  <UserX className="mr-2 h-4 w-4" />
                                  禁用用户
                                </>
                              ) : (
                                <>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  启用用户
                                </>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => openDeleteUserDialog(user)}
                              className="text-red-600"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              删除用户
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between space-x-2 py-4">
              <div className="text-sm text-muted-foreground">
                共 {totalCount} 个用户，第 {currentPage} / {totalPages} 页
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  上一页
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      </ContentSection>

      {/* 创建用户对话框 */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>新增用户</DialogTitle>
            <DialogDescription>
              创建新的系统用户账户
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="username" className="text-right">
                用户名 *
              </Label>
              <Input
                id="username"
                value={userForm.username}
                onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                className="col-span-3"
                placeholder="登录用户名"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                密码 *
              </Label>
              <Input
                id="password"
                type="password"
                value={userForm.password}
                onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                className="col-span-3"
                placeholder="登录密码"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="fullName" className="text-right">
                姓名 *
              </Label>
              <Input
                id="fullName"
                value={userForm.fullName}
                onChange={(e) => setUserForm(prev => ({ ...prev, fullName: e.target.value }))}
                className="col-span-3"
                placeholder="真实姓名"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="role" className="text-right">
                角色 *
              </Label>
              <Select 
                value={userForm.role} 
                onValueChange={(value: any) => setUserForm(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择角色" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INSPECTOR">点检员</SelectItem>
                  <SelectItem value="FACTORY_ADMIN">厂区管理员</SelectItem>
                  <SelectItem value="SUPER_ADMIN">超级管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="factory" className="text-right">
                所属厂区 *
              </Label>
              <Select 
                value={userForm.factoryId.toString()} 
                onValueChange={(value) => setUserForm(prev => ({ ...prev, factoryId: parseInt(value) }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="选择厂区" />
                </SelectTrigger>
                <SelectContent>
                  {factories.map((factory) => (
                    <SelectItem key={factory.id} value={factory.id.toString()}>
                      {factory.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreateUser}>创建用户</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑用户对话框 */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>编辑用户</DialogTitle>
            <DialogDescription>
              修改用户基本信息
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-username" className="text-right">
                用户名 *
              </Label>
              <Input
                id="edit-username"
                value={userForm.username}
                onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-fullName" className="text-right">
                姓名 *
              </Label>
              <Input
                id="edit-fullName"
                value={userForm.fullName}
                onChange={(e) => setUserForm(prev => ({ ...prev, fullName: e.target.value }))}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-role" className="text-right">
                角色 *
              </Label>
              <Select 
                value={userForm.role} 
                onValueChange={(value: any) => setUserForm(prev => ({ ...prev, role: value }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INSPECTOR">点检员</SelectItem>
                  <SelectItem value="FACTORY_ADMIN">厂区管理员</SelectItem>
                  <SelectItem value="SUPER_ADMIN">超级管理员</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-factory" className="text-right">
                所属厂区 *
              </Label>
              <Select 
                value={userForm.factoryId.toString()} 
                onValueChange={(value) => setUserForm(prev => ({ ...prev, factoryId: parseInt(value) }))}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {factories.map((factory) => (
                    <SelectItem key={factory.id} value={factory.id.toString()}>
                      {factory.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              取消
            </Button>
            <Button onClick={handleUpdateUser}>保存更改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置密码对话框 */}
      <Dialog open={showResetPasswordDialog} onOpenChange={setShowResetPasswordDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>重置密码</DialogTitle>
            <DialogDescription>
              为用户 "{selectedUser?.fullName}" 设置新密码
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="new-password" className="text-right">
                新密码 *
              </Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="col-span-3"
                placeholder="请输入新密码"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetPasswordDialog(false)}>
              取消
            </Button>
            <Button onClick={handleResetPassword}>重置密码</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 创建厂区对话框 */}
      <Dialog open={showCreateFactoryDialog} onOpenChange={setShowCreateFactoryDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>新增厂区</DialogTitle>
            <DialogDescription>
              创建新的厂区信息
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="factory-name" className="text-right">
                厂区名称 *
              </Label>
              <Input
                id="factory-name"
                value={factoryForm.name}
                onChange={(e) => setFactoryForm(prev => ({ ...prev, name: e.target.value }))}
                className="col-span-3"
                placeholder="厂区名称"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="factory-address" className="text-right">
                厂区地址
              </Label>
              <Input
                id="factory-address"
                value={factoryForm.address}
                onChange={(e) => setFactoryForm(prev => ({ ...prev, address: e.target.value }))}
                className="col-span-3"
                placeholder="厂区地址（可选）"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateFactoryDialog(false)}>
              取消
            </Button>
            <Button onClick={handleCreateFactory}>创建厂区</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑厂区对话框 */}
      <Dialog open={showEditFactoryDialog} onOpenChange={setShowEditFactoryDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>编辑厂区</DialogTitle>
            <DialogDescription>
              修改厂区信息
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-factory-name" className="text-right">
                厂区名称 *
              </Label>
              <Input
                id="edit-factory-name"
                value={factoryForm.name}
                onChange={(e) => setFactoryForm(prev => ({ ...prev, name: e.target.value }))}
                className="col-span-3"
                placeholder="厂区名称"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="edit-factory-address" className="text-right">
                厂区地址
              </Label>
              <Input
                id="edit-factory-address"
                value={factoryForm.address}
                onChange={(e) => setFactoryForm(prev => ({ ...prev, address: e.target.value }))}
                className="col-span-3"
                placeholder="厂区地址（可选）"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditFactoryDialog(false)}>
              取消
            </Button>
            <Button onClick={handleEditFactory}>保存更改</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除厂区确认对话框 */}
      <Dialog open={showDeleteFactoryDialog} onOpenChange={setShowDeleteFactoryDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>删除厂区</DialogTitle>
            <DialogDescription>
              此操作不可撤销。确定要删除厂区 "{selectedFactoryForEdit?.name}" 吗？
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              删除厂区前，请确保没有关联的用户和器材。如果存在关联数据，删除操作将失败。
            </p>
            {selectedFactoryForEdit && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="text-sm space-y-1">
                  <div><strong>厂区名称:</strong> {selectedFactoryForEdit.name}</div>
                  <div><strong>厂区地址:</strong> {selectedFactoryForEdit.address || '未设置'}</div>
                  <div><strong>关联用户:</strong> {selectedFactoryForEdit.userCount || 0} 人</div>
                  <div><strong>关联器材:</strong> {selectedFactoryForEdit.equipmentCount || 0} 台</div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteFactoryDialog(false)}>
              取消
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteFactory}
              disabled={!!selectedFactoryForEdit && ((selectedFactoryForEdit.userCount || 0) > 0 || (selectedFactoryForEdit.equipmentCount || 0) > 0)}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除用户确认对话框 */}
      <Dialog open={showDeleteUserDialog} onOpenChange={setShowDeleteUserDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>删除用户</DialogTitle>
            <DialogDescription>
              此操作不可撤销。确定要删除用户 "{selectedUser?.fullName}" 吗？
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              删除用户前，请确保该用户没有重要的业务数据关联。如果存在关联数据，删除操作将失败。
            </p>
            {selectedUser && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="text-sm space-y-1">
                  <div><strong>用户名:</strong> {selectedUser.username}</div>
                  <div><strong>姓名:</strong> {selectedUser.fullName}</div>
                  <div><strong>角色:</strong> {roleLabels[selectedUser.role]}</div>
                  <div><strong>所属厂区:</strong> {selectedUser.factory?.name || '未分配'}</div>
                  <div><strong>状态:</strong> {selectedUser.isActive ? '启用' : '禁用'}</div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteUserDialog(false)}>
              取消
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteUser}
            >
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 权限管理对话框 */}
      {selectedUser && (
        <UserPermissionDialog
          open={showPermissionDialog}
          onOpenChange={setShowPermissionDialog}
          userId={selectedUser.id}
          userName={selectedUser.fullName}
          onPermissionChange={handlePermissionChange}
        />
      )}
    </PageContainer>
  )
}
