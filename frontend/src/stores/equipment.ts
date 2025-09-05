import { create } from 'zustand'
import type { Equipment, EquipmentType } from '@/types'

interface EquipmentState {
  // 状态
  equipments: Equipment[]
  types: EquipmentType[]
  loading: boolean
  
  // Dialog状态
  dialogOpen: boolean
  editingEquipment: Equipment | null
  
  // 操作
  setEquipments: (equipments: Equipment[]) => void
  setTypes: (types: EquipmentType[]) => void
  setLoading: (loading: boolean) => void
  
  // Dialog操作
  openAddDialog: () => void
  openEditDialog: (equipment: Equipment) => void
  closeDialog: () => void
  
  // 数据操作
  addEquipment: (equipment: Equipment) => void
  updateEquipment: (equipment: Equipment) => void
  removeEquipment: (id: number) => void
}

export const useEquipmentStore = create<EquipmentState>()((set, get) => ({
  // 初始状态
  equipments: [],
  types: [],
  loading: false,
  
  // Dialog状态
  dialogOpen: false,
  editingEquipment: null,
  
  // 设置数据
  setEquipments: (equipments) => set({ equipments }),
  setTypes: (types) => set({ types }),
  setLoading: (loading) => set({ loading }),
  
  // Dialog操作
  openAddDialog: () => set({ 
    dialogOpen: true, 
    editingEquipment: null 
  }),
  
  openEditDialog: (equipment) => set({ 
    dialogOpen: true, 
    editingEquipment: equipment 
  }),
  
  closeDialog: () => set({ 
    dialogOpen: false, 
    editingEquipment: null 
  }),
  
  // 数据操作
  addEquipment: (equipment) => {
    const { equipments } = get()
    set({ equipments: [...equipments, equipment] })
  },
  
  updateEquipment: (updatedEquipment) => {
    const { equipments } = get()
    set({
      equipments: equipments.map(equipment =>
        equipment.id === updatedEquipment.id ? updatedEquipment : equipment
      )
    })
  },
  
  removeEquipment: (id) => {
    const { equipments } = get()
    set({ equipments: equipments.filter(equipment => equipment.id !== id) })
  }
}))