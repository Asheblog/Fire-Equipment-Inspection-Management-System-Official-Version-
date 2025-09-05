import { create } from 'zustand'
import type { EquipmentType, ChecklistTemplate } from '@/types'

interface EquipmentTypeState {
  // 器材类型状态
  equipmentTypes: EquipmentType[]
  loading: boolean
  error: string | null
  
  // Dialog状态
  dialogOpen: boolean
  editingType: EquipmentType | null
  
  // 点检项管理状态
  selectedType: EquipmentType | null
  checklistTemplates: ChecklistTemplate[]
  checklistLoading: boolean
  checklistSheetOpen: boolean
  
  // 器材类型操作
  setEquipmentTypes: (types: EquipmentType[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  
  // Dialog操作
  openAddDialog: () => void
  openEditDialog: (type: EquipmentType) => void
  closeDialog: () => void
  
  // 点检项管理操作
  openChecklistSheet: (type: EquipmentType) => void
  closeChecklistSheet: () => void
  setChecklistTemplates: (templates: ChecklistTemplate[]) => void
  setChecklistLoading: (loading: boolean) => void
  
  // 数据操作
  addEquipmentType: (type: EquipmentType) => void
  updateEquipmentType: (type: EquipmentType) => void
  removeEquipmentType: (id: number) => void
  
  // 点检项数据操作
  addChecklistTemplate: (template: ChecklistTemplate) => void
  updateChecklistTemplate: (template: ChecklistTemplate) => void
  removeChecklistTemplate: (id: number) => void
  reorderChecklistTemplates: (templates: ChecklistTemplate[]) => void
  
  // 重置状态
  reset: () => void
}

export const useEquipmentTypeStore = create<EquipmentTypeState>()((set, get) => ({
  // 初始状态
  equipmentTypes: [],
  loading: false,
  error: null,
  
  // Dialog状态
  dialogOpen: false,
  editingType: null,
  
  // 点检项管理状态
  selectedType: null,
  checklistTemplates: [],
  checklistLoading: false,
  checklistSheetOpen: false,
  
  // 设置数据
  setEquipmentTypes: (types) => set({ equipmentTypes: types }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  
  // Dialog操作
  openAddDialog: () => set({ 
    dialogOpen: true, 
    editingType: null,
    error: null
  }),
  
  openEditDialog: (type) => set({ 
    dialogOpen: true, 
    editingType: type,
    error: null
  }),
  
  closeDialog: () => set({ 
    dialogOpen: false, 
    editingType: null 
  }),
  
  // 点检项管理操作
  openChecklistSheet: (type) => set({
    selectedType: type,
    checklistSheetOpen: true,
    checklistTemplates: [],
    error: null
  }),
  
  closeChecklistSheet: () => set({
    selectedType: null,
    checklistSheetOpen: false,
    checklistTemplates: [],
    checklistLoading: false
  }),
  
  setChecklistTemplates: (templates) => set({ checklistTemplates: templates }),
  setChecklistLoading: (loading) => set({ checklistLoading: loading }),
  
  // 数据操作
  addEquipmentType: (type) => {
    const { equipmentTypes } = get()
    set({ equipmentTypes: [...equipmentTypes, type] })
  },
  
  updateEquipmentType: (updatedType) => {
    const { equipmentTypes } = get()
    set({
      equipmentTypes: equipmentTypes.map(type =>
        type.id === updatedType.id ? updatedType : type
      )
    })
  },
  
  removeEquipmentType: (id) => {
    const { equipmentTypes } = get()
    set({ equipmentTypes: equipmentTypes.filter(type => type.id !== id) })
  },
  
  // 点检项数据操作
  addChecklistTemplate: (template) => {
    const { checklistTemplates } = get()
    set({ checklistTemplates: [...checklistTemplates, template] })
  },
  
  updateChecklistTemplate: (updatedTemplate) => {
    const { checklistTemplates } = get()
    set({
      checklistTemplates: checklistTemplates.map(template =>
        template.id === updatedTemplate.id ? updatedTemplate : template
      )
    })
  },
  
  removeChecklistTemplate: (id) => {
    const { checklistTemplates } = get()
    set({ 
      checklistTemplates: checklistTemplates.filter(template => template.id !== id) 
    })
  },
  
  reorderChecklistTemplates: (templates) => {
    set({ checklistTemplates: templates })
  },
  
  // 重置状态
  reset: () => set({
    equipmentTypes: [],
    loading: false,
    error: null,
    dialogOpen: false,
    editingType: null,
    selectedType: null,
    checklistTemplates: [],
    checklistLoading: false,
    checklistSheetOpen: false
  })
}))

// 选择器辅助函数
export const equipmentTypeSelectors = {
  // 获取统计数据
  getStats: (state: EquipmentTypeState) => ({
    total: state.equipmentTypes.length,
    withEquipments: state.equipmentTypes.filter(t => 
      t.equipmentCount && t.equipmentCount > 0
    ).length,
    withoutChecklist: state.equipmentTypes.filter(t => 
      !t.checklistTemplates || t.checklistTemplates.length === 0
    ).length
  }),
  
  // 根据ID获取类型
  getTypeById: (state: EquipmentTypeState, id: number) => 
    state.equipmentTypes.find(type => type.id === id),
  
  // 检查是否可以删除类型
  canDeleteType: (state: EquipmentTypeState, id: number) => {
    const type = state.equipmentTypes.find(t => t.id === id)
    return type && (!type.equipmentCount || type.equipmentCount === 0)
  },
  
  // 获取当前选中类型的点检项数量
  getCurrentChecklistCount: (state: EquipmentTypeState) => 
    state.checklistTemplates.length
}