import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Download as DownloadIcon } from 'lucide-react'
import { api } from '@/api/client'
import { saveAs } from 'file-saver'

type ImageItem = { src: string; alt?: string }

interface PreviewState {
  open: boolean
  items: ImageItem[]
  index: number
}

interface ImagePreviewContextValue {
  open: (items: Array<string | ImageItem>, startIndex?: number) => void
  close: () => void
}

const ImagePreviewContext = createContext<ImagePreviewContextValue | null>(null)

function normalizeSrc(src: string): string {
  if (!src) return ''
  try {
    const textarea = document.createElement('textarea')
    textarea.innerHTML = src
    const decoded = textarea.value
    const uploadsIndex = decoded.indexOf('/uploads/')
    if (uploadsIndex > -1) return decoded.substring(uploadsIndex)
    if (decoded.startsWith('blob:')) return ''
    return decoded
  } catch {
    return src
  }
}

function toItems(arr: Array<string | ImageItem>): ImageItem[] {
  return (arr || [])
    .map((x) => (typeof x === 'string' ? { src: x } : x))
    .filter(Boolean)
    .map((it) => ({ ...it, src: normalizeSrc(it.src) }))
    .filter((it) => !!it.src)
}

const Overlay: React.FC<{
  state: PreviewState
  onClose: () => void
  setIndex: (i: number) => void
  thumbnails?: boolean
  enableDownload?: boolean
  swipeThreshold?: number
}> = ({ state, onClose, setIndex, thumbnails = true, enableDownload = true, swipeThreshold = 60 }) => {
  const { items, index } = state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | undefined>(undefined)
  const [imgUrl, setImgUrl] = useState<string>('')
  const urlCacheRef = useRef<Map<string, string>>(new Map())

  // Zoom/pan
  const [scale, setScale] = useState(1)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)

  // Pinch
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchStartRef = useRef<{ dist: number; scale: number; cx: number; cy: number } | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const MIN_SCALE = 1
  const MAX_SCALE = 4

  // Sizes for clamp
  const [natural, setNatural] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const [containerSize, setContainerSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 })
  const baseScale = useMemo(() => {
    const { w: cw, h: ch } = containerSize
    const { w: iw, h: ih } = natural
    if (!cw || !ch || !iw || !ih) return 1
    return Math.min(cw / iw, ch / ih)
  }, [containerSize, natural])

  // Swipe detection
  const swipeRef = useRef<{ x: number; y: number } | null>(null)

  const current = items[index]

  const revokeAll = useCallback(() => {
    for (const u of urlCacheRef.current.values()) {
      try { URL.revokeObjectURL(u) } catch {}
    }
    urlCacheRef.current.clear()
  }, [])

  const loadAt = useCallback(async (idx: number) => {
    const item = items[idx]
    if (!item) return
    const key = item.src
    if (urlCacheRef.current.has(key)) {
      setImgUrl(urlCacheRef.current.get(key)!)
      setLoading(false)
      setError(undefined)
      return
    }
    setLoading(true)
    setError(undefined)
    try {
      const blob = await api.getFile(key)
      const url = URL.createObjectURL(blob)
      urlCacheRef.current.set(key, url)
      setImgUrl(url)
      setLoading(false)
    } catch (e: any) {
      setError(e?.message || '加载失败')
      setLoading(false)
    }
  }, [items])

  const preloadNeighbor = useCallback((idx: number) => {
    const item = items[idx]
    if (!item) return
    const key = item.src
    if (urlCacheRef.current.has(key)) return
    api.getFile(key).then((blob) => {
      const url = URL.createObjectURL(blob)
      urlCacheRef.current.set(key, url)
    }).catch(() => {})
  }, [items])

  const resetView = useCallback(() => {
    setScale(1)
    setTx(0)
    setTy(0)
  }, [])

  // Observe container size
  React.useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const calc = () => setContainerSize({ w: el.clientWidth, h: el.clientHeight })
    calc()
    const RO: any = (window as any).ResizeObserver
    if (typeof RO !== 'undefined') {
      const ro = new RO(() => calc())
      ro.observe(el)
      return () => ro.disconnect()
    } else {
      const onResize = () => calc()
      window.addEventListener('resize', onResize)
      return () => window.removeEventListener('resize', onResize)
    }
  }, [])

  React.useEffect(() => {
    resetView()
    loadAt(index)
    preloadNeighbor(index + 1)
    preloadNeighbor(index - 1)
    for (let d = 2; d <= 4; d++) {
      preloadNeighbor(index + d)
      preloadNeighbor(index - d)
    }
  }, [index, loadAt, preloadNeighbor, resetView])

  // Revoke blobs on unmount
  React.useEffect(() => () => revokeAll(), [revokeAll])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!state.open) return
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') goto(index + 1)
      if (e.key === 'ArrowLeft') goto(index - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, onClose, state.open])

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

  const zoomBy = (delta: number) => {
    setScale((prev) => clamp(prev + delta, MIN_SCALE, MAX_SCALE))
  }

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault()
    const dy = e.deltaY
    zoomBy(dy > 0 ? -0.2 : 0.2)
  }

  // Ensure non-passive wheel listener on container, and as a fallback also on window
  React.useEffect(() => {
    const el = containerRef.current
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault()
      const dy = e.deltaY
      zoomBy(dy > 0 ? -0.2 : 0.2)
    }
    if (el) el.addEventListener('wheel', onWheelNative, { passive: false })
    // Fallback: intercept wheel globally while preview is open
    if (state.open) window.addEventListener('wheel', onWheelNative, { passive: false })
    return () => {
      if (el) el.removeEventListener('wheel', onWheelNative as EventListener)
      window.removeEventListener('wheel', onWheelNative as EventListener)
    }
  }, [zoomBy, state.open])

  // Lock body scroll while preview is open
  React.useEffect(() => {
    if (!state.open) return
    const prevBody = document.body.style.overflow
    const prevHtml = (document.documentElement && (document.documentElement as HTMLElement).style.overflow) || ''
    document.body.style.overflow = 'hidden'
    try { (document.documentElement as HTMLElement).style.overflow = 'hidden' } catch {}
    // Prevent scroll on touch devices outside the overlay
    const onTouchMove = (e: TouchEvent) => {
      const target = e.target as Node | null
      if (target && containerRef.current && containerRef.current.contains(target)) return
      e.preventDefault()
    }
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      document.body.style.overflow = prevBody
      try { (document.documentElement as HTMLElement).style.overflow = prevHtml } catch {}
      window.removeEventListener('touchmove', onTouchMove as EventListener)
    }
  }, [state.open])

  const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointersRef.current.size === 1) {
      setIsPanning(true)
      panStartRef.current = { x: e.clientX, y: e.clientY, tx, ty }
      swipeRef.current = { x: e.clientX, y: e.clientY }
    } else if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values())
      const dx = pts[0].x - pts[1].x
      const dy = pts[0].y - pts[1].y
      const dist = Math.hypot(dx, dy)
      const cx = (pts[0].x + pts[1].x) / 2
      const cy = (pts[0].y + pts[1].y) / 2
      pinchStartRef.current = { dist, scale, cx, cy }
    }
  }

  const onPointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointersRef.current.size === 2 && pinchStartRef.current) {
      const pts = Array.from(pointersRef.current.values())
      const dx = pts[0].x - pts[1].x
      const dy = pts[0].y - pts[1].y
      const dist = Math.hypot(dx, dy)
      const ratio = dist / (pinchStartRef.current.dist || 1)
      const next = clamp(pinchStartRef.current.scale * ratio, MIN_SCALE, MAX_SCALE)
      setScale(next)
    } else if (isPanning && panStartRef.current) {
      const dx = e.clientX - panStartRef.current.x
      const dy = e.clientY - panStartRef.current.y
      if (scale > 1.02) {
        const nextTx = panStartRef.current.tx + dx
        const nextTy = panStartRef.current.ty + dy
        const { clampedX, clampedY } = clampPan(nextTx, nextTy)
        setTx(clampedX)
        setTy(clampedY)
      }
    }
  }

  const onPointerUp: React.PointerEventHandler<HTMLDivElement> = (e) => {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchStartRef.current = null
    if (pointersRef.current.size === 0) {
      setIsPanning(false)
      panStartRef.current = null
      if (swipeRef.current && scale <= 1.05) {
        const dx = e.clientX - swipeRef.current.x
        const dy = e.clientY - swipeRef.current.y
        if (Math.abs(dx) > swipeThreshold && Math.abs(dx) > Math.abs(dy)) {
          if (dx < 0) goto(index + 1)
          else goto(index - 1)
        }
      }
      swipeRef.current = null
    }
  }

  // Double tap toggles zoom
  const lastTapRef = useRef<number>(0)
  const onDoubleTap = () => {
    setScale((prev) => {
      const next = prev > 1 ? 1 : 2
      if (prev <= 1) { setTx(0); setTy(0) }
      return next
    })
  }
  const onClickContainer: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const target = e.target as HTMLElement
    // 仅当点击图片本身时才认为是双击/双点
    if (!(target && target.tagName === 'IMG')) return
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      onDoubleTap()
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }

  const goto = (nextIndex: number) => {
    const n = items.length
    if (n <= 1) return
    const wrapped = ((nextIndex % n) + n) % n
    setIndex(wrapped)
  }

  const computeClamp = () => {
    const cw = containerSize.w
    const ch = containerSize.h
    const iw = natural.w * baseScale * scale
    const ih = natural.h * baseScale * scale
    const maxX = Math.max(0, (iw - cw) / 2)
    const maxY = Math.max(0, (ih - ch) / 2)
    return { maxX, maxY }
  }
  const clampPan = (x: number, y: number) => {
    const { maxX, maxY } = computeClamp()
    const clampedX = Math.max(-maxX, Math.min(maxX, x))
    const clampedY = Math.max(-maxY, Math.min(maxY, y))
    return { clampedX, clampedY }
  }

  React.useEffect(() => {
    const { clampedX, clampedY } = clampPan(tx, ty)
    if (clampedX !== tx) setTx(clampedX)
    if (clampedY !== ty) setTy(clampedY)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, baseScale, containerSize.w, containerSize.h, natural.w, natural.h])

  const downloadCurrent = async () => {
    try {
      const key = items[index]?.src
      if (!key) return
      const blob = await api.getFile(key)
      const name = (() => {
        const raw = key.split('?')[0]
        const parts = raw.split('/')
        const last = parts[parts.length - 1] || 'image'
        return last.includes('.') ? last : `${last}.jpg`
      })()
      saveAs(blob, name)
    } catch {}
  }

  const toolbar = (
    <div className="absolute top-3 right-3 flex items-center gap-2 z-50" onClick={(e) => e.stopPropagation()}>
      <button aria-label="缩小" className="p-2 bg-black/40 text-white rounded hover:bg-black/60" onClick={(e) => { e.stopPropagation(); zoomBy(-0.2) }}>
        <ZoomOut className="w-5 h-5" />
      </button>
      <button aria-label="放大" className="p-2 bg-black/40 text-white rounded hover:bg-black/60" onClick={(e) => { e.stopPropagation(); zoomBy(0.2) }}>
        <ZoomIn className="w-5 h-5" />
      </button>
      <button aria-label="重置" className="p-2 bg-black/40 text-white rounded hover:bg-black/60" onClick={(e) => { e.stopPropagation(); resetView() }}>
        <RotateCcw className="w-5 h-5" />
      </button>
      {enableDownload && (
        <button aria-label="下载" className="p-2 bg-black/40 text-white rounded hover:bg-black/60" onClick={(e) => { e.stopPropagation(); downloadCurrent() }}>
          <DownloadIcon className="w-5 h-5" />
        </button>
      )}
      <button aria-label="关闭" className="p-2 bg-black/40 text-white rounded hover:bg-black/60" onClick={(e) => { e.stopPropagation(); onClose() }}>
        <X className="w-5 h-5" />
      </button>
    </div>
  )

  const arrows = items.length > 1 && (
    <>
      <button
        aria-label="上一张"
        className="absolute left-3 top-1/2 -translate-y-1/2 p-3 bg-black/30 text-white rounded-full hover:bg-black/50 z-50"
        onClick={(e) => { e.stopPropagation(); goto(index - 1) }}
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        aria-label="下一张"
        className="absolute right-3 top-1/2 -translate-y-1/2 p-3 bg-black/30 text-white rounded-full hover:bg-black/50 z-50"
        onClick={(e) => { e.stopPropagation(); goto(index + 1) }}
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </>
  )

  const indicator = (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 text-white text-sm bg-black/30 px-2 py-1 rounded z-50" onClick={(e) => e.stopPropagation()}>
      {index + 1} / {items.length}
    </div>
  )

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] bg-black/90 select-none touch-none overscroll-contain"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClick={onClickContainer}
      role="dialog"
      aria-modal="true"
    >
      {toolbar}
      {arrows}
      {indicator}
      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        {loading && (
          <div className="text-white/80 text-sm">加载中…</div>
        )}
        {error && (
          <div className="text-red-200 text-sm">加载失败：{error}</div>
        )}
        {!loading && !error && imgUrl && (
          <img
            src={imgUrl}
            alt={current?.alt || ''}
            className="max-w-none will-change-transform"
            style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale * baseScale})`, maxHeight: 'none', maxWidth: 'none' }}
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget
              setNatural({ w: img.naturalWidth, h: img.naturalHeight })
            }}
          />
        )}
      </div>
      {thumbnails && items.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 pb-3 pt-6 bg-gradient-to-t from-black/60 to-transparent" onClick={(e) => e.stopPropagation()}>
          <div className="px-4 overflow-x-auto">
            <div className="flex gap-2">
              {items.map((it, i) => {
                const u = urlCacheRef.current.get(it.src)
                const isActive = i === index
                return (
                  <button key={i} className={`flex-shrink-0 w-14 h-14 rounded overflow-hidden border ${isActive ? 'border-white' : 'border-white/30'} bg-black/30`} onClick={(e) => { e.stopPropagation(); setIndex(i) }}>
                    {u ? (
                      <img src={u} alt={it.alt || ''} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[10px] text-white/60">···</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

interface ImagePreviewProviderProps {
  children: React.ReactNode
  thumbnails?: boolean
  enableDownload?: boolean
  swipeThreshold?: number
}

export const ImagePreviewProvider: React.FC<ImagePreviewProviderProps> = ({ children, thumbnails = true, enableDownload = true, swipeThreshold = 60 }) => {
  const [state, setState] = useState<PreviewState>({ open: false, items: [], index: 0 })

  const open = useCallback((itemsIn: Array<string | ImageItem>, startIndex = 0) => {
    const items = toItems(itemsIn)
    if (!items.length) return
    const idx = Math.min(Math.max(startIndex, 0), items.length - 1)
    setState({ open: true, items, index: idx })
  }, [])

  const close = useCallback(() => setState((s) => ({ ...s, open: false })), [])

  const setIndex = useCallback((i: number) => setState((s) => ({ ...s, index: i })), [])

  const ctx = useMemo(() => ({ open, close }), [open, close])

  return (
    <ImagePreviewContext.Provider value={ctx}>
      {children}
      {state.open && (
        <Overlay state={state} onClose={close} setIndex={setIndex} thumbnails={thumbnails} enableDownload={enableDownload} swipeThreshold={swipeThreshold} />
      )}
    </ImagePreviewContext.Provider>
  )
}

export function useImagePreview() {
  const ctx = useContext(ImagePreviewContext)
  if (!ctx) throw new Error('useImagePreview must be used within ImagePreviewProvider')
  return ctx
}
