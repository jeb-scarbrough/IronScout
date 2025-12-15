'use client'

import { useState, useCallback } from 'react'
import Image from 'next/image'
import { getProductImageUrl, generatePlaceholderSvg, isPlaceholderImage } from '@/lib/product-image'
import { cn } from '@/lib/utils'

interface ProductImageProps {
  /** Vendor-provided image URL (may be null/undefined) */
  imageUrl?: string | null
  /** Product caliber for fallback categorization */
  caliber?: string | null
  /** Product brand for fallback display */
  brand?: string | null
  /** Alt text for the image */
  alt: string
  /** Fill the parent container */
  fill?: boolean
  /** Width (only if fill is false) */
  width?: number
  /** Height (only if fill is false) */
  height?: number
  /** Additional CSS classes */
  className?: string
  /** Priority loading hint */
  priority?: boolean
}

/**
 * ProductImage component with intelligent fallback handling
 *
 * Features:
 * - Automatic fallback to caliber-based placeholder on error
 * - Smooth loading states
 * - Category-aware placeholder generation
 * - Error recovery without layout shift
 */
export function ProductImage({
  imageUrl,
  caliber,
  brand,
  alt,
  fill = true,
  width,
  height,
  className,
  priority = false,
}: ProductImageProps) {
  // Get initial URL (vendor image or generated placeholder)
  const initialUrl = getProductImageUrl(imageUrl, caliber, brand)

  // Track if we've fallen back to placeholder due to load error
  const [currentUrl, setCurrentUrl] = useState(initialUrl)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  // Handle image load error - fall back to generated placeholder
  const handleError = useCallback(() => {
    if (!hasError) {
      setHasError(true)
      // Generate placeholder as fallback
      const placeholder = generatePlaceholderSvg(caliber, brand)
      setCurrentUrl(placeholder)
    }
    setIsLoading(false)
  }, [hasError, caliber, brand])

  const handleLoad = useCallback(() => {
    setIsLoading(false)
  }, [])

  // Determine if current image is a placeholder
  const isPlaceholder = isPlaceholderImage(currentUrl)

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Loading skeleton */}
      {isLoading && !isPlaceholder && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-800 animate-pulse" />
      )}

      {/* For data URIs (placeholders), use regular img tag */}
      {isPlaceholder ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={currentUrl}
          alt={alt}
          className={cn(
            'transition-opacity duration-200',
            fill ? 'absolute inset-0 w-full h-full object-cover' : '',
          )}
          width={fill ? undefined : width}
          height={fill ? undefined : height}
          onLoad={handleLoad}
        />
      ) : (
        <Image
          src={currentUrl}
          alt={alt}
          fill={fill}
          width={fill ? undefined : width}
          height={fill ? undefined : height}
          className={cn(
            'object-cover transition-opacity duration-200',
            isLoading ? 'opacity-0' : 'opacity-100',
          )}
          onError={handleError}
          onLoad={handleLoad}
          priority={priority}
          unoptimized={currentUrl.startsWith('data:')}
        />
      )}
    </div>
  )
}
