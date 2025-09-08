import { create } from 'zustand'
import { createLogger } from '@/lib/logger'
import { persist } from 'zustand/middleware'
import type { User, Factory, UserRole } from '@/types'

interface AuthState {
  // 状态
  isAuthenticated: boolean
  user: User | null
  factory: Factory | null
  factories?: Factory[]
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

const log = createLogger('Auth')

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // 初始状态
      isAuthenticated: false,
      user: null,
      factory: null,
      factories: [],
      token: null,
      refreshToken: null,
      
      // 登录操作
      login: (user, factory, token, refreshToken) => {
        log.info('登录', {
          user: user ? { id: user.id, username: user.username, role: user.role, factoryId: user.factoryId } : null,
          factory: factory?.name,
        })
        
        set({
          isAuthenticated: true,
          user,
          factory,
          factories: user?.factories || (factory ? [factory] : []),
          token,
          refreshToken
        })
        
        log.debug('登录状态更新完成', { role: user?.role, factoryId: user?.factoryId })
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
        if (!user) return false
        if (Array.isArray(role)) return role.includes(user.role)
        return user.role === role
      },
      
      // 检查用户是否能访问指定厂区的数据
      canAccessFactory: (factoryId) => {
        const { user } = get()
        if (!user) return false
        
        // 超级管理员可以访问所有厂区
        if (user.role === 'SUPER_ADMIN') return true
        
        // 其他角色：若返回多厂区列表则使用列表判断
        if (Array.isArray(user.factoryIds) && user.factoryIds.length > 0) {
          return user.factoryIds.includes(factoryId)
        }
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
        factories: state.factories,
        token: state.token,
        refreshToken: state.refreshToken
      })
    }
  )
)
