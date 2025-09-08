import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { Toaster } from 'sonner'
import { ImagePreviewProvider } from '@/components/image-preview/ImagePreviewContext'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ImagePreviewProvider>
      <App />
    </ImagePreviewProvider>
    <Toaster 
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        duration: 4000,
      }}
    />
  </React.StrictMode>,
)
