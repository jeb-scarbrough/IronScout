'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Plus, Loader2, Package, ExternalLink, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  type CaliberValue,
  type AmmoUseCase,
  type AmmoPreference,
  type Product,
  AMMO_USE_CASE_ORDER,
  AMMO_USE_CASE_LABELS,
  aiSearch,
  addAmmoPreference,
} from '@/lib/api'
import { safeLogger } from '@/lib/safe-logger'

interface AmmoPickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  firearmId: string
  firearmLabel: string
  caliber: CaliberValue
  token: string
  /** IDs of ammo SKUs already saved as preferences — used to show "Added" state */
  existingSkuIds: Set<string>
  /** Called after a preference is successfully added */
  onPreferenceAdded: (preference: AmmoPreference) => void
}

export function AmmoPickerModal({
  open,
  onOpenChange,
  firearmId,
  firearmLabel,
  caliber,
  token,
  existingSkuIds,
  onPreferenceAdded,
}: AmmoPickerModalProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [addingSkuId, setAddingSkuId] = useState<string | null>(null)
  const [selectedUseCase, setSelectedUseCase] = useState<AmmoUseCase>('TRAINING')
  const [justAddedIds, setJustAddedIds] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setQuery('')
      setResults([])
      setHasSearched(false)
      setJustAddedIds(new Set())
      setSelectedUseCase('TRAINING')
      // Auto-search for caliber on open
      handleSearch('')
      // Focus input after a tick (dialog animation)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback(async (searchQuery: string) => {
    setIsSearching(true)
    try {
      // Always scope to caliber; append user query if present
      const fullQuery = searchQuery.trim()
        ? `${caliber} ${searchQuery.trim()}`
        : caliber
      const data = await aiSearch({
        query: fullQuery,
        limit: 20,
        token,
        filters: { caliber, inStock: true },
        sortBy: 'relevance',
      })
      setResults(data.products)
      setHasSearched(true)
    } catch (error) {
      safeLogger.search.error('Ammo picker search failed', {}, error)
      toast.error('Search failed — try again')
    } finally {
      setIsSearching(false)
    }
  }, [caliber, token])

  const handleInputChange = (value: string) => {
    setQuery(value)
    // Debounce search
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      handleSearch(value)
    }, 350)
  }

  const handleAddPreference = async (product: Product) => {
    setAddingSkuId(product.id)
    try {
      const { preference } = await addAmmoPreference(
        token,
        firearmId,
        product.id,
        selectedUseCase
      )
      setJustAddedIds((prev) => new Set(prev).add(product.id))
      onPreferenceAdded(preference)
      toast.success(`Added ${product.name}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add ammo preference'
      toast.error(message)
    } finally {
      setAddingSkuId(null)
    }
  }

  const isAlreadyAdded = (productId: string) =>
    existingSkuIds.has(productId) || justAddedIds.has(productId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>Add Ammo Preference</DialogTitle>
          <DialogDescription>
            Search for ammo you shoot in your {firearmLabel}
          </DialogDescription>
        </DialogHeader>

        {/* Use case selector */}
        <div className="px-6 pt-3 pb-1">
          <div className="flex gap-1.5 p-1 bg-muted rounded-lg">
            {AMMO_USE_CASE_ORDER.map((uc) => (
              <button
                key={uc}
                onClick={() => setSelectedUseCase(uc)}
                className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${
                  selectedUseCase === uc
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {AMMO_USE_CASE_LABELS[uc]}
              </button>
            ))}
          </div>
        </div>

        {/* Search input */}
        <div className="px-6 py-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              placeholder={`Search ${caliber} ammo...`}
              value={query}
              onChange={(e) => handleInputChange(e.target.value)}
              className="pl-9 pr-4"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Results list — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 pb-4 min-h-0">
          {isSearching && !hasSearched ? (
            /* Initial load skeleton */
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          ) : results.length === 0 && hasSearched ? (
            /* No results */
            <div className="text-center py-10">
              <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">
                {query ? `No ${caliber} ammo found for "${query}"` : `No ${caliber} ammo found`}
              </p>
            </div>
          ) : (
            /* Result cards */
            <div className="space-y-2">
              {results.map((product) => {
                const alreadyAdded = isAlreadyAdded(product.id)
                const isAdding = addingSkuId === product.id

                return (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          product.brand,
                          product.grainWeight && `${product.grainWeight}gr`,
                          product.roundCount && `${product.roundCount}rd`,
                          product.prices?.[0]?.inStock && product.prices[0].price
                            ? `$${product.prices[0].price.toFixed(2)}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>

                    {alreadyAdded ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground px-3 py-1.5">
                        <Check className="h-3.5 w-3.5" />
                        Added
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isAdding}
                        onClick={() => handleAddPreference(product)}
                        className="shrink-0"
                      >
                        {isAdding ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer — fallback link */}
        <div className="border-t px-6 py-3 text-center">
          <a
            href={`/search?caliber=${encodeURIComponent(caliber)}&firearmId=${firearmId}`}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Can&apos;t find it? Browse all {caliber} ammo
          </a>
        </div>
      </DialogContent>
    </Dialog>
  )
}
