# 统一图片预览（Image Preview）

本项目已内置全局图片预览能力，支持放大/缩小、双击放大/还原、拖拽平移、双指捏合（移动端）、左右切换、键盘操作、底部缩略图导航和下载当前图片等功能。

## 功能点
- 放大/缩小：支持鼠标滚轮、工具栏按钮、双击。
- 平移：放大后可拖拽平移，自动限制边界，防止“丢图”。
- 切换：左右按钮、键盘 ←/→、移动端左右滑动（未放大时，阈值默认 60px）。
- 缩略图：底部缩略图条，点击可跳转到指定图片（可配置开关）。
- 下载：一键下载当前图片（受保护资源通过 `api.getFile` 自动携带 Token）。
- 预加载：邻近预加载，释放对象 URL，避免内存泄漏。

## 快速开始
1) 在入口注入 Provider（仓库已接入，可按需配置）：

```tsx
// frontend/src/main.tsx
import { ImagePreviewProvider } from '@/components/image-preview/ImagePreviewContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ImagePreviewProvider
      thumbnails={true}
      enableDownload={true}
      swipeThreshold={60}
    >
      <App />
    </ImagePreviewProvider>
  </React.StrictMode>,
)
```

2) 组件内唤起预览：

```tsx
import { useImagePreview } from '@/components/image-preview/ImagePreviewContext'

const { open } = useImagePreview()

// 单图
open([imageUrl], 0)

// 多图（组内左右切换）
open(imageUrls, startIndex)
```

3) 与 `AuthenticatedImage` 对接：

```tsx
<AuthenticatedImage
  src={url}
  enableZoom
  onOpenPreview={() => open(imageUrls, idx)}
/>
```

## Provider 配置
- `thumbnails?: boolean`：显示底部缩略图条，默认 `true`。
- `enableDownload?: boolean`：显示下载按钮，默认 `true`。
- `swipeThreshold?: number`：移动端左右滑动切换阈值（像素），默认 `60`。

## 键盘与手势
- Esc：关闭
- ←/→：上一张/下一张
- 鼠标滚轮：缩放
- 双击/双击触摸：在 1x 与 2x 之间切换
- 双指捏合：缩放（移动端）
- 未放大时左右滑动超过阈值：切换图片

## 已接入位置（示例）
- 网格组件：`frontend/src/components/ui/ImageGrid.tsx`
- 巡检记录详情：`frontend/src/pages/InspectionRecordsPage.tsx`
- 我的问题详情：`frontend/src/pages/MyIssuesPage.tsx`
- 二维码弹窗：`frontend/src/components/QRCodeModal.tsx`
- 批量二维码打印预览：`frontend/src/components/EquipmentQRBatchPrint.tsx`

## 注意事项
- 摄像头拍摄流程的临时/本地 `blob:` 预览图（`frontend/src/components/MultiCameraCapture.tsx`）默认不接入统一预览；如需支持，可扩展统一预览对 `blob:` URL 的直接展示（绕过 `api.getFile`）。
- 打印 HTML 字符串模板内的 `<img>` 不接入统一预览（非 React DOM）。
