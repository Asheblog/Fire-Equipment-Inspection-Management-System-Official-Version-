import React, { useState, useEffect } from 'react'
import { createLogger } from '@/lib/logger'
import { useAuthStore } from '@/stores/auth'
import { useEquipmentStore } from '@/stores/equipment'
import { equipmentApi } from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/DataTable'
import { EquipmentQRBatchPrint } from '@/components/EquipmentQRBatchPrint'
import { EquipmentDialog } from '@/components/EquipmentDialog'
import { QRCodeModal } from '@/components/QRCodeModal'
import { ExportModal } from '@/components/ExportModal'
import { ImportModal } from '@/components/ImportModal'
import { PageContainer, PageHeader, ContentSection } from '@/components/layout'
import { type ColumnDef } from '@tanstack/react-table'
import {
  Shield,
  Plus,
  Download,
  Upload,
  QrCode,
  Calendar,
  MapPin,
  AlertTriangle,
  CheckCircle,
  Clock,
  MoreHorizontal,
  Edit,
  Trash2
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Equipment } from '@/types'
import { formatQrCodeDisplay } from '@/utils/qrCode'

// 器材表格列定义
const createColumns = (
  onEdit: (equipment: Equipment) => void,
  onDelete: (equipment: Equipment) => void,
  onViewQR: (equipment: Equipment) => void
): ColumnDef<Equipment>[] => [
  {
    accessorKey: "name",
    header: "器材名称",
    cell: ({ row }) => (
      <div className="flex items-center space-x-2">
        <Shield className="h-4 w-4 text-blue-500" />
        <span className="font-medium">{row.getValue("name")}</span>
      </div>
    ),
  },
  {
    accessorKey: "qrCode",
    header: "二维码",
    cell: ({ row }) => (
      <div className="flex items-center space-x-2">
        <QrCode className="h-4 w-4 text-gray-500" />
        <code className="text-xs bg-gray-100 px-2 py-1 rounded" title={row.getValue("qrCode") as string}>
          {formatQrCodeDisplay(row.getValue("qrCode") as string)}
        </code>
      </div>
    ),
  },
  {
    accessorKey: "type",
    header: "器材类型",
    cell: ({ row }) => {
      const type = row.original.type
      return type ? (
        <Badge variant="secondary">{type.name}</Badge>
      ) : (
        <span className="text-gray-400">未设置</span>
      )
    },
  },
  {
    accessorKey: "location",
    header: "安装位置",
    cell: ({ row }) => (
      <div className="flex items-center space-x-1">
        <MapPin className="h-3 w-3 text-gray-500" />
        <span className="text-sm">{row.getValue("location")}</span>
      </div>
    ),
  },
  {
    accessorKey: "status",
    header: "状态",
    cell: ({ row }) => {
      const status = row.getValue("status") as string
      const statusConfig = {
        NORMAL: { label: "正常", variant: "success" as const, icon: CheckCircle },
        ABNORMAL: { label: "异常", variant: "warning" as const, icon: AlertTriangle },
        SCRAPPED: { label: "报废", variant: "destructive" as const, icon: Clock }
      }
      const config = statusConfig[status as keyof typeof statusConfig]
      const Icon = config?.icon || Clock
      
      return (
        <div className="flex items-center space-x-1">
          <Icon className="h-3 w-3" />
          <Badge variant={config?.variant || "secondary"}>
            {config?.label || status}
          </Badge>
        </div>
      )
    },
  },
  {
    accessorKey: "expiryDate",
    header: "到期时间",
    cell: ({ row }) => {
      const expiryDate = row.getValue("expiryDate") as string
      const isExpiringSoon = new Date(expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      
      return (
        <div className="flex items-center space-x-1">
          <Calendar className="h-3 w-3 text-gray-500" />
          <span className={`text-sm ${isExpiringSoon ? 'text-orange-600 font-medium' : ''}`}>
            {new Date(expiryDate).toLocaleDateString()}
          </span>
          {isExpiringSoon && (
            <AlertTriangle className="h-3 w-3 text-orange-500" />
          )}
        </div>
      )
    },
  },
  {
    accessorKey: "lastInspectedAt",
    header: "最后点检",
    cell: ({ row }) => {
      const lastInspected = row.getValue("lastInspectedAt") as string
      return lastInspected ? (
        <span className="text-sm text-gray-600">
          {new Date(lastInspected).toLocaleDateString()}
        </span>
      ) : (
        <span className="text-gray-400 text-sm">未点检</span>
      )
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const equipment = row.original

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">打开菜单</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>操作</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onViewQR(equipment)}>
              <QrCode className="mr-2 h-4 w-4" />
              查看二维码
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onEdit(equipment)}>
              <Edit className="mr-2 h-4 w-4" />
              编辑
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDelete(equipment)}
              className="text-red-600"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )
    },
  },
]

export const EquipmentsPage: React.FC = () => {
  const log = createLogger('Equipments')
  const { isSuperAdmin } = useAuthStore()
  const { 
    equipments, 
    loading, 
    dialogOpen, 
    editingEquipment,
    setEquipments, 
    setLoading,
    openAddDialog,
    openEditDialog,
    closeDialog
  } = useEquipmentStore()
  
  const [error, setError] = useState('')
  const [qrModalOpen, setQrModalOpen] = useState(false)
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  const [importModalOpen, setImportModalOpen] = useState(false)

  // 重置错误状态的函数
  const resetError = () => {
    setError('')
  }

  // 加载数据
  const loadData = async () => {
    try {
      setLoading(true)
      resetError() // 重置错误状态
      
      // 加载器材列表数据
      const equipmentsResponse = await equipmentApi.getList()
      
      if (equipmentsResponse.success && equipmentsResponse.data) {
        // 处理分页响应格式：PaginatedResponse.data.items
        const items = equipmentsResponse.data.items
        if (Array.isArray(items)) {
          setEquipments(items)
        } else {
          log.warn('API响应 items 非数组', { raw: items })
          setEquipments([])
        }
      } else {
        // 如果没有数据，设置为空数组
        setEquipments([])
      }
      
    } catch (err: any) {
      log.error('加载器材数据失败', err)
      setError(err.response?.data?.message || '加载失败')
      setEquipments([]) // 确保出错时设置为空数组
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [isSuperAdmin])

  const handleEdit = (equipment: Equipment) => {
    openEditDialog(equipment)
  }

  const handleDelete = async (equipment: Equipment) => {
    if (confirm(`确定要删除器材"${equipment.name}"吗？此操作不可恢复。`)) {
      try {
        await equipmentApi.delete(equipment.id)
        await loadData() // 重新加载数据
      } catch (error: any) {
        log.error('删除器材失败', error)
        alert('删除失败: ' + (error.response?.data?.message || '网络错误'))
      }
    }
  }

  const handleViewQR = (equipment: Equipment) => {
    setSelectedEquipment(equipment)
    setQrModalOpen(true)
  }

  const handleAddEquipment = () => {
    openAddDialog()
  }

  const handleExport = () => {
    setExportModalOpen(true)
  }

  const handleImport = () => {
    setImportModalOpen(true)
  }

  const handleDialogSuccess = () => {
    loadData() // 重新加载数据
  }

  const columns = createColumns(handleEdit, handleDelete, handleViewQR)
  const [selected, setSelected] = useState<Equipment[]>([])
  const [batchPrintOpen, setBatchPrintOpen] = useState(false)

  // 统计数据 - 添加空值检查
  const stats = {
    total: equipments?.length || 0,
    normal: equipments?.filter(e => e.status === 'NORMAL').length || 0,
    abnormal: equipments?.filter(e => e.status === 'ABNORMAL').length || 0,
    expiringSoon: equipments?.filter(e => 
      e.expiryDate && new Date(e.expiryDate) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    ).length || 0
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">加载器材数据中...</p>
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
        title="器材管理"
        description="管理消防器材台账、二维码和检查记录"
      />

      <ContentSection>
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总器材数</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                在线管理的消防器材总数
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">正常器材</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.normal}</div>
              <p className="text-xs text-muted-foreground">
                状态正常可使用
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">异常器材</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.abnormal}</div>
              <p className="text-xs text-muted-foreground">
                需要维修或更换
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">即将到期</CardTitle>
              <Clock className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.expiringSoon}</div>
              <p className="text-xs text-muted-foreground">
                30天内到期需更换
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 操作栏 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button onClick={handleAddEquipment} className="flex items-center space-x-2">
              <Plus className="h-4 w-4" />
              <span>添加器材</span>
            </Button>
            <Button variant="outline" onClick={handleImport} className="flex items-center space-x-2">
              <Upload className="h-4 w-4" />
              <span>批量导入</span>
            </Button>
            <Button
              variant="outline"
              disabled={selected.length === 0}
              onClick={() => setBatchPrintOpen(true)}
              className="flex items-center space-x-2"
            >
              <QrCode className="h-4 w-4" />
              <span>批量打印二维码</span>
              {selected.length > 0 && <span className="text-xs text-gray-500">({selected.length})</span>}
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleExport} className="flex items-center space-x-2">
              <Download className="h-4 w-4" />
              <span>导出列表</span>
            </Button>
          </div>
        </div>

        {/* 器材列表 */}
        <Card>
          <CardContent className="p-6">
            <DataTable 
              columns={columns} 
              data={equipments || []}
              searchKey="name"
              searchPlaceholder="搜索器材名称..."
              enableSelection
              onSelectionChange={setSelected}
            />
          </CardContent>
        </Card>
      </ContentSection>

      {/* 器材添加/编辑对话框 */}
      <EquipmentDialog
        open={dialogOpen}
        onOpenChange={closeDialog}
        equipment={editingEquipment}
        onSuccess={handleDialogSuccess}
      />

      {/* 二维码查看Modal */}
      <QRCodeModal
        open={qrModalOpen}
        onClose={() => setQrModalOpen(false)}
        equipment={selectedEquipment}
      />

      {/* 导出Modal */}
      <ExportModal
        open={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        equipments={equipments || []}
      />

      {/* 导入Modal */}
      <ImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={handleDialogSuccess}
      />

      <EquipmentQRBatchPrint
        open={batchPrintOpen}
        onClose={() => setBatchPrintOpen(false)}
        equipments={selected}
      />
    </PageContainer>
  )
}
