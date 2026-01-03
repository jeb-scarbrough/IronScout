'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Search, X } from 'lucide-react';

export function MerchantSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(searchParams.get('search') || '');

  const handleSearch = (newValue: string) => {
    setValue(newValue);
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (newValue) {
        params.set('search', newValue);
      } else {
        params.delete('search');
      }
      router.push(`/merchants?${params.toString()}`);
    });
  };

  const clearSearch = () => {
    setValue('');
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('search');
      router.push(`/merchants?${params.toString()}`);
    });
  };

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
        <Search className={`h-4 w-4 ${isPending ? 'text-blue-500 animate-pulse' : 'text-gray-400'}`} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder="Search by business name..."
        className="block w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-10 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {value && (
        <button
          onClick={clearSearch}
          className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
