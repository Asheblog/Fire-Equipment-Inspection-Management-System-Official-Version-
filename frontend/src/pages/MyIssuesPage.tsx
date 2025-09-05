import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'
import { issueApi } from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AuthenticatedImage } from '@/components/AuthenticatedImage'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { PageContainer, PageHeader, ContentSection } from '@/components/layout'
import { 
  AlertTriangle,
  CheckCircle,
  Clock,
  Eye,
  MapPin,
  User,
  Calendar,
  FileText,
  Search,
  Filter
} from 'lucide-react'
import type { Issue } from '@/types'

interface MyIssueCardProps {
  issue: Issue
  onView: (issue: Issue) => void
}

const MyIssueCard: React.FC<MyIssueCardProps> = ({ issue, onView }) => {
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
        return <Badge variant="outline" className="text-orange-600 border-orange-300">待处理</Badge>
      case 'IN_PROGRESS':
        return <Badge variant="outline" className="text-blue-600 border-blue-300">处理中</Badge>
      case 'PENDING_AUDIT':
        return <Badge variant="outline" className="text-purple-600 border-purple-300">待审核</Badge>
      case 'CLOSED':
        return <Badge variant="outline" className="text-green-600 border-green-300">已关闭</Badge>
      case 'REJECTED':
        return <Badge variant="outline" className="text-red-600 border-red-300">已拒绝</Badge>
      default:
        return <Badge variant="secondary">{status}</Badge>
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="w-4 h-4 text-orange-500" />
      case 'IN_PROGRESS':
        return <AlertTriangle className="w-4 h-4 text-blue-500" />
      case 'PENDING_AUDIT':
        return <Eye className="w-4 h-4 text-purple-500" />
      case 'CLOSED':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'REJECTED':
        return <CheckCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4" />
    }
  }

  return (
    <Card className={`hover:shadow-md transition-shadow border-l-4 ${getSeverityColor(issue)}`}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center space-x-2">
            {getStatusIcon(issue.status)}
            <h3 className="font-medium text-sm">#{issue.id} - {issue.equipment?.name || '未知器材'}</h3>
            {getStatusBadge(issue.status)}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onView(issue)}
          >
            <Eye className="w-4 h-4 mr-1" />
            查看
          </Button>
        </div>

        <div className="space-y-2 text-sm text-gray-600">
          <div className="flex items-center space-x-1">
            <MapPin className="w-4 h-4" />
            <span>{issue.equipment?.location || '未知位置'}</span>
          </div>

          <div className="flex items-center space-x-1">
            <Calendar className="w-4 h-4" />
            <span>{new Date(issue.createdAt).toLocaleString('zh-CN')}</span>
          </div>

          <div className="flex items-start space-x-1 mt-2">
            <FileText className="w-4 h-4 mt-0.5" />
            <p className="flex-1 line-clamp-2">
              {issue.description}
            </p>
          </div>

          {/* 处理状态信息 */}
          {issue.status !== 'PENDING' && issue.handledAt && (
            <div className="flex items-center space-x-1 text-blue-600">
              <User className="w-4 h-4" />
              <span>
                {issue.status === 'IN_PROGRESS' && `处理中 - ${new Date(issue.handledAt).toLocaleDateString('zh-CN')}`}
                {issue.status === 'PENDING_AUDIT' && `已处理，等待审核 - ${new Date(issue.handledAt).toLocaleDateString('zh-CN')}`}
                {issue.status === 'CLOSED' && `已关闭 - ${issue.auditedAt ? new Date(issue.auditedAt).toLocaleDateString('zh-CN') : ''}`}
                {issue.status === 'REJECTED' && `已拒绝 - ${issue.auditedAt ? new Date(issue.auditedAt).toLocaleDateString('zh-CN') : ''}`}
              </span>
            </div>
          )}
        </div>

        {/* 显示隐患图片 */}
        {issue.issueImageUrl && (
          <div className="mt-3">
            <AuthenticatedImage
              src={issue.issueImageUrl}
              alt="隐患图片"
              className="w-16 h-16 object-cover rounded border"
            />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

const MyIssuesPage: React.FC = () => {
  const { user } = useAuthStore()
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0
  })

  useEffect(() => {
    loadMyIssues('all', 1)
  }, [])

  // 加载我的隐患列表
  const loadMyIssues = async (status: string = 'all', page: number = 1) => {
    setLoading(true)
    try {
      const params = {
        page,
        pageSize: pagination.pageSize,
        reporterId: user?.id, // 只获取当前用户上报的隐患
        ...(status !== 'all' && { status }),
        ...(searchQuery && { search: searchQuery })
      }

      console.log('🔧 [我的隐患] 请求参数:', params)
      const response = await issueApi.getList(params)
      console.log('🔧 [我的隐患] API响应:', response)

      if (response?.data && Array.isArray(response.data.items)) {
        const { items, total, page: currentPage, pageSize, totalPages } = response.data
        setIssues(items)
        setPagination({
          page: currentPage,
          pageSize: pageSize,
          total: total,
          totalPages: totalPages
        })
      }
    } catch (error) {
      console.error('🔧 [我的隐患] ❌ 加载失败:', error)
      setIssues([])
    } finally {
      setLoading(false)
    }
  }

  // 标签页切换
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    const statusMap: { [key: string]: string } = {
      'pending': 'PENDING',
      'in-progress': 'IN_PROGRESS', 
      'audit': 'PENDING_AUDIT',
      'closed': 'CLOSED',
      'rejected': 'REJECTED',
      'all': 'all'
    }
    loadMyIssues(statusMap[value], 1)
  }

  // 搜索处理
  const handleSearch = () => {
    loadMyIssues(activeTab === 'all' ? 'all' : activeTab, 1)
  }

  // 查看隐患详情
  const handleViewIssue = (issue: Issue) => {
    setSelectedIssue(issue)
    setShowDetailDialog(true)
  }

  // 分页处理
  const handlePageChange = (newPage: number) => {
    loadMyIssues(activeTab === 'all' ? 'all' : activeTab, newPage)
  }

  // 统计数据
  const pendingCount = issues.filter(i => i.status === 'PENDING').length
  const inProgressCount = issues.filter(i => i.status === 'IN_PROGRESS').length
  const auditCount = issues.filter(i => i.status === 'PENDING_AUDIT').length
  const closedCount = issues.filter(i => i.status === 'CLOSED').length
  const rejectedCount = issues.filter(i => i.status === 'REJECTED').length

  return (
    <PageContainer>
      <PageHeader 
        title="我的隐患上报" 
        description="查看您上报的隐患及处理进度"
      />

      <ContentSection>
        {/* 统计卡片 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{pagination.total}</div>
              <div className="text-sm text-gray-600">总计</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-orange-600">{pendingCount}</div>
              <div className="text-sm text-gray-600">待处理</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">{inProgressCount}</div>
              <div className="text-sm text-gray-600">处理中</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-purple-600">{auditCount}</div>
              <div className="text-sm text-gray-600">待审核</div>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">{closedCount}</div>
              <div className="text-sm text-gray-600">已关闭</div>
            </CardContent>
          </Card>
        </div>

        {/* 搜索栏 */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="搜索隐患描述、器材名称或位置..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-9"
            />
          </div>
          <Button onClick={handleSearch}>
            <Filter className="w-4 h-4 mr-2" />
            搜索
          </Button>
        </div>

        {/* 隐患列表 */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="all">全部 ({pagination.total})</TabsTrigger>
            <TabsTrigger value="pending">待处理 ({pendingCount})</TabsTrigger>
            <TabsTrigger value="in-progress">处理中 ({inProgressCount})</TabsTrigger>
            <TabsTrigger value="audit">待审核 ({auditCount})</TabsTrigger>
            <TabsTrigger value="closed">已关闭 ({closedCount})</TabsTrigger>
            <TabsTrigger value="rejected">已拒绝 ({rejectedCount})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-6">
            {loading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <p className="mt-2 text-gray-600">加载中...</p>
              </div>
            ) : (
              <>
                {/* 隐患卡片列表 */}
                <div className="space-y-4">
                  {issues.length > 0 ? (
                    issues.map((issue) => (
                      <MyIssueCard
                        key={issue.id}
                        issue={issue}
                        onView={handleViewIssue}
                      />
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
                      <h3 className="mt-2 text-sm font-medium text-gray-900">暂无隐患记录</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        您还没有上报任何隐患
                      </p>
                    </div>
                  )}
                </div>

                {/* 分页 */}
                {pagination.totalPages > 1 && (
                  <div className="flex justify-center items-center space-x-4 mt-6">
                    <Button
                      variant="outline"
                      disabled={pagination.page <= 1}
                      onClick={() => handlePageChange(pagination.page - 1)}
                    >
                      上一页
                    </Button>
                    <span className="text-sm text-gray-600">
                      第 {pagination.page} 页，共 {pagination.totalPages} 页
                    </span>
                    <Button
                      variant="outline"
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => handlePageChange(pagination.page + 1)}
                    >
                      下一页
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </ContentSection>

      {/* 隐患详情对话框 */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl w-[96vw] overflow-x-hidden">
          <DialogHeader>
            <DialogTitle>隐患详情 #{selectedIssue?.id}</DialogTitle>
          </DialogHeader>
          
          {selectedIssue && (
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
                      <span className="font-medium">{selectedIssue.equipment?.name || '未知器材'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm w-16">位置</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{selectedIssue.equipment?.location || '未知位置'}</span>
                        <span className="text-xs text-gray-400">📍</span>
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
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm w-16">状态</span>
                      <div>
                        {(() => {
                          switch (selectedIssue.status) {
                            case 'PENDING':
                              return <Badge className="bg-orange-100 text-orange-800 border-orange-300">⏳ 待处理</Badge>
                            case 'IN_PROGRESS':
                              return <Badge className="bg-blue-100 text-blue-800 border-blue-300">🔄 处理中</Badge>
                            case 'PENDING_AUDIT':
                              return <Badge className="bg-purple-100 text-purple-800 border-purple-300">👁️ 待审核</Badge>
                            case 'CLOSED':
                              return <Badge className="bg-green-100 text-green-800 border-green-300">✅ 已关闭</Badge>
                            case 'REJECTED':
                              return <Badge className="bg-red-100 text-red-800 border-red-300">❌ 已拒绝</Badge>
                            default:
                              return <Badge variant="secondary">{selectedIssue.status}</Badge>
                          }
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500 text-sm w-16">上报时间</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {new Date(selectedIssue.createdAt).toLocaleString('zh-CN')}
                        </span>
                        <span className="text-xs text-gray-400">🕐</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* 隐患描述卡片 */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-lg">📝</span>
                    <span>隐患描述</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <p className="text-gray-800 leading-relaxed">{selectedIssue.description}</p>
                  </div>
                </CardContent>
              </Card>

              {/* 隐患图片 */}
              {selectedIssue.issueImageUrl && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-lg">📸</span>
                      <span>隐患图片</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-center">
                      <div className="text-center">
                        <AuthenticatedImage
                          src={selectedIssue.issueImageUrl}
                          alt="隐患图片"
                          className="max-w-md max-h-64 object-contain mx-auto rounded-lg border shadow-sm"
                          enableZoom={true}
                        />
                        <p className="text-xs text-gray-500 mt-2">点击图片可放大查看</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 处理信息 */}
              {selectedIssue.solution && (
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
                      <p className="text-gray-800 leading-relaxed">{selectedIssue.solution}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 处理后图片 */}
              {selectedIssue.fixedImageUrl && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-lg">📸</span>
                      <span>处理后图片</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex justify-center">
                      <div className="text-center">
                        <AuthenticatedImage
                          src={selectedIssue.fixedImageUrl}
                          alt="处理后图片"
                          className="max-w-md max-h-64 object-contain mx-auto rounded-lg border shadow-sm"
                          enableZoom={true}
                        />
                        <p className="text-xs text-gray-500 mt-2">点击图片可放大查看</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 审核信息 */}
              {selectedIssue.auditNote && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-lg">📝</span>
                      <span>审核意见</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                      <p className="text-gray-800 leading-relaxed">{selectedIssue.auditNote}</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}

export default MyIssuesPage
