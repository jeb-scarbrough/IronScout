'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSession, signOut } from 'next-auth/react'
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  updateWatchlistItem,
  AuthError,
} from '@/lib/api'
import type { WatchlistResponse, UseWatchlistResult } from '@/types/dashboard'
import { createLogger } from '@/lib/logger'

const logger = createLogger('hooks:watchlist')

// Max retry attempts for auth errors
const MAX_AUTH_RETRIES = 1

/**
 * Hook for managing watchlist
 * Free: 5 items max, no collections
 * Premium: Unlimited items, collections
 */
export function useWatchlist(): UseWatchlistResult {
  const { data: session, update } = useSession()
  const [data, setData] = useState<WatchlistResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const authRetryCount = useRef(0)

  const fetchWatchlist = useCallback(async () => {
    const token = (session as any)?.accessToken
    if (!token) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const response = await getWatchlist(token)
      setData(response)
      authRetryCount.current = 0 // Reset on success
    } catch (err) {
      // Handle expired/invalid session - attempt refresh first
      if (err instanceof AuthError) {
        if (authRetryCount.current < MAX_AUTH_RETRIES) {
          authRetryCount.current++
          logger.info('Token rejected, attempting session refresh', {
            attempt: authRetryCount.current,
          })

          const updatedSession = await update()
          if (updatedSession && !(updatedSession as any).error) {
            logger.info('Session refreshed, retrying fetch')
            return // Retry will happen via useEffect when token changes
          }
        }

        logger.info('Session refresh failed, signing out')
        signOut({ callbackUrl: '/auth/signin' })
        return
      }
      logger.error('Failed to fetch watchlist', {}, err)
      setError(err instanceof Error ? err.message : 'Failed to load watchlist')
    } finally {
      setLoading(false)
    }
  }, [(session as any)?.accessToken, update])

  useEffect(() => {
    if (session?.user?.id) {
      fetchWatchlist()
    }
  }, [session?.user?.id, fetchWatchlist])

  const addItem = useCallback(
    async (productId: string, targetPrice?: number) => {
      const token = (session as any)?.accessToken
      if (!token) {
        throw new Error('Not authenticated')
      }

      try {
        setError(null)
        await addToWatchlist(token, productId, targetPrice)
        // Refetch to get updated list
        await fetchWatchlist()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to add item'
        setError(message)
        throw err
      }
    },
    [(session as any)?.accessToken, fetchWatchlist]
  )

  const removeItem = useCallback(
    async (id: string) => {
      const token = (session as any)?.accessToken
      if (!token) {
        throw new Error('Not authenticated')
      }

      try {
        setError(null)
        await removeFromWatchlist(id, token)
        // Optimistically update local state
        setData((prev) =>
          prev
            ? {
                ...prev,
                items: prev.items.filter((item) => item.id !== id),
                _meta: {
                  ...prev._meta,
                  itemCount: prev._meta.itemCount - 1,
                  canAddMore: true,
                },
              }
            : null
        )
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to remove item'
        setError(message)
        throw err
      }
    },
    [(session as any)?.accessToken]
  )

  const updateItem = useCallback(
    async (id: string, updates: { targetPrice?: number | null }) => {
      const token = (session as any)?.accessToken
      if (!token) {
        throw new Error('Not authenticated')
      }

      try {
        setError(null)
        await updateWatchlistItem(id, updates, token)
        // Refetch to get updated item
        await fetchWatchlist()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to update item'
        setError(message)
        throw err
      }
    },
    [(session as any)?.accessToken, fetchWatchlist]
  )

  return {
    data,
    loading,
    error,
    refetch: fetchWatchlist,
    addItem,
    removeItem,
    updateItem,
  }
}
