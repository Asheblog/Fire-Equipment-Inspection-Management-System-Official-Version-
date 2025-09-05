import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'
import { useParams, useNavigate } from 'react-router-dom'
import { formatQrCodeDisplay } from '@/utils/qrCode'
import { equipmentApi, inspectionApi } from '@/api'
import { isValidationError, extractValidationErrors, showValidationSummary, focusFirstError } from '@/utils/validation'
import { MultiImageUploader } from '@/components/ui/MultiImageUploader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageContainer } from '@/components/layout'
import { 
  ArrowLeft, 
  CheckCircle, 
  XCircle, 
  Loader2,
  AlertTriangle,
  Info,
  MapPin,
  Calendar,
  Package,
  FileText
} from 'lucide-react'
import type { Equipment, ChecklistTemplate } from '@/types'


// 位置数据类型
interface LocationData {
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
}

// 器材点检表单类型
interface EquipmentInspectionForm {
  equipmentId: number
  // 多图片支持
  inspectionImages: string[]
  // 向下兼容
  inspectionImageUrl?: string
  checklistResults: Array<{
    itemName: string
    result: 'NORMAL' | 'ABNORMAL'
    note: string
  }>
  overallResult: 'NORMAL' | 'ABNORMAL'
  issueDescription?: string
  // 多图片支持
  issueImages?: string[]
  // 向下兼容
  issueImageUrl?: string
}

export const MobileInspectionPage: React.FC = () => {
  // 监听认证状态失效自动跳转
  const { isAuthenticated } = useAuthStore()
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login', { replace: true })
    }
  }, [isAuthenticated, navigate])
  const { qrCode } = useParams<{ qrCode: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // 智能模式状态
  const [isMultiEquipment, setIsMultiEquipment] = useState(false)
  const [locationData, setLocationData] = useState<LocationData | null>(null)

  // 单器材模式状态 (保持原有逻辑)
  const [equipment, setEquipment] = useState<Equipment | null>(null)
  const [checklist, setChecklist] = useState<ChecklistTemplate[]>([])
  // 多图片支持
  const [inspectionImages, setInspectionImages] = useState<string[]>([])
  const [checkItems, setCheckItems] = useState<Record<number, {
    result: 'NORMAL' | 'ABNORMAL'
    remarks?: string
  }>>({})
  const [hasAbnormal, setHasAbnormal] = useState(false)
  const [issueDescription, setIssueDescription] = useState('')
  // 多图片支持
  const [issueImages, setIssueImages] = useState<string[]>([])

  // 多器材模式状态
  const [equipmentForms, setEquipmentForms] = useState<Record<number, EquipmentInspectionForm>>({})

  // 智能加载数据：自动判断单器材还是多器材模式
  useEffect(() => {
    const loadData = async () => {
      if (!qrCode) {
        setError('二维码参数缺失')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        
        console.log('📡 开始智能加载，先尝试位置API...')
        
        // 先尝试位置API，看看这个位置有多少器材
        try {
          const locationResponse = await equipmentApi.getLocationEquipments(decodeURIComponent(qrCode))
          
          if (locationResponse.success && locationResponse.data) {
            const locationData = locationResponse.data
            setLocationData(locationData)
            
            if (locationData.hasMultipleEquipments && locationData.equipmentCount > 1) {
              console.log(`🏢 检测到多器材位置 (${locationData.equipmentCount}个器材)，启用多器材模式`)
              setIsMultiEquipment(true)
              
              // 初始化多器材表单数据
              const initialForms: Record<number, EquipmentInspectionForm> = {}
              locationData.equipments.forEach(equipment => {
                const checklistResults = equipment.checklistTemplate.map(template => ({
                  itemName: template.itemName,
                  result: 'NORMAL' as const,
                  note: ''
                }))

                initialForms[equipment.id] = {
                  equipmentId: equipment.id,
                  inspectionImages: [],  // 多图片支持
                  checklistResults,
                  overallResult: 'NORMAL'
                }
              })
              setEquipmentForms(initialForms)
              
            } else {
              console.log('🔧 检测到单器材位置，启用单器材模式')
              setIsMultiEquipment(false)
              
              // 使用位置数据中的第一个器材作为单器材
              const singleEquipment = locationData.equipments[0]
              setEquipment(singleEquipment)
              setChecklist(singleEquipment.checklistTemplate)
              
              // 初始化单器材检查项状态
              const initialItems: Record<number, { result: 'NORMAL' | 'ABNORMAL'; remarks?: string }> = {}
              singleEquipment.checklistTemplate.forEach(template => {
                initialItems[template.id] = { result: 'NORMAL' }
              })
              setCheckItems(initialItems)
            }
            
          } else {
            throw new Error('位置API调用失败，尝试单器材回退模式')
          }
          
        } catch (locationErr) {
          console.log('⚠️ 位置API失败，回退到单器材模式')
          
          // 回退到原有的单器材逻辑
          const equipmentResponse = await equipmentApi.getByQR(decodeURIComponent(qrCode))
          if (!equipmentResponse.success || !equipmentResponse.data) {
            setError(equipmentResponse.message || '器材不存在')
            return
          }

          const equipmentData = equipmentResponse.data
          setEquipment(equipmentData)
          setIsMultiEquipment(false)

          // 获取点检项模板
          const checklistResponse = await equipmentApi.getChecklist(equipmentData.id)
          if (checklistResponse.success && checklistResponse.data) {
            setChecklist(checklistResponse.data)
            
            // 初始化检查项状态
            const initialItems: Record<number, { result: 'NORMAL' | 'ABNORMAL'; remarks?: string }> = {}
            checklistResponse.data.forEach(item => {
              initialItems[item.id] = { result: 'NORMAL' }
            })
            setCheckItems(initialItems)
          }
        }
        
      } catch (err: any) {
        console.error('加载数据失败:', err)
        setError(err.response?.data?.message || '加载数据失败')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [qrCode])

  // 单器材模式：检查是否有异常项
  useEffect(() => {
    if (!isMultiEquipment) {
      const hasAbnormalItem = Object.values(checkItems).some(item => item.result === 'ABNORMAL')
      setHasAbnormal(hasAbnormalItem)
    }
  }, [checkItems, isMultiEquipment])

  // 多器材模式：更新检查项结果
  const updateChecklistItem = (equipmentId: number, itemIndex: number, result: 'NORMAL' | 'ABNORMAL', note?: string) => {
    setEquipmentForms(prev => {
      const form = prev[equipmentId]
      if (!form) return prev

      const updatedResults = [...form.checklistResults]
      updatedResults[itemIndex] = {
        ...updatedResults[itemIndex],
        result,
        note: note || ''
      }

      const newForm = {
        ...form,
        checklistResults: updatedResults
      }

      // 更新整体结果
      const hasAbnormal = updatedResults.some(item => item.result === 'ABNORMAL')
      newForm.overallResult = hasAbnormal ? 'ABNORMAL' : 'NORMAL'

      return {
        ...prev,
        [equipmentId]: newForm
      }
    })
  }

  // 多器材模式：检查器材点检是否完成
  const isEquipmentCompleted = (equipmentId: number): boolean => {
    const form = equipmentForms[equipmentId]
    if (!form || !form.inspectionImages || form.inspectionImages.length === 0) return false
    
    // 如果有异常，需要异常描述和异常图片
    if (form.overallResult === 'ABNORMAL') {
      return !!(form.issueDescription && form.issueImages && form.issueImages.length > 0)
    }
    
    return true
  }

  // 多器材模式：检查所有器材是否完成
  const allEquipmentsCompleted = (): boolean => {
    if (!locationData) return false
    return locationData.equipments.every(equipment => isEquipmentCompleted(equipment.id))
  }

  // 智能提交：根据模式选择提交方式
  const handleSubmit = async () => {
    try {
      setSubmitting(true)
      setError('')

      if (isMultiEquipment) {
        // 多器材批量提交
        if (!locationData || !allEquipmentsCompleted()) {
          setError('请完成所有器材的点检后再提交')
          return
        }

        const equipmentDataList = locationData.equipments.map(equipment => {
          const form = equipmentForms[equipment.id]
          return {
            equipmentId: equipment.id,
            overallResult: form.overallResult,
            // 使用新的多图片字段，同时保持向下兼容
            inspectionImageUrls: form.inspectionImages,
            inspectionImageUrl: form.inspectionImages?.[0] || '', // 向下兼容
            checklistResults: form.checklistResults,
            ...(form.overallResult === 'ABNORMAL' && {
              issueDescription: form.issueDescription,
              issueImageUrls: form.issueImages,
              issueImageUrl: form.issueImages?.[0] || '' // 向下兼容
            })
          }
        })

        const response = await inspectionApi.createBatch({
          location: locationData.location,
          equipments: equipmentDataList
        })
        
        if (response.success) {
          const resultData = response.data
          navigate('/m/inspection-success', { 
            state: { 
              mode: 'batch',
              location: locationData.location,
              summary: resultData?.summary
            }
          })
        } else {
          setError(response.message || '批量提交失败')
        }
        
      } else {
        // 单器材提交 (保持原有逻辑)
        if (!equipment || !inspectionImages || inspectionImages.length === 0) {
          setError('请完成所有必填项')
          return
        }

        if (hasAbnormal && (!issueDescription || !issueImages || issueImages.length === 0)) {
          setError('发现异常时需要填写异常描述和上传异常照片')
          return
        }

        const inspectionData = {
          equipmentId: equipment.id,
          overallResult: hasAbnormal ? 'ABNORMAL' as const : 'NORMAL' as const,
          // 使用新的多图片字段，同时保持向下兼容
          inspectionImageUrls: inspectionImages,
          inspectionImageUrl: inspectionImages[0] || '', // 向下兼容
          checklistResults: Object.entries(checkItems).map(([templateId, item]) => {
            const template = checklist.find(t => t.id === parseInt(templateId))
            return {
              itemName: template?.itemName || '',
              result: item.result,
              note: item.remarks || ''
            }
          }),
          ...(hasAbnormal && {
            issueDescription,
            issueImageUrls: issueImages,
            issueImageUrl: issueImages[0] || '' // 向下兼容
          })
        }

        const response = await inspectionApi.create(inspectionData)
        
        if (response.success) {
          navigate('/m/inspection-success', { 
            state: { 
              mode: 'single',
              equipment: equipment.name,
              result: hasAbnormal ? 'ABNORMAL' : 'NORMAL'
            }
          })
        } else {
          setError(response.message || '提交失败')
        }
      }
      
    } catch (err: any) {
      console.error('❌ 提交点检记录失败:', err)
      if (isValidationError(err)) {
        const { map, errors, traceId } = extractValidationErrors(err)
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
        setError('提交失败，存在表单错误')
      } else {
        setError(err.response?.data?.message || '提交失败，请重试')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <PageContainer variant="mobile">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">智能识别器材模式中...</p>
          </div>
        </div>
      </PageContainer>
    )
  }

  if (error && (!equipment && !locationData)) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b sticky top-0 z-10">
          <div className="px-4 py-3 flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/m/dashboard')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="ml-3 text-lg font-semibold">器材点检</h1>
          </div>
        </header>
        
        <PageContainer variant="mobile">
          <Card>
            <CardContent className="p-6 text-center">
              <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">加载失败</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button onClick={() => navigate('/m/dashboard')}>
                返回首页
              </Button>
            </CardContent>
          </Card>
        </PageContainer>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 py-3 flex items-center">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/m/dashboard')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="ml-3 text-lg font-semibold">
            器材点检 {isMultiEquipment && locationData && (
              <Badge variant="secondary" className="ml-2">
                {locationData.equipmentCount} 种器材
              </Badge>
            )}
          </h1>
        </div>
      </header>

      <PageContainer variant="mobile" className="space-y-4">
        {/* 多器材模式：位置信息 */}
        {isMultiEquipment && locationData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                位置信息
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{locationData.location}</span>
                  <Badge variant="default">
                    {locationData.equipmentCount} 种器材
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span>{locationData.factory.name}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 多器材模式：进度指示器 */}
        {isMultiEquipment && locationData && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">完成进度</span>
                <span className="text-sm text-muted-foreground">
                  {locationData.equipments.filter(eq => isEquipmentCompleted(eq.id)).length}/{locationData.equipments.length}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ 
                    width: `${(locationData.equipments.filter(eq => isEquipmentCompleted(eq.id)).length / locationData.equipments.length) * 100}%` 
                  }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* 单器材模式：器材信息 */}
        {!isMultiEquipment && equipment && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                器材信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h3 className="font-semibold text-lg">{equipment.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline">{equipment.type?.name}</Badge>
                  <span className="text-sm text-muted-foreground">
                    编号: {formatQrCodeDisplay(equipment.qrCode)}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">位置:</span>
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="h-4 w-4" />
                    <span>{equipment.location}</span>
                  </div>
                </div>
                
                <div>
                  <span className="text-muted-foreground">到期日期:</span>
                  <div className="flex items-center gap-1 mt-1">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(equipment.expiryDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 多器材模式：器材列表 */}
        {isMultiEquipment && locationData && locationData.equipments.map((equipment) => {
          const form = equipmentForms[equipment.id]
          const completed = isEquipmentCompleted(equipment.id)
          const hasAbnormal = form?.overallResult === 'ABNORMAL'

          return (
            <Card key={equipment.id} className="space-y-4">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    <span>{equipment.name}</span>
                  </div>
                  {completed && (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  )}
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Badge variant="outline">{equipment.equipmentType?.name}</Badge>
                  <span>编号: {formatQrCodeDisplay(equipment.qrCode)}</span>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* 检查项列表 */}
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    检查项目
                  </h4>
                  <div className="space-y-3">
                    {equipment.checklistTemplate.map((template, index) => (
                      <div key={template.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm">{template.itemName}</span>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant={form?.checklistResults[index]?.result === 'NORMAL' ? 'default' : 'outline'}
                            onClick={() => updateChecklistItem(equipment.id, index, 'NORMAL')}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            正常
                          </Button>
                          <Button
                            size="sm"
                            variant={form?.checklistResults[index]?.result === 'ABNORMAL' ? 'destructive' : 'outline'}
                            onClick={() => updateChecklistItem(equipment.id, index, 'ABNORMAL')}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            异常
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 现场照片上传 */}
                <MultiImageUploader
                  images={form?.inspectionImages || []}
                  onImagesChange={(images) => setEquipmentForms(prev => ({
                    ...prev,
                    [equipment.id]: {
                      ...prev[equipment.id],
                      inspectionImages: images
                    }
                  }))}
                  title="现场照片"
                  description="请拍摄器材现场照片，最多9张"
                  required={true}
                  maxImages={9}
                />

                {/* 异常情况处理 */}
                {hasAbnormal && (
                  <div className="space-y-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="font-medium">发现异常，需要处理</span>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        异常描述 <span className="text-red-500">*</span>
                      </label>
                      <Textarea
                        placeholder="请详细描述发现的异常情况..."
                        value={form?.issueDescription || ''}
                        onChange={(e) => setEquipmentForms(prev => ({
                          ...prev,
                          [equipment.id]: {
                            ...prev[equipment.id],
                            issueDescription: e.target.value
                          }
                        }))}
                        className="min-h-[80px]"
                      />
                    </div>

                    <div>
                      <MultiImageUploader
                        images={form?.issueImages || []}
                        onImagesChange={(images) => setEquipmentForms(prev => ({
                          ...prev,
                          [equipment.id]: {
                            ...prev[equipment.id],
                            issueImages: images
                          }
                        }))}
                        title="异常照片"
                        description="请拍摄异常现象照片，最多9张"
                        required={true}
                        maxImages={9}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}

        {/* 单器材模式：点检项 */}
        {!isMultiEquipment && checklist.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>点检项目</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {checklist.map((item) => (
                <div key={item.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.itemName}</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={checkItems[item.id]?.result === 'NORMAL' ? 'default' : 'outline'}
                        onClick={() => setCheckItems(prev => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], result: 'NORMAL' }
                        }))}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        正常
                      </Button>
                      <Button
                        size="sm"
                        variant={checkItems[item.id]?.result === 'ABNORMAL' ? 'destructive' : 'outline'}
                        onClick={() => setCheckItems(prev => ({
                          ...prev,
                          [item.id]: { ...prev[item.id], result: 'ABNORMAL' }
                        }))}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        异常
                      </Button>
                    </div>
                  </div>
                  
                  {checkItems[item.id]?.result === 'ABNORMAL' && (
                    <Input
                      placeholder="请填写异常备注..."
                      value={checkItems[item.id]?.remarks || ''}
                      onChange={(e) => setCheckItems(prev => ({
                        ...prev,
                        [item.id]: { ...prev[item.id], remarks: e.target.value }
                      }))}
                    />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 单器材模式：现场照片 */}
        {!isMultiEquipment && (
          <Card>
            <CardContent className="space-y-4 pt-6">
              <MultiImageUploader
                images={inspectionImages}
                onImagesChange={setInspectionImages}
                title="现场照片"
                description="请拍摄器材现场照片，最多9张"
                required={true}
                maxImages={9}
              />
            </CardContent>
          </Card>
        )}

        {/* 单器材模式：异常处理 */}
        {!isMultiEquipment && hasAbnormal && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                发现异常情况
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  异常描述 <span className="text-red-500">*</span>
                </label>
                <Textarea
                  placeholder="请详细描述发现的异常情况..."
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  className="bg-white"
                />
              </div>

              <div>
                <MultiImageUploader
                  images={issueImages}
                  onImagesChange={setIssueImages}
                  title="异常照片"
                  description="请拍摄异常现象照片，最多9张"
                  required={true}
                  maxImages={9}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* 错误提示 */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 智能提交按钮 */}
        <div className="pb-4">
          <Button
            onClick={handleSubmit}
            disabled={
              submitting || 
              (isMultiEquipment ? !allEquipmentsCompleted() : 
                (inspectionImages.length === 0 || (hasAbnormal && (!issueDescription || issueImages.length === 0))))
            }
            className="w-full"
            size="lg"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                提交中...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                {isMultiEquipment ? '提交所有点检记录' : '提交点检记录'}
              </>
            )}
          </Button>
          
          {isMultiEquipment && !allEquipmentsCompleted() && (
            <p className="text-center text-sm text-muted-foreground mt-2">
              请完成所有器材的点检后再提交
            </p>
          )}
        </div>
      </PageContainer>
    </div>
  )
}
