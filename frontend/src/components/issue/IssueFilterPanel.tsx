import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar as CalendarUI } from '@/components/ui/calendar'
import { Search, Calendar as CalendarIcon, Download } from 'lucide-react'
import type { DateRange } from 'react-day-picker'
import type { User as SysUser, Factory } from '@/types'

/**
 * 统一高度样式说明：
 * - 所有可交互控件均应用 h-9（shadcn 默认触发器高度）
 * - 使用 grid 统一列宽，不再手写 w-64 / w-56 / w-40 等杂项宽度
 * - 响应式：移动 1 列；中屏 2 列；超宽 4 列
 * - 操作按钮固定在卡片底部右下，避免穿插在字段中
 * - 预留“高级筛选”折叠区域挂载点（后续扩展）
 */

export interface IssueFilterPanelProps {
  userRole?: string

  searchQuery: string
  onSearchChange: (v: string) => void

  dateRange: DateRange | undefined
  onDateRangeChange: (r: DateRange | undefined) => void

  overdue: number | undefined
  onOverdueChange: (v: number | undefined) => void

  sortBy: 'createdAt' | 'handledAt'
  onSortByChange: (v: 'createdAt' | 'handledAt') => void

  sortOrder: 'asc' | 'desc'
  onSortOrderChange: (v: 'asc' | 'desc') => void

  factoryIds: number[]
  onFactoryIdsChange: (ids: number[]) => void

  reporterId?: number
  onReporterIdChange: (id: number | undefined) => void

  handlerId?: number
  onHandlerIdChange: (id: number | undefined) => void

  factories: Factory[]
  inspectors: SysUser[]
  handlers: SysUser[]

  onApply: () => void
  onReset: () => void
  onExport: () => void
  onOpenAnalysis?: () => void
}

export const IssueFilterPanel: React.FC<IssueFilterPanelProps> = ({
  userRole,
  searchQuery,
  onSearchChange,
  dateRange,
  onDateRangeChange,
  overdue,
  onOverdueChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderChange,
  factoryIds,
  onFactoryIdsChange,
  reporterId,
  onReporterIdChange,
  handlerId,
  onHandlerIdChange,
  factories,
  inspectors,
  handlers,
  onApply,
  onReset,
  onExport,
  onOpenAnalysis
}) => {
  const isInspector = userRole === 'INSPECTOR'

  const toggleFactory = (id: number, checked: boolean | string) => {
    onFactoryIdsChange(
      checked
        ? Array.from(new Set([...factoryIds, id]))
        : factoryIds.filter(f => f !== id)
    )
  }

  const factoryCountLabel = factoryIds.length > 0 ? `已选厂区(${factoryIds.length})` : '选择厂区(多选)'

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">筛选条件</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 基础筛选区：统一使用 grid 布局 */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* 关键词搜索 */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="搜索描述、设备、位置、二维码、上报人"
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                className="pl-9 h-9"
              />
            </div>

          {/* 日期范围 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="justify-start text-left font-normal h-9"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <span>
                      {dateRange.from.toLocaleDateString()} - {dateRange.to.toLocaleDateString()}
                    </span>
                  ) : (
                    <span>{dateRange.from.toLocaleDateString()}</span>
                  )
                ) : (
                  <span className="text-muted-foreground">选择时间范围</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarUI
                initialFocus
                mode="range"
                selected={dateRange}
                onSelect={onDateRangeChange}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          {/* 超期天数 */}
          <div className="flex items-center gap-2">
            <Label htmlFor="overdue" className="whitespace-nowrap text-sm">超期(天)</Label>
            <Input
              id="overdue"
              type="number"
              className="h-9 w-full"
              value={overdue ?? ''}
              onChange={e => onOverdueChange(e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="不限"
            />
          </div>

          {/* 排序字段 */}
          <Select value={sortBy} onValueChange={v => onSortByChange(v as 'createdAt' | 'handledAt')}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="排序字段" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">创建时间</SelectItem>
              <SelectItem value="handledAt">处理时间</SelectItem>
            </SelectContent>
          </Select>

          {/* 排序方向 */}
          <Select value={sortOrder} onValueChange={v => onSortOrderChange(v as 'asc' | 'desc')}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="排序" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="desc">降序</SelectItem>
              <SelectItem value="asc">升序</SelectItem>
            </SelectContent>
          </Select>

          {/* 非点检员可见的扩展字段 */}
          {!isInspector && (
            <React.Fragment>
              {/* 厂区多选 */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start h-9">
                    {factoryCountLabel}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64">
                  <div className="flex items-center justify-between mb-2">
                    <Button
                      size="sm"
                      onClick={() => onFactoryIdsChange(factories.map(f => f.id))}
                    >全选</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onFactoryIdsChange([])}
                    >清空</Button>
                  </div>
                  <div className="flex flex-col gap-2 max-h-60 overflow-auto pr-1">
                    {factories.map(f => (
                      <label key={f.id} className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={factoryIds.includes(f.id)}
                          onCheckedChange={checked => toggleFactory(f.id, checked)}
                        />
                        <span>{f.name}</span>
                      </label>
                    ))}
                    {factories.length === 0 && (
                      <div className="text-xs text-muted-foreground">无可选厂区</div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* 上报人 */}
              <Select
                value={reporterId ? String(reporterId) : undefined}
                onValueChange={v => onReporterIdChange(v === '__ALL__' ? undefined : (v ? parseInt(v) : undefined))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="上报人" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">全部</SelectItem>
                  {inspectors.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* 处理人 */}
              <Select
                value={handlerId ? String(handlerId) : undefined}
                onValueChange={v => onHandlerIdChange(v === '__ALL__' ? undefined : (v ? parseInt(v) : undefined))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="处理人" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__ALL__">全部</SelectItem>
                  {handlers.map(u => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </React.Fragment>
          )}
        </div>

        {/* 已选厂区 Chips */}
        {!isInspector && factoryIds.length > 0 && (
          <div className="flex flex-wrap gap-2 border rounded-md p-2 bg-muted/30">
            {factoryIds.map(fid => {
              const f = factories.find(ff => ff.id === fid)
              if (!f) return null
              return (
                <span
                  key={fid}
                  className="inline-flex items-center gap-1 text-xs bg-white border rounded px-2 py-0.5 shadow-sm"
                >
                  {f.name}
                  <button
                    className="text-gray-400 hover:text-gray-600"
                    onClick={() => onFactoryIdsChange(factoryIds.filter(id => id !== fid))}
                    aria-label="移除厂区"
                  >
                    ×
                  </button>
                </span>
              )
            })}
          </div>
        )}

        {/* 操作按钮区 */}
        <div className="flex justify-end gap-3 pt-1">
          <Button variant="default" onClick={onApply} className="h-9">应用</Button>
          <Button variant="outline" onClick={onReset} className="h-9">重置</Button>
          <Button
            variant="secondary"
            onClick={onExport}
            className="h-9"
          >
            <Download className="w-4 h-4 mr-2" />导出
          </Button>
          {onOpenAnalysis && (
            <Button
              variant="outline"
              onClick={onOpenAnalysis}
              className="h-9"
            >
              查看数据分析图表
            </Button>
          )}
        </div>

        {/* 高级筛选扩展占位（后续可添加 Collapsible + 额外条件） */}
      </CardContent>
    </Card>
  )
}

export default IssueFilterPanel
