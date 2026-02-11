'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Circle, X, Package, Bookmark, Bell } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================================
// TYPES
// ============================================================================

interface GetStartedChecklistProps {
  hasFirearm: boolean
  hasWatchedItem: boolean
  hasAlerts: boolean
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * GetStartedChecklist — Compact onboarding progress bar
 *
 * Shows a horizontal checklist of setup steps. Self-dismisses when 2/3
 * steps are complete, or when the user manually closes it.
 *
 * Steps:
 * 1. Add your first firearm
 * 2. Save a product
 * 3. Enable alerts
 */
export function GetStartedChecklist({
  hasFirearm,
  hasWatchedItem,
  hasAlerts,
}: GetStartedChecklistProps) {
  const [dismissed, setDismissed] = useState(false)

  // Check localStorage for permanent dismissal
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ironscout:checklist-dismissed')
      if (stored === 'true') setDismissed(true)
    }
  }, [])

  const completedCount = [hasFirearm, hasWatchedItem, hasAlerts].filter(Boolean).length

  // Auto-hide when 2/3 complete
  if (completedCount >= 2 || dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    if (typeof window !== 'undefined') {
      localStorage.setItem('ironscout:checklist-dismissed', 'true')
    }
  }

  const steps = [
    {
      label: 'Add your first firearm',
      done: hasFirearm,
      href: '/dashboard/gun-locker',
      icon: Package,
    },
    {
      label: 'Save a product',
      done: hasWatchedItem,
      href: '/search',
      icon: Bookmark,
    },
    {
      label: 'Enable alerts',
      done: hasAlerts,
      href: '/dashboard/alerts',
      icon: Bell,
    },
  ]

  return (
    <div className="relative rounded-lg border border-border bg-card/50 px-4 py-3">
      {/* Dismiss button */}
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Dismiss getting started checklist"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Header */}
      <p className="text-sm font-medium text-foreground mb-2">
        Get started
        <span className="ml-2 text-xs text-muted-foreground font-normal">
          {completedCount}/3
        </span>
      </p>

      {/* Steps — horizontal on desktop, vertical on mobile */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
        {steps.map((step) => (
          <a
            key={step.label}
            href={step.done ? undefined : step.href}
            className={cn(
              'flex items-center gap-2 text-sm transition-colors group',
              step.done
                ? 'text-muted-foreground'
                : 'text-foreground hover:text-primary cursor-pointer'
            )}
          >
            {step.done ? (
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
            )}
            <span className={cn(step.done && 'line-through')}>{step.label}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

export default GetStartedChecklist
