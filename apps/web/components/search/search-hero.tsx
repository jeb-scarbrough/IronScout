'use client'

import { UnifiedSearch } from './unified-search'

interface SearchHeroProps {
  initialQuery?: string
  compact?: boolean
}

export function SearchHero({ initialQuery = '', compact = false }: SearchHeroProps) {
  // Compact mode - just the search bar for when results are showing
  if (compact) {
    return (
      <section className="bg-background border-b border-border py-4">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <UnifiedSearch initialQuery={initialQuery} />
        </div>
      </section>
    )
  }

  // Full hero mode - search box with title
  return (
    <section className="relative pt-8 sm:pt-12 pb-8">
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          {/* Subtitle */}
          <p className="text-center text-lg text-muted-foreground font-display mb-6">
            Range day or carry day. We search differently.
          </p>

          {/* Search Box */}
          <UnifiedSearch initialQuery={initialQuery} />
        </div>
      </div>
    </section>
  )
}
