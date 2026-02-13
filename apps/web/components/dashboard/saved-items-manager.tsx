'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Bookmark,
  ExternalLink,
  Trash2,
} from 'lucide-react'
import { useSavedItems } from '@/hooks/use-saved-items'
import { ProductImage } from '@/components/products/product-image'
import { toast } from 'sonner'
import type { SavedItem } from '@/lib/api'
import { safeLogger } from '@/lib/safe-logger'

/**
 * Saved Items Manager - unified view for saved products (ADR-011)
 *
 * Per UX Charter and 05_alerting_and_notifications.md:
 * - Saving is the only user action
 * - Alerts are an implicit side effect with deterministic thresholds
 * - Saved Items is tracking-only (no alert configuration)
 */
export function SavedItemsManager() {
  const { items, loading, error, remove, refetch } = useSavedItems()

  const handleRemove = async (productId: string, name: string) => {
    if (!confirm(`Remove "${name}" from your watchlist?`)) return

    try {
      await remove(productId)
      toast.success('Item removed')
    } catch (err) {
      safeLogger.dashboard.error('Failed to remove item', {}, err)
      toast.error('Failed to remove item')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">Loading watchlist...</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-destructive">{error}</p>
          <Button onClick={refetch} className="mx-auto mt-4 block">
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Saved Items is a management surface (ADR-012, UX Charter)
  // No status cards, aggregate stats, or dashboard-style metrics
  // Just: list items, allow removal, show current state per item

  return (
    <div className="space-y-6">
      {/* Items List - the only section needed */}
      <Card>
        <CardContent className="pt-6">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <Bookmark className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No items in your watchlist yet. Search for products and add them to track prices.
              </p>
              <Button className="mt-4" asChild>
                <a href="/search">Search Products</a>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <SavedItemRow
                  key={item.id}
                  item={item}
                  onRemove={() => handleRemove(item.productId, item.name)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}

interface SavedItemRowProps {
  item: SavedItem
  onRemove: () => void
}

function SavedItemRow({
  item,
  onRemove,
}: SavedItemRowProps) {
  return (
    <div className="border rounded-lg">
      {/* Main row */}
      <div className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4 hover:bg-accent/50 transition-colors">
        {/* Product Image */}
        <div className="w-16 h-16 relative flex-shrink-0 rounded overflow-hidden bg-gray-100">
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
          <div className="flex items-start gap-2 mb-1">
            <h3 className="font-medium line-clamp-2 flex-1">{item.name}</h3>
            {item.inStock ? (
              <Badge variant="outline" className="text-green-600 border-green-600">
                In Stock
              </Badge>
            ) : (
              <Badge variant="outline" className="text-red-600 border-red-600">
                Out of Stock
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-4 text-sm flex-wrap">
            <span className="text-muted-foreground">
              Price:{' '}
              <span className="font-semibold text-foreground">
                {item.price ? `$${item.price.toFixed(2)}` : 'N/A'}
              </span>
            </span>
            {item.caliber && (
              <span className="text-muted-foreground">{item.caliber}</span>
            )}
            {item.brand && (
              <span className="text-muted-foreground">{item.brand}</span>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-1">
            Added {new Date(item.savedAt).toLocaleDateString()}
          </p>
        </div>

        {/* Alerts status */}
        <div className="text-xs text-muted-foreground">
          Alerts: {item.notificationsEnabled ? 'On' : 'Off'}
          <div>
            <a href="/dashboard/alerts" className="underline hover:text-foreground">
              Manage alerts
            </a>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" asChild title="View product">
            <a href={`/products/${item.productId}`}>
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onRemove}
            title="Remove"
            data-testid={`saved-item-remove-${item.id}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
