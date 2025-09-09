import { useState, useEffect, useCallback, useRef } from 'react'
import { createLogger } from '@/lib/logger'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { CalendarIcon, Filter, Search, FileText, Eye } from 'lucide-react'
import { AuthenticatedImage } from '@/components/AuthenticatedImage'
import { DataTable } from '@/components/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageContainer, PageHeader, ContentSection } from '@/components/layout'
import { useImagePreview } from '@/components/image-preview/ImagePreviewContext'
import { useAuthStore } from '@/stores/auth'
import { inspectionApi, userApi, factoryApi } from '@/api'
import { parseInspectionImages, parseIssueImages } from '@/utils/imageParse'
import { ImageGrid } from '@/components/ui/ImageGrid'
import type { InspectionLog, User, Factory } from '@/types'
import { UserRole } from '@/types'
import { cn } from '@/lib/utils'
import { formatQrCodeDisplay } from '@/utils/qrCode'
import type { ColumnDef } from '@tanstack/react-table'
import type { DateRange } from 'react-day-picker'

const log = createLogger('InspectRecords')

interface InspectionFilters {
  equipmentId?: number
  inspectorId?: number
  result?: string
  startDate?: Date
  endDate?: Date
  factoryId?: number
}

interface InspectionDetail extends Omit<InspectionLog, 'checklistResults'> {
  checklistResults: Array<{
    itemName: string
    result: 'NORMAL' | 'ABNORMAL'
    note?: string
  }>
  // 归一化后的多图片数组（兼容 inspectionImages / inspectionImageUrls / inspectionImageUrl）
  inspectionImagesList?: string[]
}

export function InspectionRecordsPage() {
  const { open: openPreview } = useImagePreview()
  const { user } = useAuthStore()
  const [inspections, setInspections] = useState<InspectionLog[]>([])
  const [filters, setFilters] = useState<InspectionFilters>({})
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0
  })
  const [loading, setLoading] = useState(false)

  // 筛选选项数据
  const [inspectors, setInspectors] = useState<User[]>([])
  const [factories, setFactories] = useState<Factory[]>([])
  
  // 详情对话框
  const [selectedInspection, setSelectedInspection] = useState<InspectionDetail | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const detailAbortRef = useRef<AbortController | null>(null)

  // 日期选择器状态
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: undefined,
    to: undefined
  })

  // 用于取消正在进行的请求
  const abortControllerRef = useRef<AbortController | null>(null)

  // 加载数据
  const loadInspections = useCallback(async () => {
    // 取消之前的请求
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // 创建新的 AbortController
    abortControllerRef.current = new AbortController()
    
    try {
      setLoading(true)
      const params = {
        page: pagination.page,
        pageSize: pagination.pageSize,
        ...filters,
        startDate: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
        endDate: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined
      }

      const response = await inspectionApi.getList(params)
      
      // 检查请求是否被取消
      if (abortControllerRef.current?.signal.aborted) {
        return
      }

      if (response.success && response.data) {
        // 检查数据结构
        if (response.data.items && Array.isArray(response.data.items)) {
          setInspections(response.data.items)
          setPagination(prev => ({
            ...prev,
            total: response.data.total || 0
          }))
        } else if (Array.isArray(response.data)) {
          // 如果直接返回数组
          setInspections(response.data)
          setPagination(prev => ({
            ...prev,
            total: Array.isArray(response.data) ? response.data.length : response.data?.total || 0
          }))
        }
      }
    } catch (error) {
      // 忽略被取消的请求错误
      if (error instanceof Error && error.name === 'AbortError') {
        return
      }
      log.error('获取点检记录失败', error)
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.pageSize, filters, dateRange?.from, dateRange?.to])

  // 加载筛选选项
  const loadFilterOptions = async () => {
    try {
      // 根据用户角色加载不同的选项
      if (user?.role !== UserRole.INSPECTOR) {
        const [inspectorsRes, factoriesRes] = await Promise.all([
          userApi.getList({ role: UserRole.INSPECTOR }),
          factoryApi.getList()
        ])

        if (inspectorsRes.success && inspectorsRes.data) {
          if (inspectorsRes.data.items && Array.isArray(inspectorsRes.data.items)) {
            setInspectors(inspectorsRes.data.items)
          } else if (Array.isArray(inspectorsRes.data)) {
            setInspectors(inspectorsRes.data)
          }
        }

        if (factoriesRes.success && factoriesRes.data) {
          if (Array.isArray(factoriesRes.data)) {
            setFactories(factoriesRes.data)
          }
        }
      }
    } catch (error) {
      log.error('加载筛选选项失败', error)
    }
  }

  // 解析逻辑已抽离到 utils/imageParse.ts

  // 查看点检详情
  const viewInspectionDetail = async (inspectionId: number) => {
    // 取消之前的详情请求
    if (detailAbortRef.current) {
      detailAbortRef.current.abort()
    }
    const controller = new AbortController()
    detailAbortRef.current = controller

    // 先打开弹窗并展示加载态
    setDetailDialogOpen(true)
    setDetailLoading(true)
    setSelectedInspection(null)

    try {
      const response = await inspectionApi.getById(inspectionId, { signal: controller.signal })
      if (controller.signal.aborted) return
      if (response.success && response.data) {
        const checklistResults = response.data.checklistResults ? 
          JSON.parse(response.data.checklistResults) : []
        const normalizedImages = (response.data as any).inspectionImages || parseInspectionImages(response.data)
        setSelectedInspection({
          ...response.data,
          checklistResults,
          inspectionImagesList: normalizedImages
        })
      }
    } catch (error: any) {
      if (error?.name === 'CanceledError' || error?.name === 'AbortError') return
      log.error('获取点检详情失败', error)
    } finally {
      if (!controller.signal.aborted) setDetailLoading(false)
    }
  }

  // 重置筛选条件
  const resetFilters = () => {
    setFilters({})
    setDateRange({ from: undefined, to: undefined })
    setPagination(prev => ({ ...prev, page: 1 }))
  }

  // 应用筛选条件
  const applyFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 }))
    // 移除重复的loadInspections()调用，让useEffect统一处理
  }

  // 表格列定义
  const columns: ColumnDef<InspectionLog>[] = [
    {
      id: 'equipment_qrCode',
      accessorFn: (row) => row.equipment?.qrCode,
      header: '器材编号',
      cell: ({ row }) => (
        <div className="font-mono text-sm">
          {formatQrCodeDisplay(row.original.equipment?.qrCode)}
        </div>
      )
    },
    {
      id: 'equipment_name',
      accessorFn: (row) => row.equipment?.name,
      header: '器材名称',
      cell: ({ row }) => (
        <div className="font-medium">
          {row.original.equipment?.name}
        </div>
      )
    },
    {
      id: 'equipment_type',
      accessorFn: (row) => row.equipment?.equipmentType?.name,
      header: '器材类型',
      cell: ({ row }) => (
        <Badge variant="outline">
          {row.original.equipment?.equipmentType?.name}
        </Badge>
      )
    },
    {
      id: 'equipment_location',
      accessorFn: (row) => row.equipment?.location,
      header: '安装位置',
      cell: ({ row }) => (
        <div className="text-sm text-gray-600">
          {row.original.equipment?.location}
        </div>
      )
    },
    {
      id: 'inspector_name',
      accessorFn: (row) => row.inspector?.fullName,
      header: '点检员',
      cell: ({ row }) => (
        <div className="font-medium">
          {row.original.inspector?.fullName}
        </div>
      )
    },
    {
      accessorKey: 'inspectionTime',
      header: '点检时间',
      cell: ({ row }) => (
        <div className="text-sm">
          {format(new Date(row.original.inspectionTime), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
        </div>
      )
    },
    {
      accessorKey: 'overallResult',
      header: '点检结果',
      cell: ({ row }) => {
        const result = row.original.overallResult
        return (
          <Badge 
            variant={result === 'NORMAL' ? 'success' : 'destructive'}
            className={result === 'NORMAL' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
          >
            {result === 'NORMAL' ? '正常' : '异常'}
          </Badge>
        )
      }
    },
    // 只有非点检员才能看到厂区信息
    ...(user?.role !== UserRole.INSPECTOR ? [{
      id: 'factory_name',
      accessorFn: (row: any) => row.equipment?.factory?.name,
      header: '所属厂区',
      cell: ({ row }: { row: any }) => (
        <Badge variant="outline">
          {row.original.equipment?.factory?.name}
        </Badge>
      )
    }] : []),
    {
      id: 'actions',
      header: '操作',
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => viewInspectionDetail(row.original.id)}
          className="h-8 px-3"
        >
          <Eye className="h-4 w-4 mr-1" />
          查看详情
        </Button>
      )
    }
  ]

  useEffect(() => {
    loadFilterOptions()
  }, [])

  useEffect(() => {
    loadInspections()
  }, [loadInspections])

  // 组件卸载时清理未完成的请求
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return (
    <PageContainer>
      <PageHeader 
        title="点检记录"
        description="查看和管理消防器材点检记录"
      >
        <Button variant="outline" onClick={() => window.print()}>
          <FileText className="h-4 w-4 mr-2" />
          导出报表
        </Button>
      </PageHeader>

      <ContentSection>
        {/* 高级筛选区 */}
        <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Filter className="h-5 w-5 mr-2" />
            高级筛选
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 日期范围选择 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">点检日期范围</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dateRange?.from && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange?.to ? (
                        <>
                          {format(dateRange.from, "yyyy-MM-dd")} -{" "}
                          {format(dateRange.to, "yyyy-MM-dd")}
                        </>
                      ) : (
                        format(dateRange.from, "yyyy-MM-dd")
                      )
                    ) : (
                      "选择日期范围"
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={dateRange?.from}
                    selected={dateRange}
                    onSelect={(range) => setDateRange(range)}
                    numberOfMonths={2}
                    locale={zhCN}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* 点检员筛选 - 只有非点检员能看到 */}
            {user?.role !== UserRole.INSPECTOR && (
              <div className="space-y-2">
                <label className="text-sm font-medium">点检员</label>
                <Select 
                  value={filters.inspectorId?.toString() || 'all'} 
                  onValueChange={(value) => setFilters(prev => ({ 
                    ...prev, 
                    inspectorId: value === 'all' ? undefined : parseInt(value)
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择点检员" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部点检员</SelectItem>
                    {inspectors?.map(inspector => (
                      <SelectItem key={inspector.id} value={inspector.id.toString()}>
                        {inspector.fullName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 厂区筛选 - 只有超级管理员能看到 */}
            {user?.role === UserRole.SUPER_ADMIN && (
              <div className="space-y-2">
                <label className="text-sm font-medium">厂区</label>
                <Select 
                  value={filters.factoryId?.toString() || 'all'} 
                  onValueChange={(value) => setFilters(prev => ({ 
                    ...prev, 
                    factoryId: value === 'all' ? undefined : parseInt(value)
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="选择厂区" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部厂区</SelectItem>
                    {factories?.map(factory => (
                      <SelectItem key={factory.id} value={factory.id.toString()}>
                        {factory.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* 点检结果筛选 */}
            <div className="space-y-2">
              <label className="text-sm font-medium">点检结果</label>
              <Select 
                value={filters.result || 'all'} 
                onValueChange={(value) => setFilters(prev => ({ 
                  ...prev, 
                  result: value === 'all' ? undefined : value
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择结果" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部结果</SelectItem>
                  <SelectItem value="NORMAL">正常</SelectItem>
                  <SelectItem value="ABNORMAL">异常</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 筛选操作按钮 */}
          <div className="flex items-center space-x-2 mt-4">
            <Button onClick={applyFilters}>
              <Search className="h-4 w-4 mr-2" />
              应用筛选
            </Button>
            <Button variant="outline" onClick={resetFilters}>
              重置筛选
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 数据表格 */}
      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">加载中...</div>
            </div>
          ) : (
            <>
              <DataTable
                columns={columns}
                data={inspections}
                searchKey="equipment_name"
                searchPlaceholder="搜索器材名称..."
              />
              
              {/* 分页控制 */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  共 {pagination.total} 条记录，第 {pagination.page} 页，每页 {pagination.pageSize} 条
                </div>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page <= 1 || loading}
                  >
                    上一页
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= Math.ceil(pagination.total / pagination.pageSize) || loading}
                  >
                    下一页
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 点检详情对话框 */}
      <Dialog 
        open={detailDialogOpen} 
        onOpenChange={(open) => {
          setDetailDialogOpen(open)
          if (!open) {
            if (detailAbortRef.current) {
              detailAbortRef.current.abort()
              detailAbortRef.current = null
            }
            setDetailLoading(false)
            setSelectedInspection(null)
          }
        }}
      >
        <DialogContent className="max-w-6xl w-[96vw] overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>点检记录详情</DialogTitle>
          </DialogHeader>
          
          {/* 加载中占位 */}
          {detailLoading && !selectedInspection && (
            <div className="py-12 text-center text-muted-foreground">加载详情中...</div>
          )}

          {selectedInspection && (
            <div className="space-y-6">
              {/* 器材信息卡片 */}
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-blue-800">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600 font-bold text-sm">器</span>
                    </div>
                    器材信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm w-16">编号</span>
                      <div className="flex items-center gap-2 flex-1">
                        <code className="bg-gray-100 px-2 py-1 rounded text-xs font-mono">
                          {formatQrCodeDisplay(selectedInspection.equipment?.qrCode)}
                        </code>
                        <button 
                          onClick={() => navigator.clipboard.writeText(selectedInspection.equipment?.qrCode || '')}
                          className="text-blue-500 hover:text-blue-700 text-xs"
                          title="复制编号"
                        >
                          📋
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm w-16">名称</span>
                      <span className="font-medium">{selectedInspection.equipment?.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm w-16">类型</span>
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                        {selectedInspection.equipment?.equipmentType?.name}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm w-16">位置</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium break-words break-all">{selectedInspection.equipment?.location}</span>
                        <span className="text-xs text-gray-400">📍</span>
                      </div>
                    </div>
                    {user?.role !== UserRole.INSPECTOR && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-sm w-16">厂区</span>
                        <Badge variant="outline" className="border-blue-300 text-blue-700">
                          {selectedInspection.equipment?.factory?.name}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* 点检信息卡片 */}
              <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-green-800">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <span className="text-green-600 font-bold text-sm">检</span>
                    </div>
                    点检信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm w-16">点检员</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{selectedInspection.inspector?.fullName}</span>
                        <span className="text-xs text-gray-400">👤</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm w-16">时间</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {format(new Date(selectedInspection.inspectionTime), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                        </span>
                        <span className="text-xs text-gray-400">🕐</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm w-16">结果</span>
                      <Badge 
                        variant={selectedInspection.overallResult === 'NORMAL' ? 'success' : 'destructive'}
                        className={`flex items-center gap-1 ${
                          selectedInspection.overallResult === 'NORMAL' 
                            ? 'bg-green-100 text-green-800 border-green-300' 
                            : 'bg-red-100 text-red-800 border-red-300'
                        }`}
                      >
                        <span>{selectedInspection.overallResult === 'NORMAL' ? '✓' : '✗'}</span>
                        {selectedInspection.overallResult === 'NORMAL' ? '正常' : '异常'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 详细信息标签页 */}
              <Tabs defaultValue="checklist" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="checklist" className="flex items-center gap-2">
                    <span>📋</span> 点检项详情
                  </TabsTrigger>
                  <TabsTrigger value="images" className="flex items-center gap-2">
                    <span>📸</span> 点检照片
                  </TabsTrigger>
                  {selectedInspection.issue && (
                    <TabsTrigger value="issue" className="flex items-center gap-2">
                      <span>⚠️</span> 关联隐患
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* 点检项详情 */}
                <TabsContent value="checklist" className="space-y-4 mt-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📋</span>
                          <span>点检项详情</span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          共 {selectedInspection.checklistResults?.length || 0} 项
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {selectedInspection.checklistResults?.map((item, index) => (
                          <div 
                            key={index} 
                            className={`p-4 rounded-lg border-l-4 transition-all duration-200 hover:shadow-md ${
                              item.result === 'NORMAL' 
                                ? 'bg-green-50 border-l-green-400 hover:bg-green-100' 
                                : 'bg-red-50 border-l-red-400 hover:bg-red-100'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className={`text-lg ${
                                    item.result === 'NORMAL' ? 'text-green-600' : 'text-red-600'
                                  }`}>
                                    {item.result === 'NORMAL' ? '✅' : '❌'}
                                  </span>
                                  <span className="font-medium text-gray-900 break-words break-all">{item.itemName}</span>
                                </div>
                                {item.note && (
                                  <div className="ml-8 mt-2 p-2 bg-white/50 rounded border border-gray-200">
                                    <span className="text-xs text-gray-500 uppercase tracking-wide">备注</span>
                                    <p className="text-sm text-gray-700 mt-1">{item.note}</p>
                                  </div>
                                )}
                              </div>
                              <Badge 
                                variant={item.result === 'NORMAL' ? 'success' : 'destructive'}
                                className={`ml-4 flex items-center gap-1 font-medium ${
                                  item.result === 'NORMAL' 
                                    ? 'bg-green-100 text-green-800 border-green-300' 
                                    : 'bg-red-100 text-red-800 border-red-300'
                                }`}
                              >
                                <span className="text-xs">
                                  {item.result === 'NORMAL' ? '✓' : '✗'}
                                </span>
                                {item.result === 'NORMAL' ? '正常' : '异常'}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* 点检照片 - 多图支持 (重构使用 ImageGrid) */}
                <TabsContent value="images" className="mt-6">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2">
                        <span className="text-lg">📸</span>
                        <span>点检现场照片</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ImageGrid
                        images={selectedInspection.inspectionImagesList || (selectedInspection.inspectionImageUrl ? [selectedInspection.inspectionImageUrl] : [])}
                        emptyText="暂无点检照片"
                        label={undefined}
                        eagerCount={2}
                      />
                      {selectedInspection.issue && (() => {
                        const issue: any = selectedInspection.issue
                        let fixedImages: string[] = []
                        if (Array.isArray(issue.fixedImages) && issue.fixedImages.length) fixedImages = issue.fixedImages.filter(Boolean)
                        else if (issue.fixedImageUrls) {
                          if (Array.isArray(issue.fixedImageUrls)) fixedImages = issue.fixedImageUrls.filter(Boolean)
                          else if (typeof issue.fixedImageUrls === 'string') { try { const arr = JSON.parse(issue.fixedImageUrls); if (Array.isArray(arr)) fixedImages = arr.filter(Boolean) } catch(_) {} }
                        } else if (issue.fixedImageUrl) fixedImages = [issue.fixedImageUrl]
                        if (!fixedImages.length) return null
                        return (
                          <div className="mt-8">
                            <ImageGrid label="整改后照片" images={fixedImages} emptyText="暂无整改照片" eagerCount={1} />
                          </div>
                        )
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* 关联隐患 */}
                {selectedInspection.issue && (
                  <TabsContent value="issue" className="mt-6">
                    <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-orange-800">
                          <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                            <span className="text-orange-600 font-bold text-sm">⚠️</span>
                          </div>
                          关联隐患信息
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 text-sm w-16">状态</span>
                                <Badge 
                                  variant={selectedInspection.issue.status === 'CLOSED' ? 'success' : 'destructive'}
                                  className={`${
                                    selectedInspection.issue.status === 'CLOSED' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-orange-100 text-orange-800'
                                  }`}
                                >
                                  {selectedInspection.issue.status === 'PENDING' && '待处理'}
                                  {selectedInspection.issue.status === 'PENDING_AUDIT' && '待审核'}
                                  {selectedInspection.issue.status === 'CLOSED' && '已关闭'}
                                  {selectedInspection.issue.status === 'REJECTED' && '已驳回'}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 text-sm w-16">上报时间</span>
                                <span className="text-sm">
                                  {format(new Date(selectedInspection.issue.createdAt), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="border-t pt-4">
                            <div className="space-y-2">
                              <span className="text-gray-500 text-sm">隐患描述</span>
                              <div className="bg-white p-3 rounded-lg border border-orange-200">
                                <p className="text-gray-800">{selectedInspection.issue.description}</p>
                              </div>
                            </div>
                          </div>

                          {(() => {
                            const images = parseIssueImages(selectedInspection.issue)
                            if (!images.length) return null
                            return (
                              <div className="border-t pt-4">
                                <div className="space-y-2">
                                  <span className="text-gray-500 text-sm flex items-center gap-2">
                                    隐患照片
                                    {images.length > 1 && (
                                      <Badge variant="outline" className="text-xs">{images.length} 张</Badge>
                                    )}
                                  </span>
                                  <div className={cn('grid gap-4', images.length === 1 ? 'grid-cols-1 place-items-center' : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4')}>
                                    {images.map((url, idx) => (
                                      <div key={idx} className="relative group">
                                        <AuthenticatedImage
                                          src={url}
                                          alt={`隐患照片 ${idx + 1}`}
                                          className={cn('w-full rounded-lg border shadow-sm object-cover', images.length === 1 ? 'max-w-md max-h-72 object-contain' : 'h-40')}
                                          enableZoom={true}
                                          onOpenPreview={() => openPreview(images, idx)}
                                        />
                                        {images.length > 1 && (
                                          <div className="absolute top-1 left-1 bg-black/50 text-white text-xs px-1 rounded">{idx + 1}</div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-xs text-gray-500 text-center">点击图片可放大查看</p>
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                )}
              </Tabs>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </ContentSection>
    </PageContainer>
  )
}
