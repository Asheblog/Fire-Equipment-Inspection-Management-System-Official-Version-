import React, { useState, useEffect, useCallback, useRef } from 'react'
import { createLogger } from '@/lib/logger'
import { formatQrCodeDisplay } from '@/utils/qrCode'
import { useAuthStore } from '@/stores/auth'
import { useIssueStore } from '@/stores/issueStore'
import { issueApi, userApi, factoryApi } from '@/api'
import { isValidationError, extractValidationErrors, showValidationSummary, focusFirstError } from '@/utils/validation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MultiImageUploader } from '@/components/ui/MultiImageUploader'
import { ImageGrid } from '@/components/ui/ImageGrid'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { PageContainer, PageHeader, ContentSection } from '@/components/layout'
import { format } from 'date-fns'
import type { DateRange } from 'react-day-picker'
import { 
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  Edit,
  MapPin,
  User,
  Calendar,
  FileText,
  Upload,
  CheckCircleIcon,
  XCircle
} from 'lucide-react'
import type { Issue } from '@/types'
import type { User as SysUser, Factory } from '@/types'
import { IssueFilterPanel } from '@/components/issue/IssueFilterPanel'
import { IssueListTable } from '@/components/issue/IssueListTable'
import { IssueAnalysisDialog } from '@/components/issue/IssueAnalysisDialog'

interface IssueCardProps {
  issue: Issue
  onView: (issue: Issue) => void
  onHandle: (issue: Issue) => void
  onAudit: (issue: Issue) => void
  userRole: string
}

const IssueCard: React.FC<IssueCardProps> = ({ issue, onView, onHandle, onAudit, userRole }) => {
  const getSeverityColor = (issue: Issue) => {
    const daysOpen = Math.floor((Date.now() - new Date(issue.createdAt).getTime()) / (24 * 60 * 60 * 1000))
    if (daysOpen > 7) return 'border-l-red-500'
    if (daysOpen > 3) return 'border-l-orange-500'
    if (daysOpen > 1) return 'border-l-yellow-500'
    return 'border-l-green-500'
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge variant="warning">待处理</Badge>
      case 'PENDING_AUDIT':
        return <Badge variant="secondary">待审核</Badge>
      case 'CLOSED':
        return <Badge variant="success">已关闭</Badge>
      case 'REJECTED':
        return <Badge variant="destructive">已驳回</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const canHandle = userRole !== 'INSPECTOR' && issue.status === 'PENDING'
  const canAudit = userRole === 'SUPER_ADMIN' && issue.status === 'PENDING_AUDIT'

  return (
    <Card className={`border-l-4 ${getSeverityColor(issue)} hover:shadow-md transition-shadow`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{issue.equipment?.name}</CardTitle>
              {getStatusBadge(issue.status)}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {issue.equipment?.location}
              </div>
              <div className="flex items-center gap-1">
                <User className="h-4 w-4" />
                {issue.reporter?.fullName}
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {new Date(issue.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <Label className="text-sm font-medium">问题描述</Label>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {issue.description}
            </p>
          </div>
          
          <div>
            <Label className="text-sm font-medium">问题照片</Label>
            <div className="mt-1">
              <ImageGrid
                images={issue.issueImages || (issue.issueImageUrl ? [issue.issueImageUrl] : [])}
                emptyText="暂无问题照片"
                label={undefined}
                showCountBadge={false}
                numbered={false}
                imageClassName="w-20 h-20"
                eagerCount={3}
                layout="flow"
              />
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <div className="text-xs text-muted-foreground">
              器材编号: {formatQrCodeDisplay(issue.equipment?.qrCode)}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onView(issue)}
              >
                <Eye className="h-4 w-4 mr-1" />
                查看
              </Button>
              
              {canHandle && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onHandle(issue)}
                >
                  <Edit className="h-4 w-4 mr-1" />
                  处理
                </Button>
              )}
              
              {canAudit && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => onAudit(issue)}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  审核
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export const IssuePage: React.FC = () => {
  const log = createLogger('Issue')
  const { user } = useAuthStore()
  const {
    issues,
    loading,
    pagination,
    viewDialog,
    handleDialog,
    auditDialog,
    handleForm,
    auditForm,
    setIssues,
    setLoading,
    setPagination,
    openViewDialog,
    openHandleDialog,
    openAuditDialog,
    closeAllDialogs,
    updateHandleForm,
    updateAuditForm,
    resetForms
  } = useIssueStore()
  
  const [activeTab, setActiveTab] = useState('all')
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table')
  // 本页筛选与分析状态
  const [searchQuery, setSearchQuery] = useState('')
  // 已精简：移除严重程度与是否有图筛选
  const [overdue, setOverdue] = useState<number | undefined>(undefined)
  const [dateRange, setDateRange] = useState<DateRange | undefined>({ from: undefined, to: undefined })
  const [factoryIds, setFactoryIds] = useState<number[]>([])
  const [reporterId, setReporterId] = useState<number | undefined>(undefined)
  const [handlerId, setHandlerId] = useState<number | undefined>(undefined)
  const [sortBy, setSortBy] = useState<'createdAt'|'handledAt'>('createdAt')
  const [sortOrder, setSortOrder] = useState<'asc'|'desc'>('desc')
  const [factories, setFactories] = useState<Factory[]>([])
  const [inspectors, setInspectors] = useState<SysUser[]>([])
  const [handlers, setHandlers] = useState<SysUser[]>([])
  const [stats, setStats] = useState<any | null>(null)
  const [trend, setTrend] = useState<any[]>([])
  const [statsPeriod, setStatsPeriod] = useState<'today'|'week'|'month'|'year'>('month')
  const [trendDays, setTrendDays] = useState<number>(30)
  const [trendView, setTrendView] = useState<'stack'|'new'|'closed'>('stack')
  const [analysisOpen, setAnalysisOpen] = useState(false)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const listAbortRef = useRef<AbortController | null>(null)
  // 头部标签计数（与当前列表无关，受筛选条件影响）
  const [headerCounts, setHeaderCounts] = useState<{ pending: number; pendingAudit: number; closed: number }>({ pending: 0, pendingAudit: 0, closed: 0 })
  

  // 加载隐患列表
  const buildParams = useCallback((page: number, tabOverride?: string) => {
    const params: any = {
      page,
      limit: pagination.pageSize,
      sortBy,
      sortOrder
    }
    const mapped = mapTabToStatus(tabOverride ?? activeTab)
    if (mapped) params.status = mapped
    if (searchQuery) params.search = searchQuery
    if (typeof overdue === 'number' && overdue > 0) params.overdue = overdue
    if (factoryIds && factoryIds.length > 0) params.factoryIds = factoryIds
    if (reporterId) params.reporterId = reporterId
    if (handlerId) params.handlerId = handlerId
    if (dateRange?.from) params.startDate = format(dateRange.from, 'yyyy-MM-dd')
    if (dateRange?.to) params.endDate = format(dateRange.to, 'yyyy-MM-dd')
    return params
  }, [activeTab, pagination.pageSize, sortBy, sortOrder, searchQuery, overdue, factoryIds, reporterId, handlerId, dateRange?.from, dateRange?.to])

  const loadIssues = async (page = 1, tabOverride?: string) => {
    try {
      setLoading(true)
      if (listAbortRef.current) listAbortRef.current.abort()
      const controller = new AbortController()
      listAbortRef.current = controller
      const response = await issueApi.getList(buildParams(page, tabOverride), { signal: controller.signal })
      log.debug('加载隐患列表 响应', { ok: response.success, count: response.data?.items?.length })
      const { data } = response
      if (!controller.signal.aborted && data && Array.isArray(data.items)) {
        setIssues(data.items)
        setPagination({
          page: data.page,
          pageSize: data.pageSize,
          total: data.total,
          totalPages: data.totalPages
        })
      }
    } catch (error: any) {
      if (error?.name === 'AbortError' || error?.name === 'CanceledError') return
      log.error('加载隐患列表失败', error)
    } finally {
      setLoading(false)
    }
  }

  // 标签 -> 后端状态 映射，避免直接 toUpperCase 造成 'AUDIT' 无效
  const mapTabToStatus = (tab: string): string | undefined => {
    switch (tab) {
      case 'pending':
        return 'PENDING'
      case 'audit':
        return 'PENDING_AUDIT'
      case 'closed':
        return 'CLOSED'
      case 'all':
        return undefined
      default:
        return undefined
    }
  }

  // 标签页切换
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    loadIssues(1, value)
    refreshHeaderCounts()
  }

  // 处理隐患
  const handleIssueSubmit = async () => {
    if (!handleDialog.issue) return
    
    try {
      updateHandleForm({ uploading: true })
      
      await issueApi.handle(handleDialog.issue.id, {
        solution: handleForm.solution,
        // 多图字段（新）
        fixedImageUrls: handleForm.fixedImages,
        // 向下兼容旧字段
        fixedImageUrl: handleForm.fixedImages[0] || ''
      })
      
      closeAllDialogs()
      resetForms()
      // 使用映射函数，修复原 toUpperCase 导致 'audit' -> 'AUDIT' 刷新失败
      loadIssues(pagination.page, activeTab)
      refreshHeaderCounts()
    } catch (error: any) {
      log.error('处理隐患失败', error)
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
      }
    } finally {
      updateHandleForm({ uploading: false })
    }
  }

  // 审核隐患
  const handleAuditSubmit = async () => {
    if (!auditDialog.issue) return
    
    try {
      await issueApi.audit(auditDialog.issue.id, {
        approved: auditForm.approved,
        auditComments: auditForm.auditNote
      })
      
      closeAllDialogs()
      resetForms()
      // 刷新当前列表
      loadIssues(pagination.page, activeTab)
      refreshHeaderCounts()
    } catch (error: any) {
      log.error('审核隐患失败', error)
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
      }
    }
  }

  // 初始化筛选选项
  useEffect(() => {
    (async () => {
      try {
        if (user?.role !== 'INSPECTOR') {
          const [factoryRes, inspectorRes, handlerRes] = await Promise.all([
            factoryApi.getList(),
            userApi.getList({ role: 'INSPECTOR' }),
            userApi.getList({ role: 'FACTORY_ADMIN' })
          ])
          if (factoryRes.success && Array.isArray(factoryRes.data)) setFactories(factoryRes.data)
          if (inspectorRes.success) {
            const items = (inspectorRes.data as any).items || inspectorRes.data
            if (Array.isArray(items)) setInspectors(items)
          }
          if (handlerRes.success) {
            const items = (handlerRes.data as any).items || handlerRes.data
            if (Array.isArray(items)) setHandlers(items)
          }
        }
      } catch (e) { /* ignore */ }
    })()
  }, [user?.role])

  // 首次加载只加载列表，分析数据在首次打开弹窗时再加载
  useEffect(() => {
    loadIssues(1, activeTab)
    refreshHeaderCounts()
    return () => {
      if (listAbortRef.current) {
        listAbortRef.current.abort()
        listAbortRef.current = null
      }
    }
  }, [])

  const loadStatsAndTrend = async () => {
    setAnalysisLoading(true)
    try {
      const base = buildParams(1)
      // 移除分页
      delete (base as any).page
      delete (base as any).limit
      const [statsRes, trendRes] = await Promise.all([
        issueApi.getStats({ period: statsPeriod, ...(base as any) }),
        issueApi.getTrend({ days: trendDays, ...(base as any) })
      ])
      if ((statsRes as any).success) setStats((statsRes as any).data)
      if ((trendRes as any).success) setTrend(((trendRes as any).data) || [])
    } catch (e) {
      log.error('加载统计/趋势失败', e)
    } finally {
      setAnalysisLoading(false)
    }
  }

  // 刷新头部标签计数（不携带 status，按当前筛选条件统计）
  const refreshHeaderCounts = useCallback(async () => {
    try {
      const base = buildParams(1, 'all') as any
      delete base.page
      delete base.limit
      delete base.status
      const res: any = await issueApi.getStats(base)
      if (res?.success && res.data) {
        const by = res.data.byStatus || {}
        setHeaderCounts({
          pending: Number(by.pending || 0),
          pendingAudit: Number(by.pendingAudit || 0),
          closed: Number(by.closed || 0)
        })
      }
    } catch (e) {
      // ignore
    }
  }, [buildParams])

  const applyFilters = () => {
    setPagination({ ...pagination, page: 1 })
    loadIssues(1, activeTab)
    refreshHeaderCounts()
    if (analysisOpen || stats) {
      loadStatsAndTrend()
    }
  }

  const handleAnalysisOpenChange = (open: boolean) => {
    if (open && !stats) {
      loadStatsAndTrend()
    }
    setAnalysisOpen(open)
  }

  const handleExport = async () => {
    try {
      const payload: any = buildParams(1)
      delete payload.page
      delete payload.limit
      const res = await issueApi.exportList({ format: 'excel', ...(payload as any) })
      if ((res as any).success && (res as any).data?.downloadUrl) {
        window.open((res as any).data.downloadUrl, '_blank')
      }
    } catch (e) { log.error('导出失败', e) }
  }

  const resetFilters = () => {
    setSearchQuery('')
    setOverdue(undefined)
    setDateRange({ from: undefined, to: undefined })
    setFactoryIds([])
    setReporterId(undefined)
    setHandlerId(undefined)
    setSortBy('createdAt')
    setSortOrder('desc')
  }

  const pendingCount = headerCounts.pending
  const auditCount = headerCounts.pendingAudit
  const closedCount = headerCounts.closed

  return (
    <PageContainer>
      <PageHeader 
        title="隐患管理"
        description="消防器材隐患处理和审核管理"
      />

      <ContentSection>
        {/* 视图切换 */}
        <div className="flex items-center justify-end mb-2 gap-2">
          <Button
            size="sm"
            variant={viewMode === 'table' ? 'default' : 'outline'}
            onClick={() => setViewMode('table')}
          >
            表格视图
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'card' ? 'default' : 'outline'}
            onClick={() => setViewMode('card')}
          >
            卡片视图
          </Button>
        </div>

        <IssueFilterPanel
          userRole={user?.role}
          searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          dateRange={dateRange}
            onDateRangeChange={setDateRange}
          overdue={overdue}
            onOverdueChange={setOverdue}
          sortBy={sortBy}
            onSortByChange={setSortBy}
          sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
          factoryIds={factoryIds}
            onFactoryIdsChange={setFactoryIds}
          reporterId={reporterId}
            onReporterIdChange={setReporterId}
          handlerId={handlerId}
            onHandlerIdChange={setHandlerId}
          factories={factories}
          inspectors={inspectors}
          handlers={handlers}
          onApply={applyFilters}
          onReset={resetFilters}
          onExport={handleExport}
          onOpenAnalysis={() => handleAnalysisOpenChange(true)}
        />

        <IssueAnalysisDialog
          open={analysisOpen}
          onOpenChange={handleAnalysisOpenChange}
          stats={stats}
          trend={trend}
          statsPeriod={statsPeriod}
          trendDays={trendDays}
          trendView={trendView}
          onStatsPeriodChange={(v)=> { setStatsPeriod(v); loadStatsAndTrend(); }}
          onTrendDaysChange={(v)=> { setTrendDays(v); loadStatsAndTrend(); }}
          onTrendViewChange={setTrendView}
          onRefresh={loadStatsAndTrend}
          loading={analysisLoading}
        />

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            待处理
            {pendingCount > 0 && (
              <Badge variant="secondary" className="ml-1">{pendingCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            待审核
            {auditCount > 0 && (
              <Badge variant="secondary" className="ml-1">{auditCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="closed" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            已关闭
            {closedCount > 0 && (
              <Badge variant="secondary" className="ml-1">{closedCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            全部
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : viewMode === 'table' ? (
            <>
              <IssueListTable
                issues={Array.isArray(issues) ? issues : []}
                userRole={user?.role}
                onView={(issue) => openViewDialog(issue)}
                onHandle={(issue) => openHandleDialog(issue)}
                onAudit={(issue) => openAuditDialog(issue)}
              />

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">每页</span>
                  <Select value={String(pagination.pageSize)} onValueChange={(v) => { const size = parseInt(v); setPagination({ ...pagination, page: 1, pageSize: size }); loadIssues(1) }}>
                    <SelectTrigger className="h-9 w-[88px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {pagination.totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      disabled={pagination.page <= 1}
                      onClick={() => loadIssues(pagination.page - 1)}
                    >
                      上一页
                    </Button>
                    <span className="px-4 py-2 text-sm">
                      第 {pagination.page} 页 / 共 {pagination.totalPages} 页
                    </span>
                    <Button
                      variant="outline"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => loadIssues(pagination.page + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-4">
                {(Array.isArray(issues) ? issues : []).map((issue) => (
                  <IssueCard
                    key={issue.id}
                    issue={issue}
                    onView={(issue) => openViewDialog(issue)}
                    onHandle={(issue) => openHandleDialog(issue)}
                    onAudit={(issue) => openAuditDialog(issue)}
                    userRole={user?.role || ''}
                  />
                ))}
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">每页</span>
                  <Select value={String(pagination.pageSize)} onValueChange={(v) => { const size = parseInt(v); setPagination({ ...pagination, page: 1, pageSize: size }); loadIssues(1) }}>
                    <SelectTrigger className="h-9 w-[88px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {pagination.totalPages > 1 && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      disabled={pagination.page <= 1}
                      onClick={() => loadIssues(pagination.page - 1)}
                    >
                      上一页
                    </Button>
                    <span className="px-4 py-2 text-sm">
                      第 {pagination.page} 页 / 共 {pagination.totalPages} 页
                    </span>
                    <Button
                      variant="outline"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => loadIssues(pagination.page + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </TabsContent>
        </Tabs>
      </ContentSection>

      {/* 查看详情对话框 */}
      <Dialog open={viewDialog.open} onOpenChange={(open) => !open && closeAllDialogs()}>
        <DialogContent className="max-w-2xl w-[96vw] overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>隐患详情 #{viewDialog.issue?.id}</DialogTitle>
          </DialogHeader>
          
          {viewDialog.issue && (
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
                      <span className="text-gray-500 text-sm w-16">名称</span>
                      <span className="font-medium">{viewDialog.issue.equipment?.name || '未知器材'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm w-16">位置</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{viewDialog.issue.equipment?.location || '未知位置'}</span>
                        <span className="text-xs text-gray-400">📍</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm w-16">上报人</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{viewDialog.issue.reporter?.fullName}</span>
                        <span className="text-xs text-gray-400">👤</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm w-16">上报时间</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {new Date(viewDialog.issue.createdAt).toLocaleString('zh-CN')}
                        </span>
                        <span className="text-xs text-gray-400">🕐</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 隐患状态卡片 */}
              <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-orange-800">
                    <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                      <span className="text-orange-600 font-bold text-sm">⚠️</span>
                    </div>
                    隐患信息
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-sm w-16">状态</span>
                    <div>
                      {(() => {
                        switch (viewDialog.issue.status) {
                          case 'PENDING':
                            return <Badge className="bg-orange-100 text-orange-800 border-orange-300">⏳ 待处理</Badge>
                          case 'IN_PROGRESS':
                            return <Badge className="bg-blue-100 text-blue-800 border-blue-300">🔄 处理中</Badge>
                          case 'PENDING_AUDIT':
                            return <Badge className="bg-purple-100 text-purple-800 border-purple-300">👁️ 待审核</Badge>
                          case 'CLOSED':
                            return <Badge className="bg-green-100 text-green-800 border-green-300">✅ 已关闭</Badge>
                          case 'REJECTED':
                            return <Badge className="bg-red-100 text-red-800 border-red-300">❌ 已驳回</Badge>
                          default:
                            return <Badge variant="secondary">{viewDialog.issue.status}</Badge>
                        }
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 隐患描述卡片 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-lg">📝</span>
                    <span>问题描述</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p className="text-gray-800 leading-relaxed">{viewDialog.issue.description}</p>
                  </div>
                </CardContent>
              </Card>

              {/* 问题照片 - 使用 ImageGrid */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-lg">📸</span>
                    <span>问题照片</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ImageGrid
                    images={viewDialog.issue.issueImages || (viewDialog.issue.issueImageUrl ? [viewDialog.issue.issueImageUrl] : [])}
                    emptyText="暂无问题照片"
                    label={undefined}
                    eagerCount={3}
                  />
                </CardContent>
              </Card>

              {/* 处理方案 */}
              {viewDialog.issue.solution && (
                <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-green-800">
                      <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                        <span className="text-green-600 font-bold text-sm">✅</span>
                      </div>
                      处理方案
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-white p-4 rounded-lg border border-green-200">
                      <p className="text-gray-800 leading-relaxed">{viewDialog.issue.solution}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 整改后照片 - 使用 ImageGrid */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-lg">📸</span>
                    <span>整改后照片</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ImageGrid
                    images={viewDialog.issue.fixedImages || (viewDialog.issue.fixedImageUrl ? [viewDialog.issue.fixedImageUrl] : [])}
                    emptyText="暂无整改照片"
                    label={undefined}
                    eagerCount={2}
                  />
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 处理隐患对话框 */}
      <Dialog open={handleDialog.open} onOpenChange={(open) => !open && closeAllDialogs()}>
        <DialogContent className="max-w-lg w-[92vw] overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>处理隐患</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="solution">处理方案 *</Label>
              <Textarea
                id="solution"
                placeholder="请详细描述处理方案..."
                value={handleForm.solution}
                onChange={(e) => updateHandleForm({ solution: e.target.value })}
                className="mt-1"
                rows={4}
              />
            </div>
            
            <div>
              <MultiImageUploader
                images={handleForm.fixedImages}
                onImagesChange={(images) => updateHandleForm({ fixedImages: images })}
                title="整改后照片"
                description="请上传整改后的照片，最多9张"
                maxImages={9}
                disabled={handleForm.uploading}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeAllDialogs()}
            >
              取消
            </Button>
            <Button
              onClick={handleIssueSubmit}
              disabled={!handleForm.solution.trim() || handleForm.uploading}
            >
              {handleForm.uploading ? (
                <Upload className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircleIcon className="h-4 w-4 mr-2" />
              )}
              提交处理
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 审核隐患对话框 */}
      <Dialog open={auditDialog.open} onOpenChange={(open) => !open && closeAllDialogs()}>
        <DialogContent className="max-w-lg w-[92vw] overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>审核隐患处理</DialogTitle>
          </DialogHeader>
          
          {auditDialog.issue && (
            <div className="space-y-4">
              <div>
                <Label>处理方案</Label>
                <p className="text-sm text-muted-foreground mt-1 p-2 bg-muted rounded">
                  {auditDialog.issue.solution || '暂无处理方案'}
                </p>
              </div>
              
              <div>
                <Label>整改后照片</Label>
                <div className="mt-2">
                  <ImageGrid
                    images={auditDialog.issue?.fixedImages || (auditDialog.issue?.fixedImageUrl ? [auditDialog.issue.fixedImageUrl] : [])}
                    emptyText="暂无整改照片"
                    label={undefined}
                  />
                </div>
              </div>
              
              <div className="flex gap-4">
                <Button
                  variant={auditForm.approved ? "default" : "outline"}
                  onClick={() => updateAuditForm({ approved: true })}
                  className="flex-1"
                >
                  <CheckCircleIcon className="h-4 w-4 mr-2" />
                  通过
                </Button>
                <Button
                  variant={!auditForm.approved ? "destructive" : "outline"}
                  onClick={() => updateAuditForm({ approved: false })}
                  className="flex-1"
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  驳回
                </Button>
              </div>
              
              <div>
                <Label htmlFor="auditNote">审核备注</Label>
                <Textarea
                  id="auditNote"
                  placeholder="请输入审核意见..."
                  value={auditForm.auditNote}
                  onChange={(e) => updateAuditForm({ auditNote: e.target.value })}
                  className="mt-1"
                  rows={3}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => closeAllDialogs()}
            >
              取消
            </Button>
            <Button
              onClick={handleAuditSubmit}
              variant={auditForm.approved ? "default" : "destructive"}
            >
              {auditForm.approved ? (
                <CheckCircleIcon className="h-4 w-4 mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              确认{auditForm.approved ? '通过' : '驳回'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
