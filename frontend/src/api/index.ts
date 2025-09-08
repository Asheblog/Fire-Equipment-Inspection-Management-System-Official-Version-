import { api } from './client'
import type {
  LoginRequest,
  LoginResponse,
  ApiResponse,
  User,
  Equipment,
  Issue,
  InspectionLog,
  DashboardData,
  PaginatedResponse,
  EquipmentType,
  ChecklistTemplate,
  Factory,
  MonthlyReport,
  ReportExportRequest,
  ReportExportResponse,
  ReportPreviewRequest,
  ReportPreviewResponse
} from '@/types'

// 认证相关API
export const authApi = {
  // 用户登录
  login: (data: LoginRequest): Promise<ApiResponse<LoginResponse>> =>
    api.post('/auth/login', data),
    
  // 获取用户信息
  getProfile: (): Promise<ApiResponse<User>> =>
    api.get('/auth/profile'),
    
  // 刷新Token
  refreshToken: (): Promise<ApiResponse<{ accessToken: string; user: User }>> =>
    api.post('/auth/refresh'),
    
  // 用户登出
  logout: (): Promise<ApiResponse> =>
    api.post('/auth/logout'),
    
  // 修改密码
  changePassword: (data: { oldPassword: string; newPassword: string }): Promise<ApiResponse> =>
    api.post('/auth/change-password', data)
}

// 器材相关API
export const equipmentApi = {
  // 获取器材列表
  getList: (params?: {
    page?: number
    pageSize?: number
    search?: string
    typeId?: number
    factoryId?: number
    status?: string
  }): Promise<PaginatedResponse<Equipment>> =>
    api.get('/equipments', { params }),
    
  // 根据ID获取器材详情
  getById: (id: number): Promise<ApiResponse<Equipment>> =>
    api.get(`/equipments/${id}`),
    
  // 根据二维码获取器材信息
  getByQR: (qrCode: string): Promise<ApiResponse<Equipment>> =>
    api.get(`/equipments/qr/${qrCode}`),
    
  // 根据二维码获取位置下的所有器材和检查项 (新增)
  getLocationEquipments: (qrCode: string): Promise<ApiResponse<{
    location: string
    factory: { id: number; name: string }
    equipmentCount: number
    hasMultipleEquipments: boolean
    equipments: Array<Equipment & {
      checklistTemplate: ChecklistTemplate[]
      isExpiring: boolean
      isExpired: boolean
      qrImageUrl: string
    }>
    scannedEquipmentId: number
  }>> =>
    api.get(`/equipments/location/${qrCode}`),
    
  // 生成二维码图片
  generateQRImage: (qrCode: string, size?: number): Promise<ApiResponse<{
    qrCode: string               // 实际编码内容（可能是完整URL）
    originalInput?: string       // 原始传入（纯码）
    imageUrl: string
    size: number
  }>> =>
    api.get(`/equipments/qr-image/${encodeURIComponent(qrCode)}`, { params: size ? { size } : {} }),
    
  // 创建器材
  create: (data: Partial<Equipment>): Promise<ApiResponse<Equipment>> =>
    api.post('/equipments', data),
    
  // 更新器材
  update: (id: number, data: Partial<Equipment>): Promise<ApiResponse<Equipment>> =>
    api.put(`/equipments/${id}`, data),
    
  // 删除器材
  delete: (id: number): Promise<ApiResponse> =>
    api.delete(`/equipments/${id}`),
    
  // 获取器材类型列表
  getTypes: (): Promise<ApiResponse<EquipmentType[]>> =>
    api.get('/equipments/types'),

  // 创建器材类型
  createType: (data: { name: string }): Promise<ApiResponse<EquipmentType>> =>
    api.post('/equipments/types', data),

  // 根据ID获取器材类型详情
  getTypeById: (id: number): Promise<ApiResponse<EquipmentType>> =>
    api.get(`/equipments/types/${id}`),

  // 更新器材类型
  updateType: (id: number, data: { name: string }): Promise<ApiResponse<EquipmentType>> =>
    api.put(`/equipments/types/${id}`, data),

  // 删除器材类型
  deleteType: (id: number): Promise<ApiResponse> =>
    api.delete(`/equipments/types/${id}`),

  // 获取器材类型的点检项模板
  getChecklistTemplates: (typeId: number): Promise<ApiResponse<ChecklistTemplate[]>> =>
    api.get(`/equipments/types/${typeId}/checklist`),

  // 创建点检项模板
  createChecklistTemplate: (typeId: number, data: { itemName: string }): Promise<ApiResponse<ChecklistTemplate>> =>
    api.post(`/equipments/types/${typeId}/checklist`, data),

  // 批量创建点检项模板
  createChecklistTemplatesBatch: (typeId: number, data: { itemNames: string[] }): Promise<ApiResponse<{
    success: boolean
    created: ChecklistTemplate[]
    createdCount: number
    skippedCount: number
    skippedItems: string[]
    message: string
  }>> =>
    api.post(`/equipments/types/${typeId}/checklist/batch`, data),

  // 更新点检项模板
  updateChecklistTemplate: (typeId: number, id: number, data: { itemName: string }): Promise<ApiResponse<ChecklistTemplate>> =>
    api.put(`/equipments/types/${typeId}/checklist/${id}`, data),

  // 删除点检项模板
  deleteChecklistTemplate: (typeId: number, id: number): Promise<ApiResponse> =>
    api.delete(`/equipments/types/${typeId}/checklist/${id}`),

  // 批量更新点检项排序
  reorderChecklistTemplates: (typeId: number, templateIds: number[]): Promise<ApiResponse<ChecklistTemplate[]>> =>
    api.put(`/equipments/types/${typeId}/checklist/reorder`, { templateIds }),
    
  // 获取器材统计
  getStats: (): Promise<ApiResponse> =>
    api.get('/equipments/stats'),
    
  // 获取点检项模板
  getChecklist: (equipmentId: number): Promise<ApiResponse<ChecklistTemplate[]>> =>
    api.get(`/equipments/${equipmentId}/checklist`),
    
  // 批量导入器材
  batchImport: (equipments: Partial<Equipment>[]): Promise<ApiResponse> =>
    api.post('/equipments/batch-import', { equipments })
}

// 点检相关API
export const inspectionApi = {
  // 获取点检记录列表
  getList: (params?: {
    page?: number
    pageSize?: number
    equipmentId?: number
    inspectorId?: number
    result?: string
    startDate?: string
    endDate?: string
  }): Promise<PaginatedResponse<InspectionLog>> =>
    api.get('/inspections', { params }),
    
  // 根据ID获取点检详情
  getById: (id: number): Promise<ApiResponse<InspectionLog>> =>
    api.get(`/inspections/${id}`),
    
  // 创建点检记录
  create: (data: {
    equipmentId: number
    overallResult: 'NORMAL' | 'ABNORMAL'
    inspectionImageUrl: string
    checklistResults: Array<{
      itemName: string
      result: 'NORMAL' | 'ABNORMAL'
      note: string
    }>
    issueDescription?: string
    issueImageUrl?: string
  }): Promise<ApiResponse<InspectionLog>> =>
    api.post('/inspections', data),
    
  // 批量创建点检记录 (新增)
  createBatch: (data: {
    location: string
    equipments: Array<{
      equipmentId: number
      overallResult: 'NORMAL' | 'ABNORMAL'
      inspectionImageUrl: string
      checklistResults: Array<{
        itemName: string
        result: 'NORMAL' | 'ABNORMAL'
        note: string
      }>
      issueDescription?: string
      issueImageUrl?: string
    }>
  }): Promise<ApiResponse<{
    inspections: InspectionLog[]
    issues: any[]
    summary: {
      location: string
      totalEquipments: number
      normalCount: number
      abnormalCount: number
      issueCount: number
      inspectorId: number
    }
  }>> =>
    api.post('/inspections/batch', data),
    
  // 获取待处理点检
  getPending: (): Promise<ApiResponse<Equipment[]>> =>
    api.get('/inspections/pending'),
    
  // 获取点检统计
  getStats: (): Promise<ApiResponse> =>
    api.get('/inspections/stats'),
    
  // 获取点检趋势
  getTrend: (params?: { period?: string }): Promise<ApiResponse> =>
    api.get('/inspections/trend', { params }),

  // ===== 增量点检模式新增接口 =====
  /**
   * 创建空的点检记录占位（增量模式起点）
   * @param data { equipmentId }
   */
  createEmpty: (data: { equipmentId: number }): Promise<ApiResponse<InspectionLog>> =>
    api.post('/inspections/empty', data),

  /**
   * 追加图片（支持 type: inspection | issue | fixed）
   * 后端将根据 type 写入对应临时图片数组字段（兼容旧字段首图）
   */
  appendImage: (
    id: number,
    data: { type: 'inspection' | 'issue' | 'fixed'; imageUrl: string }
  ): Promise<ApiResponse<InspectionLog>> =>
    api.post(`/inspections/${id}/images`, data),

  /**
   * 删除已追加的单张图片
   * 若图片不存在返回 IMAGE_NOT_FOUND
   * 若仍被其他记录引用则仅解除引用不物理删除
   */
  removeImage: (
    id: number,
    data: { type: 'inspection' | 'issue' | 'fixed'; imageUrl: string }
  ): Promise<ApiResponse<InspectionLog>> =>
    api.delete(`/inspections/${id}/images`, { data }),

  /**
   * 最终提交点检结果（完成增量模式）
   * checklistResults: 前端传数组，后端会序列化为 JSON 字符串
   * issueDescription: overallResult=ABNORMAL 时可选
   */
  finalize: (
    id: number,
    data: {
      overallResult: 'NORMAL' | 'ABNORMAL'
      checklistResults: Array<{
        itemName: string
        result: 'NORMAL' | 'ABNORMAL'
        note: string
      }>
      issueDescription?: string
      // 以下可选：如果前端在最终提交时为了幂等补发完整图片列表（后端也能从已有临时字段读取）
      inspectionImages?: string[]
      issueImages?: string[]
      fixedImages?: string[]
    }
  ): Promise<ApiResponse<InspectionLog>> =>
    api.patch(`/inspections/${id}/finalize`, data)
  ,
  // 本月按厂区的点检进度
  getMonthlyProgress: (params?: { month?: string }): Promise<ApiResponse<{ month: string; total: number; completed: number; pending: number; factories: Array<{ factoryId: number; factoryName: string; total: number; completed: number; pending: number }> }>> =>
    api.get('/inspections/monthly-progress', { params }),

  // 获取指定厂区本月未完成点检设备
  getMonthlyPending: (factoryId: number, month?: string): Promise<ApiResponse<Equipment[]>> =>
    api.get('/inspections/monthly-pending', { params: { factoryId, month } })
}

// 隐患相关API
export const issueApi = {
  // 获取隐患列表（统一分页结构）
  getList: (params?: {
    page?: number
    pageSize?: number
    status?: string
    reporterId?: number
    handlerId?: number
    factoryId?: number
    equipmentId?: number
    startDate?: string
    endDate?: string
  }): Promise<PaginatedResponse<Issue>> =>
    api.get('/issues', { params }) as unknown as Promise<PaginatedResponse<Issue>>, // 约定后端返回 data: { items, total, page, pageSize, totalPages }
    
  // 根据ID获取隐患详情
  getById: (id: number): Promise<ApiResponse<Issue>> =>
    api.get(`/issues/${id}`),
    
  // 处理隐患
  handle: (id: number, data: {
    solution: string
    fixedImageUrl?: string // 兼容旧字段
    fixedImageUrls?: string[] // 新多图
  }): Promise<ApiResponse<Issue>> =>
    api.put(`/issues/${id}/handle`, data),
    
  // 审核隐患
  audit: (id: number, data: {
    approved: boolean
    auditComments?: string
  }): Promise<ApiResponse<Issue>> =>
    api.put(`/issues/${id}/audit`, data),
    
  // 添加评论
  addComment: (id: number, data: { comment: string }): Promise<ApiResponse> =>
    api.post(`/issues/${id}/comments`, data),
    
  // 获取隐患统计
  getStats: (params?: { period?: string }): Promise<ApiResponse> =>
    api.get('/issues/stats', { params }),
    
  // 获取隐患趋势
  getTrend: (params?: { days?: number }): Promise<ApiResponse> =>
    api.get('/issues/trend', { params })
}

// 用户管理API
export const userApi = {
  // 获取用户列表
  getList: (params?: {
    page?: number
    pageSize?: number
    search?: string
    role?: string
    factoryId?: number
  }): Promise<PaginatedResponse<User>> =>
    api.get('/users', { params }),
    
  // 根据ID获取用户详情
  getById: (id: number): Promise<ApiResponse<User>> =>
    api.get(`/users/${id}`),
    
  // 创建用户
  create: (data: Partial<User> & { password: string }): Promise<ApiResponse<User>> =>
    api.post('/users', data),
    
  // 更新用户（管理员操作）
  update: (id: number, data: Partial<User>): Promise<ApiResponse<User>> =>
    api.put(`/users/${id}`, data),
    
  // 更新个人资料（用户自己操作）
  updateProfile: (data: { fullName?: string; username?: string }): Promise<ApiResponse<User>> =>
    api.put('/users/profile/me', data),
    
  // 切换用户状态
  toggleStatus: (id: number, isActive: boolean): Promise<ApiResponse<User>> =>
    api.put(`/users/${id}/status`, { isActive }),
    
  // 重置用户密码
  resetPassword: (id: number, newPassword: string): Promise<ApiResponse> =>
    api.put(`/users/${id}/password`, { newPassword }),
    
  // 删除用户
  delete: (id: number): Promise<ApiResponse> =>
    api.delete(`/users/${id}`),
    
  // 获取用户统计
  getStats: (): Promise<ApiResponse> =>
    api.get('/users/stats')
}

// 厂区管理API
export const factoryApi = {
  // 获取厂区列表
  getList: (): Promise<ApiResponse<Factory[]>> =>
    api.get('/factories'),
  
  // 获取厂区详情
  getById: (id: number): Promise<ApiResponse<Factory>> =>
    api.get(`/factories/${id}`),
    
  // 创建厂区
  create: (data: { name: string; address?: string }): Promise<ApiResponse<Factory>> =>
    api.post('/factories', data),
    
  // 更新厂区
  update: (id: number, data: { name: string; address?: string }): Promise<ApiResponse<Factory>> =>
    api.put(`/factories/${id}`, data),
    
  // 删除厂区
  delete: (id: number): Promise<ApiResponse> =>
    api.delete(`/factories/${id}`)
}

// 报表API
export const reportApi = {
  // 获取数据看板
  getDashboard: (): Promise<ApiResponse<DashboardData>> =>
    api.get('/reports/dashboard'),
    
  // 获取月度报告
  getMonthlyReport: (year: number, month: number): Promise<ApiResponse<MonthlyReport>> =>
    api.get('/reports/monthly', { params: { year, month } }),
    
  // 获取器材概览
  getEquipmentOverview: (): Promise<ApiResponse> =>
    api.get('/reports/equipment-overview'),
    
  // 获取点检概览
  getInspectionOverview: (): Promise<ApiResponse> =>
    api.get('/reports/inspection-overview'),
    
  // 获取隐患概览
  getIssueOverview: (): Promise<ApiResponse> =>
    api.get('/reports/issue-overview'),
    
  // 获取最近活动
  getRecentActivity: (limit: number = 10): Promise<ApiResponse> =>
    api.get('/reports/recent-activity', { params: { limit } }),

  // 导出报表
  exportReport: (request: ReportExportRequest): Promise<ApiResponse<ReportExportResponse>> =>
    api.post('/reports/export', request, { timeout: 30000 }),

  // 预览报表
  previewReport: (request: ReportPreviewRequest): Promise<ApiResponse<ReportPreviewResponse>> =>
    api.post('/reports/preview', request)
}

// 文件上传API
export const uploadApi = {
  // 上传图片
  uploadImage: (file: File): Promise<ApiResponse<{
    fileUrl: string
    fileName: string
    fileSize: number
  }>> => {
    const formData = new FormData()
    formData.append('file', file)
    return api.upload('/upload', formData)
  }
}

// 导出权限管理API
export { permissionApi } from './permissions'
