// 前端日志统一封装
// 使用示例:
// import { createLogger, logger } from '@/lib/logger'
// const log = createLogger('Import')
// log.info('开始导入')

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface InternalEnv {
  env?: Record<string, any>
  PROD?: boolean
}

const levelOrder: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40
}

// 读取 Vite 环境变量
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const metaEnv = (import.meta as any as InternalEnv)
const rawLevel = (metaEnv.env?.VITE_LOG_LEVEL || metaEnv.env?.VITE_APP_LOG_LEVEL || '').toLowerCase()
const ENV_LEVEL = (['debug','info','warn','error'].includes(rawLevel) ? rawLevel : '') as LogLevel | ''
const DEBUG_MODULES_RAW = metaEnv.env?.VITE_DEBUG_MODULES || ''

const debugModules = DEBUG_MODULES_RAW
  .split(/[,;\s]+/)
  .map(s => s.trim())
  .filter(Boolean)

const defaultLevel: LogLevel = metaEnv.env?.PROD ? 'info' : 'debug'
const currentLevel: LogLevel = (ENV_LEVEL && levelOrder[ENV_LEVEL]) ? ENV_LEVEL : defaultLevel

function matchModule(module?: string): boolean {
  if (!module) return true
  if (debugModules.includes('*')) return true
  if (debugModules.length === 0) return !metaEnv.env?.PROD // 生产未指定 => 不输出调试
  return debugModules.some(pattern => {
    if (pattern.endsWith('*')) return module.startsWith(pattern.slice(0, -1))
    return pattern === module
  })
}

function isLevelEnabled(level: LogLevel, module?: string): boolean {
  if (level === 'warn' || level === 'error') return levelOrder[level] >= levelOrder[currentLevel]
  if (metaEnv.env?.PROD) {
    if (!matchModule(module)) return false
  }
  return levelOrder[level] >= levelOrder[currentLevel]
}

function format(now: Date, level: LogLevel, module: string | undefined, args: unknown[]): unknown[] {
  const ts = now.toISOString().replace('T', ' ').replace('Z','')
  const prefix = module ? `[${module}]` : ''
  return [`${ts} ${level.toUpperCase()} ${prefix}`.trim(), ...args]
}

export interface AppLogger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

function baseLog(level: LogLevel, module: string | undefined, args: unknown[]) {
  if (!isLevelEnabled(level, module)) return
  const out = format(new Date(), level, module, args)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fn = (console as any)[level] || console.log
  try { fn.apply(console, out) } catch { /* ignore */ }
}

export function createLogger(module?: string): AppLogger {
  return {
    debug: (...args) => baseLog('debug', module, args),
    info:  (...args) => baseLog('info', module, args),
    warn:  (...args) => baseLog('warn', module, args),
    error: (...args) => baseLog('error', module, args)
  }
}

export const logger = createLogger()

// 暴露当前 level 供调试排查
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof window !== 'undefined') (window as any).__APP_LOG_LEVEL__ = currentLevel
