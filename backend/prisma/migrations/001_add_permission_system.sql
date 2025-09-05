-- 消防器材点检系统 - 权限管理系统数据库迁移
-- 迁移版本: v1.1.0-permissions
-- 创建时间: 2025-08-29
-- 描述: 添加企业级RBAC权限管理系统

-- 权限定义表
CREATE TABLE IF NOT EXISTS "permissions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'factory',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 权限表索引
CREATE INDEX IF NOT EXISTS "permissions_module_action_idx" ON "permissions"("module", "action");
CREATE INDEX IF NOT EXISTS "permissions_is_active_idx" ON "permissions"("is_active");

-- 角色定义表
CREATE TABLE IF NOT EXISTS "roles" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'CUSTOM',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 角色表索引
CREATE INDEX IF NOT EXISTS "roles_type_is_active_idx" ON "roles"("type", "is_active");

-- 用户-角色关联表
CREATE TABLE IF NOT EXISTS "user_roles" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "role_id" INTEGER NOT NULL,
    "factory_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_roles_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "user_roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 用户角色表索引和约束
CREATE UNIQUE INDEX IF NOT EXISTS "user_roles_user_id_role_id_factory_id_key" ON "user_roles"("user_id", "role_id", "factory_id");
CREATE INDEX IF NOT EXISTS "user_roles_user_id_is_active_idx" ON "user_roles"("user_id", "is_active");
CREATE INDEX IF NOT EXISTS "user_roles_role_id_idx" ON "user_roles"("role_id");

-- 角色-权限关联表
CREATE TABLE IF NOT EXISTS "role_permissions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "role_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "role_permissions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 角色权限表索引和约束
CREATE UNIQUE INDEX IF NOT EXISTS "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");
CREATE INDEX IF NOT EXISTS "role_permissions_role_id_is_active_idx" ON "role_permissions"("role_id", "is_active");
CREATE INDEX IF NOT EXISTS "role_permissions_permission_id_idx" ON "role_permissions"("permission_id");

-- 用户特殊权限表
CREATE TABLE IF NOT EXISTS "user_permissions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "permission_id" INTEGER NOT NULL,
    "factory_id" INTEGER,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "expires_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" INTEGER,
    "reason" TEXT,
    CONSTRAINT "user_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_permissions_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "user_permissions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 用户权限表索引和约束
CREATE UNIQUE INDEX IF NOT EXISTS "user_permissions_user_id_permission_id_factory_id_key" ON "user_permissions"("user_id", "permission_id", "factory_id");
CREATE INDEX IF NOT EXISTS "user_permissions_user_id_is_active_idx" ON "user_permissions"("user_id", "is_active");
CREATE INDEX IF NOT EXISTS "user_permissions_expires_at_idx" ON "user_permissions"("expires_at");

-- 权限变更审计表
CREATE TABLE IF NOT EXISTS "permission_audits" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" INTEGER NOT NULL,
    "permission_id" INTEGER,
    "role_id" INTEGER,
    "old_value" TEXT,
    "new_value" TEXT,
    "operator_id" INTEGER NOT NULL,
    "factory_id" INTEGER,
    "reason" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "permission_audits_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "permission_audits_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "permission_audits_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "permission_audits_factory_id_fkey" FOREIGN KEY ("factory_id") REFERENCES "factories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 权限审计表索引
CREATE INDEX IF NOT EXISTS "permission_audits_target_type_target_id_timestamp_idx" ON "permission_audits"("target_type", "target_id", "timestamp");
CREATE INDEX IF NOT EXISTS "permission_audits_operator_id_timestamp_idx" ON "permission_audits"("operator_id", "timestamp");
CREATE INDEX IF NOT EXISTS "permission_audits_action_timestamp_idx" ON "permission_audits"("action", "timestamp");

-- 权限变更日志表 (与schema.prisma中的PermissionLog模型对应)
CREATE TABLE IF NOT EXISTS "permission_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "action_type" TEXT NOT NULL,
    "target_user_id" INTEGER NOT NULL,
    "operator_id" INTEGER,
    "role_id" INTEGER,
    "permission_id" INTEGER,
    "old_value" TEXT,
    "new_value" TEXT,
    "reason" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "factory_id" INTEGER,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "permission_logs_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "permission_logs_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "permission_logs_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "permission_logs_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- 权限日志表索引 (对应schema.prisma中的索引定义)
CREATE INDEX IF NOT EXISTS "permission_logs_target_user_id_timestamp_idx" ON "permission_logs"("target_user_id", "timestamp");
CREATE INDEX IF NOT EXISTS "permission_logs_operator_id_timestamp_idx" ON "permission_logs"("operator_id", "timestamp");
CREATE INDEX IF NOT EXISTS "permission_logs_action_type_timestamp_idx" ON "permission_logs"("action_type", "timestamp");
CREATE INDEX IF NOT EXISTS "permission_logs_factory_id_timestamp_idx" ON "permission_logs"("factory_id", "timestamp");
CREATE INDEX IF NOT EXISTS "permission_logs_timestamp_idx" ON "permission_logs"("timestamp");

-- 迁移完成标记
INSERT INTO "audit_logs" ("action", "resource", "details", "level", "timestamp", "created_at")
VALUES ('MIGRATION', 'DATABASE', '{"version":"v1.1.0-permissions","description":"添加企业级RBAC权限管理系统","tables":["permissions","roles","user_roles","role_permissions","user_permissions","permission_audits","permission_logs"]}', 'INFO', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);