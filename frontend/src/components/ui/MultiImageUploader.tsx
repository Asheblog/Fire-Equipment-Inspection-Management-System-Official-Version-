import React, { useState, useRef } from 'react'
import { captureImageDirectly } from '@/utils/directCamera'
import { uploadApi } from '@/api'
import { AuthenticatedImage } from '@/components/AuthenticatedImage'
import { Button } from '@/components/ui/button'
import { 
  Camera, 
  X, 
  Image as ImageIcon, 
  Loader2,
  Move,
  AlertTriangle
} from 'lucide-react'

interface MultiImageUploaderProps {
  images: string[]
  onImagesChange: (images: string[]) => void
  maxImages?: number
  title?: string
  description?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

export const MultiImageUploader: React.FC<MultiImageUploaderProps> = ({
  images = [],
  onImagesChange,
  maxImages = 9,
  title = "图片",
  description,
  required = false,
  disabled = false,
  className = ""
}) => {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 处理直接拍照
  const handleCapture = async () => {
    if (disabled || images.length >= maxImages) return
    
    try {
      setError('')
      setUploading(true)
      
      const result = await captureImageDirectly({
        facingMode: 'environment',
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1080
      })
      
      if (result.success && result.file) {
        const uploadResponse = await uploadApi.uploadImage(result.file)
        if (uploadResponse.success && uploadResponse.data) {
          const newImages = [...images, uploadResponse.data.fileUrl]
          onImagesChange(newImages)
        } else {
          setError('图片上传失败')
        }
      } else if (result.error !== '用户取消拍照' && result.error !== '用户取消选择') {
        setError(result.error || '拍照失败')
      }
    } catch (err) {
      console.error('拍照失败:', err)
      setError('拍照功能异常，请重试')
    } finally {
      setUploading(false)
    }
  }

  // 处理从相册选择
  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0 || disabled) return

    try {
      setError('')
      setUploading(true)
      
      const remainingSlots = maxImages - images.length
      const filesToUpload = Array.from(files).slice(0, remainingSlots)
      
      const newImageUrls: string[] = []
      
      for (const file of filesToUpload) {
        const uploadResponse = await uploadApi.uploadImage(file)
        if (uploadResponse.success && uploadResponse.data) {
          newImageUrls.push(uploadResponse.data.fileUrl)
        } else {
          throw new Error('图片上传失败')
        }
      }
      
      const updatedImages = [...images, ...newImageUrls]
      onImagesChange(updatedImages)
      
      // 清除文件输入
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      
    } catch (err) {
      console.error('上传失败:', err)
      setError('图片上传失败，请重试')
    } finally {
      setUploading(false)
    }
  }

  // 删除图片
  const handleRemoveImage = (index: number) => {
    if (disabled) return
    const newImages = images.filter((_, i) => i !== index)
    onImagesChange(newImages)
  }

  // 拖拽开始
  const handleDragStart = (index: number) => {
    if (disabled) return
    setDraggedIndex(index)
  }

  // 拖拽悬停
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (disabled || draggedIndex === null || draggedIndex === index) return
    
    const newImages = [...images]
    const draggedImage = newImages[draggedIndex]
    newImages.splice(draggedIndex, 1)
    newImages.splice(index, 0, draggedImage)
    
    setDraggedIndex(index)
    onImagesChange(newImages)
  }

  // 拖拽结束
  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const canAddMore = images.length < maxImages && !disabled
  const isAtMaxCapacity = images.length >= maxImages

  return (
    <div className={`space-y-4 ${className}`}>
      {/* 标题和描述 */}
      <div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium">
            {title}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <span className="text-xs text-muted-foreground">
            {images.length}/{maxImages}
          </span>
        </div>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-2 rounded">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 图片网格 */}
      <div className="grid grid-cols-3 gap-2">
        {/* 现有图片 */}
        {images.map((imageUrl, index) => (
          <div
            key={`${imageUrl}-${index}`}
            className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden group"
            draggable={!disabled}
            onDragStart={() => handleDragStart(index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragEnd={handleDragEnd}
          >
            <AuthenticatedImage
              src={imageUrl}
              alt={`${title} ${index + 1}`}
              className="w-full h-full object-cover"
            />
            
            {/* 拖拽指示器 */}
            {!disabled && (
              <div className="absolute top-1 left-1 bg-black/50 rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Move className="h-3 w-3 text-white" />
              </div>
            )}
            
            {/* 删除按钮 */}
            {!disabled && (
              <button
                onClick={() => handleRemoveImage(index)}
                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        {/* 添加图片按钮 */}
        {canAddMore && (
          <div className="aspect-square">
            <div className="h-full flex flex-col gap-1">
              {/* 拍照按钮 */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleCapture}
                disabled={uploading}
                className="flex-1 flex-col gap-1 h-auto min-h-0"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                <span className="text-xs">拍照</span>
              </Button>

              {/* 相册按钮 */}
              <div className="flex-1">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploading}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full h-full flex-col gap-1 min-h-0"
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                  <span className="text-xs">相册</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 容量满时的提示 */}
        {isAtMaxCapacity && !disabled && (
          <div className="aspect-square flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-center">
              <div className="text-gray-400 text-xs">已达到</div>
              <div className="text-gray-400 text-xs">最大数量</div>
            </div>
          </div>
        )}
      </div>

      {/* 使用提示 */}
      {images.length === 0 && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          {required ? '请至少添加一张图片' : '暂无图片，可以拍照或从相册选择'}
        </div>
      )}

      {/* 长按拖拽提示 */}
      {images.length > 1 && !disabled && (
        <div className="text-xs text-muted-foreground text-center">
          💡 提示：长按图片可以拖拽调整顺序
        </div>
      )}
    </div>
  )
}

export default MultiImageUploader