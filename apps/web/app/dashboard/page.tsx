'use client'

import { useDashboardV5 } from '@/hooks/use-dashboard-v5'
import { DashboardV5 } from '@/components/dashboard/v5'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

/**
 * Dashboard Page - Dashboard v5
 *
 * Status-oriented monitoring surface per ADR-020 and dashboard-product-spec-v5.md:
 *
 * Sections (in order):
 * 1. Spotlight (optional, single item) - Synthesized signal
 * 2. Your Watchlist (always shown if not cold-start, max 10)
 * 3. Recent Price Movement (conditional, max 5)
 * 4. Back in Stock (conditional, max 5)
 * 5. Matches Your Gun Locker (conditional, max 5)
 *
 * Cold-start: If no watchlist and no gun locker, show onboarding module only.
 *
 * @see ADR-020 Dashboard v5
 * @see dashboard-product-spec-v5.md
 */
export default function DashboardPage() {
  const { data, loading, error } = useDashboardV5()

  if (loading) {
    return (
      <div className="p-4 lg:p-8 max-w-4xl mx-auto">
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading dashboard...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-4 lg:p-8 max-w-4xl mx-auto">
        <Card>
          <CardContent className="py-12">
            <p className="text-center text-destructive">
              {error || 'Failed to load dashboard'}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return <DashboardV5 data={data} />
}
