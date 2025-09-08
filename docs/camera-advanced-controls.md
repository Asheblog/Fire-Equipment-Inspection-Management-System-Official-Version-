# 前端相机高级控制说明（闪光 / 对焦）

本文件说明新增加的纯 Web 相机增强能力（不依赖 App / 小程序），包含闪光模式与手动/单次对焦。所有能力均为“尽力支持”，在不支持的设备上自动隐藏 UI，不影响原有拍照功能。

## 1. 功能概览

| 能力 | 模式/交互 | 条件 | 不支持时行为 |
| ---- | -------- | ---- | ------------ |
| 闪光（补光） | off / burst / torch | 设备 video track `getCapabilities()` 包含 `torch` 则可用 torch；没有也可做 burst 尝试（若仍失败自动降级） | 按钮仍显示（仅 off / burst 循环），或直接 off |
| 对焦 | single-shot 点击对焦 / manual 垂直位置映射 | `focusMode` 含 `single-shot` 或 `focusDistance` 有 min/max | 不显示对焦提示/框 |
| 自动降级 | 统一 | 缺少相关 capability | UI 不出现，无报错 |

## 2. 主要新增文件与修改点

| 文件 | 说明 |
| ---- | ---- |
| `frontend/src/camera/types.ts` | 新增 `FlashMode`、`TrackControls`、`TrackControlsSupport`、`getTrackControls()` 扩展 |
| `frontend/src/camera/trackControls.ts` | 封装底层能力检测与 `applyConstraints` 调用（torch / single-shot / manual focus） |
| `frontend/src/camera/streamSession.ts` | 在会话创建时实例化 `trackControls` 并通过 session 暴露 |
| `frontend/src/components/NewCameraCapture.tsx` | 新增闪光/对焦 UI、burst 拍照逻辑、点击画面对焦映射 |

## 3. 闪光模式说明

- `off`: 不做任何补光。
- `burst`: 拍照前如果支持 torch，调用 `setTorch(true)`，等待约 100ms（给传感器适配曝光），完成 capture 后再关闭。
  - 若设备不支持 torch 或调用失败，静默降级为普通拍照。
- `torch`: 按按钮循环进入该状态时立即常亮；切换至其它模式时关闭。
  - 常亮可能发热 / 耗电，需要用户自行管理（UI 不自动超时关闭）。

## 4. 对焦交互逻辑

1. 读取 `track.getCapabilities()`：
   - 若 `focusMode` 数组包含 `single-shot`：支持单次对焦。
   - 若存在 `focusDistance.min/max`：支持手动对焦范围，映射手动模式。
2. 点击预览区域：
   - 若支持 manual：用点击位置的垂直坐标 `ratio = 1 - (y/height)` 映射到焦距，调用 `setManualFocus(ratio)`.
   - 否则若支持 single-shot：调用 `applySingleShotFocus()`.
3. 显示一个 40x40 的黄色对焦框 ~900ms，纯视觉反馈；即使硬件失败也不报错中断。

## 5. 失败与降级策略

| 场景 | 处理 |
| ---- | ---- |
| `getCapabilities()` 不存在 | `trackControls` = null，UI 不显示高级按钮 |
| `torch` 不在 capability | 闪光循环只在 off / burst 之间切换；torch 模式自动忽略/降级 |
| `applyConstraints` 抛错 | `console.warn` 输出，不影响主流程或 capture |
| 会话销毁 | 清空 `trackControls` 与 UI 状态，自动隐藏按钮 |

## 6. 组件外部 API 不变更点

- 既有的 `onCapture(file, meta)`、传入的 `SessionOptions` 原有字段保持兼容。
- 可通过 `initialFlashMode`（可选）指定初始闪光模式，若设置为 `torch` 但设备不支持，会自动降级为 `off`。

## 7. 开发 / 调试建议

1. 桌面 Chrome：
   - 使用 DevTools 模拟设备或直接 USB 连接真机观察 `console.warn`。
2. Android 真机：
   - 重点验证 torch（常亮、burst）行为。
3. iOS Safari：
   - 大概率仅得到自动对焦，`torch` 与手动对焦按钮隐藏。
4. 可以在 Debug / 日志面板里临时输出：  
   `session.getTrackControls()?.getSupport()` JSON 以确认能力对象。

## 8. 常见问答

| 问题 | 说明 |
| ---- | ---- |
| 为什么没有“真正闪一下瞬间补光”？ | Web 标准未提供 still flash API；用 torch 短亮模拟。 |
| iOS 为什么没有按钮？ | iOS Safari 版本普遍缺乏相关 capability，属于平台限制。 |
| manual 焦距方向是否准确？ | 浏览器实现未统一，当前线性映射可能与真实远/近方向不同；若需更一致体验需原生层支持。 |

## 9. 后续可能扩展（暂未实现）

- 双击复位对焦到自动
- 曝光锁/曝光补偿（若 `exposureMode` / `exposureCompensation` 能力存在）
- UI 滑条实时调焦（现阶段使用点击垂直位置映射，减少 UI 复杂度）

## 10. 示例：检测支持

```ts
const controls = session.getTrackControls();
if (controls) {
  const sup = controls.getSupport();
  if (sup.torch) { /* 显示闪光按钮 */ }
  if (sup.focus.manual || sup.focus.singleShot) { /* 显示对焦提示 */ }
}
```

## 11. 兼容性提醒

| 能力 | Android Chrome | iOS Safari | 桌面 Chrome | 桌面 Firefox |
| ---- | -------------- | ---------- | ----------- | ------------ |
| getCapabilities() | 通常支持 | 部分支持/缺失字段 | 支持 | 支持 |
| torch | 较多设备支持 | 基本不支持 | 无（大多数无物理 LED） | 不支持 |
| focusDistance | 部分支持 | 基本不支持 | 依设备 | 依设备 |
| single-shot focusMode | 部分支持 | 通常不支持 | 依设备 | 依设备 |

> 表格为经验性总结，实际需以 `getCapabilities()` 结果为准。

---

如需后续扩展或发现异常（例如特定机型 torch 长亮失败），可在此文档追加调试案例。
