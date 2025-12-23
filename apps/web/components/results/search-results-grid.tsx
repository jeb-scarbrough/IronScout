'use client'

import { useState, useCallback, useEffect } from 'react'
import { SearchResultCard } from './search-result-card'
import { ResultCardSkeleton } from './result-card'
import { AdCard } from '@/components/ads/ad-card'
import type { Product, Advertisement } from '@/lib/api'
import { getSavedItems } from '@/lib/api'
import { useSession } from 'next-auth/react'

interface SearchResultsGridProps {
  products: Product[]
  ads?: Advertisement[]
  /** Mix ads every N products */
  adInterval?: number
}

/**
 * SearchResultsGrid - Client component for search results
 *
 * Manages:
 * - Tracking state for all products
 * - Ad mixing into results
 * - Grid layout
 */
export function SearchResultsGrid({
  products,
  ads = [],
  adInterval = 4,
}: SearchResultsGridProps) {
  const { data: session } = useSession()
  const accessToken = (session as any)?.accessToken

  // Track which products are saved
  const [trackedIds, setTrackedIds] = useState<Set<string>>(new Set())
  const [loadingTracked, setLoadingTracked] = useState(false)

  // Load saved items on mount
  useEffect(() => {
    if (!accessToken) return

    setLoadingTracked(true)
    getSavedItems(accessToken)
      .then((response) => {
        const savedIds = new Set(response.items.map((item) => item.productId))
        setTrackedIds(savedIds)
      })
      .catch((error) => {
        console.error('Failed to load saved items:', error)
      })
      .finally(() => {
        setLoadingTracked(false)
      })
  }, [accessToken])

  // Handle track state change
  const handleTrackChange = useCallback((productId: string, isTracked: boolean) => {
    setTrackedIds((prev) => {
      const next = new Set(prev)
      if (isTracked) {
        next.add(productId)
      } else {
        next.delete(productId)
      }
      return next
    })
  }, [])

  // Mix ads into products
  const mixedResults: Array<{ type: 'product' | 'ad'; data: Product | Advertisement }> = []
  let adIndex = 0

  products.forEach((product, index) => {
    mixedResults.push({ type: 'product', data: product })

    if ((index + 1) % adInterval === 0 && adIndex < ads.length) {
      mixedResults.push({ type: 'ad', data: ads[adIndex] })
      adIndex++
    }
  })

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {mixedResults.map((item, index) => (
        <div key={`${item.type}-${index}`}>
          {item.type === 'product' ? (
            <SearchResultCard
              product={item.data as Product}
              isTracked={trackedIds.has((item.data as Product).id)}
              onTrackChange={handleTrackChange}
            />
          ) : (
            <AdCard ad={item.data as Advertisement} />
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * SearchResultsGridSkeleton - Loading state
 */
export function SearchResultsGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ResultCardSkeleton key={i} />
      ))}
    </div>
  )
}
