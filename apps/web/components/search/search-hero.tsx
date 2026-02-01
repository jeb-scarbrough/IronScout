'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

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
      <section className="bg-background border-b border-border py-4">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <form onSubmit={handleSearch}>
            <div className="relative flex items-center">
              <div className="absolute left-4 flex items-center">
                <Search className="w-5 h-5 text-muted-foreground" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by caliber, use case, or intent..."
                className="w-full pl-12 pr-28 py-3 text-base bg-secondary border-2 border-border rounded-2xl
                         focus:border-primary focus:ring-4 focus:ring-primary/20
                         transition-all text-foreground placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                className="absolute right-2 px-4 py-2 bg-primary hover:bg-primary/80
                         text-primary-foreground font-semibold rounded-xl transition-all
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

  // Full hero mode - matches www home page
  return (
    <section className="relative pt-12 sm:pt-16 pb-12">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -right-64 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -left-64 w-[500px] h-[500px] bg-muted/50 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* Headline */}
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-4">
            Ammo search that thinks<br />
            <span className="text-primary">like a shooter</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground font-display mb-8">
            Range day or carry day. We search differently.
          </p>

          {/* Search Box */}
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-6">
            <div className="relative flex items-center">
              <div className="absolute left-4 flex items-center">
                <Search className="w-5 h-5 text-muted-foreground" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by caliber, use case, or intent..."
                className="w-full pl-12 pr-32 py-4 text-lg bg-secondary border-2 border-border rounded-2xl
                         focus:border-primary focus:ring-4 focus:ring-primary/20
                         transition-all text-foreground placeholder:text-muted-foreground"
              />
              <button
                type="submit"
                className="absolute right-2 px-6 py-2.5 bg-primary hover:bg-primary/80
                         text-primary-foreground font-semibold rounded-xl transition-all
                         flex items-center gap-2"
              >
                <Search className="w-4 h-4" />
                Search
              </button>
            </div>
          </form>

          {/* Example Queries */}
          <div className="mb-8">
            <p className="text-sm text-muted-foreground mb-3">Try:</p>
            <div className="flex flex-wrap justify-center gap-2">
              {exampleQueries.map((example, i) => (
                <button
                  key={i}
                  onClick={() => handleExampleClick(example)}
                  className="text-sm px-3 py-1.5 rounded-full border border-border
                           hover:border-primary hover:bg-primary/10
                           transition-colors text-muted-foreground hover:text-primary"
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
