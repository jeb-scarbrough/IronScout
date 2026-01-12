'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function PricingPlans() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pricing</CardTitle>
        <CardDescription>
          Pricing details are not available during v1.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          This area will be used for pricing information in a future release.
        </div>
      </CardContent>
    </Card>
  )
}
