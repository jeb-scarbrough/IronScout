'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';

interface DealerFiltersProps {
  currentSearch?: string;
  currentStatus?: string;
}

export function DealerFilters({ currentSearch, currentStatus }: DealerFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch || '');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    
    if (search) {
      params.set('search', search);
    } else {
      params.delete('search');
    }
    
    router.push(`/dealers?${params.toString()}`);
  };

  const clearSearch = () => {
    setSearch('');
    const params = new URLSearchParams(searchParams.toString());
    params.delete('search');
    router.push(`/dealers?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-4">
      <form onSubmit={handleSearch} className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by business name, email, or contact..."
            className="w-full rounded-md border border-gray-300 pl-10 pr-10 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {search && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </form>
      
      {(currentSearch || currentStatus) && (
        <button
          onClick={() => router.push('/dealers')}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}
