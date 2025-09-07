// 通用图片字段解析工具
// 支持数组字段、JSON字符串字段、单字段兼容

export interface ParseOptions {
  arrayFields: string[]        // 优先解析的数组或 JSON 字段名（按优先级顺序）
  singleFallback?: string      // 向下兼容的单图片字段
}

export function parseImageList(source: any, opts: ParseOptions): string[] {
  if (!source) return []
  const { arrayFields, singleFallback } = opts
  for (const field of arrayFields) {
    const val = (source as any)[field]
    if (!val) continue
    if (Array.isArray(val)) {
      const filtered = val.filter(Boolean)
      if (filtered.length) return filtered
    } else if (typeof val === 'string') {
      try {
        let parsed: any = JSON.parse(val)
        if (typeof parsed === 'string') { // 双层序列化场景
          try { parsed = JSON.parse(parsed) } catch (_) { /* ignore */ }
        }
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(Boolean)
          if (filtered.length) return filtered
        }
      } catch (_) {/* ignore */}
    }
  }
  if (singleFallback && (source as any)[singleFallback]) {
    return [(source as any)[singleFallback]].filter(Boolean)
  }
  return []
}

// 语义化封装
export const parseInspectionImages = (data: any) =>
  parseImageList(data, { arrayFields: ['inspectionImages', 'inspectionImageUrls'], singleFallback: 'inspectionImageUrl' })

export const parseIssueImages = (issue: any) =>
  parseImageList(issue, { arrayFields: ['issueImages', 'issueImageUrls'], singleFallback: 'issueImageUrl' })

export const parseFixedImages = (issue: any) =>
  parseImageList(issue, { arrayFields: ['fixedImages', 'fixedImageUrls'], singleFallback: 'fixedImageUrl' })
