import { BillingOverview } from '@/components/billing/billing-overview'
import { SubscriptionDetails } from '@/components/billing/subscription-details'
import { PaymentHistory } from '@/components/billing/payment-history'

export default function BillingPage() {
  return (
    <div className="p-6 lg:p-8">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">Billing</h1>
        <p className="text-muted-foreground mt-1">
          Manage your subscription and view payment history
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <BillingOverview />
          <PaymentHistory />
        </div>
        <div className="space-y-6">
          <SubscriptionDetails />
        </div>
      </div>
    </div>
  )
}
