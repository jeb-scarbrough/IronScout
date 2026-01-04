import { redirect } from 'next/navigation'
import { PricingPlans } from '@/components/pricing/pricing-plans'
import { PricingFAQ } from '@/components/pricing/pricing-faq'
import { PricingHeader } from '@/components/pricing/pricing-header'
import { premiumEnabled } from '@/lib/features'

export default function PricingPage() {
  // FEATURE FLAG: Redirect to home when premium is disabled
  if (!premiumEnabled()) {
    redirect('/')
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <PricingHeader />
      <PricingPlans />
      <PricingFAQ />
    </div>
  )
}
