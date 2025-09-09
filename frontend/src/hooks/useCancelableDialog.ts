import { useRef, useState, useCallback } from 'react'

/**
 * useCancelableDialog
 * - 打开弹窗的同时触发数据加载
 * - 加载过程可被取消（关闭弹窗/再次打开新记录）
 * - 提供通用的 loading/data/error 状态
 */
export function useCancelableDialog<T, A = any>(loader: (args: A, signal: AbortSignal) => Promise<T>) {
  const abortRef = useRef<AbortController | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)

  const close = useCallback(() => {
    setOpen(false)
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setLoading(false)
    setError(null)
    setData(null)
  }, [])

  const openWith = useCallback(async (args: A) => {
    // 取消之前的加载
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setOpen(true)
    setLoading(true)
    setError(null)
    setData(null)
    try {
      const result = await loader(args, controller.signal)
      if (!controller.signal.aborted) setData(result)
    } catch (e) {
      if (!controller.signal.aborted) setError(e)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [loader])

  const onOpenChange = useCallback((o: boolean) => {
    if (!o) close()
    else setOpen(true)
  }, [close])

  return { open, loading, data, error, openWith, close, onOpenChange }
}

export default useCancelableDialog

