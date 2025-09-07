import React, { useCallback, useState } from 'react';
import NewCameraCapture from '@/components/NewCameraCapture';
import { nanoid } from 'nanoid';

interface Item {
  id: string;
  url: string;        // 远程URL (/uploads/...)
  preview?: string;   // 可展示的本地objectURL (含授权获取)
  tempLocal?: string; // 上传中本地预览(未授权fetch)
  uploading: boolean;
  error?: string;
}

export interface MultiCameraCaptureProps {
  title?: string;
  max?: number;
  onChange: (urls: string[]) => void;
  upload: (file: File) => Promise<{ fileUrl: string; fileName?: string }>;
  initial?: string[];
  description?: string;
  required?: boolean;
}

export const MultiCameraCapture: React.FC<MultiCameraCaptureProps> = ({
  title = '现场照片',
  max = 9,
  onChange,
  upload,
  initial = [],
  description,
  required
}) => {
  const [items, setItems] = useState<Item[]>(() => initial.map(u => ({ id: nanoid(), url: u, uploading: false })));
  const [showModal, setShowModal] = useState(false);

  const updateParent = (list: Item[]) => {
    onChange(list.filter(i => i.url && !i.error).map(i => i.url));
  };

  const handleCapture = useCallback(async (file: File) => {
    if (items.length >= max) return; // 超出忽略
    const id = nanoid();
    const tempLocal = URL.createObjectURL(file);
    setItems(prev => [...prev, { id, url: '', tempLocal, uploading: true }]);
    try {
      const res = await upload(file);
      const fileUrl: string | undefined =
        (res as any)?.fileUrl ||
        (res as any)?.data?.fileUrl;
      if (!fileUrl) {
        throw new Error('上传结果缺少 fileUrl');
      }
      // 授权获取真实文件(避免<img> 401)，转成blob预览
      let preview: string | undefined = undefined;
      try {
        const mod = await import('@/api/client');
        const blob = await mod.api.getFile(fileUrl);
        preview = URL.createObjectURL(blob);
      } catch {}
      setItems(prev => prev.map(it => it.id === id ? { ...it, url: fileUrl, uploading: false, preview, tempLocal: undefined } : it));
      const futureList = items.concat([{ id, url: fileUrl, uploading: false, preview }]);
      updateParent(futureList);
      URL.revokeObjectURL(tempLocal);
    } catch (e: any) {
      setItems(prev => prev.map(it => it.id === id ? { ...it, uploading: false, error: e.message || '上传失败' } : it));
    }
  }, [items, max, upload]);

  const remove = (id: string) => {
    const target = items.find(i => i.id === id);
    if (target?.preview) URL.revokeObjectURL(target.preview);
    if (target?.tempLocal) URL.revokeObjectURL(target.tempLocal);
    const next = items.filter(i => i.id !== id);
    setItems(next);
    updateParent(next);
  };

  // 初始化时为已有远程URL生成授权预览（避免<img> 401）
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import('@/api/client');
      for (const it of items) {
        if (cancelled) return;
        if (it.url && !it.preview) {
          try {
            const blob = await mod.api.getFile(it.url);
            const obj = URL.createObjectURL(blob);
            setItems(prev => prev.map(p => p.id === it.id ? { ...p, preview: obj } : p));
          } catch {}
        }
      }
    })();
    return () => {
      cancelled = true;
      items.forEach(i => { if (i.preview) URL.revokeObjectURL(i.preview); if (i.tempLocal) URL.revokeObjectURL(i.tempLocal); });
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">
          {title} {required && <span className="text-red-500">*</span>} <span className="text-xs text-gray-500">({items.filter(i=>i.url).length}/{max})</span>
        </div>
      </div>
      {description && <div className="text-xs text-gray-500">{description}</div>}
      <div className="grid grid-cols-3 gap-3">
        {items.map(it => (
          <div key={it.id} className="relative rounded-md overflow-hidden border bg-gray-50 aspect-square group">
            {it.preview && !it.error && (
              <img src={it.preview} className="object-cover w-full h-full" />
            )}
            {!it.preview && it.tempLocal && !it.error && (
              <img src={it.tempLocal} className="object-cover w-full h-full opacity-70" />
            )}
            {it.uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white text-xs">上传中...</div>
            )}
            {it.error && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-600/70 text-white text-xs p-1 text-center">
                <span>{it.error}</span>
                <button onClick={() => remove(it.id)} className="mt-1 underline">移除</button>
              </div>
            )}
            {!it.uploading && !it.error && (
              <button onClick={() => remove(it.id)} className="absolute top-1 right-1 bg-black/50 text-white rounded px-1 text-[10px] opacity-0 group-hover:opacity-100 transition">删</button>
            )}
          </div>
        ))}
        {items.length < max && (
          <div className="relative border rounded-md aspect-square flex items-center justify-center bg-white">
            <button
              type="button"
              className="text-xs text-gray-500 flex flex-col items-center justify-center w-full h-full"
              onClick={() => setShowModal(true)}
            >
              <span className="text-2xl mb-1">📷</span>
              拍照
            </button>
          </div>
        )}
      </div>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-sm mx-auto p-3">
            <div className="bg-white rounded-lg shadow-lg p-2">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-sm font-medium">拍照</span>
                <button onClick={() => { setShowModal(false); }} className="text-xs text-gray-500">关闭</button>
              </div>
              <NewCameraCapture
                onCapture={(file) => { handleCapture(file); /* 保持弹窗不关闭以维持同一流，避免方向变化 */ }}
                compact
                watermark
                autoStart
                captureLabel="拍照"
                fallbackLabel="文件"
                continuous
              />
              <div className="mt-2 text-right">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="text-xs text-blue-600 underline"
                >关闭摄像头</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiCameraCapture;
