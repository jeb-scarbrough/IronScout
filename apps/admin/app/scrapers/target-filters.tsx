'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Search, Filter } from 'lucide-react'
import { KNOWN_ADAPTERS } from '@/lib/scraper-constants'

interface TargetFiltersProps {
  currentStatus?: string
  currentAdapter?: string
  currentSearch?: string
  currentEnabled?: string
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'BROKEN', label: 'Broken' },
  { value: 'STALE', label: 'Stale' },
]

const ENABLED_OPTIONS = [
  { value: '', label: 'All targets' },
  { value: 'true', label: 'Enabled only' },
  { value: 'false', label: 'Disabled/Paused' },
]

export function TargetFilters({ currentStatus, currentAdapter, currentSearch, currentEnabled }: TargetFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [searchValue, setSearchValue] = useState(currentSearch || '')

  const updateFilters = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString())

    // Reset to page 1 when filters change
    params.delete('page')

    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
    }

    startTransition(() => {
      router.push(`/scrapers?${params.toString()}`)
    })
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilters({ search: searchValue || undefined })
  }

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateFilters({ status: e.target.value || undefined })
  }

  const handleAdapterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateFilters({ adapter: e.target.value || undefined })
  }

  const handleEnabledChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateFilters({ enabled: e.target.value || undefined })
  }

  return (
    <div className="px-4 py-4 border-b border-gray-200 bg-gray-50">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search URLs or source names..."
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </form>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            value={currentStatus || ''}
            onChange={handleStatusChange}
            disabled={isPending}
            className="block w-full sm:w-auto py-2 px-3 border border-gray-300 bg-white rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {/* Adapter Filter */}
        <div>
          <select
            value={currentAdapter || ''}
            onChange={handleAdapterChange}
            disabled={isPending}
            className="block w-full sm:w-auto py-2 px-3 border border-gray-300 bg-white rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All adapters</option>
            {KNOWN_ADAPTERS.map((adapter) => (
              <option key={adapter.id} value={adapter.id}>
                {adapter.name}
              </option>
            ))}
          </select>
        </div>

        {/* Enabled Filter */}
        <div>
          <select
            value={currentEnabled || ''}
            onChange={handleEnabledChange}
            disabled={isPending}
            className="block w-full sm:w-auto py-2 px-3 border border-gray-300 bg-white rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          >
            {ENABLED_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isPending && (
        <div className="mt-2 text-sm text-gray-500">
          Loading...
        </div>
      )}
    </div>
  )
}
