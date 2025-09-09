/**
 * 新相机模块 - 公共类型定义
 * 分层：
 *  - constraints: 负责生成多套候选 MediaStreamConstraints
 *  - deviceManager: 权限检测 + 创建 StreamSession
 *  - streamSession: 管理 MediaStream、video 元素、状态机、稳定帧检测
 *  - frameProcessor: 单次帧裁剪/旋转/水印/导出
 *  - errors: 标准化错误码
 *  - utils: 工具函数
 *
 * 设计目标：
 *  - iOS 上方向与比例稳定
 *  - 移除旧实现全局锁定副作用
 *  - 以更清晰的状态机和可测试的纯函数组件化
 */

export type OrientationPolicy = 'auto' | 'lockPortrait' | 'lockLandscape' | 'followDevice';

export interface AspectPolicyNative {
  type: 'native';
}
export interface AspectPolicyForce {
  type: 'force';
  value: number; // 宽/高 比，如 4/3
}
export type AspectPolicy = AspectPolicyNative | AspectPolicyForce;

export interface StabilizationConfig {
  minStableFrames?: number;     // 默认 3
  timeoutMs?: number;           // 默认 1500
}

export type FlashMode = 'off' | 'burst' | 'torch';

/**
 * 拓展：摄像头能力抽象
 * （仅在支持时才显示 UI，不支持的浏览器不暴露按钮）
 */
export interface TrackControlsSupport {
  torch: boolean;
  focus: {
    singleShot: boolean;
    manual: { min: number; max: number } | null;
  };
}

export interface TrackControls {
  hasTorch(): boolean;
  setTorch(on: boolean): Promise<boolean>;
  getSupport(): TrackControlsSupport;
  applySingleShotFocus(): Promise<boolean>;
  /**
   * ratio: 0~1 映射到可用对焦距离（0 = 最小 / 远；1 = 最大 / 近；具体取决于浏览器实现）
   */
  setManualFocus(ratio: number): Promise<boolean>;
  /** 可选：设置对焦点坐标（0~1），若不支持返回 false */
  setPointOfInterest?(nx: number, ny: number): Promise<boolean>;
}

export interface SessionOptions {
  facingMode?: 'environment' | 'user';
  /** 指定具体设备（优先级高于 facingMode）。当不可用时自动回退 */
  deviceId?: string;
  orientationPolicy?: OrientationPolicy;
  aspectPolicy?: AspectPolicy;
  preferResolutions?: Array<{ width: number; height: number }>;
  stabilization?: StabilizationConfig;
  maxWidth?: number;        // 限制输出最大宽度（不指定则使用原始裁剪宽度）
  quality?: number;         // 0-1 JPEG 质量
  watermark?: boolean;
  watermarkBuilder?: () => string;
  debug?: boolean;          // 控制台输出调试信息

  /**
   * 初始闪光模式（仅影响 UI 初始化，不是底层约束）
   * 'torch' 模式仅在设备支持连续补光时可用
   */
  initialFlashMode?: FlashMode;
}

export interface CaptureMeta {
  rawWidth: number;
  rawHeight: number;
  cropWidth: number;
  cropHeight: number;
  finalWidth: number;
  finalHeight: number;
  rotation: 0 | 90 | 180 | 270;
  aspectEnforced?: number;
  stableFrames: number;
  orientationPolicy: OrientationPolicy;
  timestamp: number;
}

export interface CaptureResult {
  file: File;
  meta: CaptureMeta;
}

export type SessionPhase =
  | 'idle'
  | 'requesting'
  | 'starting'
  | 'stabilizing'
  | 'ready'
  | 'error'
  | 'destroyed';

export interface SessionStateBase {
  phase: SessionPhase;
}

export interface SessionStateIdle extends SessionStateBase {
  phase: 'idle';
}
export interface SessionStateRequesting extends SessionStateBase {
  phase: 'requesting';
}
export interface SessionStateStarting extends SessionStateBase {
  phase: 'starting';
  attempt: number;
}
export interface SessionStateStabilizing extends SessionStateBase {
  phase: 'stabilizing';
  observed: number;
  lastDimension?: { w: number; h: number };
}
export interface SessionStateReady extends SessionStateBase {
  phase: 'ready';
  dimension: { w: number; h: number };
  stableFrames: number;
}
export interface SessionStateError extends SessionStateBase {
  phase: 'error';
  code: CameraErrorCode;
  message: string;
}
export interface SessionStateDestroyed extends SessionStateBase {
  phase: 'destroyed';
}

export type SessionState =
  | SessionStateIdle
  | SessionStateRequesting
  | SessionStateStarting
  | SessionStateStabilizing
  | SessionStateReady
  | SessionStateError
  | SessionStateDestroyed;

export const CameraErrorCode = {
  PermissionDenied: 'PermissionDenied',
  NotSupported: 'NotSupported',
  ConstraintFailed: 'ConstraintFailed',
  StabilizationTimeout: 'StabilizationTimeout',
  StreamEnded: 'StreamEnded',
  CaptureInterrupted: 'CaptureInterrupted',
  Unknown: 'Unknown'
} as const;
export type CameraErrorCode = typeof CameraErrorCode[keyof typeof CameraErrorCode];

export interface StreamSession {
  getState(): SessionState;
  onStateChange(cb: (s: SessionState) => void): () => void;
  getVideoEl(): HTMLVideoElement;
  capture(): Promise<CaptureResult>;
  destroy(): void;
  /**
   * 可能返回 null（例如非常旧的浏览器没有 getCapabilities）
   */
  getTrackControls(): TrackControls | null;
}

export interface CameraDeviceManager {
  ensurePermission(): Promise<'granted' | 'denied'>;
  createSession(options?: SessionOptions): Promise<StreamSession>;
}

/**
 * 默认配置建议，可在外部引用后做浅拷贝修改
 */
export const DEFAULT_SESSION_OPTIONS: Required<Pick<SessionOptions,
  'orientationPolicy' | 'aspectPolicy' | 'preferResolutions' | 'stabilization' | 'maxWidth' | 'quality' | 'watermark'
>> = {
  orientationPolicy: 'auto',
  aspectPolicy: { type: 'native' },
  preferResolutions: [
    { width: 1920, height: 1440 },
    { width: 1600, height: 1200 },
    { width: 1280, height: 960 },
    { width: 1024, height: 768 },
    // 允许 16:9 作为 fallback
    { width: 1280, height: 720 }
  ],
  stabilization: { minStableFrames: 3, timeoutMs: 1500 },
  maxWidth: 1600,
  quality: 0.9,
  watermark: true
};

/**
 * 缺省水印构造函数
 */
export function defaultWatermarkBuilder(): string {
  const ts = new Date().toISOString();
  const nonce = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${ts} • ${nonce}`;
}
