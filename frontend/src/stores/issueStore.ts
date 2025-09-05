import { create } from 'zustand'
import type { Issue } from '@/types'

interface IssueState {
  // 状态
  issues: Issue[]
  loading: boolean
  
  // 对话框状态
  viewDialog: { open: boolean; issue: Issue | null }
  handleDialog: { open: boolean; issue: Issue | null }
  auditDialog: { open: boolean; issue: Issue | null }
  
  // 表单状态
  handleForm: {
    solution: string
    // 多图片支持
    fixedImages: string[]
    // 向下兼容
    fixedImage: File | null
    uploading: boolean
  }
  auditForm: {
    approved: boolean
    auditNote: string
  }
  
  // 分页状态
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  
  // 操作
  setIssues: (issues: Issue[]) => void
  setLoading: (loading: boolean) => void
  setPagination: (pagination: any) => void
  
  // 对话框操作
  openViewDialog: (issue: Issue) => void
  openHandleDialog: (issue: Issue) => void
  openAuditDialog: (issue: Issue) => void
  closeAllDialogs: () => void
  
  // 表单操作
  updateHandleForm: (form: Partial<IssueState['handleForm']>) => void
  updateAuditForm: (form: Partial<IssueState['auditForm']>) => void
  resetForms: () => void
  
  // 数据操作
  addIssue: (issue: Issue) => void
  updateIssue: (issue: Issue) => void
  removeIssue: (id: number) => void
}

export const useIssueStore = create<IssueState>()((set, get) => ({
  // 初始状态
  issues: [],
  loading: false,
  
  // 对话框状态
  viewDialog: { open: false, issue: null },
  handleDialog: { open: false, issue: null },
  auditDialog: { open: false, issue: null },
  
  // 表单状态
  handleForm: {
    solution: '',
    fixedImages: [],
    fixedImage: null,
    uploading: false
  },
  auditForm: {
    approved: true,
    auditNote: ''
  },
  
  // 分页状态
  pagination: {
    page: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0
  },
  
  // 设置数据
  setIssues: (issues) => set({ issues }),
  setLoading: (loading) => set({ loading }),
  setPagination: (pagination) => set({ pagination }),
  
  // 对话框操作
  openViewDialog: (issue) => set({ 
    viewDialog: { open: true, issue } 
  }),
  
  openHandleDialog: (issue) => set({ 
    handleDialog: { open: true, issue } 
  }),
  
  openAuditDialog: (issue) => set({ 
    auditDialog: { open: true, issue } 
  }),
  
  closeAllDialogs: () => set({
    viewDialog: { open: false, issue: null },
    handleDialog: { open: false, issue: null },
    auditDialog: { open: false, issue: null }
  }),
  
  // 表单操作
  updateHandleForm: (form) => {
    const { handleForm } = get()
    set({ handleForm: { ...handleForm, ...form } })
  },
  
  updateAuditForm: (form) => {
    const { auditForm } = get()
    set({ auditForm: { ...auditForm, ...form } })
  },
  
  resetForms: () => set({
    handleForm: {
      solution: '',
      fixedImages: [],
      fixedImage: null,
      uploading: false
    },
    auditForm: {
      approved: true,
      auditNote: ''
    }
  }),
  
  // 数据操作
  addIssue: (issue) => {
    const { issues } = get()
    set({ issues: [...issues, issue] })
  },
  
  updateIssue: (updatedIssue) => {
    const { issues } = get()
    set({
      issues: issues.map(issue =>
        issue.id === updatedIssue.id ? updatedIssue : issue
      )
    })
  },
  
  removeIssue: (id) => {
    const { issues } = get()
    set({ issues: issues.filter(issue => issue.id !== id) })
  }
}))