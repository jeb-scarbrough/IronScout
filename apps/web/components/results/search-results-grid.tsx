'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SearchResultCard } from './search-result-card'
import { SearchResultRow } from './search-result-row'
import { ResultCardSkeleton } from './result-card'
import { ResultTableHeader, ResultRowSkeleton } from './result-row'
import { ViewToggle, type ViewMode } from './view-toggle'
import { AdCard } from '@/components/ads/ad-card'
import type { Product, Advertisement } from '@/lib/api'
import { getSavedItems } from '@/lib/api'
import { useSession } from 'next-auth/react'
import { useViewPreference } from '@/hooks/use-view-preference'

interface SearchResultsGridProps {
  products: Product[]
  ads?: Advertisement[]
  /** Mix ads every N products (card view only) */
  adInterval?: number
}

/**
 * SearchResultsGrid - Client component for search results
 *
 * Supports two view modes:
 * - Card: Discovery/decision mode with hierarchy, recommendations
 * - Grid: Execution/optimization mode with dense table for fast scanning
 */
export function SearchResultsGrid({
  products,
  ads = [],
  adInterval = 4,
}: SearchResultsGridProps) {
  const { data: session } = useSession()
  const accessToken = (session as any)?.accessToken
  const router = useRouter()
  const searchParams = useSearchParams()

  // View mode with localStorage persistence
  const [viewMode, setViewMode] = useViewPreference('card')

  // Current sort from URL
  const currentSort = searchParams.get('sortBy') || 'relevance'

  // Handle sort change - updates URL params
  const handleSortChange = useCallback((sortValue: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (sortValue === 'relevance') {
      params.delete('sortBy')
    } else {
      params.set('sortBy', sortValue)
    }
    params.delete('page') // Reset to page 1 on sort change
    router.push(`/search?${params.toString()}`)
  }, [router, searchParams])

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

  // Find the best price product (lowest price per round, in stock preferred)
  // Only used in card view
  const bestPriceProductId = useMemo(() => {
    if (products.length === 0) return null

    const withPrices = products
      .map((product) => {
        const lowestPrice = product.prices.reduce(
          (min, price) => (price.price < min.price ? price : min),
          product.prices[0]
        )
        if (!lowestPrice) return null

        const pricePerRound =
          product.roundCount && product.roundCount > 0
            ? lowestPrice.price / product.roundCount
            : lowestPrice.price

        return {
          id: product.id,
          pricePerRound,
          inStock: lowestPrice.inStock,
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)

    if (withPrices.length === 0) return null

    withPrices.sort((a, b) => {
      if (a.inStock && !b.inStock) return -1
      if (!a.inStock && b.inStock) return 1
      return a.pricePerRound - b.pricePerRound
    })

    return withPrices[0].id
  }, [products])

  // Mix ads into products (card view only)
  const mixedResults: Array<{ type: 'product' | 'ad'; data: Product | Advertisement }> = []
  let adIndex = 0

  products.forEach((product, index) => {
    mixedResults.push({ type: 'product', data: product })

    if ((index + 1) % adInterval === 0 && adIndex < ads.length) {
      mixedResults.push({ type: 'ad', data: ads[adIndex] })
      adIndex++
    }
  })

  const hasBestPrice = bestPriceProductId !== null

  return (
    <div className="space-y-3">
      {/* View Toggle + Card view anchoring line */}
      <div className="flex items-center justify-between">
        {viewMode === 'card' && hasBestPrice && products.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            We found the best available option for your search
          </p>
        ) : (
          <div /> // Spacer
        )}
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>

      {viewMode === 'card' ? (
        // Card View - Discovery mode
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-stretch">
          {mixedResults.map((item, index) => (
            <div key={`${item.type}-${index}`} className="h-full">
              {item.type === 'product' ? (
                <SearchResultCard
                  product={item.data as Product}
                  isTracked={trackedIds.has((item.data as Product).id)}
                  isBestPrice={(item.data as Product).id === bestPriceProductId}
                  onTrackChange={handleTrackChange}
                />
              ) : (
                <AdCard ad={item.data as Advertisement} />
              )}
            </div>
          ))}
        </div>
      ) : (
        // Grid View - Execution mode (dense table, no ads)
        <div className="border border-border rounded-lg overflow-hidden overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <ResultTableHeader
              currentSort={currentSort}
              onSortChange={handleSortChange}
            />
            <tbody>
              {products.map((product) => (
                <SearchResultRow
                  key={product.id}
                  product={product}
                  isTracked={trackedIds.has(product.id)}
                  onTrackChange={handleTrackChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/**
 * SearchResultsGridSkeleton - Loading state
 */
export function SearchResultsGridSkeleton({
  count = 8,
  viewMode = 'card'
}: {
  count?: number
  viewMode?: ViewMode
}) {
  if (viewMode === 'grid') {
    return (
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full">
          <ResultTableHeader />
          <tbody>
            {Array.from({ length: count }).map((_, i) => (
              <ResultRowSkeleton key={i} />
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <ResultCardSkeleton key={i} />
      ))}
    </div>
  )
}

// Re-export ViewToggle for use in search header
export { ViewToggle, type ViewMode }
