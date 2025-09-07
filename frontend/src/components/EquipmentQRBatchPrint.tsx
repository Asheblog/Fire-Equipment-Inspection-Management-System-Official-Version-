import React, { useMemo, useRef, useState } from 'react'
import type { Equipment } from '@/types'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { createLogger } from '@/lib/logger'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

interface EquipmentQRBatchPrintProps {
  open: boolean
  onClose: () => void
  equipments: Equipment[]
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

export const EquipmentQRBatchPrint: React.FC<EquipmentQRBatchPrintProps> = ({ open, onClose, equipments }) => {
  const log = createLogger('EquipmentQRBatchPrint')
  const printContainerRef = useRef<HTMLDivElement>(null)

  // 标签尺寸配置
  const [labelSize, setLabelSize] = useState<LabelPreset>(PRESETS[1]) // 默认 50×50
  const [gapMm, setGapMm] = useState<number>(2) // 统一外边距（与打印窗口 margin:2mm 保持一致）
  const pagePaddingMm = 6 // A4 内页左右/上下 padding (打印 CSS 保持一致)

  // 字段显示配置
  const [fields, setFields] = useState<FieldOptions>({ type: true, location: true, expiry: true, code: true, link: false })

  const toggleField = (key: keyof FieldOptions) => {
    setFields(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const printableList = useMemo(() => {
    return equipments.map(e => ({
      id: e.id,
      name: e.name,
      typeName: e.type?.name || e.equipmentType?.name || '-',
      location: e.location,
      expiryDate: e.expiryDate ? new Date(e.expiryDate).toLocaleDateString() : '-',
      // 若为纯码则构造完整 URL 用于展示与打印（与后端策略保持一致）
      // 保留“纯码”与独立展示逻辑：打印二维码仍使用完整 URL（已在后端生成），文本只显示纯码
      qrCode: e.qrCode,
      fullLink: (e.qrCode && e.qrCode.includes('/m/inspection/'))
        ? e.qrCode
        : (window.location.origin + (e.qrCode ? `/m/inspection/${e.qrCode}` : '')),
      qrImageUrl: e.qrImageUrl || ''
    }))
  }, [equipments])

  // 计算分页（用于预览提示）
  const layoutInfo = useMemo(() => {
    const pageWidth = 210 - pagePaddingMm * 2 // mm
    const pageHeight = 297 - pagePaddingMm * 2 // mm
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
    // 打印窗口：复制内容至新窗口，嵌入基础样式
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
    setTimeout(() => { win.print(); }, 300)
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>批量打印二维码（{equipments.length} 项）</DialogTitle>
        </DialogHeader>
        {/* 工具函数: 提取纯码 */}
        {/* 由于在 JSX 内使用 extractPure，确保其定义在函数后方 */}
        {/* 配置区域 */}
        <div className="mb-3 space-y-3">
          <div className="flex flex-wrap items-end gap-4">
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
            <div className="text-xs text-gray-500 leading-snug">
              <div>A4 计算: {layoutInfo.perRow} 列 × {layoutInfo.perCol} 行 / 页</div>
              <div>每页 {layoutInfo.perPage} 个，共 {layoutInfo.pages} 页</div>
            </div>
          </div>
          <div className="text-[11px] text-amber-600">提示：打印时请关闭浏览器页眉页脚，保持 100% 缩放；若出现分页截断可适当调整系统打印边距。</div>
        </div>

        {/* 预览区域 */}
        <div className="flex-1 overflow-auto" ref={printContainerRef}>
          {printableList.length === 0 && (
            <div className="text-center text-sm text-gray-500 py-10">未选择任何器材</div>
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
                              <img src={item.qrImageUrl} alt={item.name} className="object-contain max-w-full max-h-full" />
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

// 保留短码函数备用（当前未使用，若后续需要可调用）
function formatShort(code: string) {
  if (!code) return ''
  if (code.length <= 16) return code
  return code.slice(0, 8) + '...' + code.slice(-6)
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
