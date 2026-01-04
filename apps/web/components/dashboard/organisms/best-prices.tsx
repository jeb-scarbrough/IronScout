'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  TrendingDown,
} from 'lucide-react'
import { ProductImage } from '@/components/products/product-image'

/**
 * Best price item - matches backend deals response for scope=global
 */
export interface BestPriceItem {
  id: string
  product: {
    id: string
    name: string
    caliber: string | null
    brand: string | null
    imageUrl: string | null
    roundCount: number | null
    grainWeight: number | null
  }
  retailer: {
    id: string
    name: string
    logoUrl: string | null
  }
  price: number
  pricePerRound: number | null
  url: string
  inStock: boolean
  updatedAt: string | null
}

interface BestPricesProps {
  items: BestPriceItem[]
}

/**
 * BestPrices - Dashboard "Best Prices You Can Buy Right Now" section
 *
 * Per dashboard-product-spec.md:
 * - Always shown in every state
 * - Never framed as recommendation
 * - Copy must imply opportunity, not advice
 * - Footer: "Deals like these are caught when items are in your watchlist."
 */
export function BestPrices({ items }: BestPricesProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full text-left"
        >
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-primary uppercase tracking-wide">
            <TrendingDown className="h-4 w-4" />
            Best Prices You Can Buy Right Now
          </CardTitle>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          {items.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              No deals available right now. Check back later.
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {items.map((item) => (
                  <BestPriceCard key={item.id} item={item} />
                ))}
              </div>

              {/* Footer copy per spec */}
              <p className="mt-4 text-xs text-center text-muted-foreground">
                Deals like these are caught when items are in your watchlist.
              </p>
            </>
          )}
        </CardContent>
      )}
    </Card>
  )
}

interface BestPriceCardProps {
  item: BestPriceItem
}

function BestPriceCard({ item }: BestPriceCardProps) {
  const { product, retailer, price, pricePerRound, url } = item

  return (
    <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
      {/* Product Image */}
      <div className="w-12 h-12 relative flex-shrink-0 rounded overflow-hidden bg-gray-100">
        <ProductImage
          imageUrl={product.imageUrl}
          caliber={product.caliber}
          brand={product.brand}
          alt={product.name}
          fill
        />
      </div>

      {/* Product Info */}
      <div className="flex-1 min-w-0">
        {/* Caliber */}
        <div className="text-xs text-muted-foreground mb-0.5">
          {product.caliber || 'Unknown caliber'}
        </div>
        {/* Product Name */}
        <div className="font-medium text-sm truncate">{product.name}</div>
      </div>

      {/* Price */}
      <div className="text-right flex-shrink-0">
        {pricePerRound !== null ? (
          <div className="text-lg font-bold text-primary">
            {(pricePerRound * 100).toFixed(1)}
            <span className="text-sm font-normal text-muted-foreground">¢/rd</span>
          </div>
        ) : (
          <div className="text-lg font-bold">${price.toFixed(2)}</div>
        )}
      </div>

      {/* Retailer Button */}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
      >
        <Button variant="outline" size="sm" className="gap-1 whitespace-nowrap">
          {retailer.name}
          <ExternalLink className="h-3 w-3" />
        </Button>
      </a>
    </div>
  )
}
