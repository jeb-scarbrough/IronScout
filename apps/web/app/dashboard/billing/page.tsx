import { Metadata } from 'next'
import Link from 'next/link'
import { DashboardContent } from '@/components/dashboard/dashboard-content'

export const metadata: Metadata = {
  title: 'Billing',
}

/**
 * V1: Billing page is not available.
 * Shows a static message instead of subscription management.
 */
export default function BillingPage() {
  return (
    <DashboardContent>
      <div>
        <h1 className="text-2xl font-bold italic text-white">Billing</h1>
        <p className="text-sm text-iron-400 mt-1">
          Manage your subscription and payment methods
        </p>
      </div>

      <div className="max-w-md">
        <p className="text-muted-foreground mb-6">
          Billing and subscription management is not currently available.
          All features are free during our launch period.
        </p>
        <Link
          href="/dashboard"
          className="text-primary hover:underline"
        >
          Return to dashboard
        </Link>
      </div>
    </DashboardContent>
  )
}
