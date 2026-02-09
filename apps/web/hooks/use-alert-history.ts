'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import {
  getAlertHistory,
  AuthError,
  type AlertHistoryEntry,
  type AlertHistoryResponse,
} from '@/lib/api'
import { safeLogger } from '@/lib/safe-logger'
import { refreshSessionToken, showSessionExpiredToast } from './use-session-refresh'

/**
 * Result type for useAlertHistory hook
 */
export interface UseAlertHistoryResult {
  /** Alert history entries loaded so far */
  entries: AlertHistoryEntry[]
  /** Whether the initial fetch is in progress */
  loading: boolean
  /** Whether a "load more" fetch is in progress */
  loadingMore: boolean
  /** Error message if any operation failed */
  error: string | null
  /** Whether more entries are available */
  hasMore: boolean
  /** Load the next page of entries */
  loadMore: () => Promise<void>
  /** Refetch from the beginning */
  refetch: () => Promise<void>
}

/**
 * Hook for fetching alert notification history with cursor-based pagination.
 *
 * Per alert-history-v1 spec §7:
 * - Cursor is opaque base64, not parsed by client
 * - Appends pages for infinite scroll / "Load more" pattern
 */
export function useAlertHistory(pageSize: number = 20): UseAlertHistoryResult {
  const { data: session } = useSession()
  const [entries, setEntries] = useState<AlertHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const nextCursorRef = useRef<string | null>(null)

  const fetchPage = useCallback(
    async (cursor?: string) => {
      const token = session?.accessToken
      if (!token) return

      try {
        const result: AlertHistoryResponse = await getAlertHistory(token, pageSize, cursor)
        if (cursor) {
          // Appending to existing entries
          setEntries(prev => [...prev, ...result.history])
        } else {
          // Fresh fetch
          setEntries(result.history)
        }
        setHasMore(result._meta.hasMore)
        nextCursorRef.current = result._meta.nextCursor
        setError(null)
      } catch (err) {
        if (err instanceof AuthError) {
          try {
            const newToken = await refreshSessionToken()
            if (newToken) {
              const result = await getAlertHistory(newToken, pageSize, cursor)
              if (cursor) {
                setEntries(prev => [...prev, ...result.history])
              } else {
                setEntries(result.history)
              }
              setHasMore(result._meta.hasMore)
              nextCursorRef.current = result._meta.nextCursor
              setError(null)
              return
            }
          } catch {
            // Token refresh failed
          }
          showSessionExpiredToast()
          setError('Session expired')
          return
        }

        safeLogger.dashboard.error('Failed to fetch alert history', {}, err)
        setError('Failed to load alert history')
      }
    },
    [session?.accessToken, pageSize]
  )

  // Initial fetch
  useEffect(() => {
    if (!session?.accessToken) {
      setLoading(false)
      return
    }

    setLoading(true)
    nextCursorRef.current = null
    fetchPage().finally(() => setLoading(false))
  }, [session?.accessToken, fetchPage])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !nextCursorRef.current) return
    setLoadingMore(true)
    await fetchPage(nextCursorRef.current)
    setLoadingMore(false)
  }, [loadingMore, hasMore, fetchPage])

  const refetch = useCallback(async () => {
    setLoading(true)
    nextCursorRef.current = null
    setEntries([])
    await fetchPage()
    setLoading(false)
  }, [fetchPage])

  return {
    entries,
    loading,
    loadingMore,
    error,
    hasMore,
    loadMore,
    refetch,
  }
}
