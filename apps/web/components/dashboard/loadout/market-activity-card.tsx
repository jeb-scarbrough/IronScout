'use client'

import { Activity, RefreshCw, Store, Package } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { MarketActivityStats } from '@/hooks/use-loadout'

// ============================================================================
// TYPES
// ============================================================================

interface MarketActivityCardProps {
  stats: MarketActivityStats
  onCaliberClick?: (caliber: string) => void
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * MarketActivityCard - Shows market activity stats and caliber chips
 *
 * Per My Loadout mockup:
 * - Retailers tracked count
 * - Items in stock count
 * - Last updated timestamp
 * - Top caliber chips (clickable to search)
 */
export function MarketActivityCard({
  stats,
  onCaliberClick,
}: MarketActivityCardProps) {
  const lastUpdated = new Date(stats.lastUpdated)
  const timeAgo = formatTimeAgo(lastUpdated)

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Activity className="h-4 w-4" />
          Market Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatBox
            icon={<Store className="h-4 w-4" />}
            label="Retailers"
            value={stats.retailersTracked.toLocaleString()}
          />
          <StatBox
            icon={<Package className="h-4 w-4" />}
            label="In Stock"
            value={stats.itemsInStock.toLocaleString()}
          />
        </div>

        {/* Last updated */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Updated {timeAgo}</span>
        </div>

        {/* Caliber chips */}
        {stats.topCalibers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Top Calibers
            </p>
            <div className="flex flex-wrap gap-1.5">
              {stats.topCalibers.map((c) => (
                <CaliberChip
                  key={c.caliber}
                  caliber={c.caliber}
                  count={c.count}
                  onClick={onCaliberClick}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// STAT BOX
// ============================================================================

interface StatBoxProps {
  icon: React.ReactNode
  label: string
  value: string
}

function StatBox({ icon, label, value }: StatBoxProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className="text-muted-foreground">{icon}</div>
      <div>
        <p className="text-lg font-semibold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

// ============================================================================
// CALIBER CHIP
// ============================================================================

interface CaliberChipProps {
  caliber: string
  count: number
  onClick?: (caliber: string) => void
}

function CaliberChip({ caliber, count, onClick }: CaliberChipProps) {
  if (onClick) {
    return (
      <button
        onClick={() => onClick(caliber)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted hover:bg-muted/80 transition-colors"
      >
        <span>{caliber}</span>
        <span className="text-muted-foreground">({count})</span>
      </button>
    )
  }

  return (
    <Badge variant="outline" className="text-xs">
      {caliber}
      <span className="ml-1 text-muted-foreground">({count})</span>
    </Badge>
  )
}

// ============================================================================
// HELPERS
// ============================================================================

function formatTimeAgo(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) {
    return 'just now'
  }
  if (diffMins < 60) {
    return `${diffMins}m ago`
  }
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }
  return `${diffDays}d ago`
}

export default MarketActivityCard
