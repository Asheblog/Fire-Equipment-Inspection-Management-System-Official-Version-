import { useState, useEffect } from 'react'
import { formatQrCodeDisplay } from '@/utils/qrCode'
import { format } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { ArrowLeft, Filter, Calendar, Eye, CheckCircle, AlertCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { AuthenticatedImage } from '@/components/AuthenticatedImage'
import { ImageGrid } from '@/components/ui/ImageGrid'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { inspectionApi } from '@/api'
import { parseInspectionImages, parseIssueImages, parseFixedImages } from '@/utils/imageParse'
import type { InspectionLog } from '@/types'

interface InspectionDetail extends Omit<InspectionLog, 'checklistResults'> {
  checklistResults: Array<{
    itemName: string
    result: 'NORMAL' | 'ABNORMAL'
    note?: string
  }>
  inspectionImagesList?: string[]
}

export function MobileInspectionRecordsPage() {
  const navigate = useNavigate()
  const [inspections, setInspections] = useState<InspectionLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedInspection, setSelectedInspection] = useState<InspectionDetail | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  // 加载点检记录
  const loadInspections = async () => {
    try {
      setLoading(true)
      const params = {
        page: 1,
        pageSize: 50, // 移动端一次加载更多
        result: statusFilter || undefined
      }

      const response = await inspectionApi.getList(params)
      if (response.success && response.data) {
        setInspections(response.data.items)
      }
    } catch (error) {
      console.error('获取点检记录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 解析逻辑已抽离到 utils/imageParse

  // 查看点检详情
  const viewInspectionDetail = async (inspectionId: number) => {
    try {
      const response = await inspectionApi.getById(inspectionId)
      if (response.success && response.data) {
        const checklistResults = response.data.checklistResults ? JSON.parse(response.data.checklistResults) : []
        const inspectionImagesList = parseInspectionImages(response.data)
        setSelectedInspection({ ...response.data, checklistResults, inspectionImagesList })
        setDetailDialogOpen(true)
      }
    } catch (error) {
      console.error('获取点检详情失败:', error)
    }
  }

  // 过滤搜索结果
  const filteredInspections = inspections.filter(inspection => {
    const matchesSearch = !searchQuery || 
      inspection.equipment?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      formatQrCodeDisplay(inspection.equipment?.qrCode || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      inspection.equipment?.location?.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = !statusFilter || statusFilter === 'all' || inspection.overallResult === statusFilter
    
    return matchesSearch && matchesStatus
  })

  useEffect(() => {
    loadInspections()
  }, [statusFilter])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 头部 */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="flex items-center px-4 py-3">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => navigate('/m/dashboard')}
            className="mr-3"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">我的点检记录</h1>
        </div>
      </div>

      {/* 搜索和筛选 */}
      <div className="p-4 space-y-3 bg-white border-b">
        <div className="flex space-x-2">
          <Input
            placeholder="搜索器材名称、编号或位置..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex space-x-2">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="筛选结果" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部结果</SelectItem>
              <SelectItem value="NORMAL">正常</SelectItem>
              <SelectItem value="ABNORMAL">异常</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 点检记录列表 */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-8">
            <div className="text-gray-500">加载中...</div>
          </div>
        ) : filteredInspections.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-500">暂无点检记录</div>
          </div>
        ) : (
          filteredInspections.map((inspection) => (
            <Card key={inspection.id} className="border border-gray-200">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* 器材信息 */}
                    <div className="mb-2">
                      <h3 className="font-medium text-gray-900 mb-1">
                        {inspection.equipment?.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-1">
                        编号: {formatQrCodeDisplay(inspection.equipment?.qrCode)}
                      </p>
                      <p className="text-sm text-gray-600">
                        位置: {inspection.equipment?.location}
                      </p>
                    </div>

                    {/* 点检信息 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {inspection.overallResult === 'NORMAL' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <Badge 
                          variant={inspection.overallResult === 'NORMAL' ? 'success' : 'destructive'}
                          className={inspection.overallResult === 'NORMAL' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}
                        >
                          {inspection.overallResult === 'NORMAL' ? '正常' : '异常'}
                        </Badge>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => viewInspectionDetail(inspection.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        查看
                      </Button>
                    </div>

                    {/* 时间信息 */}
                    <div className="mt-2 flex items-center text-sm text-gray-500">
                      <Calendar className="h-4 w-4 mr-1" />
                      {format(new Date(inspection.inspectionTime), 'MM-dd HH:mm', { locale: zhCN })}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* 点检详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        {/* 移动端详情弹窗：放宽宽度限制、减少左右留白，避免内容横向溢出 */}
        <DialogContent className="w-[96vw] max-w-none sm:max-w-lg p-4 sm:p-6 overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>点检记录详情</DialogTitle>
          </DialogHeader>
          
          {selectedInspection && (
            <div className="space-y-4">
              {/* 器材信息卡片 - 移动端优化 */}
              <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
                      <span className="text-blue-600 font-bold text-xs">器</span>
                    </div>
                    <span className="font-medium text-blue-800 text-sm">器材信息</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">名称:</span>
                      <span className="font-medium text-right flex-1 ml-2">{selectedInspection.equipment?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">编号:</span>
                      <span className="font-mono text-xs text-right flex-1 ml-2 break-all">{selectedInspection.equipment?.qrCode}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">位置:</span>
                      <span className="font-medium text-right flex-1 ml-2 break-words">{selectedInspection.equipment?.location}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 点检信息卡片 - 移动端优化 */}
              <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center">
                      <span className="text-green-600 font-bold text-xs">检</span>
                    </div>
                    <span className="font-medium text-green-800 text-sm">点检信息</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">时间:</span>
                      <span className="font-medium text-right flex-1 ml-2">
                        {format(new Date(selectedInspection.inspectionTime), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">结果:</span>
                      <Badge 
                        variant={selectedInspection.overallResult === 'NORMAL' ? 'success' : 'destructive'}
                        className={`ml-2 flex items-center gap-1 ${
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
                <TabsList className={`w-full grid ${selectedInspection.issue ? 'grid-cols-3' : 'grid-cols-2'}`}>
                  <TabsTrigger value="checklist" className="flex items-center gap-1 text-xs">
                    <span>📋</span> 点检项目
                  </TabsTrigger>
                  <TabsTrigger value="images" className="flex items-center gap-1 text-xs">
                    <span>📸</span> 现场照片
                  </TabsTrigger>
                  {selectedInspection.issue && (
                    <TabsTrigger value="issue" className="flex items-center gap-1 text-xs">
                      <span>⚠️</span> 关联隐患
                    </TabsTrigger>
                  )}
                </TabsList>

                {/* 点检项详情 */}
                <TabsContent value="checklist" className="space-y-3 mt-4">
                  <div className="space-y-2">
                    {selectedInspection.checklistResults?.map((item, index) => (
                      <div 
                        key={index} 
                        className={`p-3 rounded-lg border-l-4 ${
                          item.result === 'NORMAL' 
                            ? 'bg-green-50 border-l-green-400' 
                            : 'bg-red-50 border-l-red-400'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`text-sm ${
                                item.result === 'NORMAL' ? 'text-green-600' : 'text-red-600'
                              }`}>
                                {item.result === 'NORMAL' ? '✅' : '❌'}
                              </span>
                              <span className="text-sm font-medium break-words break-all">{item.itemName}</span>
                            </div>
                            {item.note && (
                              <div className="ml-6 mt-1 p-2 bg-white/50 rounded border border-gray-200">
                                <p className="text-xs text-gray-700">{item.note}</p>
                              </div>
                            )}
                          </div>
                          <Badge 
                            variant={item.result === 'NORMAL' ? 'success' : 'destructive'}
                            className={`ml-2 text-xs ${
                              item.result === 'NORMAL' 
                                ? 'bg-green-100 text-green-800 border-green-300' 
                                : 'bg-red-100 text-red-800 border-red-300'
                            }`}
                          >
                            {item.result === 'NORMAL' ? '正常' : '异常'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                {/* 现场照片 - 多图支持 (重构 ImageGrid) */}
                <TabsContent value="images" className="mt-4">
                  <Card>
                    <CardContent className="p-4">
                      <ImageGrid
                        images={selectedInspection.inspectionImagesList || (selectedInspection.inspectionImageUrl ? [selectedInspection.inspectionImageUrl] : [])}
                        emptyText="暂无点检照片"
                        label="点检现场照片"
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
                          <div className="mt-6">
                            <ImageGrid label="整改后照片" images={fixedImages} emptyText="暂无整改照片" eagerCount={1} />
                          </div>
                        )
                      })()}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* 关联隐患 */}
                {selectedInspection.issue && (
                  <TabsContent value="issue" className="mt-4">
                    <Card className="bg-gradient-to-r from-orange-50 to-red-50 border-orange-200">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 bg-orange-100 rounded-lg flex items-center justify-center">
                            <span className="text-orange-600 font-bold text-xs">⚠️</span>
                          </div>
                          <span className="font-medium text-orange-800 text-sm">隐患信息</span>
                        </div>
                        <div className="space-y-3">
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between items-center">
                              <span className="text-gray-600">状态:</span>
                              <Badge className={`ml-2 text-xs ${
                                selectedInspection.issue.status === 'CLOSED' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-orange-100 text-orange-800'
                              }`}>
                                {selectedInspection.issue.status === 'PENDING' && '待处理'}
                                {selectedInspection.issue.status === 'PENDING_AUDIT' && '待审核'}
                                {selectedInspection.issue.status === 'CLOSED' && '已关闭'}
                                {selectedInspection.issue.status === 'REJECTED' && '已驳回'}
                              </Badge>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-600">上报:</span>
                              <span className="font-medium text-right flex-1 ml-2 text-xs">
                                {format(new Date(selectedInspection.issue.createdAt), 'yyyy-MM-dd HH:mm:ss', { locale: zhCN })}
                              </span>
                            </div>
                          </div>
                          
                          <div className="border-t pt-3">
                            <span className="text-gray-600 text-sm">隐患描述:</span>
                            <div className="bg-white p-3 rounded-lg border border-orange-200 mt-1">
                              <p className="text-gray-800 text-sm">{selectedInspection.issue.description}</p>
                            </div>
                          </div>

                          {(() => {
                            const images = parseIssueImages(selectedInspection.issue)
                            if (!images.length) return null
                            return (
                              <div className="border-t pt-3">
                                <span className="text-gray-600 text-sm flex items-center gap-2">
                                  隐患照片:
                                  {images.length > 1 && (
                                    <Badge variant="outline" className="text-[10px] px-1 py-0.5">{images.length} 张</Badge>
                                  )}
                                </span>
                                <div className={`mt-2 grid gap-3 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
                                  {images.map((url, idx) => (
                                    <div key={idx} className="relative">
                                      <AuthenticatedImage
                                        src={url}
                                        alt={`隐患照片 ${idx + 1}`}
                                        className={`w-full rounded-lg border shadow-sm ${images.length === 1 ? 'max-h-72 object-contain' : 'h-40 object-cover'}`}
                                        enableZoom={true}
                                      />
                                      {images.length > 1 && (
                                        <div className="absolute top-1 left-1 bg-black/50 text-white text-[10px] px-1 rounded">{idx + 1}</div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                                <p className="text-xs text-gray-500 text-center mt-1">点击图片可放大查看</p>
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
    </div>
  )
}
