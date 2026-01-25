'use client'

import { cn } from '@/lib/utils'

interface MonitoringSummaryProps {
  itemCount: number
  retailerCount: number
  lastUpdated: Date | string
  className?: string
}

/**
 * MonitoringSummary - Dashboard v5 Vitality
 *
 * Per v5-patch-001 Section 8:
 * - Single line in header region
 * - Muted text styling
 * - Always visible (not a section)
 * - No action pressure
 */
export function MonitoringSummary({
  itemCount,
  retailerCount,
  lastUpdated,
  className,
}: MonitoringSummaryProps) {
  const relativeTime = formatRelativeTime(lastUpdated)

  return (
    <p className={cn('text-sm text-muted-foreground', className)}>
      Monitoring {itemCount} {itemCount === 1 ? 'item' : 'items'} across{' '}
      {retailerCount} {retailerCount === 1 ? 'retailer' : 'retailers'} ·{' '}
      {relativeTime}
    </p>
  )
}

/**
 * Format timestamp to relative time
 *
 * Per spec:
 * - < 1 hour: "Updated just now"
 * - 1-23 hours: "Updated {n}h ago"
 * - 1-6 days: "Updated {n}d ago"
 * - > 7 days: "Updated {date}"
 */
function formatRelativeTime(timestamp: Date | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 1) {
    return 'Updated just now'
  }

  if (diffHours < 24) {
    return `Updated ${diffHours}h ago`
  }

  if (diffDays < 7) {
    return `Updated ${diffDays}d ago`
  }

  return `Updated ${date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })}`
}
