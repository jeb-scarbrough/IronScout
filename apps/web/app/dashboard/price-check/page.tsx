'use client'

import { useSession } from 'next-auth/react'
import { PriceCheckContent } from '@/components/price-check/price-check-content'

/**
 * Dashboard Price Check Page
 *
 * This is the authenticated version with sidebar navigation.
 * Inherits the dashboard layout (sidebar + dark theme).
 *
 * For anonymous users from www, see /price-check which has MarketingHeader.
 */
export default function DashboardPriceCheckPage() {
  const { data: session } = useSession()

  // Extract token from session for authenticated price checks
  const token = session?.accessToken

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Price Check</h1>
        <p className="text-sm text-iron-400 mt-1">
          Scan a barcode or enter details to check if a price is normal
        </p>
      </div>

      <PriceCheckContent accessToken={token} />
    </div>
  )
}
