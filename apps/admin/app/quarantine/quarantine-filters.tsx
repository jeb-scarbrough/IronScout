'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Filter } from 'lucide-react';

interface QuarantineFiltersProps {
  currentFeedType?: 'RETAILER' | 'AFFILIATE';
  currentStatus: string;
  retailerCount: number;
  affiliateCount: number;
}

export function QuarantineFilters({
  currentFeedType,
  currentStatus,
  retailerCount,
  affiliateCount,
}: QuarantineFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = (key: string, value: string | undefined) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page'); // Reset to page 1 on filter change
    router.push(`/quarantine?${params.toString()}`);
  };

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Filter className="h-4 w-4" />
          Filters:
        </div>

        {/* Feed Type Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Feed Type:</span>
          <div className="flex gap-1">
            <button
              onClick={() => updateFilter('feedType', undefined)}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                !currentFeedType
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All ({retailerCount + affiliateCount})
            </button>
            <button
              onClick={() => updateFilter('feedType', 'RETAILER')}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                currentFeedType === 'RETAILER'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
              }`}
            >
              Retailer ({retailerCount})
            </button>
            <button
              onClick={() => updateFilter('feedType', 'AFFILIATE')}
              className={`px-3 py-1.5 text-sm rounded-md transition ${
                currentFeedType === 'AFFILIATE'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
              }`}
            >
              Affiliate ({affiliateCount})
            </button>
          </div>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Status:</span>
          <select
            value={currentStatus}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="block rounded-md border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="QUARANTINED">Quarantined</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
        </div>
      </div>
    </div>
  );
}
