'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, X } from 'lucide-react';

interface ReviewQueueFiltersProps {
  sources: Array<{ id: string; name: string }>;
  currentReasonCode?: string;
  currentSource?: string;
  currentStatus?: string;
  showSkipped?: boolean;
}

const reasonCodeOptions = [
  { value: '', label: 'All Reasons' },
  { value: 'INSUFFICIENT_DATA', label: 'Insufficient Data' },
  { value: 'AMBIGUOUS_FINGERPRINT', label: 'Ambiguous Match' },
  { value: 'UPC_NOT_TRUSTED', label: 'UPC Not Trusted' },
  { value: 'CONFLICTING_IDENTIFIERS', label: 'Conflicting IDs' },
];

const statusOptions = [
  { value: '', label: 'All Active' },
  { value: 'NEEDS_REVIEW', label: 'Needs Review' },
  { value: 'UNMATCHED', label: 'Unmatched' },
  { value: 'SKIPPED', label: 'Skipped Only' },
];

export function ReviewQueueFilters({
  sources,
  currentReasonCode,
  currentSource,
  currentStatus,
  showSkipped,
}: ReviewQueueFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = (key: string, value: string | boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === true || (typeof value === 'string' && value !== '')) {
      params.set(key, String(value));
    } else {
      params.delete(key);
    }
    router.push(`/review-queue?${params.toString()}`);
  };

  const clearFilters = () => {
    router.push('/review-queue');
  };

  const hasFilters = currentReasonCode || currentSource || currentStatus || showSkipped;

  return (
    <div className="bg-white shadow rounded-lg p-4">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Filter className="h-4 w-4" />
          <span>Filters:</span>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="status" className="text-sm text-gray-600">
            Status:
          </label>
          <select
            id="status"
            value={currentStatus ?? ''}
            onChange={(e) => updateFilter('status', e.target.value)}
            className="block rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Reason Code Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="reasonCode" className="text-sm text-gray-600">
            Reason:
          </label>
          <select
            id="reasonCode"
            value={currentReasonCode ?? ''}
            onChange={(e) => updateFilter('reasonCode', e.target.value)}
            className="block rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
          >
            {reasonCodeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Source Filter */}
        <div className="flex items-center gap-2">
          <label htmlFor="source" className="text-sm text-gray-600">
            Source:
          </label>
          <select
            id="source"
            value={currentSource ?? ''}
            onChange={(e) => updateFilter('source', e.target.value)}
            className="block rounded-md border-gray-300 shadow-sm text-sm focus:border-blue-500 focus:ring-blue-500"
          >
            <option value="">All Sources</option>
            {sources.map((src) => (
              <option key={src.id} value={src.id}>
                {src.name}
              </option>
            ))}
          </select>
        </div>

        {/* Show Skipped Toggle */}
        {!currentStatus && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={showSkipped ?? false}
                onChange={(e) => updateFilter('showSkipped', e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Include skipped
            </label>
          </div>
        )}

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="inline-flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded"
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
