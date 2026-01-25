'use client'

import Link from 'next/link'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Sparkline } from './sparkline'

export type WatchlistStatusType = '90d_low' | 'back_in_stock' | null

export interface WatchlistTableItem {
  id: string
  productId: string
  productName: string
  pricePerRound: number | null
  sparklineData?: number[] // normalized 0-1, last 30 days
  change24h: 'up' | 'down' | 'none'
  status: WatchlistStatusType
  isWatched: boolean
}

interface WatchlistTableProps {
  items: WatchlistTableItem[]
  maxVisible?: number
  className?: string
}

/**
 * WatchlistTable - Dashboard v5 (Per v5-patch-001)
 *
 * Primary surface of the dashboard.
 *
 * Constraints:
 * - MUST render as a table, not cards
 * - Row height ≤48px
 * - Status badges only on exceptions
 * - If 3+ items share status, collapse to summary
 * - Silence is default
 */
export function WatchlistTable({
  items,
  maxVisible = 10,
  className,
}: WatchlistTableProps) {
  const visibleItems = items.slice(0, maxVisible)

  // Check if status should be collapsed
  const statusCounts = countStatuses(visibleItems)
  const shouldCollapseStatus = Object.values(statusCounts).some((count) => count >= 3)

  // Get summary for collapsed status
  const statusSummaries = shouldCollapseStatus
    ? Object.entries(statusCounts)
        .filter(([_, count]) => count >= 3)
        .map(([status, count]) => ({ status: status as WatchlistStatusType, count }))
    : []

  return (
    <div className={className}>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="sr-only">
            <tr>
              <th>Product</th>
              <th>Price</th>
              <th>Trend</th>
              <th>24h</th>
              <th>Status</th>
              <th>Watch</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems.map((item) => (
              <WatchlistTableRow
                key={item.id}
                item={item}
                hideStatus={shouldCollapseStatus && item.status !== null}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Status Summary (if collapsed) */}
      {statusSummaries.length > 0 && (
        <div className="mt-3 text-xs text-muted-foreground">
          {statusSummaries.map(({ status, count }) => (
            <span key={status} className="mr-4">
              {count} items {getStatusSummaryText(status)}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Individual table row
 */
function WatchlistTableRow({
  item,
  hideStatus,
}: {
  item: WatchlistTableItem
  hideStatus: boolean
}) {
  const { productId, productName, pricePerRound, sparklineData, change24h, status, isWatched } =
    item

  return (
    <tr className="h-12 border-b border-border/30 hover:bg-muted/30 transition-colors">
      {/* Product name */}
      <td className="py-2 pr-4">
        <Link
          href={`/products/${productId}`}
          className="text-sm font-medium text-foreground hover:underline truncate block max-w-[200px] sm:max-w-[300px]"
          title={productName}
        >
          {truncate(productName, 40)}
        </Link>
      </td>

      {/* Price */}
      <td className="py-2 pr-4 text-right whitespace-nowrap">
        {pricePerRound !== null ? (
          <span className="text-sm font-medium">${pricePerRound.toFixed(2)}/rd</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>

      {/* Sparkline */}
      <td className="py-2 pr-4 hidden sm:table-cell">
        {sparklineData && sparklineData.length > 0 ? (
          <Sparkline data={sparklineData} width={56} height={16} />
        ) : (
          <div className="w-14 h-4" />
        )}
      </td>

      {/* 24h change */}
      <td className="py-2 pr-4 text-center">
        <Change24hIndicator direction={change24h} />
      </td>

      {/* Status */}
      <td className="py-2 pr-4 hidden sm:table-cell">
        {!hideStatus && status && <StatusBadge status={status} />}
      </td>

      {/* Watch toggle */}
      <td className="py-2 text-center">
        <button
          className={cn(
            'p-1 rounded-sm',
            isWatched
              ? 'text-primary'
              : 'text-muted-foreground/30 hover:text-muted-foreground'
          )}
          aria-label={isWatched ? 'Watching' : 'Not watching'}
        >
          <Star className={cn('h-4 w-4', isWatched && 'fill-current')} />
        </button>
      </td>
    </tr>
  )
}

/**
 * 24h change indicator
 *
 * Per spec: directional arrow only, no color coding
 */
function Change24hIndicator({ direction }: { direction: 'up' | 'down' | 'none' }) {
  if (direction === 'none') {
    return <span className="text-muted-foreground/50">—</span>
  }

  return (
    <span className="text-muted-foreground">
      {direction === 'down' ? '↓' : '↑'}
    </span>
  )
}

/**
 * Status badge
 *
 * Per spec:
 * - Only render when exceptional
 * - No color coding (no green/red)
 * - Muted styling
 */
function StatusBadge({ status }: { status: WatchlistStatusType }) {
  if (!status) return null

  return (
    <span className="text-xs px-2 py-0.5 rounded bg-muted text-foreground whitespace-nowrap">
      {getStatusBadgeText(status)}
    </span>
  )
}

function getStatusBadgeText(status: WatchlistStatusType): string {
  switch (status) {
    case '90d_low':
      return '90d low'
    case 'back_in_stock':
      return 'Back in stock'
    default:
      return ''
  }
}

function getStatusSummaryText(status: WatchlistStatusType): string {
  switch (status) {
    case '90d_low':
      return 'at 90-day lows'
    case 'back_in_stock':
      return 'back in stock'
    default:
      return ''
  }
}

function countStatuses(
  items: WatchlistTableItem[]
): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const item of items) {
    if (item.status) {
      counts[item.status] = (counts[item.status] || 0) + 1
    }
  }
  return counts
}

function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 1) + '…'
}
