'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Bell,
  BellOff,
  BellRing,
  ExternalLink,
  ChevronDown,
  Search,
  TrendingDown,
  PackageCheck,
} from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useSavedItems } from '@/hooks/use-saved-items'
import { ProductImage } from '@/components/products/product-image'
import { toast } from 'sonner'
import type { SavedItem } from '@/lib/api'
import { safeLogger } from '@/lib/safe-logger'

/**
 * Alerts Manager — full-page view of all saved items with notification status.
 *
 * Per ADR-011: "Saving is the only user action; alerts are an implicit side effect."
 * This page surfaces the notification dimension of saved items:
 * - Which items have notifications enabled/paused
 * - Quick toggles for price drop and back-in-stock alerts
 * - Status indicators for monitoring state
 *
 * This is NOT a separate data source — it's the same saved items
 * viewed through an alerts lens.
 */
export function AlertsManager() {
  const { items, loading, error, updatePrefs, refetch } = useSavedItems()

  const handleUpdatePref = async (
    item: SavedItem,
    field: 'notificationsEnabled' | 'priceDropEnabled' | 'backInStockEnabled',
    value: boolean
  ) => {
    try {
      await updatePrefs(item.productId, { [field]: value })
      if (field === 'notificationsEnabled') {
        toast.success(value ? 'Notifications resumed' : 'Notifications paused')
      }
    } catch (err) {
      safeLogger.dashboard.error('Failed to update notification preference', { field }, err)
      toast.error('Failed to update notifications')
    }
  }

  // Split items by notification state for summary
  const activeCount = items.filter((i) => i.notificationsEnabled).length
  const pausedCount = items.filter((i) => !i.notificationsEnabled).length

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-muted-foreground mt-1">Loading...</p>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-destructive">{error}</p>
            <Button onClick={refetch} className="mx-auto mt-4 block">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Subheading — ADR-023 D2: no page h1, sidebar provides context */}
      <p className="text-muted-foreground">
        Price drop and back-in-stock notifications for your saved items.
      </p>

      {/* Summary badges */}
      {items.length > 0 && (
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="gap-1.5 py-1 px-2.5">
            <BellRing className="h-3.5 w-3.5 text-green-600" />
            {activeCount} active
          </Badge>
          {pausedCount > 0 && (
            <Badge variant="outline" className="gap-1.5 py-1 px-2.5">
              <BellOff className="h-3.5 w-3.5 text-muted-foreground" />
              {pausedCount} paused
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? 'item' : 'items'} total
          </span>
        </div>
      )}

      {/* Items list */}
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No alerts yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
              Save products from search results to automatically track price drops
              and back-in-stock notifications.
            </p>
            <Button asChild>
              <a href="/search">
                <Search className="h-4 w-4 mr-2" />
                Search Products
              </a>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <AlertItemRow
              key={item.id}
              item={item}
              onUpdatePref={(field, value) => handleUpdatePref(item, field, value)}
            />
          ))}
        </div>
      )}

      {/* Footer note */}
      {items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Alerts fire when your configured thresholds are met or items come back in stock.
          Manage your saved items on the{' '}
          <a href="/dashboard/saved" className="underline hover:text-foreground">
            Watchlist
          </a>{' '}
          page.
        </p>
      )}
    </div>
  )
}

interface AlertItemRowProps {
  item: SavedItem
  onUpdatePref: (
    field: 'notificationsEnabled' | 'priceDropEnabled' | 'backInStockEnabled',
    value: boolean
  ) => void
}

function AlertItemRow({ item, onUpdatePref }: AlertItemRowProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          {/* Product image */}
          <div className="w-12 h-12 relative flex-shrink-0 rounded overflow-hidden bg-muted">
            <ProductImage
              imageUrl={item.imageUrl}
              caliber={item.caliber}
              brand={item.brand}
              alt={item.name}
              fill
            />
          </div>

          {/* Product info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <p className="font-medium text-sm truncate">{item.name}</p>
              {!item.notificationsEnabled && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  Paused
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {item.price && (
                <span className="font-medium text-foreground">
                  ${item.price.toFixed(2)}
                </span>
              )}
              {item.caliber && <span>{item.caliber}</span>}
              {item.inStock ? (
                <span className="text-green-600">In stock</span>
              ) : (
                <span className="text-red-500">Out of stock</span>
              )}
            </div>
          </div>

          {/* Alert type indicators */}
          <div className="hidden sm:flex items-center gap-2">
            {item.priceDropEnabled && item.notificationsEnabled && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Price drop alerts on">
                <TrendingDown className="h-3.5 w-3.5" />
                Price
              </span>
            )}
            {item.backInStockEnabled && item.notificationsEnabled && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground" title="Back in stock alerts on">
                <PackageCheck className="h-3.5 w-3.5" />
                Stock
              </span>
            )}
          </div>

          {/* Notification controls */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className={item.notificationsEnabled ? 'text-blue-600' : 'text-muted-foreground'}
              >
                {item.notificationsEnabled ? (
                  <Bell className="h-4 w-4" />
                ) : (
                  <BellOff className="h-4 w-4" />
                )}
                <ChevronDown className="h-3 w-3 ml-1" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Notification Settings</h4>

                <div className="flex items-center justify-between">
                  <Label htmlFor={`alert-master-${item.id}`} className="text-sm">
                    All notifications
                  </Label>
                  <Switch
                    id={`alert-master-${item.id}`}
                    checked={item.notificationsEnabled}
                    onCheckedChange={(checked) => onUpdatePref('notificationsEnabled', checked)}
                  />
                </div>

                <div className="border-t pt-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor={`alert-price-${item.id}`}
                      className={`text-sm ${!item.notificationsEnabled ? 'text-muted-foreground' : ''}`}
                    >
                      Price drops
                    </Label>
                    <Switch
                      id={`alert-price-${item.id}`}
                      checked={item.priceDropEnabled}
                      onCheckedChange={(checked) => onUpdatePref('priceDropEnabled', checked)}
                      disabled={!item.notificationsEnabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label
                      htmlFor={`alert-stock-${item.id}`}
                      className={`text-sm ${!item.notificationsEnabled ? 'text-muted-foreground' : ''}`}
                    >
                      Back in stock
                    </Label>
                    <Switch
                      id={`alert-stock-${item.id}`}
                      checked={item.backInStockEnabled}
                      onCheckedChange={(checked) => onUpdatePref('backInStockEnabled', checked)}
                      disabled={!item.notificationsEnabled}
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground pt-1">
                  {item.notificationsEnabled
                    ? 'You\'ll be notified by email when conditions are met.'
                    : 'Turn on to receive email alerts for this item.'}
                </p>
              </div>
            </PopoverContent>
          </Popover>

          {/* View product link */}
          <Button size="sm" variant="outline" asChild title="View product">
            <a href={`/products/${item.productId}`}>
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
