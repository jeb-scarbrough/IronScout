import { RetailerHero } from '@/components/retailers/retailer-hero'
import { RetailerBenefits } from '@/components/retailers/retailer-benefits'
import { RetailerPlans } from '@/components/retailers/retailer-plans'
import { RetailerCTA } from '@/components/retailers/retailer-cta'

export default function RetailersPage() {
  return (
    <div className="flex flex-col">
      <RetailerHero />
      <RetailerBenefits />
      <RetailerPlans />
      <RetailerCTA />
    </div>
  )
}
