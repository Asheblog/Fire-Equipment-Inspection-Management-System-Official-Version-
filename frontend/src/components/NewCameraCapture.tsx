import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createCameraDeviceManager } from '@/camera/deviceManager';
import type {
  SessionOptions,
  OrientationPolicy,
  AspectPolicy,
  CaptureResult,
  StreamSession
} from '@/camera/types';
import { CameraErrorCode } from '@/camera/types';

/**
 * 新版拍照组件 NewCameraCapture
 *
 * 设计要点：
 *  - 不再使用任何全局 FIRST_CAPTURE_PROFILE / 方向锁定副作用
 *  - 通过底层 session 状态机 (idle → requesting → starting → stabilizing → ready → error → destroyed)
 *  - 仅在 capture() 时进行像素级旋转/裁剪，预览保持真实原始流方向，避免 CSS rotate 侧效
 *  - iOS: 利用多帧稳定策略，等待尺寸稳定（默认 minStableFrames=3 / timeout 1500ms）
 *
 * 与旧 CameraCapture 差异：
 *  - props 更精简，可选地兼容旧调用场景（compact / captureLabel / fallbackLabel 等）
 *  - 不再提供 stopAfterCapture（由父层控制：若需持续拍摄则保持 session）
 *
 * Props:
 *  - onCapture(file: File, meta?) 产出回调
 *  - orientationPolicy: 'auto' | 'lockPortrait' | 'lockLandscape' | 'followDevice'
 *  - aspectPolicy: { type: 'native' } | { type: 'force', value: number }
 *  - maxWidth / quality / watermark / watermarkBuilder
 *  - facingMode: 'environment' | 'user'
 *  - debug: 输出底层调试（console + overlay）
 *  - autoStart: 是否自动启动
 *  - compact: UI 紧凑模式（按钮布局更精简，常用于弹窗内连续拍摄）
 *  - captureLabel / fallbackLabel
 *  - allowFileFallback: 是否允许文件选择作为兜底
 */

export interface NewCameraCaptureProps {
  onCapture: (file: File, meta?: CaptureResult['meta']) => void;
  onError?: (err: Error) => void;

  orientationPolicy?: OrientationPolicy;
  aspectPolicy?: AspectPolicy;
  maxWidth?: number;
  quality?: number;
  watermark?: boolean;
  watermarkBuilder?: () => string;
  facingMode?: 'environment' | 'user';
  debug?: boolean;

  autoStart?: boolean;
  compact?: boolean;
  captureLabel?: string;
  fallbackLabel?: string;
  allowFileFallback?: boolean;

  /** 连续拍摄模式：默认 true（保持同一流），如果为 false 每次成功拍摄后销毁流再等待用户重新启动 */
  continuous?: boolean;
}

interface UIState {
  phase: string;
  stableFrames?: number;
  dimension?: { w: number; h: number };
  errorCode?: CameraErrorCode;
  errorMessage?: string;
}

const deviceManagerSingleton = createCameraDeviceManager();

export const NewCameraCapture: React.FC<NewCameraCaptureProps> = ({
  onCapture,
  onError,
  orientationPolicy = 'auto',
  aspectPolicy = { type: 'native' },
  maxWidth = 1600,
  quality = 0.9,
  watermark = true,
  watermarkBuilder,
  facingMode = 'environment',
  debug = false,
  autoStart = true,
  compact = false,
  captureLabel = '拍照',
  fallbackLabel = '文件选择',
  allowFileFallback = true,
  continuous = true
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
const sessionRef = useRef<StreamSession | null>(null);
const startSeqRef = useRef(0); // 启动尝试序号，避免竞态
const phaseRef = useRef('idle');
  const mountedRef = useRef(true);
  const [uiState, setUiState] = useState<UIState>({ phase: 'idle' });
  // 同步 phaseRef
  useEffect(() => { phaseRef.current = uiState.phase; }, [uiState.phase]);
  const [needUserGesture, setNeedUserGesture] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [notSupported, setNotSupported] = useState(false);
  const [starting, setStarting] = useState(false);
  const videoAttachedRef = useRef(false);

  // 新增：拍照状态与冷却控制
  const [capturing, setCapturing] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [showShotFeedback, setShowShotFeedback] = useState(false);
  const cooldownTimerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) window.clearTimeout(cooldownTimerRef.current);
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  // 内部启动逻辑
  const startSession = useCallback(async (userGesture = false) => {
    if (starting) return;
    const seq = ++startSeqRef.current;
    if (debug) console.log('[NewCameraCapture] startSession attempt', seq, { userGesture });

    setStarting(true);
    setNeedUserGesture(false);
    setPermissionDenied(false);
    setNotSupported(false);
    setUiState({ phase: 'requesting' });

    // 先销毁旧会话，避免并发占用导致新流卡住
    if (sessionRef.current) {
      try { sessionRef.current.destroy(); } catch {}
      sessionRef.current = null;
      videoAttachedRef.current = false;
      if (containerRef.current) containerRef.current.innerHTML = '';
    }

    const options: SessionOptions = {
      orientationPolicy,
      aspectPolicy,
      maxWidth,
      quality,
      watermark,
      watermarkBuilder,
      facingMode,
      debug
    };

    // 看门狗: 若 2 秒内没有进入 stabilizing/ready 且视频未附着，提示需要用户手势
    const watchdog = window.setTimeout(() => {
      if (!mountedRef.current) return;
      if (startSeqRef.current !== seq) return;
      if (!videoAttachedRef.current && (phaseRef.current === 'requesting' || phaseRef.current === 'starting')) {
        if (debug) console.warn('[NewCameraCapture] watchdog fallback -> need user gesture');
        setStarting(false);
        setNeedUserGesture(true);
      }
    }, 2000);

    try {
      const session = await deviceManagerSingleton.createSession(options);
      if (startSeqRef.current !== seq) {
        // 已有新启动尝试，丢弃本次
        if (debug) console.log('[NewCameraCapture] stale session discarded', seq);
        try { session.destroy(); } catch {}
        return;
      }
      if (!mountedRef.current) {
        session.destroy();
        return;
      }
      sessionRef.current = session;

      session.onStateChange(s => {
        if (!mountedRef.current) return;
        if (startSeqRef.current !== seq) return;
        if (debug) console.log('[NewCameraCapture][state]', seq, s);

        if (s.phase === 'error') {
          setUiState({
            phase: s.phase,
            errorCode: (s as any).code,
            errorMessage: (s as any).message
          });
        } else if (s.phase === 'stabilizing') {
          setUiState({
            phase: s.phase,
            stableFrames: (s as any).observed
          });
        } else if (s.phase === 'ready') {
          setUiState({
            phase: s.phase,
            stableFrames: (s as any).stableFrames,
            dimension: (s as any).dimension
          });
        } else {
          setUiState({ phase: s.phase });
        }

        if ((s.phase === 'stabilizing' || s.phase === 'ready') && containerRef.current && !videoAttachedRef.current) {
          const v = session.getVideoEl();
          v.style.width = '100%';
          v.style.height = 'auto';
          v.style.display = 'block';
          v.style.objectFit = 'contain';
          containerRef.current.innerHTML = '';
          containerRef.current.appendChild(v);
          videoAttachedRef.current = true;
        }
      });
    } catch (e: any) {
      if (startSeqRef.current !== seq) return;
      const code: CameraErrorCode | undefined = e?.code;
      if (code === CameraErrorCode.PermissionDenied) {
        setPermissionDenied(true);
      } else if (code === CameraErrorCode.NotSupported) {
        setNotSupported(true);
      } else if (!userGesture && (e?.name === 'NotAllowedError' || /permission|denied/i.test(e?.message || ''))) {
        setNeedUserGesture(true);
      } else {
        setUiState({
          phase: 'error',
          errorCode: code || CameraErrorCode.Unknown,
          errorMessage: e?.message || '摄像头初始化失败'
        });
      }
      if (onError) onError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      clearTimeout(watchdog);
      if (mountedRef.current && startSeqRef.current === seq) {
        setStarting(false);
      }
    }
  }, [
    starting,
    orientationPolicy,
    aspectPolicy,
    maxWidth,
    quality,
    watermark,
    watermarkBuilder,
    facingMode,
    debug,
    onError
  ]);

  const destroySession = useCallback(() => {
    startSeqRef.current++; // 终止当前启动序列
    if (sessionRef.current) {
      try { sessionRef.current.destroy(); } catch {}
    }
    sessionRef.current = null;
    videoAttachedRef.current = false;
    if (containerRef.current) containerRef.current.innerHTML = '';
    setUiState({ phase: 'idle' });
  }, []);

  // 注意：
  // 原实现依赖项包含 startSession（其又依赖 starting），在 startSession 内部会 setStarting(true/false)。
  // starting 变化会重新生成新的 startSession 函数引用，导致该 effect 每次状态切换都重跑并重新 setTimeout，
  // 形成“启动 -> 完成 -> effect 重新触发 -> 再次启动”的循环，最终可能出现 Maximum update depth exceeded。
  //
  // 修复：仅在 autoStart 变化时运行首次自动启动，不把 startSession/destroySession 放入依赖。
  // 后续若需要根据配置变化重启，可单独添加一个配置监控 effect（暂不添加，防止再次产生循环）。
  useEffect(() => {
    mountedRef.current = true;
    if (autoStart) {
      const timer = setTimeout(() => {
        startSession(false);
      }, 60);
      return () => {
        clearTimeout(timer);
        mountedRef.current = false;
        destroySession();
      };
    } else {
      setNeedUserGesture(true);
      return () => {
        mountedRef.current = false;
        destroySession();
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  const handleCapture = useCallback(async () => {
    if (capturing || cooldown) return;
    try {
      const session = sessionRef.current;
      if (!session) return;
      const state = session.getState();
      if (state.phase !== 'ready') return;

      setCapturing(true);
      const result = await session.capture();
      onCapture(result.file, result.meta);

      // 成功反馈：按钮显示“已拍摄”并 1.2s 叠加提示，2s 冷却防止重复点击
      setShowShotFeedback(true);
      setCooldown(true);
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
      if (cooldownTimerRef.current) window.clearTimeout(cooldownTimerRef.current);
      feedbackTimerRef.current = window.setTimeout(() => {
        setShowShotFeedback(false);
      }, 1200);
      cooldownTimerRef.current = window.setTimeout(() => {
        setCooldown(false);
      }, 2000);

      if (!continuous) {
        destroySession();
        setNeedUserGesture(true);
      }
    } catch (e: any) {
      if (onError) onError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setCapturing(false);
    }
  }, [onCapture, onError, continuous, destroySession, capturing, cooldown]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onCapture(f);
  };

  const showVideo = uiState.phase === 'stabilizing' || uiState.phase === 'ready';
  const ready = uiState.phase === 'ready';

  const renderStatus = () => {
    if (permissionDenied) return <span className="text-xs text-red-600">摄像头权限被拒绝</span>;
    if (notSupported) return <span className="text-xs text-red-600">设备/浏览器不支持</span>;
    if (needUserGesture) return <span className="text-xs text-gray-600">需要点击“开启摄像头”授权</span>;
    if (uiState.phase === 'requesting' || starting) return <span className="text-xs text-gray-600">请求权限/启动流...</span>;
    if (uiState.phase === 'stabilizing') return <span className="text-xs text-amber-600">稳定中({uiState.stableFrames})...</span>;
    if (uiState.phase === 'ready') {
      return (
        <span className="text-xs text-green-600">
          就绪{uiState.dimension ? ` ${uiState.dimension.w}x${uiState.dimension.h}` : ''}{uiState.stableFrames !== undefined ? ` • 稳定帧${uiState.stableFrames}` : ''}
        </span>
      );
    }
    if (uiState.phase === 'error') {
      return (
        <span className="text-xs text-red-600">
          错误: {uiState.errorCode} {uiState.errorMessage}
        </span>
      );
    }
    return null;
  };

  return (
    <div className={compact ? '' : 'border border-gray-200 rounded-md p-3 bg-white'}>
      {!compact && (
        <div className="mb-2 font-medium text-sm">
          现场拍照
        </div>
      )}
      <div className="relative w-full bg-black rounded-md overflow-hidden" style={{ minHeight: compact ? 160 : 200 }}>
        {/* 只用于挂载原生 video，不再与 React 管理的占位/调试节点混用，避免手动 innerHTML 清空导致 React 卸载时 removeChild 抛错 */}
        <div ref={containerRef} className="w-full h-full"></div>

        {!showVideo && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs select-none p-2 text-center leading-5">
            {permissionDenied && '权限被拒绝'}
            {notSupported && '不支持摄像头'}
            {needUserGesture && '等待用户手势'}
            {uiState.phase === 'requesting' && '请求中...'}
            {uiState.phase === 'starting' && '启动中...'}
            {uiState.phase === 'stabilizing' && '稳定中...'}
            {uiState.phase === 'error' && '错误'}
            {uiState.phase === 'idle' && autoStart && '准备启动...'}
            {!autoStart && uiState.phase === 'idle' && '待启动'}
          </div>
        )}

        {debug && uiState.phase !== 'idle' && (
          <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/50 text-[10px] text-white rounded pointer-events-none leading-[1.1]">
            <div>phase:{uiState.phase}</div>
            {uiState.dimension && <div>{uiState.dimension.w}x{uiState.dimension.h}</div>}
            {uiState.stableFrames !== undefined && <div>stable:{uiState.stableFrames}</div>}
          </div>
        )}

        {showShotFeedback && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
            <div className="px-4 py-2 bg-green-600 text-white text-sm rounded shadow">
              已拍摄
            </div>
          </div>
        )}

        {!compact && (
          <div className="absolute top-1 left-1 bg-black/40 text-white text-[11px] px-1.5 py-0.5 rounded">
            实时预览
          </div>
        )}
      </div>

      <div className="mt-2 flex flex-wrap gap-2 items-center">
        {showVideo && (
          <button
            type="button"
            disabled={!ready || capturing || cooldown}
            onClick={handleCapture}
            className={`px-3 py-1.5 rounded text-xs font-medium text-white ${
              ready && !capturing && !cooldown
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {ready
              ? (capturing
                  ? '处理中...'
                  : cooldown
                    ? '已拍摄'
                    : captureLabel)
              : '准备中'}
          </button>
        )}
        {!showVideo && needUserGesture && (
          <button
            type="button"
            onClick={() => startSession(true)}
            className="px-3 py-1.5 rounded text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white"
          >
            开启摄像头
          </button>
        )}
        {allowFileFallback && (permissionDenied || notSupported) && (
          <label className="px-3 py-1.5 rounded text-xs font-medium bg-gray-600 hover:bg-gray-700 text-white cursor-pointer">
            {fallbackLabel}
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </label>
        )}
        {continuous && showVideo && (
          <button
            type="button"
            onClick={() => {
              destroySession();
              setNeedUserGesture(true);
            }}
            className="px-2 py-1 rounded text-[11px] font-medium bg-gray-200 hover:bg-gray-300 text-gray-700"
          >
            停止
          </button>
        )}
        {renderStatus()}
      </div>
    </div>
  );
};

export default NewCameraCapture;
