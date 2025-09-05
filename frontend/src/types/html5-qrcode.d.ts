declare module 'html5-qrcode' {
  export interface Html5QrcodeResult {
    text: string
    format?: string
  }

  export interface Html5QrcodeScannerConfig {
    fps?: number
    qrbox?: number | { width: number; height: number }
    aspectRatio?: number
    disableFlip?: boolean
    videoConstraints?: {
      facingMode?: 'user' | 'environment'
      aspectRatio?: number
    }
  }

  export class Html5QrcodeScanner {
    constructor(
      elementId: string,
      config: Html5QrcodeScannerConfig,
      verbose?: boolean
    )

    render(
      qrCodeSuccessCallback: (decodedText: string, decodedResult: Html5QrcodeResult) => void,
      qrCodeErrorCallback?: (error: string) => void
    ): void

    clear(): void
  }

  export class Html5Qrcode {
    constructor(elementId: string, verbose?: boolean)

    start(
      cameraIdOrConfig: string | { facingMode: string },
      configuration: Html5QrcodeScannerConfig,
      qrCodeSuccessCallback: (decodedText: string, decodedResult: Html5QrcodeResult) => void,
      qrCodeErrorCallback?: (error: string) => void
    ): Promise<void>

    stop(): Promise<void>
    clear(): void

    static getCameras(): Promise<Array<{ id: string; label: string }>>
  }
}