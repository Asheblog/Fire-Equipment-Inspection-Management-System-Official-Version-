import { CameraErrorCode } from "./types";

/**
 * 标准化相机错误对象
 */
export interface CameraError extends Error {
  code: CameraErrorCode;
  cause?: unknown;
}

export function createCameraError(code: CameraErrorCode, message: string, cause?: unknown): CameraError {
  const err = new Error(message) as CameraError;
  err.code = code;
  if (cause !== undefined) {
    (err as any).cause = cause;
  }
  return err;
}

/**
 * 统一包装执行，捕获未知错误并转换
 */
export async function safeRun<T>(fn: () => Promise<T>, wrap: (e: unknown) => CameraError): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    throw wrap(e);
  }
}

/**
 * 根据原始异常推断错误码（兜底 Unknown）
 */
export function inferConstraintError(e: any): CameraError {
  if (e && typeof e === 'object') {
    const name = (e as any).name;
    if (name === 'NotAllowedError') {
      return createCameraError(CameraErrorCode.PermissionDenied, '用户拒绝相机权限', e);
    }
    if (name === 'OverconstrainedError') {
      return createCameraError(CameraErrorCode.ConstraintFailed, '约束无法满足', e);
    }
    if (name === 'NotFoundError') {
      return createCameraError(CameraErrorCode.ConstraintFailed, '未找到合适的摄像头设备', e);
    }
  }
  return createCameraError(CameraErrorCode.Unknown, '获取摄像头流失败', e);
}

export function inferCaptureError(e: any): CameraError {
  return createCameraError(CameraErrorCode.CaptureInterrupted, e?.message || '捕获失败', e);
}
