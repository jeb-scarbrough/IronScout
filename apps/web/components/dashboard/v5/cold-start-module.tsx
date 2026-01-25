'use client'

import Link from 'next/link'
import { ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ColdStartModuleProps {
  className?: string
}

/**
 * ColdStartModule - Dashboard v5
 *
 * Shown when user has no watchlist items and no saved calibers.
 * Calm, instructive, not overwhelming.
 *
 * Per spec:
 * - No empty sections rendered
 * - Single onboarding module
 * - Primary CTA: Search ammo
 * - Secondary CTA: How tracking works
 */
export function ColdStartModule({ className }: ColdStartModuleProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 max-w-md mx-auto text-center',
        className
      )}
    >
      {/* Icon */}
      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-6">
        <ClipboardList className="w-6 h-6 text-muted-foreground" />
      </div>

      {/* Headline */}
      <h2 className="text-xl font-semibold">
        You haven't started tracking yet.
      </h2>

      {/* Body */}
      <p className="text-base text-muted-foreground mt-3 max-w-sm">
        Search ammo and save items to monitor price and availability over time.
      </p>

      {/* CTAs */}
      <div className="flex items-center gap-3 mt-6">
        <Button asChild>
          <Link href="/search">
            Search ammo
          </Link>
        </Button>

        <Button variant="outline" asChild>
          <Link href="/help/tracking">
            How tracking works
          </Link>
        </Button>
      </div>
    </div>
  )
}
