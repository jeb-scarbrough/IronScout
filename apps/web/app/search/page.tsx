import { Suspense } from 'react'
import { SearchResults } from '@/components/search/search-results'
import { SearchFiltersAmmo } from '@/components/search/search-filters-ammo'
import { SearchHeader } from '@/components/search/search-header'
import { SortSelect } from '@/components/search/sort-select'

interface SearchPageProps {
  searchParams: Promise<{
    q?: string
    category?: string
    brand?: string
    minPrice?: string
    maxPrice?: string
    inStock?: string
    // Ammo-specific filters
    caliber?: string
    grainWeight?: string
    caseMaterial?: string
    purpose?: string
    minRounds?: string
    maxRounds?: string
    sortBy?: 'price_asc' | 'price_desc' | 'date_desc' | 'date_asc' | 'relevance'
    page?: string
  }>
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams
  const query = params.q || ''

  return (
    <div className="container mx-auto px-4 py-6">
      <SearchHeader query={query} />

      <div className="flex flex-col lg:flex-row gap-6 mt-6">
        {/* Filters Sidebar - Hidden on mobile, shown on desktop */}
        <aside className="w-full lg:w-64 flex-shrink-0">
          <SearchFiltersAmmo />
        </aside>

        {/* Main Content */}
        <div className="flex-1">
          <div className="flex justify-end mb-4">
            <SortSelect />
          </div>
          <Suspense fallback={<div className="text-center py-8">Loading results...</div>}>
            <SearchResults searchParams={params} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
