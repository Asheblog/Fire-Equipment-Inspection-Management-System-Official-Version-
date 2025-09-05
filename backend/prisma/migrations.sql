-- 消防器材点检管理系统 - 数据库迁移脚本
-- 用于从SQLite迁移到MySQL/PostgreSQL的兼容性处理

-- ============================================================================
-- MySQL迁移配置 (当迁移到MySQL时使用)
-- ============================================================================

-- 1. 创建数据库 (MySQL)
-- CREATE DATABASE fire_safety_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 2. 索引优化 (MySQL特定)
-- ALTER TABLE equipments ADD INDEX idx_qr_code_factory (qr_code, factory_id);
-- ALTER TABLE inspection_logs ADD INDEX idx_equipment_time (equipment_id, inspection_time DESC);
-- ALTER TABLE issues ADD INDEX idx_status_created (status, created_at DESC);

-- 3. 全文搜索索引 (MySQL)
-- ALTER TABLE equipments ADD FULLTEXT(name, location, specifications);
-- ALTER TABLE issues ADD FULLTEXT(description, solution);

-- ============================================================================
-- PostgreSQL迁移配置 (当迁移到PostgreSQL时使用)
-- ============================================================================

-- 1. 创建数据库 (PostgreSQL)
-- CREATE DATABASE fire_safety_db WITH ENCODING 'UTF8' LC_COLLATE='en_US.UTF-8' LC_CTYPE='en_US.UTF-8';

-- 2. 索引优化 (PostgreSQL特定)
-- CREATE INDEX CONCURRENTLY idx_equipments_qr_factory ON equipments(qr_code, factory_id);
-- CREATE INDEX CONCURRENTLY idx_inspection_logs_equipment_time ON inspection_logs(equipment_id, inspection_time DESC);
-- CREATE INDEX CONCURRENTLY idx_issues_status_created ON issues(status, created_at DESC);

-- 3. GIN索引用于JSON查询 (PostgreSQL)
-- CREATE INDEX CONCURRENTLY idx_inspection_logs_checklist_gin ON inspection_logs USING GIN (checklist_results);

-- 4. 分区表优化 (PostgreSQL - 大数据量时考虑)
-- -- 按月分区点检记录表
-- ALTER TABLE inspection_logs PARTITION BY RANGE (inspection_time);
-- CREATE TABLE inspection_logs_y2024m01 PARTITION OF inspection_logs 
--   FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

-- ============================================================================
-- 数据清理和维护脚本
-- ============================================================================

-- 清理过期的点检记录 (保留最近2年)
-- DELETE FROM inspection_logs 
-- WHERE inspection_time < datetime('now', '-2 years');

-- 清理已关闭的老旧隐患记录 (保留最近1年)
-- DELETE FROM issues 
-- WHERE status = 'CLOSED' 
--   AND audited_at < datetime('now', '-1 years');

-- ============================================================================
-- 性能优化建议
-- ============================================================================

-- 1. 定期分析表统计信息
-- ANALYZE TABLE equipments;
-- ANALYZE TABLE inspection_logs; 
-- ANALYZE TABLE issues;

-- 2. 检查索引使用情况
-- EXPLAIN QUERY PLAN SELECT * FROM equipments WHERE factory_id = ? AND status = ?;

-- 3. 监控慢查询
-- -- 启用慢查询日志，监控执行时间超过1秒的查询

-- ============================================================================
-- 备份和恢复策略
-- ============================================================================

-- SQLite备份
-- .backup main backup_20241226.db

-- MySQL备份
-- mysqldump -u username -p fire_safety_db > backup_20241226.sql

-- PostgreSQL备份  
-- pg_dump -U username -d fire_safety_db > backup_20241226.sql

-- ============================================================================
-- 数据完整性检查
-- ============================================================================

-- 检查孤立记录
-- SELECT COUNT(*) FROM inspection_logs il 
-- LEFT JOIN equipments e ON il.equipment_id = e.id 
-- WHERE e.id IS NULL;

-- 检查数据一致性
-- SELECT e.id, e.last_inspected_at, MAX(il.inspection_time) as latest_inspection
-- FROM equipments e
-- LEFT JOIN inspection_logs il ON e.id = il.equipment_id
-- GROUP BY e.id, e.last_inspected_at
-- HAVING e.last_inspected_at != MAX(il.inspection_time);