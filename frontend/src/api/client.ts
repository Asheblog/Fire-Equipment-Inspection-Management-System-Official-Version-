import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import { useAuthStore } from '@/stores/auth'

// Axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
})

// (Initial simple request interceptor removed; merged into preemptive logic below)

// ---------- Preemptive + automatic refresh logic ----------
// ==== Added auth failure short-circuit logic START ====
export function forceLogoutRedirect() {
  const { logout } = useAuthStore.getState() as any
  try { logout() } catch {}
  if (typeof window !== 'undefined') window.location.href = '/login'
}
// ==== Added auth failure short-circuit logic END ====
const PREEMPTIVE_REFRESH_WINDOW_SECONDS = 120 // 若token剩余不足该秒数且有refreshToken则预刷新
export const AUTH_INVALID_CODES = ['TOKEN_INVALID','TOKEN_EXPIRED','REFRESH_FAILED','TOKEN_BLACKLISTED']
let isRefreshing = false

interface RefreshQueueItem {
  resolve: (token: string) => void
  reject: (err: any) => void
}
let refreshQueue: RefreshQueueItem[] = []
function flushRefreshQueue(error: any, token: string | null) {
  refreshQueue.forEach(p => { if (error) p.reject(error); else if (token) p.resolve(token); else p.reject(new Error('No token')) })
  refreshQueue = []
}
export function parseTokenRemaining(token: string): number | null {
  try { const p = JSON.parse(atob(token.split('.')[1])); return p.exp ? p.exp - Math.floor(Date.now()/1000) : null } catch { return null }
}
export function isAuthError(error: any): boolean {
  try {
    const status = error?.response?.status
    const code = error?.response?.data?.error
    return status === 401 || (typeof code === 'string' && AUTH_INVALID_CODES.includes(code))
  } catch { return false }
}
async function performRefresh(refreshToken: string, setToken: (t:string)=>void, logout: ()=>void) {
  if (isRefreshing) {
    return new Promise<string>((resolve, reject) => { refreshQueue.push({ resolve, reject }) })
  }
  isRefreshing = true
  try {
    const res = await apiClient.post('/auth/refresh', { refreshToken })
    const newAccessToken = res?.data?.data?.accessToken || res?.data?.accessToken
    if (!newAccessToken) throw new Error('Refresh failed: accessToken missing')
    setToken(newAccessToken)
    flushRefreshQueue(null, newAccessToken)
    return newAccessToken
  } catch (err) {
    flushRefreshQueue(err, null)
    logout(); window.location.href = '/login'
    throw err
  } finally { isRefreshing = false }
}

// Request interceptor: attach token & preemptive refresh
apiClient.interceptors.request.use(
  async (config) => {
    const { token, refreshToken, setToken, logout } = useAuthStore.getState() as any
    if (token) {
      const remain = parseTokenRemaining(token)
      if (remain !== null && remain < PREEMPTIVE_REFRESH_WINDOW_SECONDS && refreshToken) {
        try { const newTok = await performRefresh(refreshToken, setToken, logout); config.headers.Authorization = `Bearer ${newTok}`; return config } catch { forceLogoutRedirect(); return Promise.reject(new Error('Preemptive refresh failed')) }
      }
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: fallback refresh on 401
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const original: any = error.config || {}
    const status = error.response?.status
    const code = error.response?.data?.error
    const reqUrl = (original.url || original.__isRetryRequest || original.baseURL ? (original.baseURL?original.baseURL:"") + (original.url||"") : original.url) || ""

    // 短路：刷新接口自身401 或 明确失效错误码
    if (status === 401 && (reqUrl.includes("/auth/refresh") || AUTH_INVALID_CODES.includes(code))) {
      forceLogoutRedirect();
      return Promise.reject(error)
    }

    if (status !== 401 || original._retry) return Promise.reject(error)
    const { refreshToken, setToken, logout } = useAuthStore.getState() as any
    if (!refreshToken) { logout(); window.location.href = '/login'; return Promise.reject(error) }
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        refreshQueue.push({
          resolve: (t: string) => { original.headers = original.headers || {}; original.headers.Authorization = `Bearer ${t}`; resolve(apiClient(original)) },
          reject
        })
      })
    }
    original._retry = true
    try {
      const newTok = await performRefresh(refreshToken, setToken, logout)
      original.headers = original.headers || {}
      original.headers.Authorization = `Bearer ${newTok}`
      return apiClient(original)
    } catch (e) { return Promise.reject(e) }
  }
)

// API wrapper helpers
export const api = {
  get: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    apiClient.get(url, config).then(r => r.data),
  post: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    apiClient.post(url, data, config).then(r => r.data),
  put: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    apiClient.put(url, data, config).then(r => r.data),
  patch: <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> =>
    apiClient.patch(url, data, config).then(r => r.data),
  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    apiClient.delete(url, config).then(r => r.data),
  upload: <T = any>(url: string, formData: FormData, config?: AxiosRequestConfig): Promise<T> =>
    apiClient.post(
      url,
      formData,
      {
        ...config,
        // 为上传设置更长超时（默认60s，除非显式传入更长）
        timeout: (config && typeof config.timeout === 'number' && config.timeout > 0)
          ? config.timeout
          : 60000,
        headers: { ...config?.headers, 'Content-Type': 'multipart/form-data' }
      }
    ).then(r => r.data),
  getFileUrl: (filePath: string): string => {
    if (!filePath) return ''
    if (filePath.startsWith('http')) return filePath
    return filePath.startsWith('/') ? filePath : `/${filePath}`
  },
  getFile: (filePath: string): Promise<Blob> => {
    // 使用 fetch 获取 Blob，避免 XHR 被第三方 inspector 读取 responseText 导致报错
    const { token } = useAuthStore.getState()
    const url = filePath
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    const doFetch = (tok?: string) => {
      const h: Record<string, string> = { ...headers }
      if (tok) h['Authorization'] = `Bearer ${tok}`
      return fetch(url, {
        method: 'GET',
        headers: h,
        // 保持与同源请求行为一致；绝对 URL 亦可正常工作
        credentials: 'same-origin',
        signal: controller.signal
      })
    }

    const { refreshToken, setToken, logout } = useAuthStore.getState() as any
    return doFetch(token ?? undefined)
      .then(async (res) => {
        if (res.status === 401 && refreshToken) {
          // 使用统一的刷新逻辑获取新 token 后重试一次
          try {
            const newTok = await performRefresh(refreshToken, setToken, logout)
            const retry = await doFetch(newTok)
            clearTimeout(timeout)
            if (!retry.ok) throw new Error(`Failed to fetch file after refresh: ${retry.status} ${retry.statusText}`)
            return retry.blob()
          } catch (e) {
            clearTimeout(timeout)
            throw e
          }
        }
        clearTimeout(timeout)
        if (!res.ok) throw new Error(`Failed to fetch file: ${res.status} ${res.statusText}`)
        return res.blob()
      })
      .catch(err => {
        // 区分超时/主动取消
        if ((err as any).name === 'AbortError') {
          throw new Error('Failed to fetch file: timeout')
        }
        throw err
      })
  }
}

export default apiClient
