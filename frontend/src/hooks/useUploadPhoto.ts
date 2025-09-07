import { useState } from 'react';
import { api } from '@/api/client';

export interface UseUploadPhotoOptions {
  endpoint?: string; // 相对 /api 的上传路径, 例如 '/upload'
}

export function useUploadPhoto(options: UseUploadPhotoOptions = {}) {
  // 由于 axios 实例已设置 baseURL='/api' 且自动附带 token，这里用 '/upload'
  const { endpoint = '/upload' } = options;
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<any>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('source', 'webrtc');
      const resp: any = await api.upload(endpoint, form);
      // 统一响应: { success, data, message }
      if (resp && resp.success === false) {
        throw new Error(resp.message || '上传失败');
      }
      // 兼容后端可能直接返回 data
      const resultData = resp?.data || resp;
      setLastResult(resultData);
      return resp;
    } catch (e: any) {
      let composed = e?.message || '上传失败';
      const errData = e?.response?.data;
      if (errData?.error) {
        composed = `${errData.error}${errData.message ? ':' + errData.message : ''}`.trim();
      }
      setError(composed);
      throw new Error(composed);
    } finally {
      setUploading(false);
    }
  };

  return { upload, uploading, error, lastResult };
}

export default useUploadPhoto;
