import { Suspense } from 'react'
import { Metadata } from 'next'
import { SearchResults } from '@/components/search/search-results'
import { SearchHero } from '@/components/search/search-hero'
import { SearchLoadingOverlay } from '@/components/search/search-loading-overlay'

export const metadata: Metadata = {
  title: 'Search - IronScout',
  description: 'Search and compare ammunition prices across retailers.',
}

interface SearchPageProps {
  searchParams: Promise<{
    q?: string
    category?: string
    brand?: string
    minPrice?: string
    maxPrice?: string
    inStock?: string
    caliber?: string
    grainWeight?: string
    minGrain?: string
    maxGrain?: string
    caseMaterial?: string
    purpose?: string
    sortBy?: 'price_asc' | 'price_desc' | 'date_desc' | 'date_asc' | 'relevance' | 'best_value'
    page?: string
    // Performance filters
    bulletType?: string
    pressureRating?: string
    isSubsonic?: string
    shortBarrelOptimized?: string
    lowFlash?: string
    matchGrade?: string
    minVelocity?: string
    maxVelocity?: string
  }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const query = params.q || ''
  const hasQuery = Boolean(query)

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* Search Hero */}
      <Suspense fallback={
        <div className="h-32 animate-pulse bg-muted rounded-lg" />
      }>
        <SearchHero initialQuery={query} compact={hasQuery} />
      </Suspense>

      {/* Results - only show when there's a query */}
      {hasQuery && (
        <div className="relative flex flex-col">
          <SearchLoadingOverlay />
          <Suspense fallback={
            <div className="text-center py-12">
              <div className="animate-pulse flex flex-col items-center">
                <div className="w-12 h-12 bg-muted rounded-full mb-4"></div>
                <div className="h-4 w-48 bg-muted rounded mb-2"></div>
                <div className="h-3 w-32 bg-muted rounded"></div>
              </div>
            </div>
          }>
            <SearchResults searchParams={params} />
          </Suspense>
        </div>
      )}
    </div>
  )
}
