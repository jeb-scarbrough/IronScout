import { Hero } from '@/components/sections/hero'
import { Features } from '@/components/sections/features'
import { Comparison } from '@/components/sections/comparison'
import { HowItWorks } from '@/components/sections/how-it-works'
import { Testimonials } from '@/components/sections/testimonials'
import { CTA } from '@/components/sections/cta'
import { Disclaimer } from '@/components/sections/disclaimer'

export default function HomePage() {
  return (
    <div className="flex flex-col">
      <Hero />
      <Features />
      <Comparison />
      <HowItWorks />
      <Testimonials />
      <CTA />
      <Disclaimer />
    </div>
  )
}
