import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createCameraDeviceManager } from '@/camera/deviceManager';
import type {
  SessionOptions,
  OrientationPolicy,
  AspectPolicy,
  CaptureResult,
  StreamSession,
  FlashMode,
  TrackControls,
  TrackControlsSupport
} from '@/camera/types';
import { CameraErrorCode } from '@/camera/types';
import { processFrame } from '@/camera/frameProcessor';

/**
 * 新版拍照组件 NewCameraCapture
 * 本次增强：
 *  - 新增闪光模式：off / burst / torch
 *    * off: 不补光
 *    * burst: 拍照时若支持 torch，临时点亮 ~100ms 后拍照再关闭（无支持则静默降级）
 *    * torch: 持续点亮（仅硬件支持）
 *  - 新增对焦交互：
 *    * single-shot: 支持则点击画面触发一次对焦
 *    * manual: 支持 focusDistance 范围时，点击垂直位置映射 0~1 设置焦距
 *  - 不支持的能力不显示相应按钮/交互
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

  /** 初始闪光模式（可选） */
  initialFlashMode?: FlashMode;
}

interface UIState {
  phase: string;
  stableFrames?: number;
  dimension?: { w: number; h: number };
  errorCode?: CameraErrorCode;
  errorMessage?: string;
}

const deviceManagerSingleton = createCameraDeviceManager();

// 设备检测
const isIOS =
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
const isAndroid = /Android/i.test(navigator.userAgent);
// 暂时关闭调试叠层渲染（即使外部传入 debug 也不显示）
const SHOW_DEBUG_OVERLAY = false;

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
  continuous = true,
  initialFlashMode = 'off'
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sessionRef = useRef<StreamSession | null>(null);
  const startSeqRef = useRef(0); // 启动尝试序号，避免竞态
  const phaseRef = useRef('idle');
  const mountedRef = useRef(true);
  const [uiState, setUiState] = useState<UIState>({ phase: 'idle' });
  useEffect(() => { phaseRef.current = uiState.phase; }, [uiState.phase]);

  const [needUserGesture, setNeedUserGesture] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [notSupported, setNotSupported] = useState(false);
  const [starting, setStarting] = useState(false);
  const startingRef = useRef(false);
  const videoAttachedRef = useRef(false);

  // 拍照状态与冷却
  const [capturing, setCapturing] = useState(false);
  const [cooldown, setCooldown] = useState(false);
  const [showShotFeedback, setShowShotFeedback] = useState(false);
  const cooldownTimerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);

  // 能力增强：flash / focus
  const trackControlsRef = useRef<TrackControls | null>(null);
  const [support, setSupport] = useState<TrackControlsSupport | null>(null);

  const [flashMode, setFlashMode] = useState<FlashMode>(initialFlashMode);
  const torchActiveRef = useRef(false); // 记录 torch 当前状态（避免重复 applyConstraints）

  const [focusPoint, setFocusPoint] = useState<{ x: number; y: number } | null>(null);
  const focusHideTimerRef = useRef<number | null>(null);
  const autoBestTriedRef = useRef(false);
  // 移除最高清自动初始化逻辑

  // 调试：当前 track/设备信息 & 所有摄像头列表
  const [currentDeviceInfo, setCurrentDeviceInfo] = useState<{
    deviceId?: string;
    label?: string;
    facingMode?: string;
    width?: number;
    height?: number;
    frameRate?: number;
    capWidthMax?: number;
    capHeightMax?: number;
  } | null>(null);
  const [allCameras, setAllCameras] = useState<Array<{ deviceId: string; label: string }>>([]);
  const [cameraCaps, setCameraCaps] = useState<Record<string, { maxW?: number; maxH?: number; note?: string }>>({});
  const [forcedDeviceId, setForcedDeviceId] = useState<string | null>(null);

  // 组件卸载清理
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) window.clearTimeout(cooldownTimerRef.current);
      if (feedbackTimerRef.current) window.clearTimeout(feedbackTimerRef.current);
      if (focusHideTimerRef.current) window.clearTimeout(focusHideTimerRef.current);
    };
  }, []);

  // 切换闪光模式：循环
  const cycleFlashMode = () => {
    setFlashMode(prev => {
      if (!support || !support.torch) {
        // 无 torch 支持: 只有 off / burst（burst 如果也无意义可只保留 off，这里仍保留 burst 以便“闪一下”逻辑）
        if (prev === 'off') return 'burst';
        if (prev === 'burst') return 'off';
        return 'off';
      } else {
        // 有 torch 支持: off -> burst -> torch -> off
        if (prev === 'off') return 'burst';
        if (prev === 'burst') return 'torch';
        if (prev === 'torch') return 'off';
        return 'off';
      }
    });
  };

  // 当 flashMode 变为 torch 时立即尝试打开；离开 torch 关闭
  useEffect(() => {
    const controls = trackControlsRef.current;
    if (!controls) return;
    if (flashMode === 'torch') {
      if (!controls.hasTorch()) return;
      controls.setTorch(true).then(ok => {
        torchActiveRef.current = ok;
      });
    } else {
      // 其他模式关闭持续 torch
      if (torchActiveRef.current) {
        controls.setTorch(false).finally(() => {
          torchActiveRef.current = false;
        });
      }
    }
  }, [flashMode]);

  // 点击对焦 / 手动焦距
  const handleFocusTap = (e: React.MouseEvent) => {
    if (!support) return;
    if (!support.focus.singleShot && !support.focus.manual) return;
    const rect = (containerRef.current?.getBoundingClientRect?.()) || null;
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setFocusPoint({ x, y });
    if (focusHideTimerRef.current) window.clearTimeout(focusHideTimerRef.current);
    focusHideTimerRef.current = window.setTimeout(() => setFocusPoint(null), 900);

    const controls = trackControlsRef.current;
    if (!controls) return;
    const nx = Math.min(1, Math.max(0, x / rect.width));
    const ny = Math.min(1, Math.max(0, y / rect.height));

    if (support.focus.manual) {
      // 使用垂直位置映射 0~1
      const ratio = 1 - Math.min(1, Math.max(0, y / rect.height));
      controls.setManualFocus(ratio);
      // 同时尝试设置对焦点（部分安卓机对手动焦距不敏感，仅对 POI 生效）
      if ((controls as any).setPointOfInterest) {
        (controls as any).setPointOfInterest(nx, ny);
      }
    } else if (support.focus.singleShot) {
      // 先尝试设置对焦点，再触发单次对焦
      if ((controls as any).setPointOfInterest) {
        (controls as any).setPointOfInterest(nx, ny).finally(() => {
          controls.applySingleShotFocus();
        });
      } else {
        controls.applySingleShotFocus();
      }
    }
  };

  // 内部启动逻辑
  const startSession = useCallback(async (userGesture = false, allowRetryOnForcedFail = true, internalRetry = false) => {
    if (startingRef.current && !internalRetry) return;
    const seq = ++startSeqRef.current;
    if (debug) console.log('[NewCameraCapture] startSession attempt', seq, { userGesture });

    startingRef.current = true;
    setStarting(true);
    setNeedUserGesture(false);
    setPermissionDenied(false);
    setNotSupported(false);
    setUiState({ phase: 'requesting' });

    // 销毁旧会话
    if (sessionRef.current) {
      try { sessionRef.current.destroy(); } catch {}
      sessionRef.current = null;
      videoAttachedRef.current = false;
      trackControlsRef.current = null;
      setSupport(null);
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
      deviceId: forcedDeviceId || undefined,
      debug
    };

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
        if (debug) console.log('[NewCameraCapture] stale session discarded', seq);
        try { session.destroy(); } catch {}
        return;
      }
      if (!mountedRef.current) {
        session.destroy();
        return;
      }
      sessionRef.current = session;
      // 读取增强能力
      const controls = session.getTrackControls();
      trackControlsRef.current = controls;
      // 收集当前 track 设备信息（用于调试显示）
      try {
        const v = session.getVideoEl();
        const stream = v?.srcObject as MediaStream | null;
        const track = stream?.getVideoTracks?.()[0];
        const settings: MediaTrackSettings | undefined = track && (typeof track.getSettings === 'function') ? track.getSettings() : undefined;
        const caps: any = track && (typeof (track as any).getCapabilities === 'function') ? (track as any).getCapabilities() : null;
        setCurrentDeviceInfo({
          deviceId: settings?.deviceId,
          label: track?.label || undefined,
          facingMode: settings?.facingMode as any,
          width: settings?.width,
          height: settings?.height,
          frameRate: settings?.frameRate as any,
          capWidthMax: caps?.width && typeof caps.width.max === 'number' ? caps.width.max : undefined,
          capHeightMax: caps?.height && typeof caps.height.max === 'number' ? caps.height.max : undefined
        });
      } catch {}
      // 仅列举所有摄像头（需权限）。注意：不在此处主动打开其它摄像头，避免安卓设备卡死。
      (async () => {
        try {
          if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
          const list = await navigator.mediaDevices.enumerateDevices();
          const vids = list.filter(d => d.kind === 'videoinput').map(d => ({ deviceId: d.deviceId, label: d.label || '(未命名摄像头)' }));
          setAllCameras(vids);
        } catch {}
      })();
      try {
        if (controls) {
          const sup = controls.getSupport();
            setSupport(sup);
            // 如果初始模式是 torch 但不支持 torch，则降级为 off
            if (initialFlashMode === 'torch' && !sup.torch) {
              setFlashMode('off');
            }
        } else {
          setSupport(null);
        }
      } catch {
        setSupport(null);
      }

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
          // 附加后再更新一次当前 track 信息（以防初始化前 settings 为空）
          try {
            const stream = v?.srcObject as MediaStream | null;
            const track = stream?.getVideoTracks?.()[0];
            const settings: MediaTrackSettings | undefined = track && (typeof track.getSettings === 'function') ? track.getSettings() : undefined;
            const caps: any = track && (typeof (track as any).getCapabilities === 'function') ? (track as any).getCapabilities() : null;
            setCurrentDeviceInfo(prev => ({
              deviceId: settings?.deviceId || prev?.deviceId,
              label: track?.label || prev?.label,
              facingMode: (settings?.facingMode as any) || prev?.facingMode,
              width: settings?.width || prev?.width,
              height: settings?.height || prev?.height,
              frameRate: (settings?.frameRate as any) || prev?.frameRate,
              capWidthMax: (caps?.width && typeof caps.width.max === 'number' ? caps.width.max : prev?.capWidthMax),
              capHeightMax: (caps?.height && typeof caps.height.max === 'number' ? caps.height.max : prev?.capHeightMax)
            }));
          } catch {}
        }

        //（已调整为首启前扫描，不在 ready 后扫描）
      });
    } catch (e: any) {
      if (startSeqRef.current !== seq) return;
      const code: CameraErrorCode | undefined = e?.code;
      // 若强制 deviceId 打不开（ConstraintFailed/Overconstrained/NotReadable/NotFound/Abort），清空强制并快速回退一次
      const name = (e?.name || '').toString();
      if (
        forcedDeviceId && allowRetryOnForcedFail && (
          code === CameraErrorCode.ConstraintFailed ||
          /overconstrain|notreadable|notfound|abort/i.test(name) ||
          /overconstrain|notreadable|notfound|abort/i.test((e?.message || '').toString())
        )
      ) {
        if (debug) console.warn('[NewCameraCapture] forced device failed, fallback to facingMode');
        setForcedDeviceId(null);
        
        await new Promise(r => setTimeout(r, 250));
        return startSession(userGesture, false, true);
      }
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
        startingRef.current = false;
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
    onError,
    initialFlashMode,
    forcedDeviceId
  ]);

  const destroySession = useCallback(() => {
    startSeqRef.current++;
    if (sessionRef.current) {
      try { sessionRef.current.destroy(); } catch {}
    }
    sessionRef.current = null;
    trackControlsRef.current = null;
    setSupport(null);
    torchActiveRef.current = false;
    videoAttachedRef.current = false;
    if (containerRef.current) containerRef.current.innerHTML = '';
    setUiState({ phase: 'idle' });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (autoStart) {
      const timer = setTimeout(async () => {
        try {
          await startSession(false);
        } catch {
          await startSession(false);
        }
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

      // iOS 兼容：在 stabilizing 阶段若已具备有效尺寸，也允许拍摄
      const state = session.getState();
      const v = session.getVideoEl();
      const vw = v?.videoWidth || 0;
      const vh = v?.videoHeight || 0;
      const canIOSCapture = isIOS && vw > 0 && vh > 0;

      if (state.phase !== 'ready' && !canIOSCapture) return;

      setCapturing(true);

      // burst 模式：若支持 torch，拍照前短暂点亮
      let burstTorchOn = false;
      if (flashMode === 'burst') {
        const controls = trackControlsRef.current;
        if (controls && controls.hasTorch()) {
          const ok = await controls.setTorch(true);
          if (ok) {
            burstTorchOn = true;
            // 给传感器一点时间，避免刚点亮太暗
            await new Promise(r => setTimeout(r, 100));
          }
        }
      }

      let result: CaptureResult;
      try {
        if (state.phase === 'ready') {
          result = await session.capture();
        } else {
          // iOS fallback：直接从 video 抓帧
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
          const fileMeta = await processFrame({
            video: v,
            options,
            stableFrames: uiState.stableFrames || 0,
            rawDimension: { w: vw, h: vh }
          });
          result = { file: fileMeta.file, meta: fileMeta.meta };
        }
      } finally {
        if (burstTorchOn) {
          // 关闭临时 torch
            trackControlsRef.current?.setTorch(false).then(() => {
              // ignore
            });
        }
      }

      onCapture(result.file, result.meta);

      // 成功反馈 & 冷却
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
  }, [onCapture, onError, continuous, destroySession, capturing, cooldown, flashMode, isIOS, orientationPolicy, aspectPolicy, maxWidth, quality, watermark, watermarkBuilder, facingMode, debug, uiState.stableFrames]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onCapture(f);
  };

  const showVideo = uiState.phase === 'stabilizing' || uiState.phase === 'ready';
  const ready = uiState.phase === 'ready';
  // iOS：在 stabilizing 阶段但已有有效尺寸时也允许拍摄
  const iosHasDims = (() => {
    try {
      const v = sessionRef.current?.getVideoEl();
      return isIOS && !!v && v.videoWidth > 0 && v.videoHeight > 0;
    } catch { return false; }
  })();
  const canCapture = ready || iosHasDims;

  const infoLine = (() => {
    if (!currentDeviceInfo) return '';
    const parts: string[] = [];
    if (currentDeviceInfo.label) parts.push(currentDeviceInfo.label);
    if (currentDeviceInfo.width && currentDeviceInfo.height) parts.push(`${currentDeviceInfo.width}x${currentDeviceInfo.height}`);
    if (typeof currentDeviceInfo.frameRate === 'number') parts.push(`${Math.round(currentDeviceInfo.frameRate)}fps`);
    return parts.join(' · ');
  })();

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

  const shortId = (id?: string) => (id ? id.slice(-6) : 'unknown');
  const isBackDeviceLabel = (label: string) => {
    const v = (label || '').toLowerCase();
    return v.includes('back') || v.includes('rear') || v.includes('environment') || v.includes('后置') || v.includes('背面');
  };

  // 已移除“最高清后摄”扫描与切换逻辑

  const renderFlashButton = () => {
    if (!showVideo) return null;
    // 无能力信息：不渲染
    if (!support) return null;
    // iOS 且无硬件 torch 支持：直接隐藏（避免用户以为能点亮）
    if (!support.torch && isIOS) return null;

    // 若不支持 torch（安卓个别机型）：仍允许展示“闪一下”(burst) 但只做 UI 提示；本地逻辑会检测 hasTorch() 再决定是否真正点亮
    const labelMap: Record<FlashMode, string> = {
      off: '闪光:关',
      burst: support.torch ? '闪光:闪一下' : '闪光:模拟',
      torch: '闪光:常亮'
    };
    // 如果不支持 torch 且当前模式为 torch（极少发生，已在上游降级），强制显示关
    const displayMode = support.torch ? flashMode : (flashMode === 'torch' ? 'off' : flashMode);
    return (
      <button
        type="button"
        onClick={cycleFlashMode}
        className="px-2 py-1 rounded text-[11px] bg-gray-200 hover:bg-gray-300 text-gray-700 disabled:opacity-60"
        disabled={!support.torch && flashMode === 'burst'} /* 无 torch 时 burst 只是视觉提示，可以留可点或禁用，按需调整 */
      >
        {labelMap[displayMode]}
      </button>
    );
  };

  const renderFocusHint = () => {
    if (!showVideo || !support) return null;
    if (!support.focus.singleShot && !support.focus.manual) return null;
    return (
      <span className="text-[11px] text-gray-500">
        {support.focus.manual
          ? '点击画面调焦'
          : support.focus.singleShot
            ? '点击对焦'
            : null}
      </span>
    );
  };

  return (
    <div className={compact ? '' : 'border border-gray-200 rounded-md p-3 bg-white'}>
      {!compact && (
        <div className="mb-2 font-medium text-sm">
          现场拍照
        </div>
      )}
      <div
        className="relative w-full bg-black rounded-md overflow-hidden select-none"
        style={{ minHeight: compact ? 160 : 200 }}
        onClick={handleFocusTap}
      >
        {/* video 容器 */}
        <div ref={containerRef} className="w-full h-full"></div>

        {/* 对焦点标记 */}
        {focusPoint && (
          <div
            className="absolute border-2 border-yellow-400 rounded-sm pointer-events-none"
            style={{
              width: 40,
              height: 40,
              left: focusPoint.x - 20,
              top: focusPoint.y - 20,
              boxShadow: '0 0 4px rgba(255,255,0,0.7)'
            }}
          />
        )}

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
        {continuous && showVideo && (
          <button
            type="button"
            onClick={() => { destroySession(); setNeedUserGesture(true); }}
            className="absolute top-1 right-1 bg-black/50 hover:bg-black/60 active:bg-black/70 text-white text-[11px] px-2 py-0.5 rounded z-10"
            aria-label="关闭摄像头"
          >
            关闭
          </button>
        )}
      </div>

      {/* 相框下方：当前使用摄像头与分辨率（非调试信息）*/}
      <div className="mt-1 text-[11px] text-gray-600 min-h-[16px]">
        {infoLine}
      </div>

      <div className="mt-2 flex flex-wrap gap-2 items-center">
        {showVideo && (
          <button
            type="button"
            disabled={!canCapture || capturing || cooldown}
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
        {renderFlashButton()}
        {renderFocusHint()}
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
        {/* 仅 Android 显示：用户手动一键切到最高清 */}
        {/* 移除“启动最高清摄像头”按钮 */}
      </div>
    </div>
  );
};

export default NewCameraCapture;
