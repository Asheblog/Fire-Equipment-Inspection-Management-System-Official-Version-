import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { Loader2, Shield } from 'lucide-react'

export const LoginPage: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login } = useAuthStore()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    username: localStorage.getItem('saved-username') || '',
    password: '',
    rememberMe: false,
    saveUsername: !!localStorage.getItem('saved-username') || true
  })

  // 获取重定向目标
  const from = location.state?.from?.pathname || '/dashboard'

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
    // 清除错误信息
    if (error) setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.username || !formData.password) {
      setError('请输入用户名和密码')
      return
    }

    setLoading(true)
    setError('')

    try {
      console.log('📡 [LoginPage] 发送登录请求:', formData)
      const response = await authApi.login({
        username: formData.username,
        password: formData.password,
        rememberMe: formData.rememberMe
      })
      console.log('📥 [LoginPage] 登录响应:', response)
      
      if (response.success && response.data) {
        const { user, factory, accessToken, refreshToken } = response.data
        console.log('📥 [LoginPage] 登录响应详细解析:', { 
          user: user ? {
            id: user.id,
            username: user.username,
            role: user.role,  // 关键检查点！
            factoryId: user.factoryId,
            fullName: user.fullName
          } : null,
          factory: factory ? {
            id: factory.id,
            name: factory.name
          } : null,
          accessToken: accessToken ? `${accessToken.substring(0, 20)}...` : '无token',
          refreshToken: refreshToken ? `${refreshToken.substring(0, 20)}...` : '无refreshToken',
          responseSuccess: response.success,
          responseMessage: response.message
        })
        
        // 解析JWT token内容
        if (accessToken) {
          try {
            const tokenParts = accessToken.split('.')
            if (tokenParts.length === 3) {
              const payload = JSON.parse(atob(tokenParts[1]))
              console.log('🎫 [LoginPage] JWT Token解析:', {
                userId: payload.userId,
                username: payload.username,
                role: payload.role,
                factoryId: payload.factoryId,
                permissions: payload.permissions,
                exp: new Date(payload.exp * 1000).toLocaleString(),
                iat: new Date(payload.iat * 1000).toLocaleString()
              })
            }
          } catch (err) {
            console.error('❌ [LoginPage] JWT Token解析失败:', err)
          }
        }
        
        // 确保factory存在，如果不存在则创建一个默认对象
        const safeFactory = factory || { id: 0, name: '未知厂区', address: '', createdAt: '' }
        
        // 调用store的login方法，使用accessToken作为token参数
        console.log('🔄 [LoginPage] 调用AuthStore.login方法')
        login(user, safeFactory, accessToken, refreshToken)

        // 保存/清除账号
        if (formData.saveUsername) {
          localStorage.setItem('saved-username', formData.username)
        } else {
          localStorage.removeItem('saved-username')
        }
        
        // 等待一下，确保状态更新完成
        setTimeout(() => {
          console.log('🔀 [LoginPage] 准备跳转到:', from)
          navigate(from, { replace: true })
        }, 100)
      } else {
        setError(response.message || '登录失败')
      }
    } catch (err: any) {
      console.error('Login error:', err)
      setError(
        err.response?.data?.message || 
        err.message || 
        '网络错误，请稍后重试'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold">
              消防器材点检管理系统
            </CardTitle>
            <CardDescription>
              请使用您的账号登录系统
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-destructive/15 border border-destructive/20 text-destructive text-sm rounded-md p-3">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <label htmlFor="username" className="text-sm font-medium">
                  用户名
                </label>
                <Input
                  id="username"
                  name="username"
                  type="text"
                  required
                  placeholder="请输入用户名"
                  value={formData.username}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  密码
                </label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  placeholder="请输入密码"
                  value={formData.password}
                  onChange={handleInputChange}
                  disabled={loading}
                />
              </div>

              <div className="flex items-center justify-between gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleInputChange}
                    className="h-4 w-4 border rounded"
                    disabled={loading}
                  />
                  <span>记住我(最长90天)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="saveUsername"
                    checked={formData.saveUsername}
                    onChange={handleInputChange}
                    className="h-4 w-4 border rounded"
                    disabled={loading}
                  />
                  <span>保存账号</span>
                </label>
              </div>
              
              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? '登录中...' : '登录'}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-xs text-muted-foreground">
                消防器材点检管理系统 v1.0
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
