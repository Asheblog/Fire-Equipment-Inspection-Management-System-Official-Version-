-- Migration: add system_settings table for runtime configurable QR base URL
CREATE TABLE IF NOT EXISTS system_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial row for qr_base_url only if not exists
INSERT OR IGNORE INTO system_settings (key, value, description)
VALUES ('qr_base_url', NULL, '二维码基础访问地址(留空则使用环境变量 BASE_URL / DOMAIN 兜底)');
