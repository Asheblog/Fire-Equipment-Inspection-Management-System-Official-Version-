/**
 * 直接相机调用工具
 * 优先使用 getUserMedia API，降级到优化的 HTML input
 * 目标：用户点击按钮直接调用相机，无选择菜单
 */

// 相机调用结果接口
interface CameraResult {
  success: boolean
  file?: File
  error?: string
}

// 相机调用配置
interface CameraConfig {
  quality?: number // 图片质量 0-1
  maxWidth?: number // 最大宽度
  maxHeight?: number // 最大高度
  facingMode?: 'user' | 'environment' // 摄像头方向
}

/**
 * 直接调用相机拍照
 * @param config 相机配置
 * @returns Promise<CameraResult>
 */
export async function captureImageDirectly(config: CameraConfig = {}): Promise<CameraResult> {
  const {
    quality = 0.8,
    maxWidth = 1920,
    maxHeight = 1080,
    facingMode = 'environment'
  } = config

  try {
    // 优先尝试 getUserMedia API
    if (typeof navigator !== 'undefined' && 
        navigator.mediaDevices && 
        typeof navigator.mediaDevices.getUserMedia === 'function') {
      console.log('📸 使用 getUserMedia API 直接调用相机')
      return await captureWithGetUserMedia({ quality, maxWidth, maxHeight, facingMode })
    }
    
    // 降级到优化的 HTML input
    console.log('📸 降级到 HTML input 方案')
    return await captureWithInput()
    
  } catch (error) {
    console.error('📸 相机调用失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '相机调用失败'
    }
  }
}

/**
 * 使用 getUserMedia API 直接调用相机
 */
async function captureWithGetUserMedia(config: Required<CameraConfig>): Promise<CameraResult> {
  return new Promise(async (resolve) => {
    let stream: MediaStream | null = null
    
    try {
      // 请求相机权限和流
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: config.facingMode,
          width: { ideal: config.maxWidth },
          height: { ideal: config.maxHeight }
        },
        audio: false
      })

      // 创建临时视频元素和画布
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')!

      // 创建拍照界面
      const modal = createCameraModal(video, () => {
        // 用户点击拍照
        try {
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          context.drawImage(video, 0, 0)
          
          canvas.toBlob((blob) => {
            if (blob) {
              const file = new File([blob], `photo_${Date.now()}.jpg`, {
                type: 'image/jpeg',
                lastModified: Date.now()
              })
              cleanup()
              resolve({ success: true, file })
            } else {
              cleanup()
              resolve({ success: false, error: '图片生成失败' })
            }
          }, 'image/jpeg', config.quality)
          
        } catch (error) {
          cleanup()
          resolve({ 
            success: false, 
            error: error instanceof Error ? error.message : '拍照失败' 
          })
        }
      }, () => {
        // 用户取消
        cleanup()
        resolve({ success: false, error: '用户取消拍照' })
      })

      // 启动视频流
      video.srcObject = stream
      video.play()

      function cleanup() {
        if (stream) {
          stream.getTracks().forEach(track => track.stop())
          stream = null
        }
        modal.remove()
      }

    } catch (error) {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
      resolve({
        success: false,
        error: error instanceof Error ? error.message : 'getUserMedia 调用失败'
      })
    }
  })
}

/**
 * 创建相机拍照模态框
 */
function createCameraModal(
  video: HTMLVideoElement,
  onCapture: () => void,
  onCancel: () => void
): HTMLElement {
  const modal = document.createElement('div')
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: black;
    z-index: 10000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  `

  video.style.cssText = `
    max-width: 100%;
    max-height: 80%;
    object-fit: contain;
  `

  const buttonContainer = document.createElement('div')
  buttonContainer.style.cssText = `
    position: absolute;
    bottom: 20px;
    display: flex;
    gap: 20px;
  `

  const captureButton = document.createElement('button')
  captureButton.textContent = '拍照'
  captureButton.style.cssText = `
    background: #0ea5e9;
    color: white;
    border: none;
    padding: 15px 30px;
    border-radius: 50px;
    font-size: 16px;
    cursor: pointer;
  `
  captureButton.onclick = onCapture

  const cancelButton = document.createElement('button')
  cancelButton.textContent = '取消'
  cancelButton.style.cssText = `
    background: #6b7280;
    color: white;
    border: none;
    padding: 15px 30px;
    border-radius: 50px;
    font-size: 16px;
    cursor: pointer;
  `
  cancelButton.onclick = onCancel

  buttonContainer.appendChild(captureButton)
  buttonContainer.appendChild(cancelButton)
  modal.appendChild(video)
  modal.appendChild(buttonContainer)
  document.body.appendChild(modal)

  return modal
}

/**
 * 使用优化的 HTML input 降级方案
 */
async function captureWithInput(): Promise<CameraResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    
    // 优化的属性配置，提高直接调用相机的成功率
    input.accept = 'image/jpeg,image/png,image/webp'
    
    // 尝试多种 capture 值以提高兼容性
    input.capture = 'camera' // 先尝试通用值
    
    // 如果浏览器支持，再尝试环境摄像头
    try {
      input.setAttribute('capture', 'environment')
    } catch (e) {
      // 某些浏览器可能不支持
      console.log('浏览器不支持 capture=environment，使用默认值')
    }

    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        resolve({ success: true, file })
      } else {
        resolve({ success: false, error: '未选择文件' })
      }
    }

    input.oncancel = () => {
      resolve({ success: false, error: '用户取消选择' })
    }

    // 触发文件选择
    input.click()
  })
}

/**
 * 检测浏览器是否支持 getUserMedia
 */
export function isGetUserMediaSupported(): boolean {
  return typeof navigator !== 'undefined' && 
         !!navigator.mediaDevices && 
         typeof navigator.mediaDevices.getUserMedia === 'function'
}

/**
 * 检测当前是否在安全上下文中（getUserMedia 需要）
 */
export function isSecureContext(): boolean {
  return window.isSecureContext || location.protocol === 'https:' || location.hostname === 'localhost'
}