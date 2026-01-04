'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bookmark, ChevronRight, Bell, BellOff } from 'lucide-react'
import Link from 'next/link'
import { ProductImage } from '@/components/products/product-image'
import type { DashboardState } from './state-banner'

/**
 * Watchlist preview item - matches backend WatchlistPreviewItem
 */
export interface WatchlistPreviewItem {
  id: string
  productId: string
  name: string
  caliber: string | null
  brand: string | null
  price: number | null
  pricePerRound: number | null
  inStock: boolean
  imageUrl: string | null
  notificationsEnabled: boolean
  createdAt: string
}

interface WatchlistPreviewV4Props {
  items: WatchlistPreviewItem[]
  totalCount: number
  maxItems?: number
  state: DashboardState
}

/**
 * WatchlistPreviewV4 - Dashboard watchlist preview section
 *
 * Per dashboard-product-spec.md:
 * - Dashboard shows a subset preview of the watchlist
 * - Shows up to maxItems (3 for most states, 7 for POWER_USER)
 * - "Manage" routes to full Watchlist page
 * - No inline editing beyond navigation
 */
export function WatchlistPreviewV4({
  items,
  totalCount,
  maxItems = 3,
  state,
}: WatchlistPreviewV4Props) {
  const displayItems = items.slice(0, maxItems)
  const showMore = totalCount > displayItems.length

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
            <Bookmark className="h-4 w-4" />
            Your Watchlist ({totalCount} item{totalCount !== 1 ? 's' : ''})
          </CardTitle>
          <Link href="/dashboard/saved">
            <Button variant="ghost" size="sm" className="text-xs h-7 gap-1">
              Manage
              <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {displayItems.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Your watchlist is empty
          </div>
        ) : (
          <div className="divide-y divide-border">
            {displayItems.map((item) => (
              <WatchlistPreviewRow
                key={item.id}
                item={item}
                showAlertStatus={state === 'NEEDS_ALERTS'}
              />
            ))}
          </div>
        )}

        {/* Show more indicator */}
        {showMore && (
          <div className="pt-3 text-center">
            <Link href="/dashboard/saved">
              <Button variant="ghost" size="sm" className="text-xs text-muted-foreground">
                {displayItems.length} of {totalCount} shown · View all
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface WatchlistPreviewRowProps {
  item: WatchlistPreviewItem
  showAlertStatus?: boolean
}

function WatchlistPreviewRow({ item, showAlertStatus = false }: WatchlistPreviewRowProps) {
  return (
    <Link
      href={`/products/${item.productId}`}
      className="flex items-center gap-3 py-3 hover:bg-accent/50 transition-colors -mx-4 px-4"
    >
      {/* Product Image */}
      <div className="w-10 h-10 relative flex-shrink-0 rounded overflow-hidden bg-gray-100">
        <ProductImage
          imageUrl={item.imageUrl}
          caliber={item.caliber}
          brand={item.brand}
          alt={item.name}
          fill
        />
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* Alert status indicator for NEEDS_ALERTS state */}
          {showAlertStatus && (
            <span
              className={`flex-shrink-0 ${
                item.notificationsEnabled ? 'text-blue-500' : 'text-muted-foreground'
              }`}
              title={item.notificationsEnabled ? 'Alerts active' : 'Alerts paused'}
            >
              {item.notificationsEnabled ? (
                <Bell className="h-3 w-3" />
              ) : (
                <BellOff className="h-3 w-3" />
              )}
            </span>
          )}
          <span className="font-medium text-sm truncate">{item.name}</span>
        </div>
      </div>

      {/* Caliber Badge */}
      {item.caliber && (
        <Badge variant="secondary" className="text-xs flex-shrink-0">
          {item.caliber}
        </Badge>
      )}

      {/* Price */}
      <div className="text-right flex-shrink-0">
        {item.pricePerRound !== null ? (
          <span className="text-sm font-medium text-primary">
            {(item.pricePerRound * 100).toFixed(1)}¢
            <span className="text-xs text-muted-foreground">/rd</span>
          </span>
        ) : item.price !== null ? (
          <span className="text-sm font-medium">${item.price.toFixed(2)}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>
    </Link>
  )
}
