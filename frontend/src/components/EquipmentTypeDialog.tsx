import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { equipmentApi } from '@/api'
import { isValidationError, extractValidationErrors, showValidationSummary, focusFirstError } from '@/utils/validation'
import type { EquipmentType } from '@/types'

interface EquipmentTypeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipmentType?: EquipmentType | null
  onSuccess?: () => void
}

export const EquipmentTypeDialog: React.FC<EquipmentTypeDialogProps> = ({
  open,
  onOpenChange,
  equipmentType,
  onSuccess
}) => {
  const [formData, setFormData] = useState({
    name: ''
  })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const isEditing = Boolean(equipmentType)

  // 重置表单
  const resetForm = () => {
    setFormData({
      name: equipmentType?.name || ''
    })
    setErrors({})
  }

  // 当对话框打开或器材类型改变时重置表单
  useEffect(() => {
    if (open) {
      resetForm()
    }
  }, [open, equipmentType])

  // 验证表单
  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = '器材类型名称不能为空'
    } else if (formData.name.trim().length < 2) {
      newErrors.name = '器材类型名称至少需要2个字符'
    } else if (formData.name.trim().length > 50) {
      newErrors.name = '器材类型名称不能超过50个字符'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // 处理输入变化
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // 清除该字段的错误
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }))
    }
  }

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      setLoading(true)
      
      const data = {
        name: formData.name.trim()
      }

      if (isEditing && equipmentType) {
        await equipmentApi.updateType(equipmentType.id, data)
      } else {
        await equipmentApi.createType(data)
      }

      // 成功后关闭对话框并通知父组件
      onOpenChange(false)
      if (onSuccess) {
        onSuccess()
      }
    } catch (error: any) {
      console.error('操作失败:', error)
      if (isValidationError(error)) {
        const { map, errors, traceId } = extractValidationErrors(error)
        setErrors(prev => ({ ...prev, ...map }))
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
      } else {
        const errorMessage = error.response?.data?.message
        if (errorMessage?.includes('名称已存在')) {
          setErrors({ name: '该器材类型名称已存在' })
        } else {
          setErrors({ submit: errorMessage || '操作失败，请稍后重试' })
        }
      }
    } finally {
      setLoading(false)
    }
  }

  // 处理取消
  const handleCancel = () => {
    if (!loading) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] w-[96vw] overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? '编辑器材类型' : '添加器材类型'}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? '修改器材类型信息。请注意，修改类型名称不会影响已有的器材记录。'
              : '创建新的器材类型。创建后可以为该类型配置专属的点检项目模板。'
            }
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                类型名称 <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="如：手提式干粉灭火器、室内消火栓等"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={errors.name ? 'border-red-500' : ''}
                disabled={loading}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
              <p className="text-xs text-muted-foreground">
                请使用清晰易懂的名称，便于后续器材管理和点检作业
              </p>
            </div>

            {errors.submit && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              取消
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  {isEditing ? '更新中...' : '创建中...'}
                </div>
              ) : (
                isEditing ? '更新' : '创建'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
