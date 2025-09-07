import type { CameraDeviceManager, SessionOptions, StreamSession } from "./types";
import { CameraErrorCode } from "./types";
import { createCameraError } from "./errors";
import {
  ensureCameraPermission,
  prepareCandidatesFromOptions,
  getMediaStreamWithCandidates
} from "./constraints";
import { createStreamSession } from "./streamSession";

/**
 * CameraDeviceManager 实现
 * 负责：
 *  - 权限确认
 *  - 基于 SessionOptions 生成候选约束并获取 MediaStream
 *  - 创建 StreamSession
 */

export function createCameraDeviceManager(): CameraDeviceManager {
  async function ensurePermission(): Promise<"granted" | "denied"> {
    return ensureCameraPermission();
  }

  async function createSession(options: SessionOptions = {}): Promise<StreamSession> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw createCameraError(
        CameraErrorCode.NotSupported,
        "当前环境不支持摄像头访问 (mediaDevices 不存在)"
      );
    }

    // 权限预检测（不会100%保证，但可提前失败）
    const perm = await ensurePermission();
    if (perm === "denied") {
      throw createCameraError(
        CameraErrorCode.PermissionDenied,
        "摄像头权限被拒绝"
      );
    }

    const candidates = prepareCandidatesFromOptions(options);
    let stream: MediaStream;
    let applied: any;

    try {
      const got = await getMediaStreamWithCandidates(candidates, options.debug);
      stream = got.stream;
      applied = got.applied;
    } catch (e: any) {
      throw e; // 已在 constraints 内包装为标准错误
    }

    const session = createStreamSession({
      stream,
      options,
      candidate: applied,
      debug: options.debug
    });

    return session;
  }

  return {
    ensurePermission,
    createSession
  };
}
