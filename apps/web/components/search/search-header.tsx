'use client'

import { useState } from 'react'
import { Sparkles, ChevronDown, ChevronUp, SlidersHorizontal, Crown } from 'lucide-react'
import { ExplicitFilters } from '@/lib/api'
import { EnhancedSortSelect } from './sort-select'

interface SearchIntent {
  calibers?: string[]
  purpose?: string
  grainWeights?: number[]
  caseMaterials?: string[]
  brands?: string[]
  qualityLevel?: string
  confidence: number
  premiumIntent?: {
    explanation?: string
    environment?: string
    barrelLength?: string
    suppressorUse?: boolean
    safetyConstraints?: string[]
    preferredBulletTypes?: string[]
  }
}

interface SearchHeaderProps {
  query: string
  resultCount?: number
  intent?: SearchIntent
  processingTimeMs?: number
  vectorSearchUsed?: boolean
  hasFilters?: boolean
  explicitFilters?: ExplicitFilters
  isPremium?: boolean
  premiumFiltersActive?: number
}

export function SearchHeader({ 
  query, 
  resultCount, 
  intent, 
  processingTimeMs,
  vectorSearchUsed,
  hasFilters,
  explicitFilters,
  isPremium = false,
  premiumFiltersActive = 0
}: SearchHeaderProps) {
  const [showDetails, setShowDetails] = useState(false)
  
  const hasIntent = intent && (
    intent.calibers?.length || 
    intent.purpose || 
    intent.grainWeights?.length ||
    intent.qualityLevel
  )

  // Build list of active explicit filters for display
  const activeFilters: Array<{ label: string; value: string; color: string; isPremium?: boolean }> = []
  if (explicitFilters) {
    // Basic filters
    if (explicitFilters.caliber) {
      activeFilters.push({ label: 'Caliber', value: explicitFilters.caliber, color: 'blue' })
    }
    if (explicitFilters.purpose) {
      activeFilters.push({ label: 'Purpose', value: explicitFilters.purpose, color: 'purple' })
    }
    if (explicitFilters.caseMaterial) {
      activeFilters.push({ label: 'Case', value: explicitFilters.caseMaterial, color: 'yellow' })
    }
    if (explicitFilters.minGrain !== undefined || explicitFilters.maxGrain !== undefined) {
      const grainRange = explicitFilters.minGrain && explicitFilters.maxGrain 
        ? `${explicitFilters.minGrain}-${explicitFilters.maxGrain}gr`
        : explicitFilters.minGrain ? `${explicitFilters.minGrain}+gr` : `≤${explicitFilters.maxGrain}gr`
      activeFilters.push({ label: 'Grain', value: grainRange, color: 'green' })
    }
    if (explicitFilters.minPrice !== undefined || explicitFilters.maxPrice !== undefined) {
      const priceRange = explicitFilters.minPrice !== undefined && explicitFilters.maxPrice !== undefined
        ? `$${explicitFilters.minPrice}-$${explicitFilters.maxPrice}`
        : explicitFilters.minPrice !== undefined ? `$${explicitFilters.minPrice}+` : `≤$${explicitFilters.maxPrice}`
      activeFilters.push({ label: 'Price', value: priceRange, color: 'emerald' })
    }
    if (explicitFilters.inStock) {
      activeFilters.push({ label: 'Stock', value: 'In Stock Only', color: 'teal' })
    }
    if (explicitFilters.brand) {
      activeFilters.push({ label: 'Brand', value: explicitFilters.brand, color: 'indigo' })
    }
    
    // Premium filters
    if (explicitFilters.bulletType) {
      activeFilters.push({ label: 'Bullet', value: explicitFilters.bulletType, color: 'amber', isPremium: true })
    }
    if (explicitFilters.pressureRating) {
      activeFilters.push({ label: 'Pressure', value: explicitFilters.pressureRating.replace('PLUS_P_PLUS', '+P+').replace('PLUS_P', '+P'), color: 'amber', isPremium: true })
    }
    if (explicitFilters.isSubsonic) {
      activeFilters.push({ label: 'Type', value: 'Subsonic', color: 'amber', isPremium: true })
    }
    if (explicitFilters.shortBarrelOptimized) {
      activeFilters.push({ label: 'Opt.', value: 'Short Barrel', color: 'amber', isPremium: true })
    }
    if (explicitFilters.suppressorSafe) {
      activeFilters.push({ label: 'Type', value: 'Suppressor Safe', color: 'amber', isPremium: true })
    }
    if (explicitFilters.lowFlash) {
      activeFilters.push({ label: 'Type', value: 'Low Flash', color: 'amber', isPremium: true })
    }
    if (explicitFilters.lowRecoil) {
      activeFilters.push({ label: 'Type', value: 'Low Recoil', color: 'amber', isPremium: true })
    }
    if (explicitFilters.matchGrade) {
      activeFilters.push({ label: 'Grade', value: 'Match Grade', color: 'amber', isPremium: true })
    }
  }

  const getColorClasses = (color: string, isPremiumFilter?: boolean) => {
    if (isPremiumFilter) {
      return 'bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/50 dark:to-orange-900/50 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-700'
    }
    
    const colorMap: Record<string, string> = {
      blue: 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300',
      purple: 'bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300',
      green: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300',
      yellow: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300',
      orange: 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300',
      emerald: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300',
      teal: 'bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300',
      indigo: 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300',
      amber: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
    }
    return colorMap[color] || colorMap.blue
  }

  return (
    <div className="pb-4">
      {/* Compact Control Bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Left: Result count + AI confirmation chip */}
        <div className="flex items-center gap-3">
          {resultCount !== undefined && (
            <span className="text-sm font-medium text-muted-foreground">
              {resultCount.toLocaleString()} results
            </span>
          )}

          {/* AI Confirmation - subtle text link, not competing with results */}
          {hasIntent && (
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Sparkles className="h-3 w-3 opacity-60" />
              <span className="underline underline-offset-2 decoration-dotted">
                {showDetails ? 'Hide interpretation' : 'View interpretation'}
              </span>
            </button>
          )}

          {/* Active filter count */}
          {activeFilters.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-muted text-muted-foreground">
              <SlidersHorizontal className="h-3 w-3" />
              {activeFilters.length} active
            </span>
          )}
        </div>

        {/* Right: Sort Select */}
        <EnhancedSortSelect isPremium={isPremium} />
      </div>

      {/* Active Explicit Filters */}
      {activeFilters.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {activeFilters.map((filter, i) => (
            <span 
              key={i} 
              className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getColorClasses(filter.color, filter.isPremium)}`}
            >
              {filter.isPremium && <Crown className="h-3 w-3" />}
              {filter.label}: {filter.value}
            </span>
          ))}
        </div>
      )}

      {/* AI Understanding Details - collapsed behind "View interpretation" */}
      {hasIntent && showDetails && (
        <div className="mt-2 py-2 px-3 bg-muted/30 rounded border border-border text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-foreground/70">Understood:</span>
            {intent.calibers?.map((cal, i) => (
              <span key={i} className={explicitFilters?.caliber ? 'line-through opacity-50' : ''}>
                {cal}
              </span>
            ))}
            {intent.purpose && (
              <span className={explicitFilters?.purpose ? 'line-through opacity-50' : ''}>
                {intent.purpose}
              </span>
            )}
            {(intent.grainWeights?.length ?? 0) > 0 && (
              <span className={explicitFilters?.minGrain !== undefined || explicitFilters?.maxGrain !== undefined ? 'line-through opacity-50' : ''}>
                {intent.grainWeights?.join('/')}gr
              </span>
            )}
            {intent.caseMaterials?.map((mat, i) => (
              <span key={i} className={explicitFilters?.caseMaterial ? 'line-through opacity-50' : ''}>
                {mat}
              </span>
            ))}
            {intent.qualityLevel && <span>{intent.qualityLevel}</span>}
            {isPremium && intent.premiumIntent?.environment && (
              <span>{intent.premiumIntent.environment}</span>
            )}
            {isPremium && intent.premiumIntent?.barrelLength && (
              <span>{intent.premiumIntent.barrelLength} barrel</span>
            )}
            {isPremium && intent.premiumIntent?.suppressorUse && (
              <span>suppressor</span>
            )}
            <span className="opacity-50">· {Math.round(intent.confidence * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
