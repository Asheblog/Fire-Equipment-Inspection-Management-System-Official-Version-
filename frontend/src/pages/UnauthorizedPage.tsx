import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldX, ArrowLeft } from 'lucide-react'

export const UnauthorizedPage: React.FC = () => {
  const navigate = useNavigate()
  const { logout } = useAuthStore()

  const handleRelogin = () => {
    logout()
    navigate('/login')
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive rounded-lg flex items-center justify-center mb-4">
              <ShieldX className="h-6 w-6 text-destructive-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold text-destructive">
              访问被拒绝
            </CardTitle>
          </CardHeader>
          
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              抱歉，您没有权限访问此页面。请联系管理员获取相应权限。
            </p>
            
            <div className="space-y-2">
              <Button asChild className="w-full">
                <Link to="/dashboard">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  返回首页
                </Link>
              </Button>
              
              <Button variant="outline" onClick={handleRelogin} className="w-full">
                重新登录
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}