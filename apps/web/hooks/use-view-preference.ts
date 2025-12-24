'use client'

import { useState, useEffect, useCallback } from 'react'
import type { ViewMode } from '@/components/results/view-toggle'

const STORAGE_KEY = 'ironscout:view-preference'

/**
 * Hook to persist view preference in localStorage
 */
export function useViewPreference(defaultValue: ViewMode = 'card'): [ViewMode, (mode: ViewMode) => void] {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultValue)
  const [isHydrated, setIsHydrated] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'card' || stored === 'grid') {
      setViewMode(stored)
    }
    setIsHydrated(true)
  }, [])

  // Persist to localStorage on change
  const setAndPersist = useCallback((mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem(STORAGE_KEY, mode)
  }, [])

  // Return default during SSR to avoid hydration mismatch
  return [isHydrated ? viewMode : defaultValue, setAndPersist]
}
