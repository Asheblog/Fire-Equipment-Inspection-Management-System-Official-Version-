import React, { useState, useEffect } from 'react'
import { useAuthStore } from '@/stores/auth'
import { equipmentApi } from '@/api'
import { isValidationError, extractValidationErrors, showValidationSummary, focusFirstError } from '@/utils/validation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/DataTable'
import { PageContainer, PageHeader, ContentSection } from '@/components/layout'
import { EquipmentTypeDialog } from '@/components/EquipmentTypeDialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { type ColumnDef } from '@tanstack/react-table'
import {
  Shield,
  Plus,
  Settings,
  List,
  MoreHorizontal,
  Edit,
  Trash2,
  ListChecks
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { EquipmentType, ChecklistTemplate } from '@/types'

// 器材类型表格列定义
const createColumns = (
  onEdit: (type: EquipmentType) => void,
  onDelete: (type: EquipmentType) => void,
  onManageChecklist: (type: EquipmentType) => void
): ColumnDef<EquipmentType>[] => [
  {
    accessorKey: "name",
    header: "类型名称",
    cell: ({ row }) => (
      <div className="flex items-center space-x-2">
        <Shield className="h-4 w-4 text-blue-500" />
        <span className="font-medium">{row.getValue("name")}</span>
      </div>
    ),
  },
  {
    accessorKey: "equipmentCount",
    header: "器材数量",
    cell: ({ row }) => {
      const count = row.getValue("equipmentCount") as number
      return (
        <Badge variant={count > 0 ? "default" : "secondary"}>
          {count} 个
        </Badge>
      )
    },
  },
  {
    accessorKey: "checklistTemplates",
    header: "点检项目",
    cell: ({ row }) => {
      const templates = row.getValue("checklistTemplates") as ChecklistTemplate[]
      return (
        <div className="flex items-center space-x-1">
          <ListChecks className="h-3 w-3 text-gray-500" />
          <span className="text-sm">{templates?.length || 0} 项</span>
        </div>
      )
    },
  },
  {
    id: "actions",
    enableHiding: false,
    cell: ({ row }) => {
      const type = row.original

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
            <DropdownMenuItem onClick={() => onManageChecklist(type)}>
              <List className="mr-2 h-4 w-4" />
              管理点检项
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onEdit(type)}>
              <Edit className="mr-2 h-4 w-4" />
              编辑
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => onDelete(type)}
              className="text-red-600"
              disabled={type.equipmentCount ? type.equipmentCount > 0 : false}
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

export const EquipmentTypesPage: React.FC = () => {
  const { isSuperAdmin, isFactoryAdmin } = useAuthStore()
  const [equipmentTypes, setEquipmentTypes] = useState<EquipmentType[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // 编辑状态
  const [editingType, setEditingType] = useState<EquipmentType | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  
  // 点检项管理状态
  const [selectedType, setSelectedType] = useState<EquipmentType | null>(null)
  const [checklistDialogOpen, setChecklistDialogOpen] = useState(false)
  const [checklistTemplates, setChecklistTemplates] = useState<ChecklistTemplate[]>([])
  const [checklistLoading, setChecklistLoading] = useState(false)
  
  // 批量添加点检项状态
  const [addMode, setAddMode] = useState<'single' | 'batch'>('single')
  const [batchInputText, setBatchInputText] = useState('')
  const [parsedItems, setParsedItems] = useState<string[]>([])

  // 重置错误状态
  const resetError = () => {
    setError('')
  }

  // 加载器材类型数据
  const loadData = async () => {
    try {
      setLoading(true)
      resetError()
      
      const response = await equipmentApi.getTypes()
      
      if (response.success && response.data) {
        setEquipmentTypes(response.data)
      } else {
        setEquipmentTypes([])
      }
      
    } catch (err: any) {
      console.error('加载器材类型数据失败:', err)
      setError(err.response?.data?.message || '加载失败')
      setEquipmentTypes([])
    } finally {
      setLoading(false)
    }
  }

  // 加载点检项模板
  const loadChecklistTemplates = async (typeId: number) => {
    try {
      setChecklistLoading(true)
      const response = await equipmentApi.getChecklistTemplates(typeId)
      
      if (response.success && response.data) {
        setChecklistTemplates(response.data)
      } else {
        setChecklistTemplates([])
      }
      
    } catch (err: any) {
      console.error('加载点检项模板失败:', err)
      setChecklistTemplates([])
    } finally {
      setChecklistLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // 打开添加对话框
  const handleAdd = () => {
    setEditingType(null)
    setDialogOpen(true)
  }

  // 打开编辑对话框
  const handleEdit = (type: EquipmentType) => {
    setEditingType(type)
    setDialogOpen(true)
  }

  // Dialog操作成功后的回调
  const handleDialogSuccess = () => {
    loadData() // 重新加载数据
  }

  // 删除器材类型
  const handleDelete = async (type: EquipmentType) => {
    if (type.equipmentCount && type.equipmentCount > 0) {
      alert('该器材类型下还有关联的器材，无法删除')
      return
    }

    if (confirm(`确定要删除器材类型"${type.name}"吗？此操作会同时删除关联的点检项模板。`)) {
      try {
        await equipmentApi.deleteType(type.id)
        await loadData() // 重新加载数据
      } catch (error: any) {
        console.error('删除器材类型失败:', error)
        alert('删除失败: ' + (error.response?.data?.message || '网络错误'))
      }
    }
  }

  // 管理点检项
  const handleManageChecklist = async (type: EquipmentType) => {
    setSelectedType(type)
    setChecklistDialogOpen(true)
    // 重置批量输入状态
    resetBatchInput()
    await loadChecklistTemplates(type.id)
  }

  // 添加点检项
  const handleAddChecklistItem = async () => {
    if (!selectedType) return
    
    const itemName = prompt('请输入点检项目名称:')
    if (!itemName || !itemName.trim()) return

    try {
      await equipmentApi.createChecklistTemplate(selectedType.id, { itemName: itemName.trim() })
      await loadChecklistTemplates(selectedType.id) // 重新加载点检项
    } catch (error: any) {
      console.error('添加点检项失败:', error)
      alert('添加失败: ' + (error.response?.data?.message || '网络错误'))
    }
  }

  // 解析批量输入文本
  const parseBatchInputText = (text: string): string[] => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .filter((item, index, arr) => arr.indexOf(item) === index) // 去重
  }

  // 处理批量输入文本变化
  const handleBatchInputChange = (text: string) => {
    setBatchInputText(text)
    const parsed = parseBatchInputText(text)
    setParsedItems(parsed)
  }

  // 批量添加点检项
  const handleBatchAddChecklistItems = async () => {
    if (!selectedType) return
    
    const itemNames = parseBatchInputText(batchInputText)
    if (itemNames.length === 0) {
      alert('请输入至少一个点检项目')
      return
    }

    try {
      const response = await equipmentApi.createChecklistTemplatesBatch(selectedType.id, { itemNames })
      
      if (response.success && response.data) {
        const { message, /* createdCount */ skippedCount, skippedItems } = response.data
        
        // 显示结果信息
        if (skippedCount > 0) {
          alert(`${message}\n\n跳过的项目：\n${skippedItems.join('\n')}`)
        } else {
          alert(message)
        }
        
        // 重置批量输入状态
        setBatchInputText('')
        setParsedItems([])
        
        // 重新加载点检项
        await loadChecklistTemplates(selectedType.id)
      }
    } catch (error: any) {
      console.error('批量添加点检项失败:', error)
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
      } else {
        alert('批量添加失败: ' + (error.response?.data?.message || '网络错误'))
      }
    }
  }

  // 重置批量输入状态
  const resetBatchInput = () => {
    setBatchInputText('')
    setParsedItems([])
    setAddMode('single')
  }

  // 编辑点检项
  const handleEditChecklistItem = async (template: ChecklistTemplate) => {
    if (!selectedType) return
    
    const itemName = prompt('请输入点检项目名称:', template.itemName)
    if (!itemName || !itemName.trim() || itemName.trim() === template.itemName) return

    try {
      await equipmentApi.updateChecklistTemplate(selectedType.id, template.id, { itemName: itemName.trim() })
      await loadChecklistTemplates(selectedType.id) // 重新加载点检项
    } catch (error: any) {
      console.error('更新点检项失败:', error)
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
      } else {
        alert('更新失败: ' + (error.response?.data?.message || '网络错误'))
      }
    }
  }

  // 删除点检项
  const handleDeleteChecklistItem = async (template: ChecklistTemplate) => {
    if (!selectedType) return
    
    if (confirm(`确定要删除点检项"${template.itemName}"吗？`)) {
      try {
        await equipmentApi.deleteChecklistTemplate(selectedType.id, template.id)
        await loadChecklistTemplates(selectedType.id) // 重新加载点检项
      } catch (error: any) {
        console.error('删除点检项失败:', error)
        alert('删除失败: ' + (error.response?.data?.message || '网络错误'))
      }
    }
  }

  const columns = createColumns(handleEdit, handleDelete, handleManageChecklist)

  // 统计数据
  const stats = {
    total: equipmentTypes.length,
    withEquipments: equipmentTypes.filter(t => t.equipmentCount && t.equipmentCount > 0).length,
    withoutChecklist: equipmentTypes.filter(t => !t.checklistTemplates || t.checklistTemplates.length === 0).length
  }

  // 权限检查
  if (!isSuperAdmin && !isFactoryAdmin) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">权限不足</h3>
              <p className="text-muted-foreground">
                只有管理员可以管理器材类型
              </p>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    )
  }

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">加载器材类型数据中...</p>
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
              <Shield className="h-12 w-12 text-destructive mx-auto mb-4" />
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
        title="器材类型管理"
        description="管理消防器材类型及其点检项目模板"
      />

      <ContentSection>
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总类型数</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground">
                已配置的器材类型
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">使用中类型</CardTitle>
              <Settings className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.withEquipments}</div>
              <p className="text-xs text-muted-foreground">
                已有关联器材
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">缺少点检项</CardTitle>
              <ListChecks className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.withoutChecklist}</div>
              <p className="text-xs text-muted-foreground">
                需要配置点检项
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 操作栏 */}
        <div className="flex items-center justify-between">
          <Button onClick={handleAdd} className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>添加器材类型</span>
          </Button>
        </div>

        {/* 器材类型列表 */}
        <Card>
          <CardContent className="p-6">
            <DataTable 
              columns={columns} 
              data={equipmentTypes}
              searchKey="name"
              searchPlaceholder="搜索器材类型..."
            />
          </CardContent>
        </Card>
      </ContentSection>

      {/* 添加/编辑器材类型对话框 */}
      <EquipmentTypeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        equipmentType={editingType}
        onSuccess={handleDialogSuccess}
      />

      {/* 点检项管理对话框 */}
      <Dialog open={checklistDialogOpen} onOpenChange={setChecklistDialogOpen}>
        <DialogContent className="max-w-2xl w-[96vw] overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <ListChecks className="h-5 w-5" />
              <span>管理点检项目</span>
            </DialogTitle>
            <DialogDescription>
              {selectedType?.name} 的点检项目配置
            </DialogDescription>
          </DialogHeader>
          
          <div className="mt-6">
            {/* 添加方式选择 */}
            <div className="mb-6">
              <Tabs value={addMode} onValueChange={(value) => setAddMode(value as 'single' | 'batch')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="single">单个添加</TabsTrigger>
                  <TabsTrigger value="batch">批量添加</TabsTrigger>
                </TabsList>
                
                <TabsContent value="single" className="mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium">单个添加点检项</h4>
                    <Button size="sm" onClick={handleAddChecklistItem}>
                      <Plus className="h-4 w-4 mr-2" />
                      添加项目
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    点击"添加项目"按钮，逐个输入点检项目名称
                  </p>
                </TabsContent>
                
                <TabsContent value="batch" className="mt-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">批量添加点检项</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        每行输入一个点检项目，回车换行后自动识别为一条项目
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="batch-input">点检项目（每行一个）</Label>
                      <Textarea
                        id="batch-input"
                        placeholder="例如：&#10;外观检查&#10;压力表检查&#10;软管检查&#10;器材标识检查"
                        value={batchInputText}
                        onChange={(e) => handleBatchInputChange(e.target.value)}
                        rows={8}
                        className="resize-none"
                      />
                    </div>
                    
                    {parsedItems.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-green-700 mb-2">
                          将创建 {parsedItems.length} 个点检项目：
                        </p>
                        <div className="max-h-32 overflow-y-auto bg-green-50 rounded-lg p-3">
                          <div className="flex flex-wrap gap-1">
                            {parsedItems.map((item, index) => (
                              <Badge key={index} variant="secondary" className="text-xs">
                                {index + 1}. {item}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex space-x-2">
                      <Button
                        onClick={handleBatchAddChecklistItems}
                        disabled={parsedItems.length === 0}
                        className="flex-1"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        批量创建 ({parsedItems.length})
                      </Button>
                      <Button
                        variant="outline"
                        onClick={resetBatchInput}
                        disabled={batchInputText.length === 0}
                      >
                        清空
                      </Button>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* 现有点检项列表 */}
            <div className="border-t pt-6">
              <h4 className="font-medium mb-4">现有点检项目列表</h4>
              
              {checklistLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                  <p className="text-sm text-muted-foreground">加载中...</p>
                </div>
              ) : checklistTemplates.length === 0 ? (
                <div className="text-center py-8">
                  <ListChecks className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">暂无点检项目</p>
                  <p className="text-sm text-muted-foreground">使用上方功能开始添加点检项目</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {checklistTemplates.map((template, index) => (
                    <div key={template.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <Badge variant="outline">{index + 1}</Badge>
                        <span className="font-medium">{template.itemName}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditChecklistItem(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600"
                          onClick={() => handleDeleteChecklistItem(template)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
