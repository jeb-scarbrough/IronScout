'use client'

import { cn } from '@/lib/utils'

interface SparklineProps {
  data: number[] // normalized 0-1 values
  width?: number
  height?: number
  className?: string
}

/**
 * Sparkline - Dashboard v5 Vitality
 *
 * Per v5-patch-001:
 * - Max 60px wide, 16px tall
 * - Muted colors (no red/green)
 * - No axes, no labels
 * - Not interactive
 */
export function Sparkline({
  data,
  width = 56,
  height = 16,
  className,
}: SparklineProps) {
  if (data.length < 2) {
    return <div style={{ width, height }} />
  }

  // Generate SVG path
  const padding = 1
  const effectiveWidth = width - padding * 2
  const effectiveHeight = height - padding * 2

  const points = data.map((value, index) => {
    const x = padding + (index / (data.length - 1)) * effectiveWidth
    // Invert Y because SVG y-axis is top-down
    const y = padding + (1 - value) * effectiveHeight
    return { x, y }
  })

  const pathD = points
    .map((point, index) => {
      const command = index === 0 ? 'M' : 'L'
      return `${command}${point.x.toFixed(1)},${point.y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn('flex-shrink-0', className)}
      role="img"
      aria-label="Price trend"
    >
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-muted-foreground/50"
      />
    </svg>
  )
}

/**
 * Generate sparkline data from price history
 *
 * Normalizes prices to 0-1 range for consistent display.
 */
export function normalizeSparklineData(prices: number[]): number[] {
  if (prices.length === 0) return []
  if (prices.length === 1) return [0.5]

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min

  if (range === 0) {
    // All prices are the same
    return prices.map(() => 0.5)
  }

  return prices.map((price) => (price - min) / range)
}
