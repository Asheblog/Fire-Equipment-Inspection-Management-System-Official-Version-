import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Database,
  Loader2
} from 'lucide-react'
import { EquipmentExporter } from '@/utils/exportUtils'
import type { Equipment } from '@/types'

interface ExportModalProps {
  open: boolean
  onClose: () => void
  equipments: Equipment[]
}

export const ExportModal: React.FC<ExportModalProps> = ({
  open,
  onClose,
  equipments
}) => {
  const [exporting, setExporting] = useState(false)
  const [exportType, setExportType] = useState<'excel' | 'csv' | 'json'>('excel')

  const stats = EquipmentExporter.getExportStats(equipments)

  const handleExport = async () => {
    if (equipments.length === 0) {
      alert('没有可导出的数据')
      return
    }

    setExporting(true)
    try {
      await EquipmentExporter.exportByType(equipments, exportType)
      onClose()
    } catch (error) {
      console.error('导出失败:', error)
      alert('导出失败: ' + (error as Error).message)
    } finally {
      setExporting(false)
    }
  }

  const exportOptions = [
    {
      type: 'excel' as const,
      name: 'Excel 文件',
      description: '支持复杂格式，适合进一步编辑',
      icon: FileSpreadsheet,
      extension: '.xlsx',
      color: 'bg-green-100 text-green-800'
    },
    {
      type: 'csv' as const,
      name: 'CSV 文件',
      description: '通用格式，兼容性好',
      icon: FileText,
      extension: '.csv',
      color: 'bg-blue-100 text-blue-800'
    },
    {
      type: 'json' as const,
      name: 'JSON 数据',
      description: '包含完整数据结构，供开发使用',
      icon: Database,
      extension: '.json',
      color: 'bg-purple-100 text-purple-800'
    }
  ]

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg w-[96vw] overflow-x-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Download className="h-5 w-5" />
            <span>导出器材列表</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* 数据统计 */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h3 className="font-medium text-sm text-gray-600 mb-3">导出数据概览</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">总数量:</span>
                <span className="ml-2 font-medium">{stats.total}</span>
              </div>
              <div>
                <span className="text-gray-500">正常:</span>
                <span className="ml-2 font-medium text-green-600">{stats.normal}</span>
              </div>
              <div>
                <span className="text-gray-500">异常:</span>
                <span className="ml-2 font-medium text-orange-600">{stats.abnormal}</span>
              </div>
              <div>
                <span className="text-gray-500">维修中:</span>
                <span className="ml-2 font-medium text-blue-600">{stats.maintenance}</span>
              </div>
            </div>
          </div>

          {/* 导出格式选择 */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-gray-700">选择导出格式</h3>
            <div className="space-y-2">
              {exportOptions.map((option) => {
                const Icon = option.icon
                return (
                  <div
                    key={option.type}
                    className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                      exportType === option.type
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setExportType(option.type)}
                  >
                    <div className="flex items-start space-x-3">
                      <Icon className="h-5 w-5 text-gray-600 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-medium">{option.name}</span>
                          <Badge className={option.color}>
                            {option.extension}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {option.description}
                        </p>
                      </div>
                      <input
                        type="radio"
                        checked={exportType === option.type}
                        onChange={() => setExportType(option.type)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 导出说明 */}
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded">
            <p>• 导出文件将包含器材的完整信息</p>
            <p>• 文件名将自动添加当前日期</p>
            <p>• 导出的数据基于当前的筛选结果</p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={exporting}
          >
            取消
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting || equipments.length === 0}
            className="flex items-center space-x-2"
          >
            {exporting && <Loader2 className="h-4 w-4 animate-spin" />}
            <Download className="h-4 w-4" />
            <span>{exporting ? '导出中...' : '开始导出'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
