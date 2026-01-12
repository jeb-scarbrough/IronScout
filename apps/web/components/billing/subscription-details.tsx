import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function SubscriptionDetails() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan Details</CardTitle>
        <CardDescription>
          Subscription details are not available during v1.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          This area will show plan details in a future release.
        </div>
      </CardContent>
    </Card>
  )
}
