import React, { useMemo, useRef, useState, useEffect } from 'react'
import { useImagePreview } from '@/components/image-preview/ImagePreviewContext'
import type { Equipment, Factory } from '@/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { factoryApi, equipmentApi } from '@/api'

interface EquipmentQRBatchPrintProps {
  open: boolean
  onClose: () => void
  equipments: Equipment[]
  mode?: 'selected' | 'all'
}

// 单个标签宽高 (毫米) 转换为打印 CSS (1mm = 3.78px 约)
const MM = (mm: number) => `${(mm * 3.78).toFixed(2)}px`

interface LabelPreset { label: string; width: number; height: number }
const PRESETS: LabelPreset[] = [
  { label: '40×40mm', width: 40, height: 40 },
  { label: '50×50mm', width: 50, height: 50 },
  { label: '60×50mm', width: 60, height: 50 },
]

interface FieldOptions {
  type: boolean
  location: boolean
  expiry: boolean
  code: boolean // 纯码
  link: boolean // 完整链接
}

export const EquipmentQRBatchPrint: React.FC<EquipmentQRBatchPrintProps> = ({ open, onClose, equipments, mode = 'selected' }) => {
  const printContainerRef = useRef<HTMLDivElement>(null)
  const { open: openPreview } = useImagePreview()

  // 标签尺寸配置
  const [labelSize, setLabelSize] = useState<LabelPreset>(PRESETS[1]) // 默认 50×50
  const gapMm = 2 // 标签外边距
  const pagePaddingMm = 6 // A4 内页 padding

  // 字段显示配置
  const [fields, setFields] = useState<FieldOptions>({ type: true, location: true, expiry: true, code: true, link: false })
  const toggleField = (key: keyof FieldOptions) => setFields(prev => ({ ...prev, [key]: !prev[key] }))

  // 全量模式状态
  const [allEquipments, setAllEquipments] = useState<Equipment[]>([])
  const [allLoading, setAllLoading] = useState(false)
  const [factories, setFactories] = useState<Factory[]>([])
  const [factoryFilter, setFactoryFilter] = useState<number | 'all'>('all')

  // 加载厂区列表（仅 all 模式）
  useEffect(() => {
    if (open && mode === 'all') {
      factoryApi.getList().then(res => {
        if (res.success && Array.isArray(res.data)) setFactories(res.data)
      }).catch(() => {})
    }
  }, [open, mode])

  // 分页抓取全部器材
  const loadAllEquipments = async () => {
    if (allLoading) return
    setAllLoading(true)
    try {
      const result: Equipment[] = []
      let page = 1
      const pageSize = 100
      while (page <= 100) { // 安全上限
        const params: any = { page, pageSize }
        if (factoryFilter !== 'all') params.factoryId = factoryFilter
        const res = await equipmentApi.getList(params)
        if (res.success && res.data?.items) {
          result.push(...res.data.items)
          const totalPages = res.data.totalPages || Math.ceil((res.data.total || 0) / (res.data.pageSize || pageSize))
          if (page >= totalPages) break
          page += 1
        } else {
          break
        }
      }
      setAllEquipments(result)
    } catch (err) {
      console.error('加载全部器材失败', err)
    } finally {
      setAllLoading(false)
    }
  }

  // 打开或筛选变化自动加载
  useEffect(() => {
    if (open && mode === 'all') {
      loadAllEquipments()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, factoryFilter])

  const sourceList = mode === 'all' ? allEquipments : equipments

  const printableList = useMemo(() => {
    return sourceList.map(e => ({
      id: e.id,
      name: e.name,
      typeName: e.type?.name || e.equipmentType?.name || '-',
      location: e.location,
      expiryDate: e.expiryDate ? new Date(e.expiryDate).toLocaleDateString() : '-',
      qrCode: e.qrCode,
      fullLink: (e.qrCode && e.qrCode.includes('/m/inspection/'))
        ? e.qrCode
        : (window.location.origin + (e.qrCode ? `/m/inspection/${e.qrCode}` : '')),
      qrImageUrl: e.qrImageUrl || ''
    }))
  }, [sourceList])

  // 计算分页（用于预览提示）
  const layoutInfo = useMemo(() => {
    const pageWidth = 210 - pagePaddingMm * 2
    const pageHeight = 297 - pagePaddingMm * 2
    const totalWidthPer = labelSize.width + gapMm * 2
    const totalHeightPer = labelSize.height + gapMm * 2
    const perRow = Math.max(1, Math.floor(pageWidth / totalWidthPer))
    const perCol = Math.max(1, Math.floor(pageHeight / totalHeightPer))
    const perPage = perRow * perCol
    const pages = Math.ceil(printableList.length / perPage) || 1
    return { perRow, perCol, perPage, pages }
  }, [printableList.length, labelSize, gapMm])

  const pagedData = useMemo(() => {
    const pages: typeof printableList[] = []
    if (!layoutInfo.perPage) return []
    for (let i = 0; i < printableList.length; i += layoutInfo.perPage) {
      pages.push(printableList.slice(i, i + layoutInfo.perPage))
    }
    return pages
  }, [printableList, layoutInfo])

  const handlePrint = () => {
    if (!printableList.length) return
    const win = window.open('', '_blank')
    if (!win) return
    const doc = win.document
    doc.write(`<!DOCTYPE html><html><head><title>批量二维码打印</title><meta charset='utf-8' />` +
      `<style>
        * { box-sizing: border-box; }
        body { margin:0; font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans',sans-serif; }
        .sheet { width: 210mm; height: 297mm; margin:0 auto; padding:${pagePaddingMm}mm ${pagePaddingMm}mm 0 ${pagePaddingMm}mm; display:flex; flex-wrap:wrap; page-break-after:always; }
        .sheet:last-child { page-break-after: auto; }
        .label { width:${labelSize.width}mm; height:${labelSize.height}mm; border:1px solid #ccc; margin:${gapMm}mm; padding:2mm; display:flex; flex-direction:column; }
        .name { font-weight:600; font-size:11px; line-height:1.15; flex-shrink:0; margin-bottom:1mm; }
        .qr { width:100%; flex:1; min-height:0; display:flex; align-items:center; justify-content:center; overflow:hidden; }
        .qr img { width:100%; max-height:100%; height:auto; object-fit:contain; }
        .meta { font-size:9.5px; line-height:1.25; word-break:break-all; flex-shrink:0; margin-top:1mm; }
        @media print { .label { break-inside: avoid; } }
      </style></head><body>`)
    pagedData.forEach(pageItems => {
      doc.write('<div class="sheet">')
      pageItems.forEach(item => {
        const lines: string[] = []
        if (fields.type) lines.push(`类型: ${escapeHtml(item.typeName)}`)
        if (fields.location) lines.push(`位置: ${escapeHtml(item.location)}`)
        if (fields.expiry) lines.push(`到期: ${escapeHtml(item.expiryDate)}`)
        if (fields.code) lines.push(`纯码: <span style='display:block;word-break:break-all;'>${escapeHtml(item.qrCode.includes('/m/inspection/') ? extractPure(item.qrCode) : item.qrCode)}</span>`)
        if (fields.link) lines.push(`链接: <span style='display:block;word-break:break-all;'>${escapeHtml(item.fullLink)}</span>`)
        doc.write(`<div class='label'>` +
          `<div class='name'>${escapeHtml(item.name)}</div>` +
          `<div class='qr'>${item.qrImageUrl ? `<img src='${item.qrImageUrl}' alt='QR' />` : `<div style='font-size:10px;color:#999'>无二维码</div>`}</div>` +
          `<div class='meta'>${lines.join('<br/>')}</div>` +
          `</div>`)
      })
      doc.write('</div>')
    })
    doc.write('</body></html>')
    doc.close()
    win.focus()
    setTimeout(() => { win.print() }, 300)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl h-[82vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>批量打印二维码（{mode === 'all' ? printableList.length : equipments.length} 项{mode === 'all' ? ' - 全部' : ''}）</DialogTitle>
        </DialogHeader>

        {/* 配置区域 */}
        <div className="mb-3 space-y-3">
          <div className="flex flex-wrap items-end gap-6">
            <div>
              <Label className="text-xs">标签尺寸</Label>
              <div className="flex gap-2 mt-1">
                {PRESETS.map(p => (
                  <Button
                    key={p.label}
                    type="button"
                    variant={p.label === labelSize.label ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLabelSize(p)}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">字段显示</Label>
              <div className="flex flex-wrap gap-3 mt-1 text-xs">
                <label className="flex items-center gap-1 cursor-pointer">
                  <Checkbox checked={fields.type} onCheckedChange={() => toggleField('type')} /> 类型
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <Checkbox checked={fields.location} onCheckedChange={() => toggleField('location')} /> 位置
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <Checkbox checked={fields.expiry} onCheckedChange={() => toggleField('expiry')} /> 到期
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <Checkbox checked={fields.code} onCheckedChange={() => toggleField('code')} /> 纯码
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <Checkbox checked={fields.link} onCheckedChange={() => toggleField('link')} /> 链接
                </label>
              </div>
            </div>
            {mode === 'all' && (
              <div className="flex flex-col gap-1 text-xs min-w-[200px]">
                <Label className="text-xs">厂区筛选</Label>
                <div className="flex items-center gap-2">
                  <select
                    className="border rounded px-2 py-1 text-xs"
                    value={factoryFilter}
                    onChange={e => setFactoryFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  >
                    <option value="all">全部</option>
                    {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                  <Button size="sm" variant="outline" onClick={loadAllEquipments} disabled={allLoading}>刷新</Button>
                </div>
                <div className="text-[11px] text-gray-500">{allLoading ? '加载中...' : `已加载 ${allEquipments.length} 条`}</div>
              </div>
            )}
            <div className="text-[11px] text-gray-500 leading-snug">
              <div>A4 计算: {layoutInfo.perRow} 列 × {layoutInfo.perCol} 行 / 页</div>
              <div>每页 {layoutInfo.perPage} 个，共 {layoutInfo.pages} 页</div>
            </div>
          </div>
          <div className="text-[11px] text-amber-600">提示：打印时请关闭浏览器页眉页脚，保持 100% 缩放；若出现分页截断可适当调整系统打印边距。</div>
        </div>

        {/* 预览区域 */}
        <div className="flex-1 overflow-auto" ref={printContainerRef}>
          {printableList.length === 0 && !allLoading && (
            <div className="text-center text-sm text-gray-500 py-10">{mode === 'all' ? '暂无数据（可尝试重新加载）' : '未选择任何器材'}</div>
          )}
          {allLoading && (
            <div className="text-center text-sm text-gray-500 py-10">加载中...</div>
          )}
          <div className="space-y-6">
            {pagedData.map((page, pi) => (
              <div key={pi} className="border rounded-md p-2 bg-gray-50">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-xs font-medium text-gray-600">第 {pi + 1} 页预览</div>
                  <div className="text-[10px] text-gray-400">{page.length}/{layoutInfo.perPage} (A4)</div>
                </div>
                <div
                  className="relative mx-auto bg-white"
                  style={{
                    width: MM(210),
                    minHeight: MM(297),
                    padding: MM(pagePaddingMm),
                    border: '1px dashed #ddd'
                  }}
                >
                  <div className="flex flex-wrap" style={{ margin: `-${gapMm}mm` }}>
                    {page.map(item => {
                      const lines: string[] = []
                      if (fields.type) lines.push(`类型: ${item.typeName}`)
                      if (fields.location) lines.push(`位置: ${item.location}`)
                      if (fields.expiry) lines.push(`到期: ${item.expiryDate}`)
                      if (fields.code) lines.push(`纯码: ${item.qrCode.includes('/m/inspection/') ? extractPure(item.qrCode) : item.qrCode}`)
                      if (fields.link) lines.push(`链接: ${item.fullLink}`)
                      return (
                        <div
                          key={item.id}
                          style={{
                            width: MM(labelSize.width),
                            height: MM(labelSize.height),
                            margin: `${gapMm}mm`,
                            padding: MM(2),
                            border: '1px solid #ccc',
                            display: 'flex',
                            flexDirection: 'column'
                          }}
                          className="shadow-sm"
                        >
                          <div className="text-[10px] font-semibold leading-tight line-clamp-2 mb-[2px]" title={item.name}>{item.name}</div>
                          <div className="flex-1 flex items-center justify-center overflow-hidden min-h-0">
                            {item.qrImageUrl ? (
                              <img src={item.qrImageUrl} alt={item.name} className="object-contain max-w-full max-h-full cursor-zoom-in" onClick={() => openPreview([item.qrImageUrl], 0)} />
                            ) : (
                              <span className="text-[9px] text-gray-400">无二维码</span>
                            )}
                          </div>
                          <div className="text-[8.5px] leading-tight mt-[2px] space-y-0.5 font-mono flex-shrink-0 break-all">
                            {lines.map(l => <div key={l} className="whitespace-pre-wrap break-all">{l}</div>)}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-between items-center pt-2">
          <div className="text-xs text-gray-500 space-y-0.5">
            <div>自动使用现有缓存的二维码图片；如为空可单独生成后再批量。</div>
            <div>最终打印布局以浏览器打印预览为准。</div>
          </div>
          <div className="space-x-2">
            <Button variant="outline" size="sm" onClick={onClose}>关闭</Button>
            <Button size="sm" onClick={handlePrint} disabled={!printableList.length}>打印</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function extractPure(full: string) {
  if (!full) return ''
  if (!full.includes('/m/inspection/')) return full
  return full.split('/m/inspection/').pop() || full
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
