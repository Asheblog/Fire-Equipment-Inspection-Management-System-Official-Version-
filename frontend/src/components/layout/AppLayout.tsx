import React from 'react'
import { Sidebar } from './Sidebar'

interface AppLayoutProps {
  children: React.ReactNode
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* PC端侧边栏 - 固定左侧 */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-50 lg:block lg:w-64 lg:overflow-y-auto">
        <Sidebar />
      </div>
      
      {/* 主要内容区域 */}
      <div className="lg:pl-64">
        {/* 页面内容 - 从顶部开始 */}
        <main className="h-screen overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}