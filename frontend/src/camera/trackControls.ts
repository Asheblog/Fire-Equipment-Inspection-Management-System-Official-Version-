import type { TrackControls, TrackControlsSupport } from './types';

/**
 * 封装底层 MediaStreamTrack 能力控制（闪光/对焦）。
 * 所有硬件相关调用都做能力检测与错误兜底，不抛出致命异常。
 *
 * 注意：
 * - 仅针对 video track
 * - 部分浏览器（尤其 iOS Safari）不支持 getCapabilities / applyConstraints
 * - 对焦与 torch 均属于“尽力而为”增强能力
 */
export function createTrackControls(track: MediaStreamTrack): TrackControls {
  const caps: any =
    typeof (track as any).getCapabilities === 'function'
      ? (track as any).getCapabilities()
      : {};

  // 解析对焦能力
  const focusModesRaw: string[] = Array.isArray(caps.focusMode) ? caps.focusMode : [];
  const hasSingleShot = focusModesRaw.includes('single-shot');
  const hasManualRange =
    caps.focusDistance &&
    typeof caps.focusDistance.min === 'number' &&
    typeof caps.focusDistance.max === 'number' &&
    !Number.isNaN(caps.focusDistance.min) &&
    !Number.isNaN(caps.focusDistance.max);

  const focusSupport: TrackControlsSupport['focus'] = {
    singleShot: hasSingleShot,
    manual: hasManualRange
      ? { min: caps.focusDistance.min, max: caps.focusDistance.max }
      : null
  };

  const support: TrackControlsSupport = {
    torch: !!caps && Object.prototype.hasOwnProperty.call(caps, 'torch'),
    focus: focusSupport
  };

  function hasTorch(): boolean {
    return support.torch;
  }

  async function setTorch(on: boolean): Promise<boolean> {
    if (!support.torch) return false;
    try {
      await track.applyConstraints({ advanced: [{ torch: on }] } as any);
      return true;
    } catch (e) {
      console.warn('[camera][trackControls] setTorch failed', e);
      return false;
    }
  }

  function getSupport(): TrackControlsSupport {
    return support;
  }

  async function applySingleShotFocus(): Promise<boolean> {
    if (!support.focus.singleShot) return false;
    try {
      await track.applyConstraints({ advanced: [{ focusMode: 'single-shot' }] } as any);
      return true;
    } catch (e) {
      console.warn('[camera][trackControls] single-shot focus failed', e);
      return false;
    }
  }

  /**
   * ratio: 0~1 -> 映射到 focusDistance.min~max
   * 说明：不同浏览器含义可能相反（远/近），此处直接线性映射，不做语义翻转。
   */
  async function setManualFocus(ratio: number): Promise<boolean> {
    if (!support.focus.manual) return false;
    const r = Math.min(1, Math.max(0, ratio));
    const { min, max } = support.focus.manual;
    const distance = min + (max - min) * r;
    try {
      // 设置手动对焦通常需要同时指定 focusMode 为 'manual'
      await track.applyConstraints({ advanced: [{ focusMode: 'manual', focusDistance: distance }] } as any);
      return true;
    } catch (e) {
      console.warn('[camera][trackControls] manual focus failed', e);
      return false;
    }
  }

  return {
    hasTorch,
    setTorch,
    getSupport,
    applySingleShotFocus,
    setManualFocus
  };
}
