// 用户角色枚举
export const UserRole = {
  INSPECTOR: 'INSPECTOR',         // 点检员
  FACTORY_ADMIN: 'FACTORY_ADMIN', // 厂区管理员
  SUPER_ADMIN: 'SUPER_ADMIN'      // 超级管理员
} as const

export type UserRole = typeof UserRole[keyof typeof UserRole]

// 用户信息类型
export interface User {
  id: number
  username: string
  fullName: string
  role: UserRole
  factoryId: number
  factory?: Factory
  isActive: boolean
  createdAt: string
}

// 厂区信息类型
export interface Factory {
  id: number
  name: string
  address?: string
  createdAt: string
  // 可选统计字段（后端聚合时返回）
  userCount?: number
  equipmentCount?: number
}

// 器材类型信息
export interface EquipmentType {
  id: number
  name: string
  equipmentCount?: number
  checklistTemplates?: ChecklistTemplate[]
}

// 点检项模板类型
export interface ChecklistTemplate {
  id: number
  typeId: number
  itemName: string
  sortOrder: number
}

// 器材信息类型
export interface Equipment {
  id: number
  qrCode: string
  name: string
  typeId: number
  type?: EquipmentType // 一些接口用 type
  equipmentType?: EquipmentType // 组件中引用 equipmentType
  factoryId: number
  factory?: Factory
  location: string
  specifications: string
  productionDate: string
  expiryDate: string
  status: 'NORMAL' | 'ABNORMAL' | 'SCRAPPED' | 'MAINTENANCE'
  lastInspectedAt?: string
  createdAt?: string
  description?: string
}

// 隐患状态枚举
export const IssueStatus = {
  PENDING: 'PENDING',           // 待处理
  IN_PROGRESS: 'IN_PROGRESS',   // 处理中
  PENDING_AUDIT: 'PENDING_AUDIT', // 待审核
  CLOSED: 'CLOSED',             // 已关闭
  REJECTED: 'REJECTED'          // 已驳回
} as const

export type IssueStatus = typeof IssueStatus[keyof typeof IssueStatus]

// 隐患信息类型
export interface Issue {
  id: number
  equipmentId: number
  equipment?: Equipment
  description: string
  reporterId: number
  reporter?: User
  // 多图片支持
  issueImages?: string[]        // 新的多图片数组字段
  fixedImages?: string[]        // 新的多图片数组字段
  // 向下兼容的单图片字段
  issueImageUrl?: string
  fixedImageUrl?: string
  status: IssueStatus
  createdAt: string
  handlerId?: number
  handler?: User
  handledAt?: string
  solution?: string
  auditorId?: number
  auditor?: User
  auditedAt?: string
  auditNote?: string
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  daysOpen?: number
  processingTime?: number
}

// 点检记录类型
export interface InspectionLog {
  id: number
  equipmentId: number
  equipment?: Equipment & {
    equipmentType?: EquipmentType
    factory?: Factory
  }
  inspectorId: number
  inspector?: User
  overallResult: 'NORMAL' | 'ABNORMAL'
  // 多图片支持
  inspectionImages?: string[]   // 新的多图片数组字段
  // 向下兼容的单图片字段
  inspectionImageUrl?: string
  inspectionTime: string
  issueId?: number
  issue?: Issue
  checklistResults?: string // JSON字符串格式存储
}

// 点检项结果类型
export interface InspectionItem {
  id: number
  logId: number
  templateId: number
  template?: ChecklistTemplate
  result: 'NORMAL' | 'ABNORMAL'
  remarks?: string
}

// API响应类型
export interface ValidationFieldError {
  field: string
  code: string
  message: string
  hint?: string
  value?: any
}

export interface ApiResponse<T = any> {
  success: boolean
  message: string
  data?: T
  error?: string
  code?: string
  errors?: ValidationFieldError[]
  traceId?: string
}

// 分页响应类型
export interface PaginatedResponse<T = any> {
  success: boolean
  message: string
  data: {
    items: T[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}

// 登录请求类型
export interface LoginRequest {
  username: string
  password: string
  // 记住我：后端将颁发更长期 refresh token (<=90d)
  rememberMe?: boolean
}

// 登录响应类型
export interface LoginResponse {
  user: User
  factory: Factory
  accessToken: string
  refreshToken: string
  // 回显是否为记住我登录
  rememberMe?: boolean
}

// 器材统计类型
export interface EquipmentStats {
  total: number
  normal: number
  abnormal: number
  scrapped: number
  upcomingExpiry: number
}

// 隐患统计类型
export interface IssueStats {
  total: number
  pending: number
  underReview: number
  closed: number
  thisMonth: number
}

// 点检统计类型
export interface InspectionStats {
  total: number
  thisMonth: number
  normalRate: number
  abnormalCount: number
  pendingCount: number
}

// 数据看板类型
export interface DashboardData {
  equipmentStats: EquipmentStats
  issueStats: IssueStats
  inspectionStats: InspectionStats
  recentActivities: Activity[]
  monthlyTrend: MonthlyTrendData[]
}

// 活动记录类型
export interface Activity {
  id: number
  type: 'INSPECTION' | 'ISSUE_CREATED' | 'ISSUE_HANDLED' | 'ISSUE_AUDITED'
  title: string
  description: string
  userId: number
  user?: User
  createdAt: string
}

// 月度趋势数据类型
export interface MonthlyTrendData {
  month: string
  inspections: number
  issues: number
  normalRate: number
}

// 报表导出请求类型
export interface ReportExportRequest {
  reportType: 'monthly' | 'equipment' | 'inspection' | 'issue' | 'comprehensive'
  year?: number
  month?: number
  startDate?: string
  endDate?: string
  format: 'excel' | 'pdf'
  filters?: Record<string, any>
  includeCharts?: boolean
}

// 报表导出响应类型
export interface ReportExportResponse {
  downloadUrl: string
  filename: string
  size: number
  generatedAt: string
}

// 报表预览请求类型
export interface ReportPreviewRequest {
  reportType: 'monthly' | 'equipment' | 'inspection' | 'issue'
  year?: number
  month?: number
  format: 'html'
  filters?: Record<string, any>
}

// 报表预览响应类型
export interface ReportPreviewResponse {
  previewUrl: string
  expiresAt: string
}

// 月度报表类型
export interface MonthlyReport {
  reportDate: {
    year: number
    month: number
    startDate: string
    endDate: string
  }
  summary: {
    equipment: {
      total: number
      normal: number
      abnormal: number
      scrapped: number
      expiring: number
      expired: number
      healthRate: string
    }
    inspection: {
      total: number
      normal: number
      abnormal: number
      passRate: string
    }
    issue: {
      total: number
      closed: number
      pending: number
      resolveRate: string
    }
  }
  trends: {
    dailyInspections: DailyInspectionTrend[]
  }
  rankings: {
    equipmentTypes: EquipmentTypeRanking[]
    inspectors: InspectorPerformance[]
  }
  generatedAt: string
}

// 每日点检趋势
export interface DailyInspectionTrend {
  date: string
  total: number
  normal: number
  abnormal: number
}

// 器材类型排行
export interface EquipmentTypeRanking {
  name: string
  equipmentCount: number
  inspectionCount: number
}

// 点检员绩效
export interface InspectorPerformance {
  name: string
  totalInspections: number
  normalInspections: number
  abnormalInspections: number
}

// 设备状态报告类型
export interface EquipmentStatusReport {
  summary: {
    total: number
    byStatus: Record<string, number>
    byType: Record<string, number>
    expiringNext30Days: number
    expiredCount: number
  }
  details: {
    expiring: Equipment[]
    expired: Equipment[]
    abnormal: Equipment[]
  }
  recommendations: string[]
}

// 点检效率报告类型
export interface InspectionEfficiencyReport {
  summary: {
    totalInspections: number
    averageTimePerInspection: number
    inspectorCount: number
    passRate: number
  }
  performance: {
    byInspector: InspectorPerformance[]
    byEquipmentType: EquipmentTypeRanking[]
    byTimeOfDay: { hour: number; count: number }[]
  }
  trends: {
    daily: DailyInspectionTrend[]
    weekly: { week: string; total: number; avgTime: number }[]
  }
}

// 隐患分析报告类型
export interface IssueAnalysisReport {
  summary: {
    totalIssues: number
    resolvedIssues: number
    pendingIssues: number
    averageResolutionTime: number
  }
  analysis: {
    bySeverity: Record<string, number>
    byEquipmentType: Record<string, number>
    byRootCause: Record<string, number>
    topReporters: { name: string; count: number }[]
  }
  trends: {
    monthly: { month: string; created: number; resolved: number }[]
    resolutionTimes: { range: string; count: number }[]
  }
}

// 用户统计类型
export interface UserStats {
  total: number
  activeRate: number
  byRole: {
    inspector: number
    factoryAdmin: number
    superAdmin: number
  }
}
