'use client'

import { ViewToggle } from '@/components/results/view-toggle'
import { EnhancedSortSelect } from './sort-select'
import { useViewPreference } from '@/hooks/use-view-preference'

/**
 * SearchControls - Client component for view toggle + sort
 *
 * Combines view mode toggle and sort dropdown in a single row.
 */
export function SearchControls() {
  const [viewMode, setViewMode] = useViewPreference('card')

  return (
    <div className="flex flex-col items-end gap-1">
      <ViewToggle value={viewMode} onChange={setViewMode} />
      <EnhancedSortSelect />
    </div>
  )
}
