'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { getMarketDeals, type MarketDealsResponse } from '@/lib/api'
import { refreshSessionToken } from './use-session-refresh'
import { safeLogger } from '@/lib/safe-logger'

export interface UseMarketDealsResult {
  data: MarketDealsResponse | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Fetches notable market-wide price events.
 * Auth is optional — unauthenticated users get generic deals,
 * authenticated users with Gun Locker calibers get personalized sections.
 */
export function useMarketDeals(): UseMarketDealsResult {
  const { data: session, status } = useSession()
  const token = session?.accessToken
  const [data, setData] = useState<MarketDealsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDeals = useCallback(async () => {
    if (status === 'loading') return

    try {
      setLoading(true)
      setError(null)

      let authToken: string | undefined = token
      if (!authToken && status === 'authenticated') {
        const refreshed = await refreshSessionToken()
        if (refreshed) authToken = refreshed
      }

      const result = await getMarketDeals(authToken)
      setData(result)
    } catch (err) {
      safeLogger.dashboard.error('Failed to fetch market deals', {}, err)
      setError('Failed to load market deals')
    } finally {
      setLoading(false)
    }
  }, [token, status])

  useEffect(() => {
    if (status === 'loading') return
    fetchDeals()
  }, [status, fetchDeals])

  return { data, loading, error, refetch: fetchDeals }
}
