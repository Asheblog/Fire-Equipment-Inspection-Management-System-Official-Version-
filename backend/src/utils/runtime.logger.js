const fs = require('fs');
const path = require('path');
const util = require('util');

// Console levels we hook
const LEVELS = ['log', 'info', 'warn', 'error', 'debug'];
let initialized = false;
let originalConsole = {};
let currentDateStr = null;
let stream = null;
let logDir = null;
let fallbackNotified = false;

function getToday() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function timestamp() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${yyyy}-${mm}-${dd} ${h}:${m}:${s}.${ms}`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function rotate(newDate) {
  if (stream) { try { stream.end(); } catch (_) {} }
  currentDateStr = newDate;
  const filePath = path.join(logDir, `${currentDateStr}.log`);
  try {
    stream = fs.createWriteStream(filePath, { flags: 'a', encoding: 'utf8' });
    cleanupOldFiles();
  } catch (err) {
    if (!fallbackNotified) {
      fallbackNotified = true;
      originalConsole.error('[runtime.logger] 创建日志文件失败, 仅控制台输出:', err.message);
    }
    stream = null;
  }
}

function openStreamIfNeeded() {
  // 开发环境下 init() 会直接返回，没有设置 logDir。
  // 但 morgan 仍然会通过 httpStream() -> writeLine() 进入这里。
  // 若不短路，rotate() 内会执行 path.join(logDir, ...) 导致 logDir 为 null 时抛错。
  if (!logDir) return; // not initialized (e.g. development)
  const today = getToday();
  if (today !== currentDateStr || !stream) rotate(today);
}

function safeSerialize(arg) {
  if (arg instanceof Error) return arg.stack || `${arg.name}: ${arg.message}`;
  const t = typeof arg;
  if (t === 'string') return arg;
  if (t === 'number' || t === 'boolean' || arg === null) return String(arg);
  if (arg === undefined) return 'undefined';
  try { return util.inspect(arg, { depth: 5, colors: false, maxArrayLength: 50 }); } catch { return '[Unserializable]'; }
}

function formatLine(level, parts) {
  return `[${timestamp()}][${level.toUpperCase()}] ${parts.join(' ')}`;
}

function writeLine(level, args) {
  openStreamIfNeeded(); // 在未初始化时为 no-op
  const parts = args.map(safeSerialize);
  const line = formatLine(level, parts);
  if (stream) {
    try { stream.write(line + '\n'); } catch (err) {
      if (!fallbackNotified) {
        fallbackNotified = true;
        originalConsole.error('[runtime.logger] 写入失败, 仅控制台输出:', err.message);
      }
    }
  }
}

function cleanupOldFiles() {
  try {
    const files = fs.readdirSync(logDir)
      .filter(f => /^\d{4}-\d{2}-\d{2}\.log$/.test(f))
      .sort();
    if (files.length <= 7) return;
    const toDelete = files.slice(0, files.length - 7);
    toDelete.forEach(f => { try { fs.unlinkSync(path.join(logDir, f)); } catch (_) {} });
  } catch (e) {
    originalConsole.error('[runtime.logger] 清理旧日志失败:', e.message);
  }
}

function patchConsole() {
  LEVELS.forEach(level => {
    const orig = originalConsole[level];
    console[level] = function patched(...args) {
      writeLine(level === 'log' ? 'info' : level, args);
      try { orig.apply(console, args); } catch (_) {}
    };
  });
}

function restore() {
  LEVELS.forEach(level => { if (originalConsole[level]) console[level] = originalConsole[level]; });
  if (stream) { try { stream.end(); } catch (_) {} }
  stream = null; initialized = false;
}

function init(options = {}) {
  if (initialized) return;
  if (process.env.NODE_ENV !== 'production') return;
  originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug || console.log
  };
  const rootDir = options.rootDir || path.resolve(__dirname, '../../../');
  logDir = options.logDir || path.join(rootDir, 'backend', 'logs');
  ensureDir(logDir);
  rotate(getToday());
  patchConsole();
  initialized = true;
  process.once('SIGINT', () => restore());
  process.once('SIGTERM', () => restore());
  process.once('beforeExit', () => restore());
}

function httpStream() {
  return { write(str) { const line = str.endsWith('\n') ? str.slice(0, -1) : str; writeLine('http', [line]); } };
}

function writeClient(level, msg, meta = {}) {
  const parts = [];
  if (meta.url) parts.push(`@${meta.url}`);
  if (meta.extra) parts.push(meta.extra);
  parts.unshift(msg);
  writeLine(`CLIENT${level ? ':' + level : ''}`, parts);
}

module.exports = { init, restore, httpStream, writeClient };
