import { createLogger } from './logger'

const log = createLogger('ApiError')

export interface ApiErrorOptions {
  toast?: (msg: string) => void
  silent?: boolean
  context?: string
}

export function handleApiError(error: any, message: string, opts: ApiErrorOptions = {}) {
  const { toast, silent, context } = opts
  const base = context ? `[${context}] ${message}` : message
  log.error(base, error)

  if (silent) return

  let detail = ''
  if (error?.response?.data?.message) detail = error.response.data.message
  else if (error instanceof Error && error.message) detail = error.message
  else if (typeof error === 'string') detail = error

  const finalMsg = detail ? `${base}: ${detail}` : base
  if (toast) toast(finalMsg)
}

