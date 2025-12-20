'use client'

import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Verdict, VerdictChipProps } from '@/types/dashboard'

const VERDICT_CONFIG: Record<
  Verdict,
  { label: string; className: string; tooltip: string }
> = {
  BUY: {
    label: 'FAVORABLE',
    className: 'bg-status-buy text-white',
    tooltip: 'Price is below recent average relative to last 90 days',
  },
  WAIT: {
    label: 'ELEVATED',
    className: 'bg-status-wait text-white',
    tooltip: 'Price is above recent average',
  },
  STABLE: {
    label: 'TYPICAL',
    className: 'bg-status-stable text-white',
    tooltip: 'Price is consistent with recent averages',
  },
}

const SIZE_CLASSES = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
  lg: 'text-sm px-3 py-1.5',
}

/**
 * VerdictChip - Trading terminal-style price status indicator
 *
 * Displays price context as a colored chip with optional tooltip.
 * Color-coded: Green (FAVORABLE), Amber (ELEVATED), Gray (TYPICAL)
 */
export function VerdictChip({
  verdict,
  showTooltip = true,
  size = 'md',
}: VerdictChipProps) {
  const config = VERDICT_CONFIG[verdict]

  const chip = (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded tracking-wide uppercase',
        'transition-all duration-200 animate-in fade-in',
        SIZE_CLASSES[size],
        config.className
      )}
      role="status"
      aria-label={`Market verdict: ${config.label}`}
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
