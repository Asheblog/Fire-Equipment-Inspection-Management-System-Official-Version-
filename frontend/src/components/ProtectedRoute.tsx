import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import type { UserRole } from '@/types'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRoles?: UserRole[]
  redirectTo?: string
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles = [],
  redirectTo = '/login'
}) => {
  const location = useLocation()
  const { isAuthenticated, hasRole, user } = useAuthStore()

  console.log('🔒 [ProtectedRoute] 权限检查开始:', { 
    isAuthenticated, 
    requiredRoles, 
    currentPath: location.pathname,
    user: user ? {
      id: user.id,
      username: user.username,
      role: user.role,
      factoryId: user.factoryId
    } : null
  })

  // 未登录用户重定向到登录页
  if (!isAuthenticated) {
    console.log('❌ [ProtectedRoute] 用户未认证，重定向到登录页')
    return <Navigate to={redirectTo} state={{ from: location }} replace />
  }

  // 检查角色权限
  if (requiredRoles.length > 0) {
    const hasRequiredRole = hasRole(requiredRoles)
    console.log('🔍 [ProtectedRoute] 角色权限检查:', {
      requiredRoles,
      userRole: user?.role,
      hasRequiredRole,
      checkResult: hasRequiredRole ? '✅ 通过' : '❌ 拒绝'
    })
    
    if (!hasRequiredRole) {
      console.log('❌ [ProtectedRoute] 用户角色权限不足，重定向到未授权页面')
      return <Navigate to="/unauthorized" replace />
    }
  }

  console.log('✅ [ProtectedRoute] 用户认证通过，渲染受保护的内容')
  return <>{children}</>
}

interface PublicRouteProps {
  children: React.ReactNode
  redirectTo?: string
}

export const PublicRoute: React.FC<PublicRouteProps> = ({
  children,
  redirectTo = '/dashboard'
}) => {
  const { isAuthenticated } = useAuthStore()

  // 已登录用户重定向到指定页面
  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}