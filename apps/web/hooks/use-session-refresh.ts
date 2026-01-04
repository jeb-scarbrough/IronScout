'use client'

import { useEffect } from 'react'
import { useSession, signOut } from 'next-auth/react'
import { createLogger } from '@/lib/logger'

const logger = createLogger('hooks:session-refresh')

/**
 * Hook that monitors session for refresh token errors
 * and automatically signs out when the refresh token is invalid/expired.
 *
 * Use this in your root layout or app component.
 */
export function useSessionRefresh() {
  const { data: session } = useSession()

  useEffect(() => {
    // Check if session has a refresh token error
    if ((session as any)?.error === 'RefreshTokenError') {
      logger.info('Refresh token expired, signing out')
      signOut({ callbackUrl: '/auth/signin' })
    }
  }, [session])
}
