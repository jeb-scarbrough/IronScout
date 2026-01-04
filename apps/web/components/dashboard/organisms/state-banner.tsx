'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Search,
  Bell,
  CheckCircle2,
  TrendingDown,
  Zap,
  Plus,
  Settings,
  ChevronRight,
} from 'lucide-react'
import Link from 'next/link'

/**
 * Dashboard state types - matches backend DashboardState
 */
export type DashboardState =
  | 'BRAND_NEW'
  | 'NEW'
  | 'NEEDS_ALERTS'
  | 'HEALTHY'
  | 'RETURNING'
  | 'POWER_USER'

export interface DashboardStateContext {
  state: DashboardState
  watchlistCount: number
  alertsConfigured: number
  alertsMissing: number
  priceDropsThisWeek: number
}

interface StateBannerProps {
  state: DashboardState
  context: DashboardStateContext
}

/**
 * Popular calibers for quick-add chips in NEW state
 * Per plan: hard-coded, covers 80%+ of users
 */
const POPULAR_CALIBERS = [
  { label: '9mm', query: '9mm' },
  { label: '.223/5.56', query: '.223 5.56' },
  { label: '.22 LR', query: '.22 lr' },
  { label: '.45 ACP', query: '.45 acp' },
  { label: '.308 Win', query: '.308' },
]

/**
 * StateBanner - Dashboard v4 contextual banner
 *
 * Renders different banners based on user state per dashboard-product-spec.md.
 * State resolution is server-side; this component receives the resolved state.
 */
export function StateBanner({ state, context }: StateBannerProps) {
  switch (state) {
    case 'BRAND_NEW':
      return <BrandNewBanner />
    case 'NEW':
      return <NewUserBanner watchlistCount={context.watchlistCount} />
    case 'NEEDS_ALERTS':
      return <NeedsAlertsBanner alertsMissing={context.alertsMissing} />
    case 'HEALTHY':
      return <HealthyBanner watchlistCount={context.watchlistCount} />
    case 'RETURNING':
      return <ReturningBanner priceDropsThisWeek={context.priceDropsThisWeek} />
    case 'POWER_USER':
      return (
        <PowerUserBanner
          watchlistCount={context.watchlistCount}
          priceDropsThisWeek={context.priceDropsThisWeek}
        />
      )
    default:
      return null
  }
}

/**
 * BRAND_NEW: 0 watchlist items
 * Goal: First search, first saved item
 */
function BrandNewBanner() {
  return (
    <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
      <CardContent className="py-8 md:py-12">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            Buy now at the best price.
          </h1>
          <p className="text-lg text-muted-foreground mb-6">
            We'll watch what happens next.
          </p>

          <Link href="/dashboard/search">
            <Button size="lg" className="gap-2">
              <Search className="h-5 w-5" />
              Find ammo deals
            </Button>
          </Link>

          {/* Suggested search chips */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {POPULAR_CALIBERS.slice(0, 3).map((caliber) => (
              <Link
                key={caliber.query}
                href={`/dashboard/search?q=${encodeURIComponent(caliber.query)}`}
              >
                <Badge
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 transition-colors"
                >
                  {caliber.label}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * NEW: 1-4 watchlist items
 * Goal: Reach minimum effective watchlist size (5+)
 */
function NewUserBanner({ watchlistCount }: { watchlistCount: number }) {
  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30">
      <CardContent className="py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-5 w-5 text-amber-600" />
              <span className="font-semibold text-amber-800 dark:text-amber-200">
                Your watchlist has {watchlistCount} item{watchlistCount !== 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Most price drops are still invisible. Add more to catch deals.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Recommended: 5–10 items
            </p>
          </div>

          <Link href="/dashboard/search">
            <Button className="gap-2 whitespace-nowrap">
              <Plus className="h-4 w-4" />
              Add ammo to watchlist
            </Button>
          </Link>
        </div>

        {/* Quick-add caliber chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          {POPULAR_CALIBERS.map((caliber) => (
            <Link
              key={caliber.query}
              href={`/dashboard/search?q=${encodeURIComponent(caliber.query)}`}
            >
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors text-xs"
              >
                + {caliber.label}
              </Badge>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * NEEDS_ALERTS: ≥5 items, at least 1 missing active alerts
 * Goal: Alert configuration
 */
function NeedsAlertsBanner({ alertsMissing }: { alertsMissing: number }) {
  return (
    <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
      <CardContent className="py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Bell className="h-5 w-5 text-blue-600" />
              <span className="font-semibold text-blue-800 dark:text-blue-200">
                {alertsMissing} watchlist item{alertsMissing !== 1 ? 's' : ''} don't have
                price drop alerts active
              </span>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Enable notifications to get alerted when prices drop.
            </p>
          </div>

          <div className="flex gap-2">
            <Link href="/dashboard/saved">
              <Button className="gap-2 whitespace-nowrap">
                <Settings className="h-4 w-4" />
                Configure alerts
              </Button>
            </Link>
            <Link href="/dashboard/saved">
              <Button variant="outline" size="icon">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * HEALTHY: ≥5 items, all alerts active
 * Goal: Reassurance
 */
function HealthyBanner({ watchlistCount }: { watchlistCount: number }) {
  return (
    <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30">
      <CardContent className="py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
            <div>
              <span className="font-semibold text-green-800 dark:text-green-200">
                Watchlist ready
              </span>
              <p className="text-sm text-green-700 dark:text-green-300">
                {watchlistCount} items with price drop alerts
              </p>
            </div>
          </div>

          <Link href="/dashboard/search">
            <Button variant="outline" className="gap-2 whitespace-nowrap">
              <Plus className="h-4 w-4" />
              Add more to watchlist
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * RETURNING: Healthy + alerts delivered this week
 * Goal: Reinforce value
 */
function ReturningBanner({ priceDropsThisWeek }: { priceDropsThisWeek: number }) {
  return (
    <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30">
      <CardContent className="py-4 md:py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <TrendingDown className="h-6 w-6 text-green-600" />
            <div>
              <span className="font-semibold text-green-800 dark:text-green-200">
                {priceDropsThisWeek} price drop{priceDropsThisWeek !== 1 ? 's' : ''} caught
                this week
              </span>
              <p className="text-sm text-green-700 dark:text-green-300">
                Your watchlist is working for you
              </p>
            </div>
          </div>

          <Link href="/dashboard/search">
            <Button variant="outline" className="gap-2 whitespace-nowrap">
              <Plus className="h-4 w-4" />
              Add more to watchlist
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * POWER_USER: ≥7 items + alerts this week
 * Goal: Scale advantage, efficiency
 */
function PowerUserBanner({
  watchlistCount,
  priceDropsThisWeek,
}: {
  watchlistCount: number
  priceDropsThisWeek: number
}) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="py-3 md:py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-primary" />
            <span className="font-medium">
              Watchlist: {watchlistCount} items.{' '}
              {priceDropsThisWeek > 0 && (
                <span className="text-green-600">
                  {priceDropsThisWeek} price drop{priceDropsThisWeek !== 1 ? 's' : ''}{' '}
                  caught this week.
                </span>
              )}
            </span>
          </div>

          <div className="flex gap-2">
            <Link href="/dashboard/search">
              <Button variant="outline" size="sm" className="gap-1 text-xs">
                <Plus className="h-3 w-3" />
                Add another caliber
              </Button>
            </Link>
            <Link href="/dashboard/saved">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                Manage
                <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
