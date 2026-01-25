'use client'

import { cn } from '@/lib/utils'
import { Sparkline } from './sparkline'

export interface CaliberTrend {
  caliber: string
  sparkline: number[] // normalized 0-1
  trend: 'stable' | 'up' | 'down'
  percentChange: number // vs 7-day avg
}

interface MarketPulseStripProps {
  calibers: CaliberTrend[]
  maxVisible?: number
  className?: string
}

/**
 * MarketPulseStrip - Ambient Vitality Component
 *
 * Per dashboard-v5-ambient-vitality.md:
 * - Shows caliber-level trends for tracked calibers
 * - Single-line horizontal strip
 * - Changes daily, rewards return visits
 * - Purely observational, not actionable
 *
 * What this is NOT:
 * - Not rankings
 * - Not recommendations
 * - Not urgency signals
 */
export function MarketPulseStrip({
  calibers,
  maxVisible = 4,
  className,
}: MarketPulseStripProps) {
  if (calibers.length === 0) {
    return null
  }

  const visibleCalibers = calibers.slice(0, maxVisible)

  return (
    <div
      className={cn(
        'h-8 flex items-center gap-6 overflow-x-auto',
        'scrollbar-none', // Hide scrollbar
        className
      )}
    >
      {visibleCalibers.map((cal) => (
        <CaliberTrendItem key={cal.caliber} {...cal} />
      ))}
    </div>
  )
}

/**
 * Individual caliber trend display
 */
function CaliberTrendItem({ caliber, sparkline, trend, percentChange }: CaliberTrend) {
  const trendLabel = getTrendLabel(trend, percentChange)

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      {/* Caliber name */}
      <span className="text-xs font-medium text-foreground">
        {caliber}
      </span>

      {/* Mini sparkline */}
      {sparkline.length > 0 && (
        <Sparkline
          data={sparkline}
          width={40}
          height={12}
          className="opacity-60"
        />
      )}

      {/* Trend label */}
      <span className="text-xs text-muted-foreground">
        {trendLabel}
      </span>
    </div>
  )
}

/**
 * Get trend label text
 *
 * Uses neutral language:
 * - "stable" not "holding"
 * - "+3%" not "rising"
 * - "-2%" not "falling" or "dropping"
 */
function getTrendLabel(trend: 'stable' | 'up' | 'down', percentChange: number): string {
  if (trend === 'stable' || Math.abs(percentChange) < 1) {
    return 'stable'
  }

  const sign = percentChange > 0 ? '+' : ''
  return `${sign}${percentChange.toFixed(0)}%`
}

/**
 * Generate caliber trends from price history data
 */
export function generateCaliberTrends(
  priceHistory: Array<{
    caliber: string
    prices: Array<{ date: string; avgPrice: number }>
  }>
): CaliberTrend[] {
  return priceHistory.map((cal) => {
    const prices = cal.prices.map((p) => p.avgPrice)
    const sparkline = normalizeForSparkline(prices)

    // Calculate 7-day average comparison
    const recent = prices.slice(-7)
    const older = prices.slice(-14, -7)

    if (recent.length === 0 || older.length === 0) {
      return {
        caliber: cal.caliber,
        sparkline,
        trend: 'stable' as const,
        percentChange: 0,
      }
    }

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length
    const percentChange = ((recentAvg - olderAvg) / olderAvg) * 100

    let trend: 'stable' | 'up' | 'down' = 'stable'
    if (percentChange > 2) trend = 'up'
    if (percentChange < -2) trend = 'down'

    return {
      caliber: cal.caliber,
      sparkline,
      trend,
      percentChange,
    }
  })
}

function normalizeForSparkline(values: number[]): number[] {
  if (values.length === 0) return []
  if (values.length === 1) return [0.5]

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min

  if (range === 0) return values.map(() => 0.5)

  return values.map((v) => (v - min) / range)
}
