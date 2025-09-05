import type { ValidationFieldError } from '@/types'
import { toast } from 'sonner'

export function isValidationError(err: any): boolean {
  const status = err?.response?.status
  const code = err?.response?.data?.code
  const errors = err?.response?.data?.errors
  return status === 422 && code === 'VALIDATION_ERROR' && Array.isArray(errors)
}

export function extractValidationErrors(err: any): {
  errors: ValidationFieldError[]
  map: Record<string, string>
  traceId?: string
  message?: string
} {
  const data = err?.response?.data || {}
  const list: ValidationFieldError[] = Array.isArray(data.errors) ? data.errors : []
  const map: Record<string, string> = {}
  list.forEach(e => {
    if (!e || !e.field) return
    map[e.field] = e.message || '无效输入'
    const last = e.field.split('.').pop() || e.field
    if (!map[last]) map[last] = e.message || '无效输入'
  })
  return { errors: list, map, traceId: data.traceId, message: data.message }
}

export function focusFirstError(map: Record<string,string>) {
  const firstField = Object.keys(map)[0]
  if (!firstField) return
  let selector = `[name='${firstField}'],[data-field='${firstField}']`
  const last = firstField.split('.').pop()
  if (last && last !== firstField) selector += `,[name='${last}'],[data-field='${last}']`
  const el = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector)
  if (el) {
    if ('focus' in el) el.focus()
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

export function showValidationSummary(count: number, traceId?: string) {
  if (count <= 0) return
  const base = `共有 ${count} 项需要修改`
  toast.error(base)
  if (traceId) {
    if (import.meta.env?.DEV) {
      console.warn('[Validation][traceId]', traceId)
    }
  }
}

export function mergeFieldErrors(existing: Record<string,string>, incoming: Record<string,string>): Record<string,string> {
  return { ...existing, ...incoming }
}

export function applyRHFBackendErrors(form: any, errors: ValidationFieldError[]) {
  if (!form || !errors) return
  errors.forEach(e => {
    const path = e.field
    try {
      form.setError(path, { message: e.message })
    } catch {
      const last = path.split('.').pop()
      if (last) {
        try { form.setError(last, { message: e.message }) } catch { /* ignore */ }
      }
    }
  })
}

