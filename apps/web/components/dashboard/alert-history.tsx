'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Bell, TrendingDown, PackageCheck, Loader2, AlertCircle } from 'lucide-react'
import { useAlertHistory } from '@/hooks/use-alert-history'
import type { AlertHistoryEntry } from '@/lib/api'

/**
 * Alert History — shows past alert notifications that were actually delivered.
 *
 * Per alert-history-v1 spec §10:
 * - Product name + link, event type badge, triggered date, price changes
 * - Cursor pagination ("Load more" button)
 * - Empty/loading/error states
 * - Timestamp: relative for <48h, absolute otherwise
 * - Missing product: "Product unavailable", disabled link
 * - Redacted retailer: "Retailer unavailable" (ADR-005)
 */
export function AlertHistory() {
  const { entries, loading, loadingMore, error, hasMore, loadMore, refetch } = useAlertHistory()

  if (loading) {
    return (
      <div className="space-y-4">
        <SectionHeader />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <SectionHeader />
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-destructive mb-3">{error}</p>
              <Button size="sm" variant="outline" onClick={refetch}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <SectionHeader />

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              No alerts yet — we&apos;ll notify you when prices drop on your saved items.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {entries.map((entry) => (
              <AlertHistoryRow key={entry.id} entry={entry} />
            ))}
          </div>

          {hasMore && (
            <div className="text-center pt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load more'
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SectionHeader() {
  return (
    <div>
      <h2 className="text-lg font-semibold">Notification History</h2>
      <p className="text-sm text-muted-foreground">
        Alerts that were sent to your email.
      </p>
    </div>
  )
}

function AlertHistoryRow({ entry }: { entry: AlertHistoryEntry }) {
  const isUnavailable = entry.productName === 'Product unavailable'

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {/* Type badge */}
          <div className="flex-shrink-0">
            {entry.type === 'PRICE_DROP' ? (
              <Badge variant="outline" className="gap-1 text-xs">
                <TrendingDown className="h-3 w-3" />
                Price Drop
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-xs">
                <PackageCheck className="h-3 w-3" />
                Back in Stock
              </Badge>
            )}
          </div>

          {/* Product info */}
          <div className="flex-1 min-w-0">
            {isUnavailable ? (
              <p className="text-sm text-muted-foreground">Product unavailable</p>
            ) : (
              <a
                href={`/products/${entry.productId}`}
                className="text-sm font-medium hover:underline truncate block"
              >
                {entry.productName}
              </a>
            )}
            {entry.metadata.originalProductId && (
              <span className="text-xs text-muted-foreground">Updated listing</span>
            )}
          </div>

          {/* Price change */}
          <div className="hidden sm:block text-right text-sm flex-shrink-0">
            {entry.type === 'PRICE_DROP' && entry.metadata.oldPrice != null && entry.metadata.newPrice != null && (
              <span>
                <span className="text-muted-foreground line-through">
                  ${entry.metadata.oldPrice.toFixed(2)}
                </span>
                {' → '}
                <span className="font-medium text-green-600">
                  ${entry.metadata.newPrice.toFixed(2)}
                </span>
              </span>
            )}
            {entry.type === 'BACK_IN_STOCK' && entry.metadata.newPrice != null && (
              <span className="font-medium">${entry.metadata.newPrice.toFixed(2)}</span>
            )}
          </div>

          {/* Retailer + timestamp */}
          <div className="text-right text-xs text-muted-foreground flex-shrink-0 min-w-[80px]">
            <div>
              {entry.metadata.retailer === null
                ? 'Retailer unavailable'
                : entry.metadata.retailer || ''}
            </div>
            <div>{formatTriggeredAt(entry.triggeredAt)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Format triggeredAt per spec §10:
 * - Relative time for < 48h
 * - Absolute date/time otherwise
 */
function formatTriggeredAt(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = diffMs / (1000 * 60 * 60)

  if (diffHours < 1) {
    const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)))
    return `${mins}m ago`
  }
  if (diffHours < 48) {
    return `${Math.floor(diffHours)}h ago`
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}
