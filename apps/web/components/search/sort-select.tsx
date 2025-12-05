'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Crown, Lock, ArrowUpDown, Sparkles, DollarSign, Calendar, TrendingUp } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface EnhancedSortSelectProps {
  isPremium?: boolean
}

const SORT_OPTIONS = [
  { 
    value: 'relevance', 
    label: 'Relevance',
    icon: Sparkles,
    description: 'AI-powered relevance ranking',
    premium: false 
  },
  { 
    value: 'best_value', 
    label: 'Best Value',
    icon: TrendingUp,
    description: 'Composite score: price, shipping, reliability',
    premium: true 
  },
  { 
    value: 'price_asc', 
    label: 'Price: Low to High',
    icon: DollarSign,
    description: 'Lowest price first',
    premium: false 
  },
  { 
    value: 'price_desc', 
    label: 'Price: High to Low',
    icon: DollarSign,
    description: 'Highest price first',
    premium: false 
  },
  { 
    value: 'date_desc', 
    label: 'Newest First',
    icon: Calendar,
    description: 'Most recently added',
    premium: false 
  },
  { 
    value: 'date_asc', 
    label: 'Oldest First',
    icon: Calendar,
    description: 'Oldest products first',
    premium: false 
  },
]

export function EnhancedSortSelect({ isPremium = false }: EnhancedSortSelectProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentSort = searchParams.get('sortBy') || 'relevance'

  const handleSortChange = (value: string) => {
    // Check if this is a Premium-only option
    const option = SORT_OPTIONS.find(o => o.value === value)
    if (option?.premium && !isPremium) {
      return // Don't allow selection
    }

    const params = new URLSearchParams(searchParams.toString())
    if (value === 'relevance') {
      params.delete('sortBy')
    } else {
      params.set('sortBy', value)
    }
    params.delete('page')
    router.push(`/search?${params.toString()}`)
  }

  const currentOption = SORT_OPTIONS.find(o => o.value === currentSort)

  return (
    <div className="flex items-center gap-2">
      <ArrowUpDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
      <label htmlFor="sort" className="text-sm font-medium hidden sm:block">
        Sort:
      </label>
      
      <TooltipProvider>
        <Select value={currentSort} onValueChange={handleSortChange}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue>
              <div className="flex items-center gap-2">
                {currentOption && (
                  <>
                    <currentOption.icon className="h-3.5 w-3.5" />
                    <span>{currentOption.label}</span>
                    {currentOption.premium && (
                      <Crown className="h-3 w-3 text-amber-500" />
                    )}
                  </>
                )}
              </div>
            </SelectValue>
          </SelectTrigger>
          
          <SelectContent>
            {SORT_OPTIONS.map((option) => {
              const isLocked = option.premium && !isPremium
              
              return (
                <Tooltip key={option.value}>
                  <TooltipTrigger asChild>
                    <div>
                      <SelectItem 
                        value={option.value}
                        disabled={isLocked}
                        className={isLocked ? 'opacity-50' : ''}
                      >
                        <div className="flex items-center gap-2">
                          <option.icon className="h-4 w-4 text-muted-foreground" />
                          <span>{option.label}</span>
                          {option.premium && (
                            isLocked ? (
                              <Lock className="h-3 w-3 text-muted-foreground ml-auto" />
                            ) : (
                              <Crown className="h-3 w-3 text-amber-500 ml-auto" />
                            )
                          )}
                        </div>
                      </SelectItem>
                    </div>
                  </TooltipTrigger>
                  {isLocked && (
                    <TooltipContent side="left">
                      <p className="text-sm">Upgrade to Premium to sort by Best Value</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              )
            })}
          </SelectContent>
        </Select>
      </TooltipProvider>
    </div>
  )
}

/**
 * Simple sort select (original version for backwards compatibility)
 */
export function SortSelect() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const currentSort = searchParams.get('sortBy') || 'relevance'

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'relevance') {
      params.delete('sortBy')
    } else {
      params.set('sortBy', value)
    }
    params.delete('page')
    router.push(`/search?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="text-sm font-medium">
        Sort by:
      </label>
      <select
        id="sort"
        value={currentSort}
        onChange={(e) => handleSortChange(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
      >
        <option value="relevance">Relevance</option>
        <option value="price_asc">Price: Low to High</option>
        <option value="price_desc">Price: High to Low</option>
        <option value="date_desc">Newest First</option>
        <option value="date_asc">Oldest First</option>
      </select>
    </div>
  )
}
