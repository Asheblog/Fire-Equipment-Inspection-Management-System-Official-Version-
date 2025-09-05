import React from 'react'
import { cn } from '@/lib/utils'

interface PageContainerProps {
  children: React.ReactNode
  className?: string
  variant?: 'default' | 'mobile'
}

export const PageContainer: React.FC<PageContainerProps> = ({ 
  children, 
  className, 
  variant = 'default' 
}) => {
  const baseClasses = variant === 'mobile' 
    ? 'p-4' // 移动端：16px padding
    : 'p-4 lg:p-6' // PC端：16px mobile, 24px desktop
  
  return (
    <div className={cn(baseClasses, className)}>
      {children}
    </div>
  )
}