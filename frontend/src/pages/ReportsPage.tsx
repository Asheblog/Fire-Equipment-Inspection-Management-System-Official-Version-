import React, { useState, useEffect } from 'react'
import { createLogger } from '@/lib/logger'
import { useAuthStore } from '@/stores/auth'
import { reportApi } from '@/api'
// 直链下载已由后端签名URL支持，无需额外鉴权fetch
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { PageContainer, PageHeader, ContentSection } from '@/components/layout'
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  ComposedChart, Area
} from 'recharts'
import {
  BarChart3,
  TrendingUp,
  FileText,
  Filter,
  RefreshCw,
  PieChart as PieChartIcon,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Shield,
  FileSpreadsheet,
  Eye
} from 'lucide-react'
import type { MonthlyReport, ReportExportRequest } from '@/types'

export const ReportsPage: React.FC = () => {
  const log = createLogger('Reports')
  const { user } = useAuthStore()
  
  const [loading, setLoading] = useState(false)
  const [monthlyReport, setMonthlyReport] = useState<MonthlyReport | null>(null)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1)
  const [activeTab, setActiveTab] = useState('overview')
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  // 生成年份和月份选项
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 3 }, (_, i) => currentYear - i)
  const months = Array.from({ length: 12 }, (_, i) => i + 1)

  // 加载月度报表数据
  const loadMonthlyReport = async () => {
    try {
      setLoading(true)
      setError('')
      
      const response = await reportApi.getMonthlyReport(selectedYear, selectedMonth)
      
      if (response.success && response.data) {
        setMonthlyReport(response.data)
      } else {
        setError(response.message || '加载报表失败')
      }
    } catch (err: any) {
      log.error('加载月度报表失败', err)
      setError(err.response?.data?.message || '加载报表失败')
    } finally {
      setLoading(false)
    }
  }

  // 导出报表
  const handleExport = async (format: 'excel' | 'pdf') => {
    try {
      setExporting(true)
      
      const exportRequest: ReportExportRequest = {
        reportType: 'monthly',
        year: selectedYear,
        month: selectedMonth,
        format
      }

      const response = await reportApi.exportReport(exportRequest)
      
      if (response.success && response.data?.downloadUrl) {
        // 使用签名直链下载（无需Authorization）
        const link = document.createElement('a')
        link.href = response.data.downloadUrl
        link.download = response.data.filename || `月度报表_${selectedYear}-${selectedMonth.toString().padStart(2, '0')}.${format}`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        setError('导出失败: ' + (response.message || '未知错误'))
      }
    } catch (err: any) {
      log.error('导出报表失败', err)
      setError('导出失败: ' + (err.response?.data?.message || '网络错误'))
    } finally {
      setExporting(false)
    }
  }

  // 预览报表
  const handlePreview = async () => {
    try {
      setLoading(true)
      const response = await reportApi.previewReport({
        reportType: 'monthly',
        year: selectedYear,
        month: selectedMonth,
        format: 'html'
      })
      
      if (response.success && response.data?.previewUrl) {
        // 打开签名直链（inline）
        window.open(response.data.previewUrl, '_blank')
      }
    } catch (err: any) {
      log.error('预览报表失败', err)
      setError('预览失败: ' + (err.response?.data?.message || '网络错误'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMonthlyReport()
  }, [selectedYear, selectedMonth])

  // 图表颜色配置
  const COLORS = {
    primary: '#3B82F6',
    success: '#22C55E', 
    warning: '#F59E0B',
    danger: '#EF4444',
    info: '#06B6D4',
    muted: '#64748B'
  }

  const pieColors = [COLORS.success, COLORS.warning, COLORS.danger, COLORS.info]

  if (loading && !monthlyReport) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">加载报表数据中...</p>
          </div>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader 
        title="报表中心"
        description="消防器材管理数据分析与报表生成"
      >
        <Button
          onClick={handlePreview}
          variant="outline"
          disabled={loading || !monthlyReport}
          className="flex items-center space-x-2"
        >
          <Eye className="h-4 w-4" />
          <span>在线预览</span>
        </Button>
        
        <Button
          onClick={() => handleExport('excel')}
          disabled={exporting || !monthlyReport}
          variant="outline"
          className="flex items-center space-x-2"
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>导出Excel</span>
        </Button>
        
        <Button
          onClick={() => handleExport('pdf')}
          disabled={exporting || !monthlyReport}
          className="flex items-center space-x-2"
        >
          <FileText className="h-4 w-4" />
          <span>导出PDF</span>
        </Button>
      </PageHeader>

      <ContentSection>
        {/* 筛选控件 */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Label>报表筛选</Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Label htmlFor="year-select">年份:</Label>
                <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
                  <SelectTrigger id="year-select" className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map(year => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center space-x-2">
                <Label htmlFor="month-select">月份:</Label>
                <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(parseInt(value))}>
                  <SelectTrigger id="month-select" className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map(month => (
                      <SelectItem key={month} value={month.toString()}>{month}月</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <Button
                onClick={loadMonthlyReport}
                disabled={loading}
                size="sm"
                className="flex items-center space-x-1"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>刷新</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 错误提示 */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 报表内容 */}
        {monthlyReport && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>数据概览</span>
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>趋势分析</span>
            </TabsTrigger>
            <TabsTrigger value="rankings" className="flex items-center space-x-2">
              <PieChartIcon className="h-4 w-4" />
              <span>排行榜</span>
            </TabsTrigger>
            <TabsTrigger value="details" className="flex items-center space-x-2">
              <Activity className="h-4 w-4" />
              <span>详细数据</span>
            </TabsTrigger>
          </TabsList>

          {/* 数据概览 */}
          <TabsContent value="overview" className="space-y-6">
            {/* 核心指标卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">器材总数</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{monthlyReport.summary.equipment.total}</div>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                    <Badge variant="success" className="text-xs">
                      正常 {monthlyReport.summary.equipment.normal}
                    </Badge>
                    <Badge variant="warning" className="text-xs">
                      异常 {monthlyReport.summary.equipment.abnormal}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">本月点检</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{monthlyReport.summary.inspection.total}</div>
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-1">
                    <TrendingUp className="h-3 w-3" />
                    <span>合格率 {monthlyReport.summary.inspection.passRate}%</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">隐患处理</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {monthlyReport.summary.issue.pending}
                  </div>
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    <span>处理率 {monthlyReport.summary.issue.resolveRate}%</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">健康度</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {monthlyReport.summary.equipment.healthRate}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    器材整体健康状况
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 器材状态分布图 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>器材状态分布</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: '正常', value: monthlyReport.summary.equipment.normal, color: COLORS.success },
                          { name: '异常', value: monthlyReport.summary.equipment.abnormal, color: COLORS.warning },
                          { name: '报废', value: monthlyReport.summary.equipment.scrapped || 0, color: COLORS.danger },
                          { name: '过期', value: monthlyReport.summary.equipment.expired || 0, color: COLORS.muted }
                        ]}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => 
                          `${name} ${((percent || 0) * 100).toFixed(0)}%`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {[
                          { name: '正常', value: monthlyReport.summary.equipment.normal },
                          { name: '异常', value: monthlyReport.summary.equipment.abnormal },
                          { name: '报废', value: monthlyReport.summary.equipment.scrapped || 0 },
                          { name: '过期', value: monthlyReport.summary.equipment.expired || 0 }
                        ].map((_, index) => (
                          <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>点检与隐患统计</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={[
                        {
                          name: '点检数据',
                          正常: monthlyReport.summary.inspection.normal,
                          异常: monthlyReport.summary.inspection.abnormal
                        },
                        {
                          name: '隐患数据',
                          已处理: monthlyReport.summary.issue.closed,
                          待处理: monthlyReport.summary.issue.pending
                        }
                      ]}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="正常" fill={COLORS.success} />
                      <Bar dataKey="异常" fill={COLORS.warning} />
                      <Bar dataKey="已处理" fill={COLORS.info} />
                      <Bar dataKey="待处理" fill={COLORS.danger} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 趋势分析 */}
          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>每日点检趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <ComposedChart data={monthlyReport.trends.dailyInspections}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="total" fill={COLORS.primary} fillOpacity={0.3} stroke={COLORS.primary} name="总计" />
                    <Bar dataKey="normal" fill={COLORS.success} name="正常" />
                    <Bar dataKey="abnormal" fill={COLORS.warning} name="异常" />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 排行榜 */}
          <TabsContent value="rankings" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 器材类型排行 */}
              <Card>
                <CardHeader>
                  <CardTitle>器材类型点检排行</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {monthlyReport.rankings.equipmentTypes.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Badge variant={index < 3 ? "default" : "secondary"} className="w-6 h-6 p-0 flex items-center justify-center">
                            {index + 1}
                          </Badge>
                          <span className="font-medium">{item.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{item.inspectionCount}</div>
                          <div className="text-xs text-muted-foreground">{item.equipmentCount} 台器材</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* 点检员绩效排行 */}
              <Card>
                <CardHeader>
                  <CardTitle>点检员绩效排行</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {monthlyReport.rankings.inspectors.map((inspector, index) => (
                      <div key={inspector.name} className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Badge variant={index < 3 ? "default" : "secondary"} className="w-6 h-6 p-0 flex items-center justify-center">
                            {index + 1}
                          </Badge>
                          <span className="font-medium">{inspector.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">{inspector.totalInspections}</div>
                          <div className="text-xs text-muted-foreground">
                            正常: {inspector.normalInspections} | 异常: {inspector.abnormalInspections}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* 详细数据 */}
          <TabsContent value="details" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">报表信息</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">报表时间:</span>
                    <span>{selectedYear}年{selectedMonth}月</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">生成时间:</span>
                    <span>{new Date(monthlyReport.generatedAt).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">数据范围:</span>
                    <span>
                      {new Date(monthlyReport.reportDate.startDate).toLocaleDateString()} - 
                      {new Date(monthlyReport.reportDate.endDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">查看权限:</span>
                    <span>
                      {user?.role === 'SUPER_ADMIN' ? '全部厂区' : 
                       user?.role === 'FACTORY_ADMIN' ? '所属厂区' : '受限'}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">器材统计详情</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">器材总数:</span>
                    <span className="font-semibold">{monthlyReport.summary.equipment.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">正常器材:</span>
                    <span className="text-green-600">{monthlyReport.summary.equipment.normal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">异常器材:</span>
                    <span className="text-orange-600">{monthlyReport.summary.equipment.abnormal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">即将过期:</span>
                    <span className="text-yellow-600">{monthlyReport.summary.equipment.expiring || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">已过期:</span>
                    <span className="text-red-600">{monthlyReport.summary.equipment.expired || 0}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-muted-foreground">健康率:</span>
                    <span className="text-green-600">{monthlyReport.summary.equipment.healthRate}%</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">点检统计详情</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">总点检数:</span>
                    <span className="font-semibold">{monthlyReport.summary.inspection.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">正常点检:</span>
                    <span className="text-green-600">{monthlyReport.summary.inspection.normal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">异常点检:</span>
                    <span className="text-orange-600">{monthlyReport.summary.inspection.abnormal}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-muted-foreground">合格率:</span>
                    <span className="text-green-600">{monthlyReport.summary.inspection.passRate}%</span>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">隐患总数:</span>
                      <span className="font-semibold">{monthlyReport.summary.issue.total}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">已处理:</span>
                      <span className="text-blue-600">{monthlyReport.summary.issue.closed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">待处理:</span>
                      <span className="text-orange-600">{monthlyReport.summary.issue.pending}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          </Tabs>
        )}
      </ContentSection>
    </PageContainer>
  )
}
