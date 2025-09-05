# 多图片支持数据迁移指南

## 概述

此迁移脚本将现有的单图片字段数据转换为多图片数组格式，以支持新的多图片上传功能。

## 迁移内容

### 点检记录表 (inspection_logs)
- 将 `inspection_image_url` 字段数据转换为 `inspection_image_urls` JSON数组格式

### 隐患记录表 (issues)
- 将 `issue_image_url` 字段数据转换为 `issue_image_urls` JSON数组格式
- 将 `fixed_image_url` 字段数据转换为 `fixed_image_urls` JSON数组格式

## 安全保障

- ✅ **非破坏性迁移**：原有字段数据完全保留，确保向下兼容
- ✅ **幂等性**：可重复执行，不会重复迁移已处理的数据
- ✅ **错误处理**：单条记录失败不影响其他记录的迁移
- ✅ **验证机制**：迁移完成后自动验证结果

## 使用方法

### 1. 运行前准备

确保数据库结构已更新：
```bash
cd backend
npm run db:push
```

### 2. 执行迁移（推荐）

使用预配置的npm脚本：
```bash
npm run db:migrate-images
```

### 3. 手动执行

直接运行迁移脚本：
```bash
node scripts/migrate-multi-images.js
```

## 迁移日志示例

```
[2024-01-20T10:30:00.000Z] ==================================================
[2024-01-20T10:30:00.000Z] 开始多图片支持数据迁移
[2024-01-20T10:30:00.000Z] ==================================================
[2024-01-20T10:30:00.500Z] 开始迁移点检记录图片数据...
[2024-01-20T10:30:01.000Z] 找到 25 条点检记录需要迁移
[2024-01-20T10:30:02.000Z] 点检记录迁移完成：迁移 25 条，跳过 0 条
[2024-01-20T10:30:02.100Z] 开始迁移隐患记录图片数据...
[2024-01-20T10:30:02.500Z] 找到 12 条隐患记录需要迁移
[2024-01-20T10:30:03.000Z] 隐患记录迁移完成：迁移 12 条，跳过 0 条
[2024-01-20T10:30:03.100Z] 开始验证迁移结果...
[2024-01-20T10:30:03.500Z] 点检记录验证：总计有图片记录 25 条，已迁移 25 条
[2024-01-20T10:30:03.600Z] 隐患记录验证：总计有图片记录 12 条，已迁移 12 条
[2024-01-20T10:30:03.700Z] 迁移结果验证完成
[2024-01-20T10:30:03.800Z] ==================================================
[2024-01-20T10:30:03.800Z] 数据迁移完成！
[2024-01-20T10:30:03.800Z] ==================================================
```

## 数据格式转换

### 转换前（单图片）
```sql
-- inspection_logs 表
inspection_image_url: "/uploads/images/inspection_123.jpg"

-- issues 表  
issue_image_url: "/uploads/images/issue_456.jpg"
fixed_image_url: "/uploads/images/fixed_789.jpg"
```

### 转换后（多图片数组）
```sql
-- inspection_logs 表
inspection_image_url: "/uploads/images/inspection_123.jpg"  -- 保留原字段
inspection_image_urls: "["/uploads/images/inspection_123.jpg"]"  -- 新字段

-- issues 表
issue_image_url: "/uploads/images/issue_456.jpg"        -- 保留原字段
issue_image_urls: "["/uploads/images/issue_456.jpg"]"   -- 新字段
fixed_image_url: "/uploads/images/fixed_789.jpg"        -- 保留原字段  
fixed_image_urls: "["/uploads/images/fixed_789.jpg"]"   -- 新字段
```

## 回滚说明

如需回滚到旧版本：
1. 新字段数据可以安全忽略
2. 原有字段数据完整保留
3. 旧版本代码可正常使用原有字段

## 故障排除

### 权限问题
```bash
# 确保脚本有执行权限
chmod +x scripts/migrate-multi-images.js
```

### 数据库连接问题
确认 `.env` 文件中的 `DATABASE_URL` 配置正确：
```env
DATABASE_URL="file:../data/fire_safety.db"
```

### 迁移失败
1. 检查数据库文件是否存在且可写
2. 确认数据库结构已通过 `npm run db:push` 更新
3. 查看详细错误日志进行问题定位

## 技术支持

如遇到问题，请检查：
1. Node.js 版本 >= 18.0.0
2. 数据库文件访问权限
3. Prisma 客户端是否已生成：`npm run db:generate`

迁移过程完全自动化，无需手动干预。