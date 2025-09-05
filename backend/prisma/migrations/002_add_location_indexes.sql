-- 消防器材点检系统 - 位置索引优化迁移
-- 迁移版本: v1.2.0-location-indexes
-- 创建时间: 2025-08-31
-- 描述: 为Equipment表location字段添加索引，支持同位置多器材类型点检功能

-- 为location字段添加索引，优化同位置器材查询
CREATE INDEX IF NOT EXISTS "idx_equipment_location" ON "equipments"("location");

-- 为location和factory_id组合字段添加复合索引，支持厂区级数据隔离查询
CREATE INDEX IF NOT EXISTS "idx_equipment_location_factory" ON "equipments"("location", "factory_id");

-- 为location和status组合字段添加复合索引，支持按状态筛选同位置器材
CREATE INDEX IF NOT EXISTS "idx_equipment_location_status" ON "equipments"("location", "status");

-- 迁移完成日志
-- 说明: 这些索引将大幅提升同位置器材查询的性能，支持新的多器材类型点检功能