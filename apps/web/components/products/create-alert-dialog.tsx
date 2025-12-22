'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { saveItem, type Product } from '@/lib/api'
import { X, Bell, TrendingDown, Package } from 'lucide-react'
import { toast } from 'sonner'

interface SaveItemDialogProps {
  product: Product
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Save Item Dialog (ADR-011)
 *
 * Simplified save flow - just save the item with default notifications.
 * Users can customize notification preferences in the Saved Items Manager.
 */
export function SaveItemDialog({ product, open, onOpenChange }: SaveItemDialogProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    setError(null)

    const token = (session as any)?.accessToken
    if (!token) {
      router.push('/api/auth/signin')
      return
    }

    try {
      setLoading(true)
      const result = await saveItem(token, product.id)

      if (result._meta.wasExisting) {
        toast.info('Already saved', {
          description: 'This item is already in your saved items.',
          action: {
            label: 'View Saved',
            onClick: () => router.push('/dashboard/saved'),
          },
        })
      } else {
        toast.success('Item saved!', {
          description: 'You\'ll be notified when the price drops or it comes back in stock.',
          action: {
            label: 'Manage Alerts',
            onClick: () => router.push('/dashboard/saved'),
          },
        })
      }
      onOpenChange(false)
    } catch (error: any) {
      toast.error(error.message || 'Failed to save item')
      setError(error.message || 'Failed to save item')
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  const currentPrice = product.prices[0]?.price

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="relative">
          <button
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
          <CardTitle>Save Item</CardTitle>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {product.name}
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-200">
              {error}
            </div>
          )}

          {/* Current price info */}
          {currentPrice && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Current lowest price</p>
              <p className="text-2xl font-bold">${currentPrice.toFixed(2)}</p>
            </div>
          )}

          {/* What you'll get */}
          <div className="space-y-3">
            <p className="text-sm font-medium">You'll be notified when:</p>

            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <TrendingDown className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium">Price Drops</p>
                <p className="text-sm text-muted-foreground">
                  Alert when price drops by 5% or more
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 border rounded-lg">
              <Package className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium">Back in Stock</p>
                <p className="text-sm text-muted-foreground">
                  Alert when this item is available again
                </p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            You can customize notification preferences in your Saved Items.
          </p>
        </CardContent>

        <CardFooter className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={loading} className="flex-1">
            <Bell className="h-4 w-4 mr-2" />
            {loading ? 'Saving...' : 'Save & Track'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

/**
 * @deprecated Use SaveItemDialog instead
 */
export const CreateAlertDialog = SaveItemDialog
