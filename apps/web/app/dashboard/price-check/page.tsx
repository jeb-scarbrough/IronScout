'use client'

import { useSession } from 'next-auth/react'
import { PriceCheckContent } from '@/components/price-check/price-check-content'
import { DashboardContent } from '@/components/dashboard/dashboard-content'

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
    <DashboardContent>
      <div>
        <h1 className="text-2xl font-bold italic text-white">In-Store Price Check</h1>
        <p className="text-sm text-iron-400 mt-1">
          Scan a barcode or enter details to check if a price is normal
        </p>
      </div>

      <PriceCheckContent accessToken={token} />
    </DashboardContent>
  )
}
