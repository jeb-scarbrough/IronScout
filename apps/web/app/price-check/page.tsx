'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { MarketingHeader } from '@ironscout/ui/components/marketing-header'
import { BRAND } from '@/lib/brand'
import { PriceCheckContent } from '@/components/price-check/price-check-content'

/**
 * Public Price Check Page
 *
 * This is the public version accessible from www marketing site.
 * Uses MarketingHeader (no sidebar) and works for both anonymous and logged-in users.
 *
 * For logged-in users within the app, see /dashboard/price-check which has sidebar nav.
 */

// Force dark theme for price-check to match www marketing site
function useForceDarkTheme() {
  const { setTheme } = useTheme()

  useEffect(() => {
    setTheme('dark')
  }, [setTheme])
}

export default function PriceCheckPage() {
  // Force dark theme to match www app styling
  useForceDarkTheme()

  const { data: session } = useSession()

  // Extract token from session (price check works without auth, just with less detail)
  const token = session?.accessToken

  return (
    <div className="min-h-screen bg-iron-950">
      <MarketingHeader
        currentPage="price-check"
        websiteUrl={BRAND.website}
        appUrl={BRAND.appUrl}
      />

      <main className="container mx-auto px-4 py-6 pt-24">
        <PriceCheckContent accessToken={token} />
      </main>
    </div>
  )
}
