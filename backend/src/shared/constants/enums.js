/**
 * 枚举常量定义 - SQLite兼容性解决方案
 * 用于在应用层进行枚举值验证
 */

// 用户角色枚举
export const Role = {
  INSPECTOR: 'INSPECTOR',        // 点检员
  FACTORY_ADMIN: 'FACTORY_ADMIN', // 厂区管理员
  SUPER_ADMIN: 'SUPER_ADMIN'      // 超级管理员
}

// 器材状态枚举
export const EquipmentStatus = {
  NORMAL: 'NORMAL',     // 正常
  ABNORMAL: 'ABNORMAL', // 异常
  SCRAPPED: 'SCRAPPED'  // 报废
}

// 隐患状态枚举
export const IssueStatus = {
  PENDING: 'PENDING',             // 待处理
  IN_PROGRESS: 'IN_PROGRESS',     // 处理中
  PENDING_AUDIT: 'PENDING_AUDIT', // 待审核
  CLOSED: 'CLOSED',               // 已关闭
  REJECTED: 'REJECTED'            // 已驳回
}

// 点检结果枚举
export const InspectionResult = {
  NORMAL: 'NORMAL',     // 正常
  ABNORMAL: 'ABNORMAL'  // 异常
}

// 枚举值数组 - 用于验证
export const RoleValues = Object.values(Role)
export const EquipmentStatusValues = Object.values(EquipmentStatus)
export const IssueStatusValues = Object.values(IssueStatus)
export const InspectionResultValues = Object.values(InspectionResult)

// 验证函数
export const validateRole = (role) => RoleValues.includes(role)
export const validateEquipmentStatus = (status) => EquipmentStatusValues.includes(status)
export const validateIssueStatus = (status) => IssueStatusValues.includes(status)
export const validateInspectionResult = (result) => InspectionResultValues.includes(result)

// 默认值
export const DEFAULT_ROLE = Role.INSPECTOR
export const DEFAULT_EQUIPMENT_STATUS = EquipmentStatus.NORMAL
export const DEFAULT_ISSUE_STATUS = IssueStatus.PENDING
export const DEFAULT_INSPECTION_RESULT = InspectionResult.NORMAL