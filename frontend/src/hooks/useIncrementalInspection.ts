import { useEffect, useRef, useState, useCallback } from 'react';
import { inspectionApi } from '@/api';
import { uploadApi } from '@/api';
import type { InspectionLog } from '@/types';

/**
 * 支持的图片分类（与后端 append / remove type 对应）
 */
export type IncrementalImageType = 'inspection' | 'issue' | 'fixed';

export interface ChecklistItemResult {
  itemName: string;
  result: 'NORMAL' | 'ABNORMAL';
  note: string;
}

interface UseIncrementalInspectionOptions {
  /**
   * 是否在 equipmentId 变更时自动重新创建空记录
   * 默认 true
   */
  autoRestart?: boolean;
  /**
   * 捕获统一错误（可用于 toast）
   */
  onError?: (msg: string) => void;
  /**
   * 追加 / 删除 / finalize 成功回调
   */
  onEvent?: (evt:
    | { type: 'created'; inspectionId: number }
    | { type: 'appended'; imageType: IncrementalImageType; imageUrl: string }
    | { type: 'removed'; imageType: IncrementalImageType; imageUrl: string }
    | { type: 'finalized'; inspectionId: number; overallResult: string }
  ) => void;
}

/**
 * 后端返回的 InspectionLog 中图片字段兼容解析
 */
function parseImages(log: any, arrayField: string, legacyField: string): string[] {
  if (!log) return [];
  const arrVal = (log as any)[arrayField];
  const legacy = (log as any)[legacyField];
  // 已是数组
  if (Array.isArray(arrVal)) {
    return arrVal.filter(Boolean);
  }
  // 是 JSON 字符串
  if (typeof arrVal === 'string') {
    try {
      const parsed = JSON.parse(arrVal);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch { /* ignore */ }
  }
  // 回退 legacy
  if (legacy) return [legacy];
  return [];
}

interface ImagesState {
  inspection: string[];
  issue: string[];
  fixed: string[];
}

/**
 * useIncrementalInspection
 * 负责：
 *  1. createEmptyInspection
 *  2. append/remove 图片（即时持久化）
 *  3. finalize（提交最终检查结果）
 *  4. 状态机：idle -> creating -> editing -> finalizing -> done
 */
export function useIncrementalInspection(
  equipmentId: number | null | undefined,
  options: UseIncrementalInspectionOptions = {}
) {
  const {
    autoRestart = true,
    onError,
    onEvent
  } = options;

  const [phase, setPhase] = useState<'idle' | 'creating' | 'editing' | 'finalizing' | 'done'>('idle');
  const [inspectionId, setInspectionId] = useState<number | null>(null);
  const [images, setImages] = useState<ImagesState>({ inspection: [], issue: [], fixed: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const equipmentRef = useRef<number | null>(null);

  // 重置状态
  const reset = useCallback(() => {
    setPhase('idle');
    setInspectionId(null);
    setImages({ inspection: [], issue: [], fixed: [] });
    setError(null);
  }, []);

  // 当 equipmentId 变化时自动重建空记录
  useEffect(() => {
    if (equipmentId == null) {
      if (autoRestart) reset();
      return;
    }
    if (equipmentRef.current !== equipmentId) {
      equipmentRef.current = equipmentId;
      if (autoRestart) {
        reset();
        void createEmpty(equipmentId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [equipmentId]);

  /**
   * 创建空记录
   */
  const createEmpty = useCallback(async (eqId: number) => {
    if (!eqId) return;
    try {
      setPhase('creating');
      setLoading(true);
      setError(null);
      const resp = await inspectionApi.createEmpty({ equipmentId: eqId });
      if (!resp.success || !resp.data) {
        throw new Error(resp.message || '创建空记录失败');
      }
      const data = resp.data;
      setInspectionId(data.id);
      // 解析当前返回的图片（理论为空）
      setImages({
        inspection: parseImages(data, 'inspectionImageUrls', 'inspectionImageUrl'),
        issue: parseImages(data, 'issueImageUrls', 'issueImageUrl'),
        fixed: parseImages(data, 'fixedImageUrls', 'fixedImageUrl')
      });
      setPhase('editing');
      onEvent?.({ type: 'created', inspectionId: data.id });
      return data;
    } catch (e: any) {
      const msg = e?.response?.data?.message || e.message || '创建空记录失败';
      setError(msg);
      onError?.(msg);
      setPhase('idle');
      throw e;
    } finally {
      setLoading(false);
    }
  }, [onError, onEvent]);

  /**
   * 上传（文件→后端存储）并追加图片（持久化）
   * 返回追加后的最新图片数组
   */
  const uploadAndAppend = useCallback(async (file: File, type: IncrementalImageType = 'inspection') => {
    if (!inspectionId) throw new Error('尚未创建点检记录');
    try {
      setLoading(true);
      setError(null);
      // 1. 上传获得 fileUrl
      const uploadResp = await uploadApi.uploadImage(file);
      const fileUrl = uploadResp?.data?.fileUrl;
      if (!fileUrl) {
        throw new Error('上传结果缺少 fileUrl');
      }
      // 2. 持久化追加
      const appendResp = await inspectionApi.appendImage(inspectionId, { type, imageUrl: fileUrl });
      if (!appendResp.success || !appendResp.data) {
        throw new Error(appendResp.message || '追加图片失败');
      }
      const data = appendResp.data;
      const nextImages: ImagesState = {
        inspection: parseImages(data, 'inspectionImageUrls', 'inspectionImageUrl'),
        issue: parseImages(data, 'issueImageUrls', 'issueImageUrl'),
        fixed: parseImages(data, 'fixedImageUrls', 'fixedImageUrl')
      };
      setImages(nextImages);
      onEvent?.({ type: 'appended', imageType: type, imageUrl: fileUrl });
      return { fileUrl, images: nextImages };
    } catch (e: any) {
      const backendErr = e?.response?.data?.error;
      let msg = e?.response?.data?.message || e.message || '追加图片失败';
      if (backendErr === 'IMAGE_ALREADY_EXISTS') {
        msg = '图片已存在（重复上传）';
      }
      setError(msg);
      onError?.(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [inspectionId, onError, onEvent]);

  /**
   * 直接用已有 URL 追加（用于其它来源已上传完成的文件）
   */
  const appendExisting = useCallback(async (imageUrl: string, type: IncrementalImageType = 'inspection') => {
    if (!inspectionId) throw new Error('尚未创建点检记录');
    try {
      setLoading(true);
      setError(null);
      const appendResp = await inspectionApi.appendImage(inspectionId, { type, imageUrl });
      if (!appendResp.success || !appendResp.data) {
        throw new Error(appendResp.message || '追加图片失败');
      }
      const data = appendResp.data;
      const nextImages: ImagesState = {
        inspection: parseImages(data, 'inspectionImageUrls', 'inspectionImageUrl'),
        issue: parseImages(data, 'issueImageUrls', 'issueImageUrl'),
        fixed: parseImages(data, 'fixedImageUrls', 'fixedImageUrl')
      };
      setImages(nextImages);
      onEvent?.({ type: 'appended', imageType: type, imageUrl });
      return nextImages;
    } catch (e: any) {
      const backendErr = e?.response?.data?.error;
      let msg = e?.response?.data?.message || e.message || '追加图片失败';
      if (backendErr === 'IMAGE_ALREADY_EXISTS') {
        msg = '图片已存在（重复上传）';
      }
      setError(msg);
      onError?.(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [inspectionId, onError, onEvent]);

  /**
   * 删除指定图片
   */
  const removeImage = useCallback(async (imageUrl: string, type: IncrementalImageType = 'inspection') => {
    if (!inspectionId) throw new Error('尚未创建点检记录');
    try {
      setLoading(true);
      setError(null);
      const resp = await inspectionApi.removeImage(inspectionId, { type, imageUrl });
      if (!resp.success || !resp.data) {
        throw new Error(resp.message || '删除图片失败');
      }
      const data = resp.data;
      const nextImages: ImagesState = {
        inspection: parseImages(data, 'inspectionImageUrls', 'inspectionImageUrl'),
        issue: parseImages(data, 'issueImageUrls', 'issueImageUrl'),
        fixed: parseImages(data, 'fixedImageUrls', 'fixedImageUrl')
      };
      setImages(nextImages);
      onEvent?.({ type: 'removed', imageType: type, imageUrl });
      return nextImages;
    } catch (e: any) {
      const backendErr = e?.response?.data?.error;
      let msg = e?.response?.data?.message || e.message || '删除图片失败';
      if (backendErr === 'IMAGE_NOT_FOUND') {
        msg = '图片不存在或已被删除';
      }
      setError(msg);
      onError?.(msg);
      throw e;
    } finally {
      setLoading(false);
    }
  }, [inspectionId, onError, onEvent]);

  /**
   * 最终提交
   */
  const finalize = useCallback(async (payload: {
    overallResult: 'NORMAL' | 'ABNORMAL';
    checklistResults: ChecklistItemResult[];
    issueDescription?: string;
  }) => {
    if (!inspectionId) throw new Error('尚未创建点检记录');
    try {
      setPhase('finalizing');
      setLoading(true);
      setError(null);
      const resp = await inspectionApi.finalize(inspectionId, {
        overallResult: payload.overallResult,
        checklistResults: payload.checklistResults,
        issueDescription: payload.issueDescription
      });
      if (!resp.success || !resp.data) {
        throw new Error(resp.message || '提交失败');
      }
      setPhase('done');
      onEvent?.({ type: 'finalized', inspectionId, overallResult: payload.overallResult });
      return resp.data as InspectionLog;
    } catch (e: any) {
      const backendErr = e?.response?.data?.error;
      let msg = e?.response?.data?.message || e.message || '提交失败';
      if (backendErr === 'INVALID_STATE') {
        msg = '记录已提交或状态非法';
      }
      setError(msg);
      onError?.(msg);
      setPhase('editing'); // 回退
      throw e;
    } finally {
      setLoading(false);
    }
  }, [inspectionId, onError, onEvent]);

  return {
    phase,
    inspectionId,
    images,
    loading,
    error,
    createEmpty,
    uploadAndAppend,
    appendExisting,
    removeImage,
    finalize,
    reset
  };
}

export default useIncrementalInspection;
