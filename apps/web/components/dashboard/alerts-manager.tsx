'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Bell,
  BellOff,
  BellRing,
  Search,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useSavedItems } from '@/hooks/use-saved-items'
import { toast } from 'sonner'
import type { SavedItem } from '@/lib/api'
import { safeLogger } from '@/lib/safe-logger'

/**
 * Alerts Manager — notification controls for saved items + status grouping.
 *
 * Per ADR-011: "Saving is the only user action; alerts are an implicit side effect."
 * This page surfaces the notification dimension of saved items:
 * - Which items have notifications enabled/paused
 * - Quick toggles for price drop and back-in-stock alerts
 * - Status indicators for monitoring state
 *
 * This is NOT a separate data source — it's the same saved items
 * viewed through an alerts-only lens (configuration + history).
 */
export function AlertsManager() {
  const { items, loading, error, updatePrefs, refetch } = useSavedItems()

  const handleUpdatePref = async (
    item: SavedItem,
    field: 'notificationsEnabled' | 'priceDropEnabled' | 'backInStockEnabled',
    value: boolean
  ) => {
    try {
      const result = await updatePrefs(item.productId, { [field]: value })
      if (!result) return // Auth failed — toast already shown by hook
      if (field === 'notificationsEnabled') {
        toast.success(value ? 'Notifications resumed' : 'Notifications paused')
      }
    } catch (err) {
      safeLogger.dashboard.error('Failed to update notification preference', { field }, err)
      toast.error('Failed to update notifications')
    }
  }

  // Split items by notification state for summary and sections
  const activeItems = items.filter((i) => i.notificationsEnabled)
  const pausedItems = items.filter((i) => !i.notificationsEnabled)
  const activeCount = activeItems.length
  const pausedCount = pausedItems.length

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
        Control alerts for saved items.
      </p>
      <p className="text-xs text-muted-foreground">
        Why am I seeing this? Alerts come from your saved items.
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
        <div className="space-y-6">
          <AlertSection
            title="Alerts On"
            description="Enabled."
            items={activeItems}
            onUpdatePref={handleUpdatePref}
            emptyMessage="No alerts on yet."
          />
          <AlertSection
            title="Alerts Paused"
            description="Paused."
            items={pausedItems}
            onUpdatePref={handleUpdatePref}
            emptyMessage="No paused alerts."
          />
        </div>
      )}

      {/* Footer note */}
      {items.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Alerts fire on price drops or back-in-stock.
          Manage your saved items on the{' '}
          <a href="/dashboard/saved" className="underline hover:text-foreground">
            Watchlist
          </a>
          .
        </p>
      )}
    </div>
  )
}

interface AlertSectionProps {
  title: string
  description: string
  items: SavedItem[]
  onUpdatePref: (
    item: SavedItem,
    field: 'notificationsEnabled' | 'priceDropEnabled' | 'backInStockEnabled',
    value: boolean
  ) => void
  emptyMessage: string
}

function AlertSection({
  title,
  description,
  items,
  onUpdatePref,
  emptyMessage,
}: AlertSectionProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {items.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <AlertItemRow
              key={item.id}
              item={item}
              onUpdatePref={(field, value) => onUpdatePref(item, field, value)}
            />
          ))}
        </div>
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
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium text-sm truncate">{item.name}</p>
              {!item.notificationsEnabled && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  Paused
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              {item.brand && <span>{item.brand}</span>}
              {item.brand && item.caliber && <span> • </span>}
              {item.caliber && <span>{item.caliber}</span>}
            </div>
          </div>

          <div className="min-w-[220px] space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor={`alert-master-${item.id}`} className="text-xs">
                All notifications
              </Label>
              <Switch
                id={`alert-master-${item.id}`}
                checked={item.notificationsEnabled}
                onCheckedChange={(checked) => onUpdatePref('notificationsEnabled', checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label
                htmlFor={`alert-price-${item.id}`}
                className={`text-xs ${!item.notificationsEnabled ? 'text-muted-foreground' : ''}`}
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
            <div className="flex items-center justify-between gap-3">
              <Label
                htmlFor={`alert-stock-${item.id}`}
                className={`text-xs ${!item.notificationsEnabled ? 'text-muted-foreground' : ''}`}
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
        </div>
      </CardContent>
    </Card>
  )
}
