import type {
  SessionOptions,
  StreamSession,
  SessionState,
  SessionStateError,
  SessionStateReady,
  SessionStateStabilizing,
  CaptureResult
} from "./types";
import { CameraErrorCode } from "./types";
import { processFrame } from "./frameProcessor";
import { createCameraError } from "./errors";
import type { ConstraintCandidate } from "./constraints";

/**
 * StreamSession 实现
 * 负责：
 *  - 维护 MediaStream + video 元素
 *  - 状态机：starting → stabilizing → ready
 *  - 稳定帧检测（尺寸不变连续 N 帧）
 *  - capture 输出文件
 *  - destroy 清理资源
 *
 * 说明：
 *  - 不做全局缓存
 *  - 不处理前后摄切换（后续可扩展 restart）
 */

interface InternalContext {
  options: SessionOptions;
  stream: MediaStream;
  video: HTMLVideoElement;
  candidatesInfo?: ConstraintCandidate;
  stableFrames: number;
  lastDimension?: { w: number; h: number };
  state: SessionState;
  listeners: Array<(s: SessionState) => void>;
  stabilizationTimer?: number;
  rafId?: number;
  stopped: boolean;
  debug?: boolean;
}

function setState(ctx: InternalContext, next: SessionState) {
  ctx.state = next;
  ctx.listeners.forEach(l => {
    try { l(next); } catch { /* ignore */ }
  });
}

function dimsEqual(a?: { w: number; h: number }, b?: { w: number; h: number }) {
  return !!a && !!b && a.w === b.w && a.h === b.h;
}

function observeStabilization(ctx: InternalContext) {
  const { options } = ctx;
  const minStable = options.stabilization?.minStableFrames ?? 3;
  const timeoutMs = options.stabilization?.timeoutMs ?? 1500;

  const startTime = Date.now();
  let consecutive = 0;
  let lastDims: { w: number; h: number } | undefined;

  const useVideoFrameCallback = typeof (ctx.video as any).requestVideoFrameCallback === "function";

  const step = () => {
    if (ctx.stopped) return;
    const w = ctx.video.videoWidth;
    const h = ctx.video.videoHeight;
    if (w && h) {
      const current = { w, h };
      if (dimsEqual(current, lastDims)) {
        consecutive += 1;
      } else {
        consecutive = 1;
        lastDims = current;
      }
      ctx.lastDimension = current;
      // 更新 stabilizing 状态
      const st: SessionStateStabilizing = {
        phase: "stabilizing",
        observed: consecutive,
        lastDimension: current
      };
      setState(ctx, st);

      if (consecutive >= minStable) {
        ctx.stableFrames = consecutive;
        const ready: SessionStateReady = {
          phase: "ready",
            // @ts-ignore
          dimension: current,
          stableFrames: consecutive
        };
        setState(ctx, ready);
        return;
      }
    }

    if (Date.now() - startTime > timeoutMs) {
      // 超时：仍进入 ready，但 stableFrames 可能不足
      ctx.stableFrames = consecutive;
      const fallbackDim = ctx.lastDimension || { w: ctx.video.videoWidth, h: ctx.video.videoHeight };
      if (!fallbackDim.w || !fallbackDim.h) {
        const err: SessionStateError = {
          phase: "error",
          code: CameraErrorCode.StabilizationTimeout,
          message: "稳定帧检测超时且未获得有效尺寸"
        };
        setState(ctx, err);
        return;
      }
      const ready: SessionStateReady = {
        phase: "ready",
          // @ts-ignore
        dimension: fallbackDim,
        stableFrames: consecutive
      };
      setState(ctx, ready);
      return;
    }

    if (useVideoFrameCallback) {
      (ctx.video as any).requestVideoFrameCallback(() => step());
    } else {
      ctx.rafId = requestAnimationFrame(step);
    }
  };

  // 启动循环
  if (useVideoFrameCallback) {
    (ctx.video as any).requestVideoFrameCallback(() => step());
  } else {
    ctx.rafId = requestAnimationFrame(step);
  }
}

export function createStreamSession(params: {
  stream: MediaStream;
  options: SessionOptions;
  candidate?: ConstraintCandidate;
  debug?: boolean;
}): StreamSession {
  const { stream, options, candidate, debug } = params;
  const video = document.createElement("video");
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.muted = true;
  video.autoplay = true;
  video.srcObject = stream;

  const ctx: InternalContext = {
    options,
    stream,
    video,
    candidatesInfo: candidate,
    stableFrames: 0,
    state: { phase: "starting", attempt: 1 },
    listeners: [],
    stopped: false,
    debug
  };

  // 监听 track ended
  const track = stream.getVideoTracks()[0];
  track.addEventListener("ended", () => {
    if (ctx.stopped) return;
    setState(ctx, {
      phase: "error",
      code: CameraErrorCode.StreamEnded,
      message: "视频流已结束"
    });
  });

  // 等待元数据
  const init = async () => {
    try {
      await new Promise<void>((resolve, reject) => {
        const onLoaded = () => {
          video.removeEventListener("loadedmetadata", onLoaded);
          resolve();
        };
        const onError = (e: any) => {
          video.removeEventListener("error", onError);
          reject(e);
        };
        video.addEventListener("loadedmetadata", onLoaded);
        video.addEventListener("error", onError);
      });
      if (ctx.stopped) return;

      // 进入 stabilizing
      setState(ctx, { phase: "stabilizing", observed: 0 });
      observeStabilization(ctx);
      video.play().catch(() => { /* ignore play errors */ });
    } catch (e: any) {
      if (ctx.stopped) return;
      setState(ctx, {
        phase: "error",
        code: CameraErrorCode.Unknown,
        message: e?.message || "视频初始化失败"
      });
    }
  };
  init();

  function getState(): SessionState {
    return ctx.state;
  }

  function onStateChange(cb: (s: SessionState) => void) {
    ctx.listeners.push(cb);
    // 订阅后立即同步当前状态，避免在订阅前已经经历了 starting→stabilizing 的快速跃迁导致 UI 永远停留在 requesting
    try { cb(ctx.state); } catch { /* ignore */ }
    return () => {
      const i = ctx.listeners.indexOf(cb);
      if (i >= 0) ctx.listeners.splice(i, 1);
    };
  }

  async function capture(): Promise<CaptureResult> {
    const state = ctx.state;
    if (state.phase !== "ready") {
      throw createCameraError(
        CameraErrorCode.CaptureInterrupted,
        "当前未就绪，无法拍照"
      );
    }
    const dim = state.dimension;
    return processFrame({
      video: ctx.video,
      options: ctx.options,
      stableFrames: state.stableFrames,
      rawDimension: { w: dim.w, h: dim.h }
    });
  }

  function destroy() {
    if (ctx.stopped) return;
    ctx.stopped = true;
    try {
      video.pause();
      video.srcObject = null;
    } catch { /* ignore */ }
    try {
      stream.getTracks().forEach(t => t.stop());
    } catch { /* ignore */ }
    if (ctx.rafId) cancelAnimationFrame(ctx.rafId);
    setState(ctx, { phase: "destroyed" });
  }

  return {
    getState,
    onStateChange,
    getVideoEl: () => video,
    capture,
    destroy
  };
}
