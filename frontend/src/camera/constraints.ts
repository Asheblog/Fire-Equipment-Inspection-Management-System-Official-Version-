import type { AspectPolicy, SessionOptions } from "./types";
import { CameraErrorCode } from "./types";
import { createCameraError } from "./errors";

/**
 * 约束生成与获取工具
 *
 * Safari / iOS 兼容策略：
 * 1. 首选强制期望分辨率 + aspectRatio（若支持）
 * 2. 再退化为仅 width/height ideal
 * 3. 最后退化为仅 facingMode
 *
 * 注意：不直接使用 exact，避免 OverconstrainedError 频率过高。
 */

export interface ConstraintCandidate {
  kind: "rich" | "basic" | "fallback";
  constraint: MediaStreamConstraints;
  desc: string;
}

interface BuildParams {
  facingMode: "environment" | "user";
  preferResolutions: Array<{ width: number; height: number }>;
  aspectPolicy: AspectPolicy;
}

/**
 * 构建候选约束列表（按优先级顺序返回）
 */
export function buildConstraintCandidates(params: BuildParams): ConstraintCandidate[] {
  const { facingMode, preferResolutions, aspectPolicy } = params;

  const list: ConstraintCandidate[] = [];
  const wantAspect = aspectPolicy.type === "force" ? aspectPolicy.value : null;

  for (const r of preferResolutions) {
    const baseVideo: any = {
      facingMode: facingMode,
      width: { ideal: r.width },
      height: { ideal: r.height }
    };

    if (wantAspect) {
      // 尝试包含 aspectRatio
      list.push({
        kind: "rich",
        constraint: { video: { ...baseVideo, aspectRatio: wantAspect } },
        desc: `rich-${r.width}x${r.height}-ar${wantAspect}`
      });
    }

    // 不含 aspectRatio 的 basic 版本
    list.push({
      kind: "basic",
      constraint: { video: { ...baseVideo } },
      desc: `basic-${r.width}x${r.height}`
    });
  }

  // 最终 fallback
  list.push({
    kind: "fallback",
    constraint: { video: { facingMode } },
    desc: "fallback-facingMode-only"
  });

  return list;
}

/**
 * 尝试按候选集合获取流
 */
export async function getMediaStreamWithCandidates(candidates: ConstraintCandidate[], debug?: boolean): Promise<{
  stream: MediaStream;
  applied: ConstraintCandidate;
}> {
  let lastErr: unknown = null;

  for (const c of candidates) {
    try {
      if (debug) {
        // eslint-disable-next-line no-console
        console.log("[camera] try constraint:", c.desc, c.constraint);
      }
      const stream = await navigator.mediaDevices.getUserMedia(c.constraint);
      return { stream, applied: c };
    } catch (e) {
      lastErr = e;
      if (debug) {
        // eslint-disable-next-line no-console
        console.warn("[camera] constraint failed:", c.desc, e);
      }
      continue;
    }
  }

  throw createCameraError(
    CameraErrorCode.ConstraintFailed,
    "无法满足任何候选视频约束",
    lastErr
  );
}

/**
 * 权限检测
 */
export async function ensureCameraPermission(): Promise<"granted" | "denied"> {
  if (!navigator.mediaDevices) return "denied";

  // 优先使用 Permissions API（不会主动触发权限弹窗）
  // 若状态为 granted / denied 则直接返回；prompt / 不支持时不做额外 getUserMedia 预取
  // 这样可以避免 iOS 上在同一次自动启动流程里出现“双重 getUserMedia”导致的卡死或黑屏。
  // 真正的权限弹窗交给后续的正式约束流获取。
  // @ts-ignore
  if (navigator.permissions && navigator.permissions.query) {
    try {
      // @ts-ignore
      const res = await navigator.permissions.query({ name: "camera" });
      if (res.state === "granted") return "granted";
      if (res.state === "denied") return "denied";
      // res.state === "prompt" 时返回 "granted" 让后续主流程去触发；若最终被拒绝会抛 NotAllowedError
      return "granted";
    } catch {
      // ignore -> 继续走后面的逻辑
    }
  }

  // 无 Permissions API 或查询失败：直接返回“granted”让主调用尝试。
  // 真实权限结果在主 getUserMedia 调用时体现，失败会被包装成标准错误。
  return "granted";
}

/**
 * 构造默认 preferResolutions（若外部未提供）
 * 主要以 4:3 为主 + 一个 16:9 fallback
 */
export function getDefaultPreferResolutions(): Array<{ width: number; height: number }> {
  return [
    { width: 1920, height: 1440 },
    { width: 1600, height: 1200 },
    { width: 1280, height: 960 },
    { width: 1024, height: 768 },
    { width: 1280, height: 720 }
  ];
}

/**
 * 从 SessionOptions 生成候选集合
 */
export function prepareCandidatesFromOptions(opts: SessionOptions): ConstraintCandidate[] {
  const facing = opts.facingMode || "environment";
  const prefer = opts.preferResolutions && opts.preferResolutions.length > 0
    ? opts.preferResolutions
    : getDefaultPreferResolutions();

  return buildConstraintCandidates({
    facingMode: facing,
    preferResolutions: prefer,
    aspectPolicy: opts.aspectPolicy || { type: "native" }
  });
}
