import React from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { RotateCw } from 'lucide-react'

/**
 * 隐患分析弹窗
 * 将原先内联在 IssuePage 中的“统计指标 + 趋势图”抽离成独立组件。
 * 支持：
 *  - 指标总览
 *  - 趋势图（堆叠 / 新增 / 关闭）
 *  - 统计周期、趋势天数、视图切换
 *  - 手动刷新
 */

export interface IssueAnalysisDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void

  // 数据
  stats: any | null
  trend: any[]

  // 控制参数
  statsPeriod: 'today' | 'week' | 'month' | 'year'
  trendDays: number
  trendView: 'stack' | 'new' | 'closed'

  // 修改回调
  onStatsPeriodChange: (v: 'today' | 'week' | 'month' | 'year') => void
  onTrendDaysChange: (v: number) => void
  onTrendViewChange: (v: 'stack' | 'new' | 'closed') => void

  // 触发刷新（重新加载统计与趋势）
  onRefresh: () => void

  loading?: boolean
}

export const IssueAnalysisDialog: React.FC<IssueAnalysisDialogProps> = ({
  open,
  onOpenChange,
  stats,
  trend,
  statsPeriod,
  trendDays,
  trendView,
  onStatsPeriodChange,
  onTrendDaysChange,
  onTrendViewChange,
  onRefresh,
  loading
}) => {
  const hasTrend = Array.isArray(trend) && trend.length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">数据分析图表</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 指标概览 */}
            {stats ? (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                <Card className="text-center">
                  <CardContent className="p-4 h-full flex flex-col justify-center">
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-xs md:text-sm text-gray-600">隐患总数</div>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="p-4 h-full flex flex-col justify-center">
                    <div className="text-2xl font-bold text-orange-600">{stats.byStatus?.pending || 0}</div>
                    <div className="text-xs md:text-sm text-gray-600">待处理</div>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="p-4 h-full flex flex-col justify-center">
                    <div className="text-2xl font-bold text-purple-600">{stats.byStatus?.pendingAudit || 0}</div>
                    <div className="text-xs md:text-sm text-gray-600">待审核</div>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="p-4 h-full flex flex-col justify-center">
                    <div className="text-2xl font-bold text-green-600">{stats.byStatus?.closed || 0}</div>
                    <div className="text-xs md:text-sm text-gray-600">已关闭</div>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="p-4 h-full flex flex-col justify-center">
                    <div className="text-2xl font-bold text-blue-600">{stats.resolveRate}%</div>
                    <div className="text-xs md:text-sm text-gray-600">解决率</div>
                  </CardContent>
                </Card>
                <Card className="text-center">
                  <CardContent className="p-4 h-full flex flex-col justify-center">
                    <div className="text-2xl font-bold text-emerald-600">{stats.avgProcessingTime}天</div>
                    <div className="text-xs md:text-sm text-gray-600">平均处理天数</div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">暂无统计数据</div>
            )}

          {/* 趋势图 + 控制条 */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <CardTitle className="text-sm">隐患趋势</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={statsPeriod} onValueChange={(v:any)=> onStatsPeriodChange(v)}>
                    <SelectTrigger className="w-28 h-8">
                      <SelectValue placeholder="统计周期" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">今日</SelectItem>
                      <SelectItem value="week">近7天</SelectItem>
                      <SelectItem value="month">近30天</SelectItem>
                      <SelectItem value="year">近一年</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={String(trendDays)} onValueChange={(v:any)=> onTrendDaysChange(parseInt(v))}>
                    <SelectTrigger className="w-24 h-8">
                      <SelectValue placeholder="天数" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7天</SelectItem>
                      <SelectItem value="30">30天</SelectItem>
                      <SelectItem value="90">90天</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={trendView} onValueChange={(v:any)=> onTrendViewChange(v)}>
                    <SelectTrigger className="w-24 h-8">
                      <SelectValue placeholder="视图" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stack">堆叠</SelectItem>
                      <SelectItem value="new">新增</SelectItem>
                      <SelectItem value="closed">关闭</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={onRefresh}
                    disabled={loading}
                  >
                    <RotateCw className={`w-4 h-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                    刷新
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-52 text-sm text-muted-foreground">加载中...</div>
              ) : hasTrend ? (
                <div className="h-60">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      {trendView === 'stack' ? (
                        <>
                          <Bar dataKey="pending" stackId="a" fill="#f59e0b" name="待处理" />
                          <Bar dataKey="closed" stackId="a" fill="#34d399" name="已关闭" />
                        </>
                      ) : trendView === 'new' ? (
                        <Bar dataKey="total" fill="#60a5fa" name="新增" />
                      ) : (
                        <Bar dataKey="closed" fill="#34d399" name="已关闭" />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex items-center justify-center h-52 text-sm text-muted-foreground">暂无趋势数据</div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default IssueAnalysisDialog
