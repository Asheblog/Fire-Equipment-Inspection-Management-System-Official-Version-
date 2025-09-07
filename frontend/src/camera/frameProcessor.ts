import type { AspectPolicy, CaptureMeta, SessionOptions } from "./types";

/**
 * 帧处理（纯函数 + 少量 DOM 依赖）
 * 负责：
 *  - 读取当前 video 的原始尺寸
 *  - 根据 aspectPolicy 执行裁剪
 *  - 根据 orientationPolicy 决定是否旋转（仅像素层，不改 video）
 *  - 生成水印
 *  - 输出 File
 */

/**
 * 方向判定
 */
function detectRawOrientation(w: number, h: number): 'portrait' | 'landscape' {
  return w < h ? 'portrait' : 'landscape';
}

function detectDisplayOrientation(): 'portrait' | 'landscape' {
  try {
    if (typeof screen !== 'undefined' && (screen as any).orientation?.type) {
      return (screen as any).orientation.type.includes('portrait') ? 'portrait' : 'landscape';
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
    }
  } catch { /* ignore */ }
  return 'portrait';
}

interface CropResult {
  cropX: number;
  cropY: number;
  cropW: number;
  cropH: number;
  aspectApplied?: number;
}

function applyAspectCrop(rawW: number, rawH: number, policy: AspectPolicy): CropResult {
  if (policy.type === 'native') {
    return { cropX: 0, cropY: 0, cropW: rawW, cropH: rawH };
  }
  const desired = policy.value;
  const actual = rawW / rawH;
  if (Math.abs(actual - desired) < 0.0001) {
    return { cropX: 0, cropY: 0, cropW: rawW, cropH: rawH, aspectApplied: desired };
  }
  if (actual > desired) {
    // 裁剪宽度
    const targetW = Math.round(rawH * desired);
    const cropX = Math.round((rawW - targetW) / 2);
    return { cropX, cropY: 0, cropW: targetW, cropH: rawH, aspectApplied: desired };
  } else {
    // 裁剪高度
    const targetH = Math.round(rawW / desired);
    const cropY = Math.round((rawH - targetH) / 2);
    return { cropX: 0, cropY, cropW: rawW, cropH: targetH, aspectApplied: desired };
  }
}

/**
 * 根据 orientationPolicy & 原始/显示方向 计算需要的旋转角度
 * 约定：只产生 0 / 90 / 270（不做 180 的极端场景处理）
 */
function decideRotation(rawOri: 'portrait' | 'landscape', displayOri: 'portrait' | 'landscape', policy: SessionOptions['orientationPolicy']): 0 | 90 | 180 | 270 {
  switch (policy) {
    case 'lockPortrait':
      return rawOri === 'portrait' ? 0 : 270; // raw landscape -> rotate -90 (相当于 270)
    case 'lockLandscape':
      return rawOri === 'landscape' ? 0 : 90; // raw portrait -> rotate +90
    case 'followDevice':
      if (rawOri === displayOri) return 0;
      // 不同则旋转：portrait->landscape(顺时针90) / landscape->portrait(逆时针90=270)
      if (rawOri === 'portrait' && displayOri === 'landscape') return 90;
      if (rawOri === 'landscape' && displayOri === 'portrait') return 270;
      return 0;
    case 'auto':
    default:
      return 0;
  }
}

interface ProcessFrameParams {
  video: HTMLVideoElement;
  options: SessionOptions;
  stableFrames: number;
  rawDimension: { w: number; h: number };
}

/**
 * 核心处理函数
 */
export async function processFrame(params: ProcessFrameParams): Promise<{ file: File; meta: CaptureMeta }> {
  const { video, options, stableFrames, rawDimension } = params;
  const { aspectPolicy = { type: 'native' }, orientationPolicy = 'auto' } = options;
  const rawW = rawDimension.w || video.videoWidth;
  const rawH = rawDimension.h || video.videoHeight;

  if (!rawW || !rawH) {
    throw new Error('Video dimension not ready');
  }

  const rawOri = detectRawOrientation(rawW, rawH);
  const displayOri = detectDisplayOrientation();

  const rotation = decideRotation(rawOri, displayOri, orientationPolicy);

  // 裁剪
  const crop = applyAspectCrop(rawW, rawH, aspectPolicy);

  // 计算缩放
  let targetW = crop.cropW;
  let targetH = crop.cropH;
  const limit = options.maxWidth;
  if (limit && limit > 0 && targetW > limit) {
    const scale = limit / targetW;
    targetW = Math.round(targetW * scale);
    targetH = Math.round(targetH * scale);
  }

  // 旋转后 canvas 尺寸
  const finalW = rotation === 90 || rotation === 270 ? targetH : targetW;
  const finalH = rotation === 90 || rotation === 270 ? targetW : targetH;

  const canvas = document.createElement('canvas');
  canvas.width = finalW;
  canvas.height = finalH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  ctx.save();
  if (rotation !== 0) {
    ctx.translate(finalW / 2, finalH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    // draw image with center translation
    // after rotation 90/270, width/height swapped
    const drawW = targetW;
    const drawH = targetH;
    ctx.drawImage(
      video,
      crop.cropX,
      crop.cropY,
      crop.cropW,
      crop.cropH,
      -drawW / 2,
      -drawH / 2,
      drawW,
      drawH
    );
  } else {
    ctx.drawImage(
      video,
      crop.cropX,
      crop.cropY,
      crop.cropW,
      crop.cropH,
      0,
      0,
      targetW,
      targetH
    );
  }
  ctx.restore();

  // 水印
  if (options.watermark !== false) {
    try {
      const text = (options.watermarkBuilder || defaultWatermark)();
      const pad = 12;
      ctx.font = '16px system-ui, -apple-system, sans-serif';
      ctx.textBaseline = 'bottom';
      const metrics = ctx.measureText(text);
      const textW = metrics.width;
      const textH = 18;
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(pad - 4, finalH - textH - pad - 6, textW + 12, textH + 8);
      ctx.fillStyle = '#fff';
      ctx.fillText(text, pad, finalH - pad);
    } catch { /* ignore watermark errors */ }
  }

  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(b => {
      if (b) resolve(b);
      else reject(new Error('toBlob failed'));
    }, 'image/jpeg', options.quality ?? 0.9);
  });

  const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });

  const meta: CaptureMeta = {
    rawWidth: rawW,
    rawHeight: rawH,
    cropWidth: crop.cropW,
    cropHeight: crop.cropH,
    finalWidth: finalW,
    finalHeight: finalH,
    rotation,
    aspectEnforced: crop.aspectApplied,
    stableFrames,
    orientationPolicy,
    timestamp: Date.now()
  };

  if (options.debug) {
    // eslint-disable-next-line no-console
    console.table(meta);
  }

  return { file, meta };
}

function defaultWatermark(): string {
  const ts = new Date().toISOString();
  const nonce = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${ts} • ${nonce}`;
}
