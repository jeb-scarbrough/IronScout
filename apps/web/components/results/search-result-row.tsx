'use client'

import { useCallback } from 'react'
import { ResultRow } from './result-row'
import type { Product } from '@/lib/api'
import { saveItem, unsaveItem } from '@/lib/api'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

interface SearchResultRowProps {
  product: Product
  isTracked?: boolean
  onTrackChange?: (productId: string, isTracked: boolean) => void
}

/**
 * SearchResultRow - Adapter for grid view rows
 *
 * Maps a Product to the ResultRow spec contract.
 * Handles tracking state via the saved items API.
 */
export function SearchResultRow({
  product,
  isTracked = false,
  onTrackChange,
}: SearchResultRowProps) {
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
    : lowestPrice.price

  // Handle track toggle
  const handleTrackToggle = useCallback(async (id: string) => {
    if (!accessToken) {
      toast.error('Please sign in to create alerts')
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
      toast.error('Failed to update alert')
    }
  }, [accessToken, isTracked, product.id, onTrackChange])

  return (
    <ResultRow
      id={product.id}
      productTitle={product.name}
      pricePerRound={pricePerRound}
      totalPrice={lowestPrice.price}
      roundCount={product.roundCount ?? undefined}
      inStock={lowestPrice.inStock}
      retailerName={lowestPrice.retailer.name}
      retailerUrl={lowestPrice.url}
      isTracked={isTracked}
      placement="search"
      onTrackToggle={handleTrackToggle}
    />
  )
}
