'use client';

import { useState } from 'react';
import { BRAND } from '@/lib/brand';

const APP_URL = BRAND.appUrl;

const EXAMPLE_CHIPS = [
  { label: '9mm Range', query: '9mm for range practice' },
  { label: '9mm Bulk', query: '9mm bulk for range' },
  { label: '300BLK Subsonic', query: '300 blackout subsonic' },
  { label: '5.56 Match 77gr', query: '5.56 match grade 77 grain' },
  { label: '.22LR Plinking', query: '.22 LR bulk plinking' },
];

const advancedExampleQueries = [
  '9mm for compact carry, low flash',
  'subsonic .300 blackout for suppressor',
  'short barrel optimized defense ammo',
];

export function HeroSearch() {
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      window.location.href = `${APP_URL}/search?q=${encodeURIComponent(query)}`;
    }
  };

  const handleExampleClick = (example: string) => {
    window.location.href = `${APP_URL}/search?q=${encodeURIComponent(example)}`;
  };

  return (
    <>
      {/* Search Box */}
      <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-6">
        <div className="relative flex items-center">
          <div className="absolute left-4 flex items-center">
            <svg className="w-5 h-5 text-iron-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by caliber, use case, or intent..."
            className="w-full pl-12 pr-32 py-4 text-lg bg-iron-900 border-2 border-iron-700 rounded-2xl
                     focus:border-primary focus:ring-4 focus:ring-primary/20
                     transition-all text-iron-100 placeholder:text-iron-500"
          />
          <button
            type="submit"
            className="absolute right-2 px-6 py-2.5 bg-primary hover:bg-primary/80
                     text-iron-950 font-semibold rounded-xl transition-all
                     flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search
          </button>
        </div>
      </form>

      {/* Example Chips */}
      <div className="mb-12 space-y-5">
        <div className="flex flex-wrap justify-center gap-2">
          {EXAMPLE_CHIPS.map((chip, i) => (
            <button
              key={i}
              onClick={() => handleExampleClick(chip.query)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-iron-700
                       bg-iron-900/50 text-iron-200 text-sm font-medium
                       shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0
                       hover:border-primary/50 transition-all"
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="pt-3 border-t border-iron-800">
          <div className="flex items-center justify-center gap-2 mb-2">
            <p className="text-xs text-iron-500 font-medium">Advanced searches:</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {advancedExampleQueries.map((example, i) => (
              <button
                key={i}
                onClick={() => handleExampleClick(example)}
                className="text-xs px-3 py-1.5 rounded-full border border-iron-700
                         hover:border-primary/50 hover:bg-iron-800/50
                         transition-colors text-iron-500"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
