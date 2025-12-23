'use client'

import { useCallback } from 'react'
import { ResultCard } from './result-card'
import type { Product } from '@/lib/api'
import { saveItem, unsaveItem } from '@/lib/api'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

interface SearchResultCardProps {
  product: Product
  isTracked?: boolean
  /** Crown this card as the best price in the result set */
  isBestPrice?: boolean
  onTrackChange?: (productId: string, isTracked: boolean) => void
}

/**
 * SearchResultCard - Adapter for search results
 *
 * Maps a Product to the ResultCard spec contract.
 * Handles tracking state via the saved items API.
 */
export function SearchResultCard({
  product,
  isTracked = false,
  isBestPrice = false,
  onTrackChange,
}: SearchResultCardProps) {
  const { data: session } = useSession()
  const accessToken = (session as any)?.accessToken

  // Get the lowest price entry
  const lowestPrice = product.prices.reduce((min, price) =>
    price.price < min.price ? price : min,
    product.prices[0]
  )

  if (!lowestPrice) {
    return null
  }

  // Calculate price per round
  const pricePerRound = product.roundCount && product.roundCount > 0
    ? lowestPrice.price / product.roundCount
    : lowestPrice.price // Fallback to total if no round count

  // Handle track toggle
  const handleTrackToggle = useCallback(async (id: string) => {
    if (!accessToken) {
      toast.error('Please sign in to track prices')
      return
    }

    try {
      if (isTracked) {
        await unsaveItem(accessToken, product.id)
        onTrackChange?.(product.id, false)
      } else {
        await saveItem(accessToken, product.id)
        onTrackChange?.(product.id, true)
      }
    } catch (error) {
      console.error('Failed to toggle tracking:', error)
      toast.error('Failed to update tracking')
    }
  }, [accessToken, isTracked, product.id, onTrackChange])

  return (
    <ResultCard
      id={product.id}
      pricePerRound={pricePerRound}
      inStock={lowestPrice.inStock}
      productTitle={product.name}
      retailerName={lowestPrice.retailer.name}
      retailerUrl={lowestPrice.url}
      caliber={product.caliber || 'Unknown'}
      grain={product.grainWeight}
      caseMaterial={product.caseMaterial}
      isTracked={isTracked}
      isBestPrice={isBestPrice}
      placement="search"
      onTrackToggle={handleTrackToggle}
    />
  )
}
