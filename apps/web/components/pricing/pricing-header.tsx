'use client'

export function PricingHeader() {
  return (
    <div className="text-center mb-12">
      <h1 className="text-4xl md:text-5xl font-bold mb-4">
        Pricing
      </h1>

      <p className="text-xl font-medium text-foreground mb-4">
        Pricing is not available during v1.
      </p>

      <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
        This page will be updated when pricing is introduced in a future release.
      </p>
    </div>
  )
}
