import React, { useState, useEffect, useRef } from 'react'
import { createLogger } from '@/lib/logger'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { equipmentApi } from '@/api'
import { isValidationError, extractValidationErrors, applyRHFBackendErrors, showValidationSummary, focusFirstError } from '@/utils/validation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuthStore } from '@/stores/auth'
import type { Equipment, EquipmentType } from '@/types'

// 表单验证Schema
// 增强日期校验：格式、先后关系及未来时间限制，避免空字符串被拼接成无效ISO时间导致后端Joi报“格式不正确”
const equipmentFormSchema = z
  .object({
    name: z.string().min(1, '器材名称不能为空').max(100, '器材名称过长'),
    typeId: z.string().min(1, '请选择器材类型'),
    location: z.string().min(1, '安装位置不能为空').max(200, '安装位置过长'),
    specifications: z.string().max(500, '规格型号过长').optional(),
    productionDate: z
      .string()
      .min(1, '生产日期不能为空')
      .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u, '生产日期格式不正确'),
    expiryDate: z
      .string()
      .min(1, '到期日期不能为空')
      .regex(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/u, '有效期格式不正确'),
  })
  .superRefine((data, ctx) => {
    if (data.productionDate && data.expiryDate) {
      const prod = new Date(data.productionDate + 'T00:00:00.000Z').getTime()
      const exp = new Date(data.expiryDate + 'T23:59:59.999Z').getTime()
      if (isNaN(prod)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['productionDate'], message: '生产日期格式不正确' })
      }
      if (isNaN(exp)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['expiryDate'], message: '有效期格式不正确' })
      }
      if (!isNaN(prod) && !isNaN(exp) && exp < prod) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['expiryDate'], message: '到期日期不能早于生产日期' })
      }
      const now = Date.now()
      if (!isNaN(prod) && prod > now) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['productionDate'], message: '生产日期不能晚于当前日期' })
      }
    }
  })

type EquipmentFormValues = z.infer<typeof equipmentFormSchema>

interface EquipmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment?: Equipment | null
  onSuccess: () => void
}

export const EquipmentDialog: React.FC<EquipmentDialogProps> = ({
  open,
  onOpenChange,
  equipment,
  onSuccess,
}) => {
  const log = createLogger('EquipmentDialog')
  const { factory } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [types, setTypes] = useState<EquipmentType[]>([])
  const [typesLoading, setTypesLoading] = useState(false)
  const typesAbortRef = useRef<AbortController | null>(null)

  const isEdit = !!equipment

  const form = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentFormSchema),
    defaultValues: {
      name: '',
      typeId: '',
      location: '',
      specifications: '',
      productionDate: '',
      expiryDate: '',
    },
  })

  // 加载器材类型（可取消）
  useEffect(() => {
    const loadTypes = async () => {
      if (typesAbortRef.current) typesAbortRef.current.abort()
      const controller = new AbortController()
      typesAbortRef.current = controller
      try {
        setTypesLoading(true)
        const response = await equipmentApi.getTypes({ signal: controller.signal })
        if (!controller.signal.aborted && response.success && response.data) {
          setTypes(response.data)
        }
      } catch (error: any) {
        if (error?.name === 'CanceledError' || error?.name === 'AbortError') return
        log.error('加载器材类型失败', error)
      } finally {
        if (!typesAbortRef.current?.signal.aborted) setTypesLoading(false)
      }
    }

    if (open) {
      loadTypes()
    } else if (typesAbortRef.current) {
      typesAbortRef.current.abort()
      typesAbortRef.current = null
    }

    return () => {
      if (typesAbortRef.current) {
        typesAbortRef.current.abort()
        typesAbortRef.current = null
      }
    }
  }, [open])

  // 当器材数据改变时更新表单
  useEffect(() => {
    if (equipment && open) {
      form.reset({
        name: equipment.name,
        typeId: equipment.typeId.toString(),
        location: equipment.location,
        specifications: equipment.specifications || '',
        productionDate: equipment.productionDate.split('T')[0], // 转换为日期格式
        expiryDate: equipment.expiryDate.split('T')[0], // 转换为日期格式
      })
    } else if (open && !equipment) {
      form.reset({
        name: '',
        typeId: '',
        location: '',
        specifications: '',
        productionDate: '',
        expiryDate: '',
      })
    }
  }, [equipment, open, form])

  const onSubmit = async (values: EquipmentFormValues) => {
    try {
      setLoading(true)
      
      // 仅在有值时再拼接时间，避免空字符串生成无效日期字符串
      const buildDate = (d: string, endOfDay = false) => d ? d + (endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z') : undefined
      const submitData = {
        ...values,
        typeId: parseInt(values.typeId),
        factoryId: factory?.id,
        productionDate: buildDate(values.productionDate, false),
        expiryDate: buildDate(values.expiryDate, true),
        // 去除 const 断言避免 TS1355
        status: (equipment?.status || 'NORMAL'),
      }

      if (isEdit && equipment) {
        await equipmentApi.update(equipment.id, submitData)
      } else {
        await equipmentApi.create(submitData)
      }

      onSuccess()
      onOpenChange(false)
      form.reset()
    } catch (error: any) {
      log.error('保存器材失败', error)
      if (isValidationError(error)) {
        const { errors, map, traceId } = extractValidationErrors(error)
        applyRHFBackendErrors(form, errors)
        showValidationSummary(errors.length, traceId)
        focusFirstError(map)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    form.reset()
    if (typesAbortRef.current) {
      typesAbortRef.current.abort()
      typesAbortRef.current = null
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] w-[96vw] overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? '编辑器材' : '添加新器材'}
          </DialogTitle>
          <DialogDescription>
            {isEdit 
              ? '修改器材信息，确保信息准确完整。' 
              : '填写器材基本信息，系统将自动生成二维码。'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* 器材名称 */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>器材名称 *</FormLabel>
                    <FormControl>
                      <Input placeholder="请输入器材名称" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 器材类型 */}
              <FormField
                control={form.control}
                name="typeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>器材类型 *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择器材类型" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {typesLoading ? (
                          <SelectItem value="loading" disabled>
                            加载中...
                          </SelectItem>
                        ) : (
                          types.map((type) => (
                            <SelectItem key={type.id} value={type.id.toString()}>
                              {type.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* 安装位置 */}
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>安装位置 *</FormLabel>
                  <FormControl>
                    <Input placeholder="请输入安装位置" {...field} />
                  </FormControl>
                  <FormDescription>
                    例如：一号车间东侧、办公楼二楼走廊等
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* 规格型号 */}
            <FormField
              control={form.control}
              name="specifications"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>规格型号</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="请输入规格型号和相关参数" 
                      className="resize-none"
                      rows={3}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* 生产日期 */}
              <FormField
                control={form.control}
                name="productionDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>生产日期 *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* 到期日期 */}
              <FormField
                control={form.control}
                name="expiryDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>到期日期 *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormDescription>
                      设备检验或使用的有效截止日期
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={loading}
              >
                取消
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? '保存中...' : (isEdit ? '更新' : '创建')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
