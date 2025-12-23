'use client'

import { useCallback } from 'react'
import { ResultCard } from './result-card'
import type { ProductFeedItem } from '@/types/dashboard'
import { addToWatchlist, removeFromWatchlist } from '@/lib/api'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

interface ForYouResultCardProps {
  item: ProductFeedItem
  onTrackChange?: (productId: string, isTracked: boolean) => void
}

/**
 * ForYouResultCard - Adapter for dashboard "For You" feed
 *
 * Maps a ProductFeedItem to the ResultCard spec contract.
 * Uses the same card hierarchy as search results for consistency.
 */
export function ForYouResultCard({
  item,
  onTrackChange,
}: ForYouResultCardProps) {
  const { data: session } = useSession()
  const accessToken = (session as any)?.accessToken

  // Calculate price per round (fallback to total price / default round count)
  const pricePerRound = item.pricePerRound ?? (item.price / (item.product.roundCount || 50))

  // Handle track toggle
  const handleTrackToggle = useCallback(async (id: string) => {
    if (!accessToken) {
      toast.error('Please sign in to track prices')
      return
    }

    try {
      if (item.isWatched) {
        // Note: For legacy watchlist API, we need the watchlist item ID, not product ID
        // This may need adjustment based on actual API
        await removeFromWatchlist(item.id, accessToken)
        onTrackChange?.(item.product.id, false)
      } else {
        await addToWatchlist(accessToken, item.product.id)
        onTrackChange?.(item.product.id, true)
      }
    } catch (error) {
      console.error('Failed to toggle tracking:', error)
      toast.error('Failed to update tracking')
    }
  }, [accessToken, item.isWatched, item.id, item.product.id, onTrackChange])

  return (
    <ResultCard
      id={item.id}
      pricePerRound={pricePerRound}
      inStock={item.inStock}
      productTitle={item.product.name}
      retailerName={item.retailer.name}
      retailerUrl={item.url}
      caliber={item.product.caliber}
      grain={item.product.grainWeight ?? undefined}
      caseMaterial={undefined} // Not in ProductFeedItem
      isTracked={item.isWatched}
      placement="for_you"
      onTrackToggle={handleTrackToggle}
    />
  )
}
