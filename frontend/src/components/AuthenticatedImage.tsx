import React, { useState, useEffect, useRef, useMemo } from 'react'
import { createLogger } from '@/lib/logger'
import { api, isAuthError, forceLogoutRedirect } from '@/api/client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
// 删除未使用的图标导入

interface AuthenticatedImageProps {
  src: string
  alt?: string
  className?: string
  fallback?: React.ReactNode
  enableZoom?: boolean // 是否启用点击放大功能
  lazy?: boolean        // 是否使用 IntersectionObserver 延迟加载
  rootMargin?: string   // IO rootMargin
  threshold?: number    // IO 阈值
  priority?: boolean    // 首屏优先，跳过懒加载
}

export function AuthenticatedImage({ src, alt = '', className = '', fallback, enableZoom = false, lazy = true, rootMargin = '100px', threshold = 0.1, priority = false, onOpenPreview }: AuthenticatedImageProps & { onOpenPreview?: () => void }) {
  const log = createLogger('AuthImage')
  const [imageSrc, setImageSrc] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [showModal, setShowModal] = useState(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(!lazy || priority) // 如果 priority 或未启用懒加载则直接加载
  
  const MAX_RETRIES = 2 // 最大重试次数
  const RETRY_DELAY = 1000 // 重试延迟(ms)

  // 兼容历史数据：把以前保存的完整前端域名 + /uploads/ 路径裁剪为相对路径，避免错误端口
  // 也支持把包含 /uploads/ 的任意 http(s) 地址规范化为 /uploads/... 相对路径（利用 Vite 代理或同源静态服务）
  const normalizedSrc = useMemo(() => {
    if (!src) return ''
    try {
      // 处理被 HTML 实体编码的情况
      const textarea = document.createElement('textarea')
      textarea.innerHTML = src
      const decoded = textarea.value
      const uploadsIndex = decoded.indexOf('/uploads/')
      if (uploadsIndex > -1) {
        const pathPart = decoded.substring(uploadsIndex)
        if (pathPart !== decoded) {
          log.debug('纠正旧图片URL', { from: decoded, to: pathPart })
        }
        return pathPart
      }
      // 过滤掉误存的 blob: 值（数据库里不该有）
      if (decoded.startsWith('blob:')) {
        log.warn('检测到 blob URL，无法请求', { value: decoded })
        return ''
      }
      return decoded
    } catch {
      return src
    }
  }, [src])

  // 观察可见性
  useEffect(() => {
    if (!lazy || priority) return
    const el = containerRef.current
    if (!el) return
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setInView(true)
            io.disconnect()
          }
        })
      }, { root: null, rootMargin, threshold })
      io.observe(el)
      return () => io.disconnect()
    } else {
      // 不支持 IO 直接加载
      setInView(true)
    }
  }, [lazy, priority, rootMargin, threshold])

  useEffect(() => {
    if (!inView) return // 未进入视口不加载
    if (!normalizedSrc) {
      setLoading(false)
      setError(true)
      return
    }

    let isMounted = true
    let timeoutId: NodeJS.Timeout

    const loadImage = async () => {
      try {
        setLoading(true)
        setError(false)

        // 取消之前的请求
        if (abortControllerRef.current) {
          abortControllerRef.current.abort()
        }

        // 创建新的 AbortController
        abortControllerRef.current = new AbortController()

        // 使用API客户端获取文件（会自动携带认证头）
        const blob = await api.getFile(normalizedSrc)
        
        if (isMounted && !abortControllerRef.current.signal.aborted) {
          const imageUrl = URL.createObjectURL(blob)
          setImageSrc(imageUrl)
          setLoading(false)
          setRetryCount(0) // 重置重试计数
        }
      } catch (err: any) {
        log.error('加载认证图片失败', err)
        
        if (isMounted && !abortControllerRef.current?.signal.aborted) {
          // 401/认证失败：强制退出登录
          try { if (isAuthError(err)) { forceLogoutRedirect(); return } } catch {}
          // 404错误不重试，其他错误可以重试
          if (err?.response?.status === 404) {
            setError(true)
            setLoading(false)
          } else if (retryCount < MAX_RETRIES) {
            // 延迟重试
            timeoutId = setTimeout(() => {
              if (isMounted) {
                setRetryCount(prev => prev + 1)
                loadImage()
              }
            }, RETRY_DELAY * (retryCount + 1)) // 递增延迟
          } else {
            setError(true)
            setLoading(false)
          }
        }
      }
    }

    loadImage()

    // 清理函数
    return () => {
      isMounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc)
      }
    }
  }, [normalizedSrc, retryCount, inView])

  // 当组件卸载时清理blob URL
  useEffect(() => {
    return () => {
      if (imageSrc) {
        URL.revokeObjectURL(imageSrc)
      }
    }
  }, [imageSrc])

  if (loading) {
    return (
      <div ref={containerRef} className={`bg-gray-100 animate-pulse flex items-center justify-center ${className}`}>
        <span className="text-gray-400 text-xs">
          {retryCount > 0 ? `重试中(${retryCount}/${MAX_RETRIES})...` : '加载中...'}
        </span>
      </div>
    )
  }

  if (error || !imageSrc) {
    if (fallback) {
      return <div ref={containerRef}>{fallback}</div>
    }
    
    return (
      <div ref={containerRef} className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <span className="text-gray-400 text-xs">图片加载失败</span>
      </div>
    )
  }

  return (
    <>
      <div ref={containerRef} className="contents">
        <img 
          src={imageSrc} 
          alt={alt} 
          loading={priority ? 'eager' : 'lazy'}
          className={`${className} ${enableZoom ? 'cursor-zoom-in' : ''}`}
          onClick={() => {
            if (!enableZoom) return
            // @ts-ignore onOpenPreview may be injected later to integrate global viewer
            if (typeof onOpenPreview === 'function') { onOpenPreview() }
            else setShowModal(true)
          }}
          onError={() => {
            setError(true)
            if (imageSrc) {
              URL.revokeObjectURL(imageSrc)
              setImageSrc('')
            }
          }}
        />
      </div>
      
      {/* 放大图片模态框 */}
      {enableZoom && (
        <Dialog open={showModal} onOpenChange={setShowModal}>
          <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden p-0">
            <DialogHeader className="p-4">
              <DialogTitle className="text-base">{alt || '图片预览'}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center justify-center p-4">
              <img
                src={imageSrc}
                alt={alt}
                className="max-w-full max-h-[80vh] object-contain rounded"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
