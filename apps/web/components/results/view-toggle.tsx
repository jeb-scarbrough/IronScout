'use client'

import { LayoutGrid, List } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ViewMode = 'card' | 'grid'

interface ViewToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
}

/**
 * ViewToggle - Switch between Card and Grid views
 *
 * Neutral labels. Not "Advanced" or "Simple".
 * Icon + label, not icon-only.
 */
export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted/30 p-1">
      <button
        onClick={() => onChange('card')}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
          value === 'card'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
        aria-pressed={value === 'card'}
      >
        <LayoutGrid className="h-4 w-4" />
        Card
      </button>
      <button
        onClick={() => onChange('grid')}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
          value === 'grid'
            ? 'bg-background text-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
        aria-pressed={value === 'grid'}
      >
        <List className="h-4 w-4" />
        Grid
      </button>
    </div>
  )
}
