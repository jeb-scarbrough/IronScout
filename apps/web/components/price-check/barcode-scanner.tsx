'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } from '@zxing/library'
import { X, Camera, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface BarcodeScannerProps {
  onScan: (code: string) => void
  onClose: () => void
  className?: string
}

type ScannerState = 'initializing' | 'ready' | 'error' | 'permission-denied'

/**
 * List available video input devices using navigator.mediaDevices
 */
async function listVideoInputDevices(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) {
    return []
  }
  const devices = await navigator.mediaDevices.enumerateDevices()
  return devices.filter((d) => d.kind === 'videoinput')
}

/**
 * BarcodeScanner component for scanning UPC/EAN barcodes using the device camera
 *
 * Uses @zxing/library for barcode detection. Optimized for UPC/EAN formats
 * commonly found on ammunition packaging.
 */
export function BarcodeScanner({ onScan, onClose, className }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<BrowserMultiFormatReader | null>(null)
  const [state, setState] = useState<ScannerState>('initializing')
  const [errorMessage, setErrorMessage] = useState<string>('')

  const stopScanning = useCallback(() => {
    if (readerRef.current) {
      readerRef.current.reset()
      readerRef.current = null
    }
  }, [])

  const startScanning = useCallback(async () => {
    if (!videoRef.current) return

    setState('initializing')
    setErrorMessage('')

    try {
      // Configure hints for optimal barcode scanning
      const hints = new Map()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
      ])
      hints.set(DecodeHintType.TRY_HARDER, true)

      const reader = new BrowserMultiFormatReader(hints)
      readerRef.current = reader

      // Get available video devices
      const devices = await listVideoInputDevices()

      if (devices.length === 0) {
        setState('error')
        setErrorMessage('No camera found on this device.')
        return
      }

      // Prefer back camera on mobile devices
      const backCamera = devices.find(
        (d) =>
          d.label.toLowerCase().includes('back') ||
          d.label.toLowerCase().includes('rear') ||
          d.label.toLowerCase().includes('environment')
      )
      const deviceId = backCamera?.deviceId || devices[0]?.deviceId

      // Start continuous scanning
      await reader.decodeFromVideoDevice(
        deviceId || null,
        videoRef.current,
        (result) => {
          if (result) {
            const code = result.getText()
            // Debounce: only fire once per scan
            stopScanning()
            onScan(code)
          }
          // Ignore decode errors - they happen continuously when no barcode is in view
        }
      )

      setState('ready')
    } catch (error) {
      const err = error as Error

      // Handle permission denied
      if (
        err.name === 'NotAllowedError' ||
        err.message.includes('Permission denied') ||
        err.message.includes('not allowed')
      ) {
        setState('permission-denied')
        setErrorMessage('Camera access was denied. Please allow camera access to scan barcodes.')
        return
      }

      // Handle other errors
      setState('error')
      setErrorMessage(err.message || 'Failed to start camera. Please try again.')
    }
  }, [onScan, stopScanning])

  useEffect(() => {
    startScanning()

    return () => {
      stopScanning()
    }
  }, [startScanning, stopScanning])

  const handleClose = () => {
    stopScanning()
    onClose()
  }

  const handleRetry = () => {
    stopScanning()
    startScanning()
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-black flex flex-col',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/80">
        <h2 className="text-white font-medium">Scan Barcode</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          className="text-white hover:bg-white/20"
          aria-label="Close scanner"
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      {/* Video Feed */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
          autoPlay
        />

        {/* Scanning overlay */}
        {state === 'ready' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {/* Scanning guide frame */}
            <div className="relative w-64 h-32 sm:w-80 sm:h-40">
              {/* Corner markers */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white rounded-br-lg" />

              {/* Scanning line animation */}
              <div className="absolute inset-x-0 top-1/2 h-0.5 bg-primary animate-pulse" />
            </div>
          </div>
        )}

        {/* Loading state */}
        {state === 'initializing' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center text-white">
              <Camera className="h-12 w-12 mx-auto mb-4 animate-pulse" />
              <p className="text-lg">Starting camera...</p>
            </div>
          </div>
        )}

        {/* Permission denied state */}
        {state === 'permission-denied' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-6">
            <div className="text-center text-white max-w-sm">
              <Camera className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <h3 className="text-lg font-medium mb-2">Camera Access Required</h3>
              <p className="text-sm text-white/70 mb-6">{errorMessage}</p>
              <div className="space-y-2">
                <Button onClick={handleRetry} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button variant="outline" onClick={handleClose} className="w-full">
                  Enter Manually
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {state === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/90 p-6">
            <div className="text-center text-white max-w-sm">
              <Camera className="h-12 w-12 mx-auto mb-4 text-destructive" />
              <h3 className="text-lg font-medium mb-2">Camera Error</h3>
              <p className="text-sm text-white/70 mb-6">{errorMessage}</p>
              <div className="space-y-2">
                <Button onClick={handleRetry} className="w-full">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
                <Button variant="outline" onClick={handleClose} className="w-full">
                  Enter Manually
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer hint */}
      {state === 'ready' && (
        <div className="p-4 bg-black/80 text-center">
          <p className="text-white/70 text-sm">
            Position the barcode within the frame
          </p>
        </div>
      )}
    </div>
  )
}
