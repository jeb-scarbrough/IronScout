'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, Sparkles, X, Loader2, SlidersHorizontal, ChevronDown, RotateCcw, Target, Package, VolumeX, Crosshair } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getSearchSuggestions } from '@/lib/api'
import { PremiumFilters } from '@/components/premium'
import { cn } from '@/lib/utils'
import { useSearchLoading } from './search-loading-context'
import { safeLogger } from '@/lib/safe-logger'

// Common calibers for the ammunition market
const CALIBERS = [
  '9mm', '.45 ACP', '.40 S&W', '.380 ACP', '.38 Special', '.357 Magnum',
  '.223 Remington', '5.56 NATO', '.308 Winchester', '7.62x39', '6.5 Creedmoor',
  '.300 Blackout', '12 Gauge', '20 Gauge', '.22 LR', '.17 HMR'
]

const PURPOSES = [
  'Target', 'Defense', 'Hunting', 'Competition', 'Plinking', 'Training'
]

const CASE_MATERIALS = [
  'Brass', 'Steel', 'Aluminum', 'Nickel-Plated'
]

const GRAIN_RANGES = [
  { label: 'Light (< 100gr)', min: 0, max: 99 },
  { label: 'Medium (100-150gr)', min: 100, max: 150 },
  { label: 'Heavy (150-180gr)', min: 150, max: 180 },
  { label: 'Very Heavy (180+gr)', min: 180, max: 999 },
]

// Rotating placeholder examples - outcome-driven
const ROTATING_PLACEHOLDERS = [
  "Find 9mm ammo for range practice",
  "Cheap .223 for target shooting",
  "Home defense 9mm hollow points",
  "Bulk 5.56 NATO for training",
  ".308 match grade for long range",
]

// Quick-start example chips with icons
const EXAMPLE_CHIPS = [
  { label: '9mm Range', query: '9mm for range practice', icon: Target },
  { label: '9mm Bulk', query: '9mm bulk for range', icon: Package },
  { label: '300BLK Subsonic', query: '300 blackout subsonic', icon: VolumeX },
  { label: '5.56 Match 77gr', query: '5.56 match grade 77 grain', icon: Crosshair },
  { label: '.22LR Plinking', query: '.22 LR bulk plinking', icon: Target },
]

const advancedExampleQueries = [
  "9mm for compact carry, low flash",
  "subsonic .300 blackout for suppressor",
  "short barrel optimized defense ammo",
]

interface UnifiedSearchProps {
  initialQuery?: string
}

export function UnifiedSearch({ initialQuery = '' }: UnifiedSearchProps) {
  const searchParams = useSearchParams()
  const { isSearching, navigateWithLoading } = useSearchLoading()

  // Search state
  const [query, setQuery] = useState(initialQuery)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Filter state - collapsed by default
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [performanceFiltersOpen, setPerformanceFiltersOpen] = useState(false)

  // Rotate placeholder text
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % ROTATING_PLACEHOLDERS.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  // Autofocus on mount
  useEffect(() => {
    if (!initialQuery && inputRef.current) {
      inputRef.current.focus()
    }
  }, [])
  
  // Get current filter values from URL
  const getFiltersFromUrl = () => ({
    caliber: searchParams.get('caliber') || '',
    purpose: searchParams.get('purpose') || '',
    caseMaterial: searchParams.get('caseMaterial') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    minGrain: searchParams.get('minGrain') || '',
    maxGrain: searchParams.get('maxGrain') || '',
    inStock: searchParams.get('inStock') === 'true',
  })

  const [filters, setFilters] = useState(getFiltersFromUrl())
  
  // Count active filters (basic)
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === 'inStock') return value === true
    return value !== ''
  }).length

  // Count performance filters
  const performanceFilterKeys = ['bulletType', 'pressureRating', 'isSubsonic', 'shortBarrelOptimized',
                             'suppressorSafe', 'lowFlash', 'lowRecoil', 'matchGrade']
  const performanceFiltersActive = performanceFilterKeys.filter(k => searchParams.get(k)).length

  // Auto-open filters if any are active
  useEffect(() => {
    if (activeFilterCount > 0 && !filtersOpen) {
      setFiltersOpen(true)
    }
    if (performanceFiltersActive > 0 && !performanceFiltersOpen) {
      setPerformanceFiltersOpen(true)
    }
  }, [])

  // Sync filters with URL
  useEffect(() => {
    setFilters(getFiltersFromUrl())
  }, [searchParams])

  // Handle search
  const handleSearch = (searchQuery?: string) => {
    const q = searchQuery || query
    if (q.trim()) {
      setShowSuggestions(false)
      const params = new URLSearchParams(searchParams.toString())
      params.set('q', q.trim())
      params.delete('page') // Reset to page 1
      navigateWithLoading(`/search?${params.toString()}`)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSearch()
  }

  // Fetch suggestions on input change
  useEffect(() => {
    if (query.length < 2) {
      setSuggestions([])
      return
    }

    const timeoutId = setTimeout(async () => {
      try {
        const results = await getSearchSuggestions(query)
        setSuggestions(results.slice(0, 5))
      } catch (error) {
        safeLogger.search.error('Failed to fetch suggestions', {}, error)
      }
    }, 200)

    return () => clearTimeout(timeoutId)
  }, [query])

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Filter methods
  const applyFilters = (newFilters: typeof filters) => {
    const params = new URLSearchParams(searchParams.toString())

    Object.entries(newFilters).forEach(([key, value]) => {
      if (value === '' || value === false) {
        params.delete(key)
      } else {
        params.set(key, String(value))
      }
    })

    params.delete('page')
    navigateWithLoading(`/search?${params.toString()}`)
  }

  const clearFilters = () => {
    const clearedFilters = {
      caliber: '',
      purpose: '',
      caseMaterial: '',
      minPrice: '',
      maxPrice: '',
      minGrain: '',
      maxGrain: '',
      inStock: false,
    }
    setFilters(clearedFilters)

    const params = new URLSearchParams()
    const query = searchParams.get('q')
    const sortBy = searchParams.get('sortBy')
    if (query) params.set('q', query)
    if (sortBy) params.set('sortBy', sortBy)

    navigateWithLoading(`/search?${params.toString()}`)
  }

  const handleSelectChange = (key: keyof typeof filters, value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    applyFilters(newFilters)
  }

  const handleCheckboxChange = (checked: boolean) => {
    const newFilters = { ...filters, inStock: checked }
    setFilters(newFilters)
    applyFilters(newFilters)
  }

  const [priceTimeout, setPriceTimeout] = useState<NodeJS.Timeout | null>(null)
  
  const handlePriceChange = (key: 'minPrice' | 'maxPrice', value: string) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    
    if (priceTimeout) clearTimeout(priceTimeout)
    setPriceTimeout(setTimeout(() => {
      applyFilters(newFilters)
    }, 500))
  }

  const handleGrainRange = (min: number, max: number) => {
    const newFilters = { 
      ...filters, 
      minGrain: String(min), 
      maxGrain: String(max) 
    }
    setFilters(newFilters)
    applyFilters(newFilters)
  }

  return (
    <div className="w-full">
      {/* Hero Search Bar - Pill Style per Design */}
      <div className="max-w-4xl mx-auto">
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative flex items-center bg-card border border-border rounded-full shadow-lg hover:shadow-xl transition-shadow">
            {/* AI Badge - Cyan pill on the left */}
            <div className="flex-shrink-0 pl-4">
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/20 text-primary text-xs font-semibold transition-all",
                isSearching && "animate-pulse"
              )}>
                <Sparkles className={cn("h-3.5 w-3.5", isSearching && "animate-spin")} />
                <span>AI</span>
              </div>
            </div>

            <input
              ref={inputRef}
              id="search-query"
              name="q"
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShowSuggestions(true)
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder={ROTATING_PLACEHOLDERS[placeholderIndex]}
              data-testid="search-input"
              className="flex-1 px-4 py-4 text-base bg-transparent border-0 focus:outline-none focus:ring-0 placeholder:text-muted-foreground/50"
            />

            {/* Clear button */}
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
                className="flex-shrink-0 p-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            )}

            {/* Search Button - Cyan pill on the right */}
            <Button
              type="submit"
              disabled={isSearching}
              className="flex-shrink-0 mr-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-5 py-2 h-auto font-semibold shadow-md hover:shadow-lg transition-all"
            >
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </>
              )}
            </Button>
          </div>

          {/* Confident AI helper - only show when no query */}
          {!query && (
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Describe what you need. Filters are applied automatically.
            </p>
          )}

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-10 w-full mt-2 bg-background rounded-xl shadow-lg border border-border overflow-hidden"
            >
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    setQuery(suggestion)
                    handleSearch(suggestion)
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-muted flex items-center gap-3 transition-colors"
                >
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <span>{suggestion}</span>
                </button>
              ))}
            </div>
          )}
        </form>

        {/* Quick-start chips - shown when no query */}
        {!query && (
          <div className="mt-6 space-y-5">
            {/* Clickable example chips with icons */}
            <div className="flex flex-wrap justify-center gap-2">
              {EXAMPLE_CHIPS.map((chip, i) => {
                const Icon = chip.icon
                return (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(chip.query)
                      handleSearch(chip.query)
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-border bg-card text-foreground text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 hover:border-primary/50 transition-all"
                  >
                    <Icon className="h-4 w-4" />
                    {chip.label}
                  </button>
                )
              })}
            </div>

            <div className="pt-3 border-t border-border">
              <div className="flex items-center justify-center gap-2 mb-2">
                <p className="text-xs text-muted-foreground font-medium">Advanced searches:</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {advancedExampleQueries.map((example, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(example)
                      handleSearch(example)
                    }}
                    className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-primary/50 hover:bg-muted/50 transition-colors text-muted-foreground"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Horizontal Filter Bar - Always visible when query exists */}
      {query && (
        <div className="max-w-4xl mx-auto mt-4">
          <div className="flex flex-wrap items-center gap-2">
            {/* Filters button - visible on all sizes, primary control on mobile */}
            <button
              onClick={() => setFiltersOpen(!filtersOpen)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
                filtersOpen || activeFilterCount > 0
                  ? "bg-muted text-foreground border-border"
                  : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/50"
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeFilterCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Inline dropdown filters — hidden on mobile, visible md+ */}
            <div className="hidden md:contents">
              <select
                value={filters.caliber}
                onChange={(e) => handleSelectChange('caliber', e.target.value)}
                className={cn(
                  "px-3 py-2 rounded-lg border text-sm font-medium bg-card transition-colors appearance-none cursor-pointer pr-8",
                  filters.caliber ? "text-foreground border-primary/50" : "text-muted-foreground border-border hover:text-foreground"
                )}
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
              >
                <option value="">Caliber</option>
                {CALIBERS.map(cal => (
                  <option key={cal} value={cal}>{cal}</option>
                ))}
              </select>

              <select
                value={filters.minGrain && filters.maxGrain ? `${filters.minGrain}-${filters.maxGrain}` : ''}
                onChange={(e) => {
                  if (!e.target.value) {
                    const newFilters = { ...filters, minGrain: '', maxGrain: '' }
                    setFilters(newFilters)
                    applyFilters(newFilters)
                  } else {
                    const [min, max] = e.target.value.split('-').map(Number)
                    handleGrainRange(min, max)
                  }
                }}
                className={cn(
                  "px-3 py-2 rounded-lg border text-sm font-medium bg-card transition-colors appearance-none cursor-pointer pr-8",
                  filters.minGrain ? "text-foreground border-primary/50" : "text-muted-foreground border-border hover:text-foreground"
                )}
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
              >
                <option value="">Grain</option>
                {GRAIN_RANGES.map(range => (
                  <option key={range.label} value={`${range.min}-${range.max}`}>{range.label}</option>
                ))}
              </select>

              {/* Casing and Type filters hidden — data not yet populated (see #GH-issue) */}
            </div>

            {/* Spacer to push toggles to the right */}
            <div className="flex-1" />

            {/* Toggle pill buttons */}
            <button
              onClick={() => handleCheckboxChange(!filters.inStock)}
              className={cn(
                "px-4 py-2 rounded-lg border text-sm font-medium transition-colors",
                filters.inStock
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-muted/50"
              )}
            >
              In Stock
            </button>

            {/* Clear filters button - shown when filters are active */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                title="Clear all filters"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Advanced Filters Panel - shown when Filters button is clicked */}
      {filtersOpen && (
        <div className="max-w-4xl mx-auto mt-3 p-4 bg-muted/30 rounded-xl border border-border/50 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-foreground">Advanced Filters</h3>
            {activeFilterCount > 0 && (
              <button
                onClick={clearFilters}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Clear all
              </button>
            )}
          </div>

          {/* Basic filters — shown on mobile only (desktop has inline dropdowns) */}
          <div className="md:hidden grid grid-cols-2 gap-2 mb-4">
            <select
              value={filters.caliber}
              onChange={(e) => handleSelectChange('caliber', e.target.value)}
              className={cn(
                "px-3 py-2 rounded-lg border text-sm font-medium bg-card transition-colors appearance-none cursor-pointer pr-8",
                filters.caliber ? "text-foreground border-primary/50" : "text-muted-foreground border-border"
              )}
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
            >
              <option value="">Caliber</option>
              {CALIBERS.map(cal => (
                <option key={cal} value={cal}>{cal}</option>
              ))}
            </select>

            <select
              value={filters.minGrain && filters.maxGrain ? `${filters.minGrain}-${filters.maxGrain}` : ''}
              onChange={(e) => {
                if (!e.target.value) {
                  const newFilters = { ...filters, minGrain: '', maxGrain: '' }
                  setFilters(newFilters)
                  applyFilters(newFilters)
                } else {
                  const [min, max] = e.target.value.split('-').map(Number)
                  handleGrainRange(min, max)
                }
              }}
              className={cn(
                "px-3 py-2 rounded-lg border text-sm font-medium bg-card transition-colors appearance-none cursor-pointer pr-8",
                filters.minGrain ? "text-foreground border-primary/50" : "text-muted-foreground border-border"
              )}
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
            >
              <option value="">Grain</option>
              {GRAIN_RANGES.map(range => (
                <option key={range.label} value={`${range.min}-${range.max}`}>{range.label}</option>
              ))}
            </select>

            {/* Casing and Type filters hidden — data not yet populated (see #GH-issue) */}
          </div>

          {/* Price Range */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-muted-foreground mb-2">
              Total Price Range
            </label>
            <div className="flex items-center gap-2 max-w-xs">
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <input
                  id="min-price"
                  name="minPrice"
                  type="number"
                  value={filters.minPrice}
                  onChange={(e) => handlePriceChange('minPrice', e.target.value)}
                  placeholder="Min"
                  min="0"
                  step="0.01"
                  className="w-full pl-6 pr-2 py-2 text-sm border rounded-lg bg-background focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
              <span className="text-muted-foreground">–</span>
              <div className="relative flex-1">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                <input
                  id="max-price"
                  name="maxPrice"
                  type="number"
                  value={filters.maxPrice}
                  onChange={(e) => handlePriceChange('maxPrice', e.target.value)}
                  placeholder="Max"
                  min="0"
                  step="0.01"
                  className="w-full pl-6 pr-2 py-2 text-sm border rounded-lg bg-background focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Performance Filters */}
          <div className="pt-3 border-t border-border/50">
            <button
              onClick={() => setPerformanceFiltersOpen(!performanceFiltersOpen)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <span>Performance filters</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${performanceFiltersOpen ? 'rotate-180' : ''}`} />
            </button>
            {performanceFiltersOpen && (
              <div className="mt-3">
                <PremiumFilters />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
