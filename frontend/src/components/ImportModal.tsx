import React, { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { 
  Upload, 
  FileSpreadsheet, 
  Download,
  AlertCircle,
  CheckCircle,
  Loader2,
  X
} from 'lucide-react'
import { EquipmentImporter } from '@/utils/importUtils'
import { equipmentApi, factoryApi } from '@/api'
import { saveAs } from 'file-saver'
import type { Equipment, EquipmentType, Factory } from '@/types'
import { isValidationError, extractValidationErrors, showValidationSummary, focusFirstError } from '@/utils/validation'
import { toast } from 'sonner'

interface ImportModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export const ImportModal: React.FC<ImportModalProps> = ({
  open,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<'upload' | 'preview' | 'importing' | 'result'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [loadingBaseData, setLoadingBaseData] = useState(false)
  const [previewData, setPreviewData] = useState<{
    success: Partial<Equipment>[]
    errors: Array<{ row: number, errors: string[] }>
    mapping: Record<string, number>
  } | null>(null)
  const [importResult, setImportResult] = useState<{
    success: number
    failed: number
    errors: string[]
  } | null>(null)
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
  const [factories, setFactories] = useState<Factory[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 加载基础数据
  React.useEffect(() => {
    if (open) {
      loadBaseData()
    }
  }, [open])

  const loadBaseData = async () => {
    setLoadingBaseData(true)
    try {
      const [typesRes, factoriesRes] = await Promise.all([
        equipmentApi.getTypes(),
        factoryApi.getList()
      ])
      
      if (typesRes.success) {
        setEquipmentTypes(typesRes.data || [])
      } else {
        console.error('获取器材类型失败:', typesRes.message)
      }
      if (factoriesRes.success) {
        setFactories(factoriesRes.data || [])
      } else {
        console.error('获取厂区列表失败:', factoriesRes.message)
      }
    } catch (error) {
      console.error('加载基础数据失败:', error)
      alert('加载基础数据失败，请重试')
    } finally {
      setLoadingBaseData(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    if (!EquipmentImporter.validateFileType(selectedFile)) {
      alert('不支持的文件格式，请选择 Excel (.xlsx/.xls) 或 CSV 文件')
      return
    }

    setFile(selectedFile)
    parseFile(selectedFile)
  }

  const parseFile = async (file: File) => {
    // 检查基础数据是否已加载
    if (loadingBaseData) {
      alert('基础数据正在加载中，请稍后重试')
      return
    }

    if (equipmentTypes.length === 0) {
      alert('器材类型数据未加载，请稍后重试或刷新页面')
      return
    }

    console.log('=== 开始解析文件 ===')
    console.log('文件信息:', {
      name: file.name,
      size: file.size,
      type: file.type
    })
    console.log('基础数据状态:', {
      equipmentTypesCount: equipmentTypes.length,
      factoriesCount: factories.length,
      equipmentTypes: equipmentTypes.map(t => ({ id: t.id, name: t.name })),
      factories: factories.map(f => ({ id: f.id, name: f.name }))
    })

    setParsing(true)
    try {
      const rawData = await EquipmentImporter.parseFile(file)
      console.log('原始Excel数据:', rawData)
      
      if (rawData.length < 2) {
        throw new Error('文件数据不足，至少需要包含表头和一行数据')
      }

      // 检测列映射
      const headers = rawData[0] as string[]
      console.log('Excel表头:', headers)
      
      const mapping = EquipmentImporter.detectColumnMapping(headers)
      console.log('列映射结果:', mapping)
      
      // 验证必填字段
      const mappingErrors = EquipmentImporter.validateRequiredFields(mapping)
      console.log('必填字段验证:', mappingErrors)
      
      if (mappingErrors.length > 0) {
        throw new Error(`列映射失败:\n${mappingErrors.join('\n')}`)
      }

      // 解析数据
      console.log('开始解析器材数据...')
      const { success, errors } = EquipmentImporter.parseEquipmentData(
        rawData, 
        mapping, 
        equipmentTypes,
        factories
      )

      console.log('解析结果:', {
        successCount: success.length,
        errorsCount: errors.length,
        successData: success,
        errorData: errors
      })

      setPreviewData({ success, errors, mapping })
      setStep('preview')
    } catch (error: any) {
      console.error('文件解析失败:', error)
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
        toast.error('文件解析失败：存在数据格式错误')
      } else {
        toast.error('文件解析失败: ' + (error?.message || '未知错误'))
      }
      setFile(null)
    } finally {
      setParsing(false)
    }
  }

  const handleImport = async () => {
    if (!previewData?.success.length) return

    console.log('=== 开始批量导入 ===')
    console.log('预览数据:', previewData)

    setStep('importing')
    setImporting(true)

    try {
      console.log('开始批量导入，原始数据:', previewData.success)
      
      // 格式化数据以匹配后端期望的格式
      const formattedEquipments = previewData.success.map((equipment, index) => {
        console.log(`格式化器材 ${index + 1} - 输入:`, equipment)
        
        const formatted = {
          name: equipment.name,
          location: equipment.location,
          specifications: equipment.specifications || '',
          productionDate: equipment.productionDate ? equipment.productionDate.split('T')[0] : undefined,
          expiryDate: equipment.expiryDate ? equipment.expiryDate.split('T')[0] : undefined,
          // 处理器材类型：如果是字符串（类型名称），直接传递；如果是数字（类型ID），也传递
          typeId: equipment.typeId,
          // 如果没有指定厂区ID，使用默认值（后端会根据用户权限自动分配）
          factoryId: equipment.factoryId || undefined
        }
        
        console.log(`格式化器材 ${index + 1} - 输出:`, formatted)
        console.log(`格式化器材 ${index + 1} - 字段检查:`, {
          name: { value: formatted.name, type: typeof formatted.name, defined: formatted.name !== undefined },
          typeId: { value: formatted.typeId, type: typeof formatted.typeId, defined: formatted.typeId !== undefined },
          factoryId: { value: formatted.factoryId, type: typeof formatted.factoryId, defined: formatted.factoryId !== undefined },
          location: { value: formatted.location, type: typeof formatted.location, defined: formatted.location !== undefined }
        })
        
        return formatted
      })
      
      console.log('格式化后的批量导入数据:', formattedEquipments)
      console.log('发送到API的完整请求:', {
        equipments: formattedEquipments
      })
      
      // 调用批量导入API
      const response = await equipmentApi.batchImport(formattedEquipments)
      
      console.log('批量导入API响应:', response)

      if (response.success) {
        // 从后端响应中获取实际的成功/失败统计
        const { success, failed } = response.data
        setImportResult({
          success: success?.length || 0,
          failed: failed?.length || 0,
          errors: failed?.map((failure: any) => `第${failure.index + 1}行 (${failure.data?.name || '未知器材'}): ${failure.error}`) || []
        })
        setStep('result')
        onSuccess?.()
      } else {
        throw new Error(response.message || '导入失败')
      }
    } catch (error: any) {
      console.error('导入失败:', error)
      
      // 更详细的错误处理
      let errorMessage = '导入失败'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'string') {
        errorMessage = error
      }
      
      // 检查是否是网络错误
      if (errorMessage.includes('Network Error') || errorMessage.includes('ERR_NETWORK')) {
        errorMessage = '网络连接失败，请检查网络连接后重试'
      } else if (errorMessage.includes('timeout')) {
        errorMessage = '请求超时，请稍后重试'
      } else if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        errorMessage = '登录已过期，请重新登录'
      }
      
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
        toast.error('导入失败：存在字段验证错误')
      } else {
        toast.error('导入失败: ' + errorMessage)
      }
      setStep('preview')
    } finally {
      setImporting(false)
    }
  }

  const handleDownloadTemplate = () => {
    const blob = EquipmentImporter.generateTemplate(equipmentTypes, factories)
    saveAs(blob, '器材导入模板.xlsx')
  }

  const handleReset = () => {
    setStep('upload')
    setFile(null)
    setPreviewData(null)
    setImportResult(null)
    setLoadingBaseData(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleClose = () => {
    handleReset()
    onClose()
  }

  const renderUploadStep = () => (
    <div className="space-y-6">
      {/* 下载模板 */}
      <div className="border rounded-lg p-4 bg-blue-50">
        <div className="flex items-start space-x-3">
          <FileSpreadsheet className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-medium text-blue-900">推荐：使用导入模板</h3>
            <p className="text-sm text-blue-700 mt-1">
              下载标准模板，按格式填写数据，提高导入成功率
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="mt-2"
              onClick={handleDownloadTemplate}
              disabled={loadingBaseData || equipmentTypes.length === 0}
            >
              {loadingBaseData ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  加载中...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  下载模板
                </>
              )}
            </Button>
            {equipmentTypes.length === 0 && !loadingBaseData && (
              <p className="text-xs text-red-600 mt-1">
                器材类型数据未加载，请刷新页面重试
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 文件上传 */}
      <div className="space-y-4">
        <div
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700 mb-2">
            点击选择文件或拖拽上传
          </p>
          <p className="text-sm text-gray-500">
            支持 Excel (.xlsx/.xls) 和 CSV 格式
          </p>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileSelect}
          className="hidden"
        />

        {file && (
          <div className="flex items-center space-x-3 p-3 border rounded bg-gray-50">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <p className="font-medium">{file.name}</p>
              <p className="text-sm text-gray-500">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            {parsing && <Loader2 className="h-5 w-5 animate-spin" />}
          </div>
        )}
      </div>

      {/* 导入说明 */}
      <div className="text-sm text-gray-500 space-y-1">
        <p>• 文件第一行为列标题</p>
        <p>• 必填列：器材名称、器材类型、安装位置、生产日期、到期日期</p>
        <p>• 支持的列名映射请参考模板和说明页</p>
        <p>• 单次最多导入100条记录</p>
        <p>• 日期格式支持：2023-01-15, 2023/1/15, 15/1/2023 等</p>
      </div>
    </div>
  )

  const renderPreviewStep = () => {
    if (!previewData) return null
    
    const stats = EquipmentImporter.getImportStats(previewData.success, previewData.errors)
    
    return (
      <div className="space-y-6">
        {/* 统计信息 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 border rounded bg-green-50">
            <div className="text-2xl font-bold text-green-600">{stats.success}</div>
            <div className="text-sm text-green-700">成功</div>
          </div>
          <div className="text-center p-3 border rounded bg-red-50">
            <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
            <div className="text-sm text-red-700">失败</div>
          </div>
          <div className="text-center p-3 border rounded bg-blue-50">
            <div className="text-2xl font-bold text-blue-600">{stats.successRate}%</div>
            <div className="text-sm text-blue-700">成功率</div>
          </div>
        </div>

        {/* 成功数据预览 */}
        {previewData.success.length > 0 && (
          <div>
            <h3 className="font-medium text-green-600 mb-3 flex items-center">
              <CheckCircle className="h-4 w-4 mr-2" />
              成功解析的数据 ({previewData.success.length} 条)
            </h3>
            <div className="border rounded max-h-40 overflow-y-auto">
              <div className="grid grid-cols-5 gap-2 p-2 bg-gray-50 text-sm font-medium border-b">
                <div>器材名称</div>
                <div>器材类型</div>
                <div>安装位置</div>
                <div>生产日期</div>
                <div>到期日期</div>
              </div>
              {previewData.success.slice(0, 5).map((item, index) => (
                <div key={index} className="grid grid-cols-5 gap-2 p-2 text-sm border-b last:border-b-0">
                  <div title={item.name}>{item.name}</div>
                  <div title={`类型ID: ${item.typeId}`}>
                    {item.typeId ? `ID:${item.typeId}` : '-'}
                  </div>
                  <div title={item.location}>{item.location}</div>
                  <div className="text-gray-600">
                    {item.productionDate ? item.productionDate.split('T')[0] : '-'}
                  </div>
                  <div className="text-gray-600">
                    {item.expiryDate ? item.expiryDate.split('T')[0] : '-'}
                  </div>
                </div>
              ))}
              {previewData.success.length > 5 && (
                <div className="p-2 text-center text-sm text-gray-500">
                  ... 还有 {previewData.success.length - 5} 条数据
                </div>
              )}
            </div>
          </div>
        )}

        {/* 错误数据 */}
        {previewData.errors.length > 0 && (
          <div>
            <h3 className="font-medium text-red-600 mb-3 flex items-center">
              <AlertCircle className="h-4 w-4 mr-2" />
              解析失败的数据 ({previewData.errors.length} 条)
            </h3>
            <div className="border rounded max-h-40 overflow-y-auto bg-red-50">
              {previewData.errors.slice(0, 10).map((error, index) => (
                <div key={index} className="p-2 text-sm border-b last:border-b-0">
                  <div className="font-medium text-red-700">第 {error.row} 行:</div>
                  <ul className="text-red-600 ml-4">
                    {error.errors.map((err, i) => (
                      <li key={i}>• {err}</li>
                    ))}
                  </ul>
                </div>
              ))}
              {previewData.errors.length > 10 && (
                <div className="p-2 text-center text-sm text-red-600">
                  ... 还有 {previewData.errors.length - 10} 个错误
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderImportingStep = () => (
    <div className="text-center space-y-6">
      <Loader2 className="h-16 w-16 animate-spin text-blue-500 mx-auto" />
      <div>
        <h3 className="text-lg font-medium">正在导入数据...</h3>
        <p className="text-gray-500 mt-2">请稍候，正在处理您的数据</p>
      </div>
      <Progress value={50} className="w-full" />
    </div>
  )

  const renderResultStep = () => {
    if (!importResult) return null
    
    return (
      <div className="text-center space-y-6">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
        <div>
          <h3 className="text-lg font-medium text-green-600">导入完成</h3>
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 border rounded bg-green-50">
              <div className="text-2xl font-bold text-green-600">{importResult.success}</div>
              <div className="text-green-700">成功导入</div>
            </div>
            <div className="p-3 border rounded bg-red-50">
              <div className="text-2xl font-bold text-red-600">{importResult.failed}</div>
              <div className="text-red-700">导入失败</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl w-[96vw] overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>批量导入器材</span>
            {step !== 'upload' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                className="ml-auto"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="min-h-[400px]">
          {step === 'upload' && renderUploadStep()}
          {step === 'preview' && renderPreviewStep()}
          {step === 'importing' && renderImportingStep()}
          {step === 'result' && renderResultStep()}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
          >
            {step === 'result' ? '完成' : '取消'}
          </Button>
          
          {step === 'preview' && (
            <Button
              onClick={handleImport}
              disabled={!previewData?.success.length || importing}
              className="flex items-center space-x-2"
            >
              {importing && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>确认导入 ({previewData?.success.length || 0} 条)</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
