import React, { useCallback } from 'react';
import NewCameraCapture from '@/components/NewCameraCapture';
import { useUploadPhoto } from '@/hooks/useUploadPhoto';

// 简单演示集成页 (可根据路由系统挂载)
export const CameraDemoPage: React.FC = () => {
  const { upload, uploading, error, lastResult } = useUploadPhoto();

  const handleCapture = useCallback(async (file: File) => {
    try {
      await upload(file);
    } catch (e) {
      // error 已由 hook 处理
    }
  }, [upload]);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '16px 20px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>现场拍照上传 (示例)</h1>
      <p style={{ fontSize: 14, color: '#475569', lineHeight: 1.5 }}>
        该组件优先使用 WebRTC 直接打开后置摄像头，失败时回退为文件选择。生成的照片自动添加时间戳与随机校验码水印。
      </p>
      <NewCameraCapture onCapture={handleCapture} />
      <div style={{ marginTop: 16, fontSize: 14 }}>
        {uploading && <div style={{ color: '#2563eb' }}>上传中...</div>}
        {error && <div style={{ color: '#b91c1c' }}>上传失败: {error}</div>}
        {lastResult && (
          <div style={{ color: '#15803d' }}>
            上传成功: {lastResult.fileName || lastResult.fileUrl || '已接收'}
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: '#64748b', marginTop: 24, lineHeight: 1.4 }}>
        提示: WebRTC 方案不会保留原生 EXIF；水印中的时间戳与随机码可用于后端防伪校验。
      </div>
    </div>
  );
};

export default CameraDemoPage;
