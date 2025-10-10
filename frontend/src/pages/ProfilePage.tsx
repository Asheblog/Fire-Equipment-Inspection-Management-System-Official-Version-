import React, { useState } from 'react'
import { useAuthStore } from '@/stores/auth'
import { userApi, authApi } from '@/api'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/layout/PageHeader'
import { ContentSection } from '@/components/layout/ContentSection'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { isValidationError, extractValidationErrors, showValidationSummary, focusFirstError } from '@/utils/validation'
import { User, Settings, Shield, Building2, Calendar, Eye, EyeOff } from 'lucide-react'

export const ProfilePage: React.FC = () => {
  const { user, factory, updateUser } = useAuthStore()
  const [isEditing, setIsEditing] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [showOldPassword, setShowOldPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  
  // 表单数据
  const [profileData, setProfileData] = useState({
    fullName: user?.fullName || '',
    username: user?.username || ''
  })
  
  const [passwordData, setPasswordData] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

  const [formErrors, setFormErrors] = useState<Record<string, string>>({})

  const validateProfileForm = () => {
    const errors: Record<string, string> = {}
    
    if (!profileData.fullName.trim()) {
      errors.fullName = '用户姓名不能为空'
    } else if (profileData.fullName.trim().length < 2) {
      errors.fullName = '用户姓名至少2个字符'
    }
    
    if (!profileData.username.trim()) {
      errors.username = '用户名不能为空'
    } else if (profileData.username.trim().length < 3) {
      errors.username = '用户名至少3个字符'
    } else if (!/^[a-zA-Z0-9_]+$/.test(profileData.username)) {
      errors.username = '用户名只能包含字母、数字和下划线'
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const validatePasswordForm = () => {
    const errors: Record<string, string> = {}
    
    if (!passwordData.oldPassword) {
      errors.oldPassword = '请输入当前密码'
    }
    
    if (!passwordData.newPassword) {
      errors.newPassword = '请输入新密码'
    } else if (passwordData.newPassword.length < 8) {
      errors.newPassword = '密码至少8个字符'
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?])/.test(passwordData.newPassword)) {
      errors.newPassword = '新密码必须包含大小写字母、数字和特殊字符'
    }
    
    if (!passwordData.confirmPassword) {
      errors.confirmPassword = '请确认新密码'
    } else if (passwordData.newPassword !== passwordData.confirmPassword) {
      errors.confirmPassword = '两次输入的密码不一致'
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !validateProfileForm()) return

    try {
      const response = await userApi.updateProfile({
        fullName: profileData.fullName.trim(),
        username: profileData.username.trim()
      })

      if (response.success && response.data) {
        updateUser(response.data)
        setIsEditing(false)
        toast.success("个人资料更新成功")
      }
    } catch (error: any) {
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        setFormErrors(prev => ({ ...prev, ...map }))
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
      } else {
        toast.error(error.response?.data?.message || "更新个人资料时发生错误")
      }
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validatePasswordForm()) return

    try {
      const response = await authApi.changePassword({
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword,
        confirmPassword: passwordData.confirmPassword
      })

      if (response.success) {
        setIsChangingPassword(false)
        setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' })
        toast.success("密码修改成功")
      }
    } catch (error: any) {
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        setFormErrors(prev => ({ ...prev, ...map }))
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
      } else {
        toast.error(error.response?.data?.message || "修改密码时发生错误")
      }
    }
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setProfileData({
      fullName: user?.fullName || '',
      username: user?.username || ''
    })
    setFormErrors({})
  }

  const handleCancelPasswordChange = () => {
    setIsChangingPassword(false)
    setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' })
    setFormErrors({})
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'default'
      case 'FACTORY_ADMIN':
        return 'secondary'
      case 'INSPECTOR':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN':
        return '系统管理员'
      case 'FACTORY_ADMIN':
        return '厂区管理员'
      case 'INSPECTOR':
        return '点检员'
      default:
        return role
    }
  }

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString)
      if (isNaN(date.getTime())) {
        return '无效日期'
      }
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (error) {
      return '无效日期'
    }
  }

  if (!user) {
    return null
  }

  return (
    <PageContainer>
      <PageHeader
        title="个人资料"
        description="查看和管理您的个人信息"
        icon={<User className="h-6 w-6" />}
      />

      <ContentSection>
        <div className="grid gap-6 max-w-4xl">
          {/* 基本信息卡片 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">基本信息</CardTitle>
                <CardDescription>您的账户基本信息</CardDescription>
              </div>
              {!isEditing && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  编辑资料
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">用户姓名</Label>
                    <Input
                      id="fullName"
                      value={profileData.fullName}
                      onChange={(e) => setProfileData(prev => ({...prev, fullName: e.target.value}))}
                      placeholder="请输入您的姓名"
                      className={formErrors.fullName ? 'border-red-500' : ''}
                    />
                    {formErrors.fullName && (
                      <p className="text-sm text-red-500">{formErrors.fullName}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="username">用户名</Label>
                    <Input
                      id="username"
                      value={profileData.username}
                      onChange={(e) => setProfileData(prev => ({...prev, username: e.target.value}))}
                      placeholder="请输入用户名"
                      className={formErrors.username ? 'border-red-500' : ''}
                    />
                    {formErrors.username && (
                      <p className="text-sm text-red-500">{formErrors.username}</p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button type="submit">
                      保存修改
                    </Button>
                    <Button type="button" variant="outline" onClick={handleCancelEdit}>
                      取消
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-500">用户姓名</label>
                      <p className="text-base font-medium">{user.fullName}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-500">用户名</label>
                      <p className="text-base font-medium">{user.username}</p>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-500">用户角色</label>
                      <div>
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          <Shield className="h-3 w-3 mr-1" />
                          {getRoleDisplayName(user.role)}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-500">所属厂区</label>
                      <div className="flex items-center">
                        <Building2 className="h-4 w-4 mr-2 text-gray-400" />
                        <p className="text-base">{factory?.name || '无'}</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-500">账户状态</label>
                      <div>
                        <Badge variant={user.isActive ? "default" : "secondary"}>
                          {user.isActive ? '正常' : '已停用'}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-500">创建时间</label>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                        <p className="text-base">
                          {formatDateTime(user.createdAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 密码管理卡片 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle className="text-lg">密码管理</CardTitle>
                <CardDescription>修改您的登录密码</CardDescription>
              </div>
              {!isChangingPassword && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsChangingPassword(true)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  修改密码
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isChangingPassword ? (
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="oldPassword">当前密码</Label>
                    <div className="relative">
                      <Input 
                        id="oldPassword"
                        type={showOldPassword ? "text" : "password"}
                        value={passwordData.oldPassword}
                        onChange={(e) => setPasswordData(prev => ({...prev, oldPassword: e.target.value}))}
                        placeholder="请输入当前密码"
                        className={formErrors.oldPassword ? 'border-red-500' : ''}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                      >
                        {showOldPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {formErrors.oldPassword && (
                      <p className="text-sm text-red-500">{formErrors.oldPassword}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">新密码</Label>
                    <div className="relative">
                      <Input 
                        id="newPassword"
                        type={showNewPassword ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData(prev => ({...prev, newPassword: e.target.value}))}
                        placeholder="请输入新密码（至少8位，需包含大小写字母、数字和特殊字符）"
                        className={formErrors.newPassword ? 'border-red-500' : ''}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {formErrors.newPassword && (
                      <p className="text-sm text-red-500">{formErrors.newPassword}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">确认新密码</Label>
                    <div className="relative">
                      <Input 
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData(prev => ({...prev, confirmPassword: e.target.value}))}
                        placeholder="请再次输入新密码"
                        className={formErrors.confirmPassword ? 'border-red-500' : ''}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {formErrors.confirmPassword && (
                      <p className="text-sm text-red-500">{formErrors.confirmPassword}</p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-4">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button">
                          确认修改
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>确认修改密码</AlertDialogTitle>
                          <AlertDialogDescription>
                            您确定要修改登录密码吗？修改后需要使用新密码重新登录。
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>取消</AlertDialogCancel>
                          <AlertDialogAction onClick={handlePasswordSubmit}>
                            确认修改
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button type="button" variant="outline" onClick={handleCancelPasswordChange}>
                      取消
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="text-sm text-gray-500">
                    <p>• 密码至少8个字符</p>
                    <p>• 必须包含大写字母、小写字母、数字和特殊字符</p>
                    <p>• 建议定期更新密码以确保账户安全</p>
                  </div>
                  <Separator />
                  <p className="text-sm text-gray-600">
                    上次密码修改时间：
                    {user.lastPasswordChangedAt 
                      ? formatDateTime(user.lastPasswordChangedAt as any)
                      : '暂无数据'}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ContentSection>
    </PageContainer>
  )
}
