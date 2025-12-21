'use client'

import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { PriceContext, ContextChipProps } from '@/types/dashboard'

/**
 * Price context configuration (ADR-006 compliant)
 *
 * Labels are purely descriptive - no recommendations or verdicts.
 * Colors indicate relative position only, not advice.
 */
const CONTEXT_CONFIG: Record<
  PriceContext,
  { label: string; className: string; tooltip: string }
> = {
  LOWER_THAN_RECENT: {
    label: 'BELOW RECENT',
    className: 'bg-status-buy text-white',
    tooltip: 'Current price is below the recent 30-day average',
  },
  WITHIN_RECENT_RANGE: {
    label: 'TYPICAL',
    className: 'bg-status-stable text-white',
    tooltip: 'Current price is within the typical recent range',
  },
  HIGHER_THAN_RECENT: {
    label: 'ABOVE RECENT',
    className: 'bg-status-wait text-white',
    tooltip: 'Current price is above the recent 30-day average',
  },
  INSUFFICIENT_DATA: {
    label: 'LIMITED DATA',
    className: 'bg-muted text-muted-foreground',
    tooltip: 'Not enough recent price data for comparison',
  },
}

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
  lg: 'text-sm px-3 py-1.5',
}

/**
 * ContextChip - Price context indicator (ADR-006 compliant)
 *
 * Displays descriptive price context as a colored chip with optional tooltip.
 * This is purely informational - no recommendations or verdicts.
 *
 * Color-coded for quick visual reference:
 * - Green: Below recent average
 * - Gray: Within typical range
 * - Amber: Above recent average
 * - Muted: Insufficient data
 */
export function ContextChip({
  context,
  showTooltip = true,
  size = 'md',
}: ContextChipProps) {
  const config = CONTEXT_CONFIG[context]

  const chip = (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded tracking-wide uppercase',
        'transition-all duration-200 animate-in fade-in',
        SIZE_CLASSES[size],
        config.className
      )}
      role="status"
      aria-label={`Price context: ${config.label}`}
    >
      {config.label}
    </span>
  )

  if (!showTooltip) {
    return chip
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{chip}</TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-xs text-xs"
        >
          {config.tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
