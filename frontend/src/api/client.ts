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
function forceLogoutRedirect() {
  const { logout } = useAuthStore.getState() as any
  try { logout() } catch {}
  if (typeof window !== 'undefined') window.location.href = '/login'
}
// ==== Added auth failure short-circuit logic END ====
const PREEMPTIVE_REFRESH_WINDOW_SECONDS = 120 // 若token剩余不足该秒数且有refreshToken则预刷新
const AUTH_INVALID_CODES = ['TOKEN_INVALID','TOKEN_EXPIRED','REFRESH_FAILED']
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
function parseTokenRemaining(token: string): number | null {
  try { const p = JSON.parse(atob(token.split('.')[1])); return p.exp ? p.exp - Math.floor(Date.now()/1000) : null } catch { return null }
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
  delete: <T = any>(url: string, config?: AxiosRequestConfig): Promise<T> =>
    apiClient.delete(url, config).then(r => r.data),
  upload: <T = any>(url: string, formData: FormData, config?: AxiosRequestConfig): Promise<T> =>
    apiClient.post(url, formData, { ...config, headers: { ...config?.headers, 'Content-Type': 'multipart/form-data' } }).then(r => r.data),
  getFileUrl: (filePath: string): string => {
    if (!filePath) return ''
    if (filePath.startsWith('http')) return filePath
    return filePath.startsWith('/') ? filePath : `/${filePath}`
  },
  getFile: (filePath: string): Promise<Blob> => {
    const { token } = useAuthStore.getState()
    return axios.get(filePath, { responseType: 'blob', headers: token ? { Authorization: `Bearer ${token}` } : {}, timeout: 10000 }).then(r => r.data)
  }
}

export default apiClient
