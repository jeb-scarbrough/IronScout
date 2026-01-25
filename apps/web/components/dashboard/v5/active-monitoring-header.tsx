'use client'

import { cn } from '@/lib/utils'

type ScanVariant = 'time' | 'count' | 'retailers'

interface ActiveMonitoringHeaderProps {
  title?: string
  isActivelyMonitoring: boolean
  lastScanAt: Date | string
  scansToday?: number
  retailersChecked?: number
  variant?: ScanVariant
  className?: string
}

/**
 * ActiveMonitoringHeader - Ambient Vitality Component
 *
 * Per dashboard-v5-ambient-vitality.md:
 * - Communicates ongoing activity, not static state
 * - Pulse dot indicates active monitoring
 * - Dynamic scan recency or activity count
 * - Makes users feel system is working for them
 *
 * Variants:
 * - time: "Last scan 12 min ago"
 * - count: "3 scans completed today"
 * - retailers: "Checked 47 retailers today"
 */
export function ActiveMonitoringHeader({
  title = 'Your Watchlist',
  isActivelyMonitoring,
  lastScanAt,
  scansToday,
  retailersChecked,
  variant = 'time',
  className,
}: ActiveMonitoringHeaderProps) {
  const activityText = getActivityText(
    variant,
    lastScanAt,
    scansToday,
    retailersChecked
  )

  return (
    <header className={className}>
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      <div className="flex items-center gap-2 mt-1">
        {/* Pulse dot */}
        {isActivelyMonitoring && (
          <span
            className={cn(
              'inline-block w-2 h-2 rounded-full',
              'bg-emerald-500/60'
            )}
            aria-hidden="true"
          />
        )}

        {/* Activity text */}
        <p className="text-sm text-muted-foreground">
          {isActivelyMonitoring ? 'Actively monitoring' : 'Monitoring paused'}
          {activityText && (
            <>
              <span className="mx-1">·</span>
              {activityText}
            </>
          )}
        </p>
      </div>
    </header>
  )
}

/**
 * Get activity text based on variant
 */
function getActivityText(
  variant: ScanVariant,
  lastScanAt: Date | string,
  scansToday?: number,
  retailersChecked?: number
): string {
  switch (variant) {
    case 'time':
      return `Last scan ${formatRelativeTime(lastScanAt)}`

    case 'count':
      if (scansToday !== undefined && scansToday > 0) {
        return `${scansToday} ${scansToday === 1 ? 'scan' : 'scans'} completed today`
      }
      return `Last scan ${formatRelativeTime(lastScanAt)}`

    case 'retailers':
      if (retailersChecked !== undefined && retailersChecked > 0) {
        return `Checked ${retailersChecked} retailers today`
      }
      return `Last scan ${formatRelativeTime(lastScanAt)}`

    default:
      return ''
  }
}

/**
 * Format timestamp to relative time
 *
 * Per spec:
 * - < 1 min: "just now"
 * - 1-59 min: "X min ago"
 * - 1-23 hours: "X hr ago"
 * - 1+ days: "X days ago"
 */
function formatRelativeTime(timestamp: Date | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMin < 1) {
    return 'just now'
  }

  if (diffMin < 60) {
    return `${diffMin} min ago`
  }

  if (diffHours < 24) {
    return `${diffHours} hr ago`
  }

  return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
}

/**
 * Select which variant to show
 *
 * Rotates based on day of week to provide variety
 */
export function selectMonitoringVariant(date: Date = new Date()): ScanVariant {
  const day = date.getDay()
  const variants: ScanVariant[] = ['time', 'count', 'retailers']
  return variants[day % variants.length]
}
