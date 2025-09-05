import React from 'react'
import { Navigate } from 'react-router-dom'
import { isMobileDevice } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth'
import { UserRole } from '@/types'

export const MobileRedirectRoute: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore()
  
  // 如果用户未登录，重定向到登录页
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  const isMobile = isMobileDevice()
  
  // 移动端用户重定向到移动版首页
  if (isMobile) {
    return <Navigate to="/m/dashboard" replace />
  }
  
  // PC端用户重定向到管理后台
  // 但需要检查用户权限，点检员没有PC端管理权限
  if (user?.role === UserRole.INSPECTOR) {
    // 点检员只能使用移动端，即使在PC上也重定向到移动版
    return <Navigate to="/m/dashboard" replace />
  }
  
  return <Navigate to="/dashboard" replace />
}