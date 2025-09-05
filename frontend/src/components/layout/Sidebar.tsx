import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Shield,
  BarChart3,
  ShieldCheck,
  AlertTriangle,
  ScrollText,
  Users,
  FileBarChart,
  Building2,
  LogOut,
  User,
  Settings,
  ListChecks
} from 'lucide-react'

interface NavigationItem {
  name: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  requiredRoles?: string[]
}

const navigation: NavigationItem[] = [
  {
    name: '数据看板',
    href: '/dashboard',
    icon: BarChart3,
    requiredRoles: ['FACTORY_ADMIN', 'SUPER_ADMIN']
  },
  {
    name: '器材管理',
    href: '/equipments',
    icon: ShieldCheck,
    requiredRoles: ['FACTORY_ADMIN', 'SUPER_ADMIN']
  },
  {
    name: '器材类型管理',
    href: '/equipment-types',
    icon: ListChecks,
    requiredRoles: ['FACTORY_ADMIN', 'SUPER_ADMIN']
  },
  {
    name: '隐患管理',
    href: '/issues',
    icon: AlertTriangle,
    requiredRoles: ['FACTORY_ADMIN', 'SUPER_ADMIN']
  },
  {
    name: '点检记录',
    href: '/inspections',
    icon: ScrollText,
    requiredRoles: ['FACTORY_ADMIN', 'SUPER_ADMIN']
  },
  {
    name: '用户管理',
    href: '/users',
    icon: Users,
    requiredRoles: ['SUPER_ADMIN']
  },
  {
    name: '报表中心',
    href: '/reports',
    icon: FileBarChart,
    requiredRoles: ['FACTORY_ADMIN', 'SUPER_ADMIN']
  }
]

export const Sidebar: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, factory, hasRole, isSuperAdmin, logout } = useAuthStore()

  const filteredNavigation = navigation.filter(item => {
    if (!item.requiredRoles) return true
    return hasRole(item.requiredRoles as any)
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-full flex-col bg-white border-r border-gray-200 shadow-sm">
      {/* Logo区域 */}
      <div className="flex h-16 items-center px-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-bold text-base text-gray-900 leading-tight">
              消防器材点检管理系统
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Fire Safety Management
            </div>
          </div>
        </div>
      </div>

      {/* 导航菜单 */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {filteredNavigation.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                'group flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                isActive
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 h-5 w-5 flex-shrink-0',
                  isActive
                    ? 'text-white'
                    : 'text-gray-400 group-hover:text-gray-500'
                )}
              />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* 用户信息和操作区域 */}
      <div className="px-4 py-4 border-t border-gray-200 space-y-3">
        {/* 用户信息卡片 */}
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-medium text-primary">
                  {user?.fullName?.charAt(0) || 'U'}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.fullName}
              </p>
              <p className="text-xs text-gray-500 truncate flex items-center">
                <Building2 className="h-3 w-3 mr-1" />
                {factory?.name}
              </p>
            </div>
          </div>
          <div className="mt-2">
            <Badge 
              variant={isSuperAdmin() ? 'default' : 'secondary'} 
              className="text-xs"
            >
              {isSuperAdmin() ? '超级管理员' : '厂区管理员'}
            </Badge>
          </div>
        </div>

        {/* 用户操作菜单 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-start">
              <User className="h-4 w-4 mr-2" />
              <span className="text-sm">账户设置</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <div className="px-3 py-2">
              <p className="text-sm font-medium">{user?.fullName}</p>
              <p className="text-xs text-gray-500">{user?.username}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <User className="mr-2 h-4 w-4" />
              个人资料
            </DropdownMenuItem>
            {isSuperAdmin() && (
              <DropdownMenuItem onClick={() => navigate('/settings')}>
                <Settings className="mr-2 h-4 w-4" />
                系统设置
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              退出登录
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 系统版本信息 */}
        <div className="text-xs text-gray-500 text-center pt-2">
          <p>消防器材点检管理系统</p>
          <p className="mt-1">v1.0.0</p>
        </div>
      </div>
    </div>
  )
}