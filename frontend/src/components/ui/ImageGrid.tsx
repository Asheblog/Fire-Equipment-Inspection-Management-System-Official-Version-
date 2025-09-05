import React from 'react'
import { Badge } from '@/components/ui/badge'
import { AuthenticatedImage } from '@/components/AuthenticatedImage'
import { cn } from '@/lib/utils'

interface ImageGridProps {
  label?: string
  images: string[]
  emptyText?: string
  className?: string
  imageClassName?: string
  enableZoom?: boolean
  numbered?: boolean
  showCountBadge?: boolean
  gridCols?: { base?: number; sm?: number; md?: number }
  loading?: boolean
  error?: string
  skeletonCount?: number
  eagerCount?: number
}

export const ImageGrid: React.FC<ImageGridProps> = ({
  label,
  images = [],
  emptyText = '暂无图片',
  className = '',
  imageClassName = '',
  enableZoom = true,
  numbered = true,
  showCountBadge = true,
  gridCols = { base: 2, sm: 3, md: 4 },
  loading = false,
  error,
  skeletonCount = 3,
  eagerCount = 0
}) => {
  const filtered = images.filter(Boolean)

  if (error) {
    return (
      <div className={cn('space-y-2', className)}>
        {label && <span className="text-gray-500 text-sm">{label}</span>}
        <div className="p-4 border border-red-200 bg-red-50 rounded text-sm text-red-600">
          图片加载失败：{error}
        </div>
      </div>
    )
  }

  if (loading) {
    const skeletons = Array.from({ length: skeletonCount }).map((_, i) => (
      <div key={i} className="relative group animate-pulse">
        <div className="w-full h-40 rounded-lg bg-gray-200" />
      </div>
    ))
    return (
      <div className={cn('space-y-2', className)}>
        {label && <span className="text-gray-500 text-sm">{label}</span>}
        <div className={cn('grid gap-4', `grid-cols-${gridCols.base || 2}`)}>{skeletons}</div>
      </div>
    )
  }
  const count = filtered.length
  if (count === 0) {
    return (
      <div className={cn('space-y-2', className)}>
        {label && <span className="text-gray-500 text-sm">{label}</span>}
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-2xl text-gray-400">📷</span>
          </div>
          <p className="text-gray-500 text-sm">{emptyText}</p>
        </div>
      </div>
    )
  }

  const gridClass = count === 1
    ? 'grid-cols-1 place-items-center'
    : `grid-cols-${gridCols.base || 2} ${gridCols.sm ? `sm:grid-cols-${gridCols.sm}` : ''} ${gridCols.md ? `md:grid-cols-${gridCols.md}` : ''}`

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <div className="flex items-center gap-2">
          <span className="text-gray-500 text-sm">{label}</span>
          {showCountBadge && count > 1 && (
            <Badge variant="outline" className="text-xs">{count} 张</Badge>
          )}
        </div>
      )}
      <div className={cn('grid gap-4', gridClass)}>
        {filtered.map((url, idx) => (
          <div key={idx} className="relative group">
            <AuthenticatedImage
              src={url}
              alt={`${label || '图片'} ${idx + 1}`}
              className={cn(
                'w-full rounded-lg border shadow-sm object-cover',
                count === 1 ? 'max-w-md max-h-72 object-contain' : 'h-40',
                imageClassName
              )}
              enableZoom={enableZoom}
              priority={idx < eagerCount}
              lazy={idx >= eagerCount}
            />
            {numbered && count > 1 && (
              <div className="absolute top-1 left-1 bg-black/50 text-white text-xs px-1 rounded">
                {idx + 1}
              </div>
            )}
          </div>
        ))}
      </div>
      {enableZoom && <p className="text-xs text-gray-500 text-center">点击图片可放大查看</p>}
    </div>
  )
}

export default ImageGrid
