'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'

const exampleQueries = [
  '9mm hollow point',
  'bulk .223 brass case',
  '.308 match grade',
  '5.56 green tip',
  '300 blackout subsonic',
]

interface SearchHeroProps {
  initialQuery?: string
  compact?: boolean
}

export function SearchHero({ initialQuery = '', compact = false }: SearchHeroProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(initialQuery)
  const inputRef = useRef<HTMLInputElement>(null)

  // Update query when URL changes
  useEffect(() => {
    const urlQuery = searchParams.get('q') || ''
    setQuery(urlQuery)
  }, [searchParams])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query)}`)
    }
  }

  const handleExampleClick = (example: string) => {
    setQuery(example)
    router.push(`/search?q=${encodeURIComponent(example)}`)
  }

  // Compact mode - just the search bar for when results are showing
  if (compact) {
    return (
      <section className="bg-iron-950 border-b border-iron-800/50 py-4">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <form onSubmit={handleSearch}>
            <div className="relative flex items-center">
              <div className="absolute left-4 flex items-center">
                <Search className="w-5 h-5 text-iron-500" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by caliber, use case, or intent..."
                className="w-full pl-12 pr-28 py-3 text-base bg-iron-900 border-2 border-iron-800 rounded-2xl
                         focus:border-primary focus:ring-4 focus:ring-primary/20
                         transition-all text-white placeholder:text-iron-500"
              />
              <button
                type="submit"
                className="absolute right-2 px-4 py-2 bg-primary hover:bg-primary/80
                         text-iron-950 font-semibold rounded-xl transition-all
                         flex items-center gap-2 text-sm"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </div>
          </form>
        </div>
      </section>
    )
  }

  // Full hero mode - search box with example queries
  return (
    <section className="relative pt-8 sm:pt-12 pb-8">
      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto">
          {/* Subtitle */}
          <p className="text-center text-lg text-iron-400 font-display mb-6">
            Range day or carry day. We search differently.
          </p>

          {/* Search Box */}
          <form onSubmit={handleSearch} className="mb-6">
            <div className="relative flex items-center">
              <div className="absolute left-4 flex items-center">
                <Search className="w-5 h-5 text-iron-500" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by caliber, use case, or intent..."
                className="w-full pl-12 pr-32 py-4 text-lg bg-iron-900 border-2 border-iron-800 rounded-2xl
                         focus:border-primary focus:ring-4 focus:ring-primary/20
                         transition-all text-white placeholder:text-iron-500"
              />
              <button
                type="submit"
                className="absolute right-2 px-6 py-2.5 bg-primary hover:bg-primary/80
                         text-iron-950 font-semibold rounded-xl transition-all
                         flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </div>
          </form>

          {/* Example Queries */}
          <div>
            <p className="text-sm text-iron-500 mb-3">Try:</p>
            <div className="flex flex-wrap gap-2">
              {exampleQueries.map((example, i) => (
                <button
                  key={i}
                  onClick={() => handleExampleClick(example)}
                  className="text-sm px-3 py-1.5 rounded-full border border-iron-700
                           hover:border-primary hover:bg-primary/10
                           transition-colors text-iron-400 hover:text-primary"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
