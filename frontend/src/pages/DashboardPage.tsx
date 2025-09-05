import React, { useState, useEffect } from 'react'
import { reportApi } from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageContainer, PageHeader, ContentSection } from '@/components/layout'
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  TrendingUp,
  Calendar
} from 'lucide-react'
import type { DashboardData } from '@/types'

export const DashboardPage: React.FC = () => {
  
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true)
        const response = await reportApi.getDashboard()
        
        if (response.success && response.data) {
          setData(response.data)
        } else {
          setError(response.message || '加载失败')
        }
      } catch (err: any) {
        console.error('加载数据看板失败:', err)
        setError(err.response?.data?.message || '加载失败')
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [])

  // 已移除图表与底部快捷操作按钮

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">加载数据看板中...</p>
          </div>
        </div>
      </PageContainer>
    )
  }

  if (error) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">加载失败</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>
                重新加载
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <PageHeader 
        title="数据看板"
        description={`消防器材管理概览 • 最后更新: ${new Date().toLocaleString()}`}
      />

      {data && (
        <ContentSection>
          {/* 统计卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 器材统计 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">总器材数</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.equipmentStats?.total || 0}</div>
                  <div className="flex items-center space-x-2 text-xs text-muted-foreground mt-1">
                    <Badge variant="success" className="text-xs">
                      {data.equipmentStats?.normal || 0} 正常
                    </Badge>
                    <Badge variant="warning" className="text-xs">
                      {data.equipmentStats?.abnormal || 0} 异常
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* 点检统计 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">本月点检</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{data.inspectionStats?.thisMonth || 0}</div>
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-1">
                    <TrendingUp className="h-3 w-3" />
                    <span>正常率 {(data.inspectionStats?.normalRate || 0).toFixed(1)}%</span>
                  </div>
                </CardContent>
              </Card>

              {/* 隐患统计 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">待处理隐患</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {data.issueStats?.pending || 0}
                  </div>
                  <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-1">
                    <Clock className="h-3 w-3" />
                    <span>本月新增 {data.issueStats?.thisMonth || 0}</span>
                  </div>
                </CardContent>
              </Card>

              {/* 待点检器材 */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">待点检</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {data.inspectionStats?.pendingCount || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    需要安排点检的器材
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 最近活动 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  最近活动
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(data.recentActivities || []).slice(0, 5).map((activity) => (
                    <div key={activity.id} className="flex items-center space-x-3 py-2">
                      <div className={`w-2 h-2 rounded-full ${
                        activity.type === 'INSPECTION' ? 'bg-green-500' :
                        activity.type === 'ISSUE_CREATED' ? 'bg-orange-500' :
                        activity.type === 'ISSUE_HANDLED' ? 'bg-blue-500' :
                        'bg-gray-500'
                      }`} />
                      <div className="flex-1">
                        <div className="font-medium text-sm">{activity.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {activity.user?.fullName} • {new Date(activity.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {(!data.recentActivities || data.recentActivities.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      暂无活动记录
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 已移除图表与快捷操作按钮 */}
          </ContentSection>
        )}
    </PageContainer>
  )
}
