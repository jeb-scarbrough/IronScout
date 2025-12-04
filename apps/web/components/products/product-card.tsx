'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatPrice } from '@/lib/utils'
import { Star, ExternalLink, Bell, Crown, Package } from 'lucide-react'
import type { Product } from '@/lib/api'
import { CreateAlertDialog } from './create-alert-dialog'

interface ProductCardProps {
  product: Product & { relevanceScore?: number }
  showRelevance?: boolean
}

// Helper to get purpose badge variant and color
const getPurposeBadge = (purpose?: string) => {
  if (!purpose) return null

  const purposeLower = purpose.toLowerCase()
  if (purposeLower.includes('target') || purposeLower.includes('practice')) {
    return { label: purpose, className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' }
  }
  if (purposeLower.includes('defense') || purposeLower.includes('defensive')) {
    return { label: purpose, className: 'bg-red-100 text-red-800 hover:bg-red-100' }
  }
  if (purposeLower.includes('hunt')) {
    return { label: purpose, className: 'bg-green-100 text-green-800 hover:bg-green-100' }
  }
  return { label: purpose, className: 'bg-gray-100 text-gray-800 hover:bg-gray-100' }
}

export function ProductCard({ product, showRelevance = false }: ProductCardProps) {
  const [showAlertDialog, setShowAlertDialog] = useState(false)

  const lowestPrice = product.prices.reduce((min, price) =>
    price.price < min.price ? price : min
  )

  const isPremiumRetailer = lowestPrice.retailer.tier === 'PREMIUM'

  // Calculate price per round if roundCount is available
  const pricePerRound = product.roundCount && product.roundCount > 0
    ? lowestPrice.price / product.roundCount
    : null

  const purposeBadge = getPurposeBadge(product.purpose)

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 overflow-hidden">
      <div className="relative">
        <div className="aspect-square relative overflow-hidden bg-gray-50">
          <Image
            src={product.imageUrl || '/placeholder-product.jpg'}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-200"
          />
        </div>

        {/* Premium Badge */}
        {isPremiumRetailer && (
          <div className="absolute top-2 left-2">
            <Badge className="bg-yellow-500 text-yellow-900 flex items-center gap-1">
              <Crown className="h-3 w-3" />
              Premium
            </Badge>
          </div>
        )}

        {/* Relevance Score */}
        {showRelevance && product.relevanceScore !== undefined && product.relevanceScore > 0 && (
          <div className="absolute bottom-2 left-2">
            <Badge className="bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs">
              {product.relevanceScore}% match
            </Badge>
          </div>
        )}

        {/* Quick Actions */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="sm"
            variant="secondary"
            className="h-8 w-8 p-0"
            onClick={() => setShowAlertDialog(true)}
          >
            <Bell className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <CardContent className="p-4">
        <div className="space-y-2">
          {/* Ammo Badges */}
          {(product.caliber || product.grainWeight || product.caseMaterial || purposeBadge) && (
            <div className="flex flex-wrap gap-1.5">
              {product.caliber && (
                <Badge variant="secondary" className="text-xs font-semibold">
                  {product.caliber}
                </Badge>
              )}
              {product.grainWeight && (
                <Badge variant="outline" className="text-xs">
                  {product.grainWeight}gr
                </Badge>
              )}
              {product.caseMaterial && (
                <Badge variant="outline" className="text-xs">
                  {product.caseMaterial}
                </Badge>
              )}
              {purposeBadge && (
                <Badge className={`text-xs ${purposeBadge.className}`}>
                  {purposeBadge.label}
                </Badge>
              )}
            </div>
          )}

          <h3 className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
            {product.name}
          </h3>

          {product.brand && (
            <p className="text-xs text-muted-foreground">{product.brand}</p>
          )}

          {/* Round Count */}
          {product.roundCount && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Package className="h-3 w-3" />
              <span>{product.roundCount} rounds</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <p className="text-lg font-bold text-primary">
                  {formatPrice(lowestPrice.price, lowestPrice.currency)}
                </p>
                {pricePerRound !== null && (
                  <p className="text-xs text-muted-foreground">
                    ({formatPrice(pricePerRound, lowestPrice.currency)}/rd)
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                at {lowestPrice.retailer.name}
              </p>
            </div>

            {product.prices.length > 1 && (
              <Badge variant="outline" className="text-xs">
                +{product.prices.length - 1} more
              </Badge>
            )}
          </div>

          {/* Mock Rating */}
          <div className="flex items-center space-x-1">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-3 w-3 ${
                    i < 4 ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">(4.2)</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 space-y-2">
        <div className="flex space-x-2 w-full">
          <Button size="sm" className="flex-1" asChild>
            <a
              href={lowestPrice.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              Buy Now
            </a>
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => setShowAlertDialog(true)}
          >
            <Bell className="h-3 w-3 mr-1" />
            Alert
          </Button>
        </div>

        {!lowestPrice.inStock && (
          <p className="text-xs text-destructive text-center">Out of Stock</p>
        )}
      </CardFooter>

      <CreateAlertDialog
        product={product}
        open={showAlertDialog}
        onOpenChange={setShowAlertDialog}
      />
    </Card>
  )
}
