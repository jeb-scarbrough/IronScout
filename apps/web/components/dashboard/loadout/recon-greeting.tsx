'use client'

import { useMemo } from 'react'
import type { WatchingItemWithPrice } from '@/hooks/use-loadout'

// ============================================================================
// TYPES
// ============================================================================

interface ReconGreetingProps {
  userName: string | undefined
  watchingItems: WatchingItemWithPrice[]
  retailersTracked: number
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ReconGreeting — Contextual one-liner at the top of the Recon dashboard.
 *
 * Shows a time-based greeting with the user's first name and a brief
 * summary of what's happening (items moved, items tracked, market coverage).
 */
export function ReconGreeting({
  userName,
  watchingItems,
  retailersTracked,
}: ReconGreetingProps) {
  const greeting = useGreeting()
  const firstName = extractFirstName(userName)
  const summary = useSummary(watchingItems, retailersTracked)

  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
      <h1 className="text-lg font-semibold text-foreground">
        {greeting}
        {firstName ? `, ${firstName}` : ''}.
      </h1>
      {summary && (
        <p className="text-sm text-muted-foreground">{summary}</p>
      )}
    </div>
  )
}

// ============================================================================
// HOOKS
// ============================================================================

function useGreeting(): string {
  return useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])
}

function useSummary(
  watchingItems: WatchingItemWithPrice[],
  retailersTracked: number
): string | null {
  return useMemo(() => {
    const changedCount = watchingItems.filter((item) => item.status !== null).length
    const watchedCount = watchingItems.length

    if (changedCount > 0) {
      const itemWord = changedCount === 1 ? 'item' : 'items'
      return `${changedCount} ${itemWord} moved since your last visit.`
    }

    if (watchedCount > 0) {
      return `Tracking ${watchedCount} items across ${retailersTracked} retailers.`
    }

    return null
  }, [watchingItems, retailersTracked])
}

// ============================================================================
// HELPERS
// ============================================================================

function extractFirstName(name: string | undefined): string | null {
  if (!name) return null
  const trimmed = name.trim()
  if (!trimmed) return null
  // Take first word, cap at 20 chars for safety
  const first = trimmed.split(/\s+/)[0]
  return first.length > 20 ? first.slice(0, 20) : first
}

export default ReconGreeting
