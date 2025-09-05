import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, Factory, UserRole } from '@/types'

interface AuthState {
  // 状态
  isAuthenticated: boolean
  user: User | null
  factory: Factory | null
  token: string | null
  refreshToken: string | null
  
  // 操作
  login: (user: User, factory: Factory, token: string, refreshToken: string) => void
  logout: () => void
  updateUser: (user: Partial<User>) => void
  setToken: (token: string) => void
  
  // 权限检查
  hasRole: (role: UserRole | UserRole[]) => boolean
  canAccessFactory: (factoryId: number) => boolean
  isSuperAdmin: () => boolean
  isFactoryAdmin: () => boolean
  isInspector: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // 初始状态
      isAuthenticated: false,
      user: null,
      factory: null,
      token: null,
      refreshToken: null,
      
      // 登录操作
      login: (user, factory, token, refreshToken) => {
        console.log('🔑 [AuthStore] login方法调用参数详情:', { 
          user: user ? {
            id: user.id,
            username: user.username, 
            role: user.role,  // 关键检查点！
            factoryId: user.factoryId,
            fullName: user.fullName
          } : null,
          factory: factory?.name || 'no factory', 
          token: token ? `${token.substring(0, 20)}...` : 'missing',
          refreshToken: refreshToken ? `${refreshToken.substring(0, 20)}...` : 'missing'
        })
        
        set({
          isAuthenticated: true,
          user,
          factory,
          token,
          refreshToken
        })
        
        console.log('✅ [AuthStore] 登录状态更新完成，当前状态:', {
          isAuthenticated: true,
          userRole: user?.role,
          factoryId: user?.factoryId,
          factoryName: factory?.name
        })
      },
      
      // 登出操作
      logout: () => {
        set({
          isAuthenticated: false,
          user: null,
          factory: null,
          token: null,
          refreshToken: null
        })
        // 清除所有本地存储
        localStorage.removeItem('auth-storage')
      },
      
      // 更新用户信息
      updateUser: (updatedUser) => {
        const { user } = get()
        if (user) {
          set({
            user: { ...user, ...updatedUser }
          })
        }
      },
      
      // 设置新Token
      setToken: (token) => {
        set({ token })
      },
      
      // 检查用户是否拥有指定角色
      hasRole: (role) => {
        const { user } = get()
        
        console.log('🎭 [AuthStore] hasRole权限检查:', {
          user: user ? {
            username: user.username,
            role: user.role,
            id: user.id,
            factoryId: user.factoryId
          } : null,
          requiredRole: role,
          requiredRoleType: Array.isArray(role) ? 'array' : 'single'
        })
        
        if (!user) {
          console.log('❌ [AuthStore] 无用户信息，权限检查失败')
          return false
        }
        
        let hasPermission = false
        if (Array.isArray(role)) {
          hasPermission = role.includes(user.role)
          console.log('🔍 [AuthStore] 数组角色检查:', {
            requiredRoles: role,
            userRole: user.role,
            includes: hasPermission,
            result: hasPermission ? '✅ 匹配' : '❌ 不匹配'
          })
        } else {
          hasPermission = user.role === role
          console.log('🔍 [AuthStore] 单一角色检查:', {
            requiredRole: role,
            userRole: user.role,
            equals: hasPermission,
            result: hasPermission ? '✅ 匹配' : '❌ 不匹配'
          })
        }
        
        return hasPermission
      },
      
      // 检查用户是否能访问指定厂区的数据
      canAccessFactory: (factoryId) => {
        const { user } = get()
        if (!user) return false
        
        // 超级管理员可以访问所有厂区
        if (user.role === 'SUPER_ADMIN') return true
        
        // 其他角色只能访问自己所属的厂区
        return user.factoryId === factoryId
      },
      
      // 快捷权限检查方法
      isSuperAdmin: () => {
        const { user } = get()
        return user?.role === 'SUPER_ADMIN'
      },
      
      isFactoryAdmin: () => {
        const { user } = get()
        return user?.role === 'FACTORY_ADMIN'
      },
      
      isInspector: () => {
        const { user } = get()
        return user?.role === 'INSPECTOR'
      }
    }),
    {
      name: 'auth-storage',
      // 只持久化关键信息
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        user: state.user,
        factory: state.factory,
        token: state.token,
        refreshToken: state.refreshToken
      })
    }
  )
)