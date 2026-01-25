'use client'

import Link from 'next/link'
import { cn } from '@/lib/utils'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  viewAllHref?: string
  viewAllLabel?: string
  className?: string
}

/**
 * SectionHeader - Dashboard v5
 *
 * Consistent header for dashboard sections.
 * Title is uppercase, muted. Subtitle is smaller, more muted.
 * Optional "View all" link on the right.
 */
export function SectionHeader({
  title,
  subtitle,
  viewAllHref,
  viewAllLabel = 'View all',
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-baseline justify-between mb-3', className)}>
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h2>
        {subtitle && (
          <p className="text-sm text-muted-foreground/70 mt-0.5">{subtitle}</p>
        )}
      </div>
      {viewAllHref && (
        <Link
          href={viewAllHref}
          className="text-sm text-primary hover:underline"
        >
          {viewAllLabel} &rarr;
        </Link>
      )}
    </div>
  )
}
