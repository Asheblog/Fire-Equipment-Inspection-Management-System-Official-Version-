// 统一环境变量读写与默认配置 (shared-env.js)
const fs = require('fs');

function readEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {};
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  const out = {};
  for (const line of lines) {
    if (!line || /^\s*#/.test(line)) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    let v = line.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

// 已废弃 / 需要剔除的旧变量
const DEPRECATED_KEYS = [
  'ENABLE_HTTPS','HTTPS_PORT','SSL_CERT_PATH','SSL_KEY_PATH','CORS_ADD_DOMAIN','CORS_DUAL_PROTOCOL'
];

// 规范顺序
const ORDERED_KEYS = [
  'NODE_ENV','PORT','DOMAIN','DATABASE_URL','JWT_SECRET','JWT_REFRESH_SECRET',
  'JWT_EXPIRES_IN','REFRESH_TOKEN_EXPIRES_IN','LONG_REFRESH_TOKEN_EXPIRES_IN',
  'BCRYPT_SALT_ROUNDS',
  'RATE_LIMIT_WINDOW_MS','RATE_LIMIT_MAX_REQUESTS','AUTH_RATE_LIMIT_MAX',
  'CORS_ORIGIN','CORS_ALLOW_LOCAL_NETWORK',
  'UPLOAD_DIR','UPLOAD_MAX_SIZE','UPLOAD_ALLOWED_TYPES',
  'QR_CODE_DEFAULT_SIZE','QR_CODE_MIN_SIZE','QR_CODE_MAX_SIZE','QR_CODE_MARGIN','QR_CODE_CACHE_TTL','BASE_URL',
  'TRUST_PROXY',
  'LOG_LEVEL','AUDIT_LOG_RETENTION_DAYS','FILE_CLEANUP_DAYS',
  'SMTP_HOST','SMTP_PORT','SMTP_SECURE','SMTP_USER','SMTP_PASS','SMTP_FROM','ALERT_RECIPIENTS'
];

function ensureDefaults(base, overrides = {}) {
  const out = { ...base };
  const setIfMissing = (k, v) => { if (out[k] === undefined || out[k] === '') out[k] = v; };
  setIfMissing('NODE_ENV', overrides.NODE_ENV || 'development');
  setIfMissing('PORT', overrides.PORT || '3001');
  setIfMissing('DOMAIN', overrides.DOMAIN || 'localhost');
  setIfMissing('DATABASE_URL', 'file:../data/fire_safety.db');
  setIfMissing('JWT_SECRET', 'fire-safety-jwt-secret-2024-dev');
  setIfMissing('JWT_REFRESH_SECRET', 'fire-safety-refresh-secret-2024-dev');
  setIfMissing('JWT_EXPIRES_IN', '24h');
  setIfMissing('REFRESH_TOKEN_EXPIRES_IN', '30d');
  setIfMissing('LONG_REFRESH_TOKEN_EXPIRES_IN', '90d');
  setIfMissing('BCRYPT_SALT_ROUNDS', '12');
  setIfMissing('RATE_LIMIT_WINDOW_MS', '900000');
  setIfMissing('RATE_LIMIT_MAX_REQUESTS', '100');
  setIfMissing('AUTH_RATE_LIMIT_MAX', '5');
  setIfMissing('CORS_ORIGIN', 'http://localhost:3000,http://localhost:3001,http://localhost:5173');
  setIfMissing('CORS_ALLOW_LOCAL_NETWORK', overrides.CORS_ALLOW_LOCAL_NETWORK || 'false');
  setIfMissing('UPLOAD_DIR', './uploads');
  setIfMissing('UPLOAD_MAX_SIZE', '5242880');
  setIfMissing('UPLOAD_ALLOWED_TYPES', 'image/jpeg,image/png,image/gif');
  setIfMissing('QR_CODE_DEFAULT_SIZE', '200');
  setIfMissing('QR_CODE_MIN_SIZE', '50');
  setIfMissing('QR_CODE_MAX_SIZE', '1000');
  setIfMissing('QR_CODE_MARGIN', '2');
  setIfMissing('QR_CODE_CACHE_TTL', '3600');
  setIfMissing('TRUST_PROXY', '1');
  setIfMissing('LOG_LEVEL', 'info');
  setIfMissing('AUDIT_LOG_RETENTION_DAYS', '90');
  setIfMissing('FILE_CLEANUP_DAYS', '30');
  setIfMissing('SMTP_HOST', 'smtp.qq.com');
  setIfMissing('SMTP_PORT', '587');
  setIfMissing('SMTP_SECURE', 'false');
  setIfMissing('SMTP_FROM', '"消防器材点检系统 <your-email@qq.com>"');
  return out;
}

function writeEnvFile(envPath, data) {
  for (const k of DEPRECATED_KEYS) delete data[k];
  const existing = Object.keys(data).filter(k => !ORDERED_KEYS.includes(k)).sort();
  const finalKeys = [...ORDERED_KEYS, ...existing].filter(k => data[k] !== undefined);
  const content = [
    '# 自动生成/更新 (统一脚本)',
    '',
    ...finalKeys.map(k => `${k}=${/\s/.test(data[k]) ? '"'+data[k]+'"' : data[k]}`),
    ''
  ].join('\n');
  fs.writeFileSync(envPath, content, 'utf8');
}

module.exports = { readEnvFile, writeEnvFile, ensureDefaults, ORDERED_KEYS, DEPRECATED_KEYS };

