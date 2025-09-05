import React from 'react'
import { cn } from '@/lib/utils'

interface ContentSectionProps {
  children: React.ReactNode
  className?: string
  spacing?: 'default' | 'compact' | 'loose'
}

export const ContentSection: React.FC<ContentSectionProps> = ({ 
  children, 
  className, 
  spacing = 'default' 
}) => {
  const spacingClasses = {
    compact: 'space-y-4',
    default: 'space-y-6', 
    loose: 'space-y-8'
  }
  
  return (
    <div className={cn(spacingClasses[spacing], className)}>
      {children}
    </div>
  )
}