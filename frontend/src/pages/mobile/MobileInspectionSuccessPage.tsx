import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, AlertTriangle, Home, List } from 'lucide-react'

interface BatchSummary {
  location: string
  totalEquipments: number
  normalCount: number
  abnormalCount: number
  issueCount: number
  inspectorId: number
}

interface LocationState {
  // 单器材模式
  equipment?: string
  result?: 'NORMAL' | 'ABNORMAL'
  
  // 批量模式
  mode?: 'batch'
  location?: string
  summary?: BatchSummary
}

export const MobileInspectionSuccessPage: React.FC = () => {
  const navigate = useNavigate()
  const locationObj = useLocation()
  
  const state = locationObj.state as LocationState | null
  
  // 判断是批量模式还是单器材模式
  const isBatchMode = state?.mode === 'batch'
  
  if (isBatchMode) {
    const { location, summary } = state!
    const hasAbnormal = summary!.abnormalCount > 0
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-6">
          <Card className={hasAbnormal ? "border-orange-200" : "border-green-200"}>
            <CardHeader className="text-center">
              <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                hasAbnormal ? 'bg-orange-100' : 'bg-green-100'
              }`}>
                {hasAbnormal ? (
                  <AlertTriangle className="h-8 w-8 text-orange-600" />
                ) : (
                  <CheckCircle className="h-8 w-8 text-green-600" />
                )}
              </div>
              <CardTitle className={`text-xl ${hasAbnormal ? 'text-orange-900' : 'text-green-900'}`}>
                批量点检完成
              </CardTitle>
            </CardHeader>
            
            <CardContent className="text-center space-y-4">
              <div className={`p-4 rounded-lg ${hasAbnormal ? 'bg-orange-50' : 'bg-green-50'}`}>
                <p className={`font-medium ${hasAbnormal ? 'text-orange-900' : 'text-green-900'}`}>
                  位置: {location}
                </p>
                <p className={`text-sm mt-1 ${hasAbnormal ? 'text-orange-700' : 'text-green-700'}`}>
                  已完成 {summary!.totalEquipments} 个器材的点检
                  {hasAbnormal && `，发现 ${summary!.abnormalCount} 个器材存在异常`}
                </p>
              </div>

              {/* 统计信息 */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-green-50 p-3 rounded-lg">
                  <div className="font-semibold text-green-800">{summary!.normalCount}</div>
                  <div className="text-green-600">正常器材</div>
                </div>
                <div className="bg-orange-50 p-3 rounded-lg">
                  <div className="font-semibold text-orange-800">{summary!.abnormalCount}</div>
                  <div className="text-orange-600">异常器材</div>
                </div>
              </div>

              {hasAbnormal && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    💡 <strong>温馨提示：</strong>
                    <br />
                    发现的 {summary!.issueCount} 个异常已自动创建隐患整改通知单，
                    相关管理员将收到处理通知。
                  </p>
                </div>
              )}

              <div className="flex flex-col gap-3 pt-4">
                <Button 
                  onClick={() => navigate('/m/dashboard')} 
                  className="w-full"
                >
                  <Home className="h-4 w-4 mr-2" />
                  返回首页
                </Button>
                <Button 
                  onClick={() => navigate('/m/inspections')} 
                  variant="outline" 
                  className="w-full"
                >
                  <List className="h-4 w-4 mr-2" />
                  查看点检记录
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }
  
  // 单器材模式
  const { equipment, result } = state || {}
  const isAbnormal = result === 'ABNORMAL'

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <Card className={isAbnormal ? "border-orange-200" : "border-green-200"}>
          <CardHeader className="text-center">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              isAbnormal ? 'bg-orange-100' : 'bg-green-100'
            }`}>
              {isAbnormal ? (
                <AlertTriangle className="h-8 w-8 text-orange-600" />
              ) : (
                <CheckCircle className="h-8 w-8 text-green-600" />
              )}
            </div>
            <CardTitle className={`text-xl ${isAbnormal ? 'text-orange-900' : 'text-green-900'}`}>
              {isAbnormal ? '发现异常并已上报' : '点检完成'}
            </CardTitle>
          </CardHeader>
          
          <CardContent className="text-center space-y-4">
            <div className={`p-4 rounded-lg ${isAbnormal ? 'bg-orange-50' : 'bg-green-50'}`}>
              <p className={`font-medium ${isAbnormal ? 'text-orange-900' : 'text-green-900'}`}>
                器材: {equipment || '未知器材'}
              </p>
              <p className={`text-sm mt-1 ${isAbnormal ? 'text-orange-700' : 'text-green-700'}`}>
                {isAbnormal 
                  ? '检测到异常项目，已自动创建隐患整改通知单，请等待管理员处理。'
                  : '所有检查项目正常，器材状态良好。'
                }
              </p>
            </div>

            {isAbnormal && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  💡 <strong>温馨提示：</strong>
                  <br />
                  隐患整改通知单已发送给厂区管理员，您可以在"我的隐患上报"中查看处理进度。
                </p>
              </div>
            )}

            <div className="space-y-3 pt-4">
              <Button
                onClick={() => navigate('/m/dashboard')}
                className="w-full"
                size="lg"
              >
                <Home className="mr-2 h-5 w-5" />
                返回首页
              </Button>
              
              <Button
                onClick={() => navigate('/m/inspections')}
                variant="outline"
                className="w-full"
                size="lg"
              >
                <List className="mr-2 h-5 w-5" />
                查看记录
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            感谢您的认真检查，为消防安全保驾护航！
          </p>
        </div>
      </div>
    </div>
  )
}