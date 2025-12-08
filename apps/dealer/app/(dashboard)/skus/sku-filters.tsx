'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useState, useCallback } from 'react';
import { Search } from 'lucide-react';

interface SkuFiltersProps {
  currentFilter: string;
  currentSearch: string;
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'All SKUs' },
  { value: 'needs-review', label: 'Needs Review' },
  { value: 'unmapped', label: 'Unmapped' },
  { value: 'mapped', label: 'Mapped' },
  { value: 'out-of-stock', label: 'Out of Stock' },
];

export function SkuFilters({ currentFilter, currentSearch }: SkuFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch);

  const createQueryString = useCallback(
    (params: Record<string, string | null>) => {
      const newParams = new URLSearchParams(searchParams.toString());
      
      Object.entries(params).forEach(([key, value]) => {
        if (value === null) {
          newParams.delete(key);
        } else {
          newParams.set(key, value);
        }
      });
      
      // Reset to page 1 when filtering
      if (params.filter || params.search) {
        newParams.delete('page');
      }
      
      return newParams.toString();
    },
    [searchParams]
  );

  const handleFilterChange = (filter: string) => {
    router.push(`${pathname}?${createQueryString({ filter: filter === 'all' ? null : filter })}`);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.push(`${pathname}?${createQueryString({ search: search || null })}`);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => handleFilterChange(option.value)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              currentFilter === option.value
                ? 'bg-gray-900 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
        <div className="relative flex-1 sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by title, UPC, SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800"
        >
          Search
        </button>
      </form>
    </div>
  );
}
