'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft,
  Info,
  TrendingDown,
  TrendingUp,
  Minus,
  AlertCircle,
  Plus,
  ScanBarcode,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  checkPrice,
  lookupProductByUpc,
  CALIBERS,
  type CaliberValue,
  type PriceCheckResult,
  type PriceClassification,
  type UpcLookupProduct,
  type BulletType,
  BULLET_TYPE_LABELS,
} from '@/lib/api'
import { BarcodeScanner } from '@/components/price-check/barcode-scanner'

/**
 * Price Check Content Component
 *
 * Shared content for price-check functionality used by both:
 * - /price-check (public, MarketingHeader)
 * - /dashboard/price-check (authenticated, sidebar nav)
 *
 * Per mobile_price_check_v1_spec.md:
 * - Mobile-first route for instant price sanity checks
 * - Answers: "Is this price normal, high, or unusually low right now?"
 * - No verdicts or recommendations (BUY/WAIT/SKIP)
 */

type PageState =
  | 'initial' // Show scan button + manual entry link
  | 'scanning' // Camera view active
  | 'looking-up' // Loading after scan
  | 'product-found' // Product card + price entry
  | 'product-not-found' // Error + manual entry fallback
  | 'manual-entry' // Manual caliber + price form
  | 'result' // Price check result

interface PriceCheckContentProps {
  /** Access token for authenticated requests (optional - works without for anonymous) */
  accessToken?: string
}

export function PriceCheckContent({ accessToken }: PriceCheckContentProps) {
  const [pageState, setPageState] = useState<PageState>('initial')

  // Scanned product state
  const [scannedProduct, setScannedProduct] = useState<UpcLookupProduct | null>(null)
  const [boxPrice, setBoxPrice] = useState('')
  const [scannedUpc, setScannedUpc] = useState('')

  // Manual entry state
  const [caliber, setCaliber] = useState<CaliberValue | ''>('')
  const [pricePerRound, setPricePerRound] = useState('')
  const [brand, setBrand] = useState('')
  const [grain, setGrain] = useState('')
  const [roundCount, setRoundCount] = useState('')
  const [caseMaterial, setCaseMaterial] = useState('')
  const [bulletType, setBulletType] = useState<BulletType | ''>('')

  // Result state
  const [result, setResult] = useState<PriceCheckResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Handle barcode scan
  const handleScan = async (code: string) => {
    setScannedUpc(code)
    setPageState('looking-up')
    setError(null)

    try {
      const result = await lookupProductByUpc(code)

      if (result.found && result.product) {
        setScannedProduct(result.product)
        setPageState('product-found')
      } else {
        setPageState('product-not-found')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to lookup product')
      setPageState('product-not-found')
    }
  }

  // Handle price check for scanned product
  const handleScannedPriceCheck = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scannedProduct || !boxPrice) return

    setIsLoading(true)
    setError(null)

    try {
      const totalPrice = parseFloat(boxPrice)
      if (isNaN(totalPrice) || totalPrice <= 0) {
        throw new Error('Please enter a valid price')
      }

      // Calculate price per round from box price
      const roundCount = scannedProduct.roundCount || 1
      const calculatedPricePerRound = totalPrice / roundCount

      // Use the product's caliber for the check
      const productCaliber = mapToCaliber(scannedProduct.caliber)
      if (!productCaliber) {
        throw new Error('Unable to determine caliber for this product')
      }

      const response = await checkPrice(
        {
          caliber: productCaliber,
          pricePerRound: calculatedPricePerRound,
          brand: scannedProduct.brand || undefined,
          grain: scannedProduct.grainWeight || undefined,
          roundCount: scannedProduct.roundCount || undefined,
        },
        accessToken
      )

      setResult(response)
      setPageState('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check price')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle manual price check
  const handleManualPriceCheck = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!caliber || !pricePerRound) return

    setIsLoading(true)
    setError(null)

    try {
      const price = parseFloat(pricePerRound)
      if (isNaN(price) || price <= 0) {
        throw new Error('Please enter a valid price')
      }

      const response = await checkPrice(
        {
          caliber: caliber as CaliberValue,
          pricePerRound: price,
          brand: brand || undefined,
          grain: grain ? parseInt(grain) : undefined,
          roundCount: roundCount ? parseInt(roundCount) : undefined,
          caseMaterial: caseMaterial || undefined,
          bulletType: bulletType || undefined,
        },
        accessToken
      )

      setResult(response)
      setPageState('result')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check price')
    } finally {
      setIsLoading(false)
    }
  }

  const handleReset = () => {
    setResult(null)
    setScannedProduct(null)
    setBoxPrice('')
    setScannedUpc('')
    setCaliber('')
    setPricePerRound('')
    setBrand('')
    setGrain('')
    setRoundCount('')
    setCaseMaterial('')
    setBulletType('')
    setError(null)
    setPageState('initial')
  }

  const handleScanAnother = () => {
    setScannedProduct(null)
    setBoxPrice('')
    setScannedUpc('')
    setError(null)
    setPageState('scanning')
  }

  return (
    <div className="max-w-md mx-auto">
      {pageState === 'initial' && (
        <InitialView
          onStartScan={() => setPageState('scanning')}
          onManualEntry={() => setPageState('manual-entry')}
        />
      )}

      {pageState === 'scanning' && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setPageState('initial')}
        />
      )}

      {pageState === 'looking-up' && (
        <LookingUpView upc={scannedUpc} />
      )}

      {pageState === 'product-found' && scannedProduct && (
        <ProductFoundView
          product={scannedProduct}
          boxPrice={boxPrice}
          setBoxPrice={setBoxPrice}
          onSubmit={handleScannedPriceCheck}
          onScanAnother={handleScanAnother}
          onManualEntry={() => setPageState('manual-entry')}
          isLoading={isLoading}
          error={error}
        />
      )}

      {pageState === 'product-not-found' && (
        <ProductNotFoundView
          upc={scannedUpc}
          onScanAgain={() => setPageState('scanning')}
          onManualEntry={() => setPageState('manual-entry')}
          error={error}
        />
      )}

      {pageState === 'manual-entry' && (
        <ManualEntryForm
          caliber={caliber}
          setCaliber={setCaliber}
          price={pricePerRound}
          setPrice={setPricePerRound}
          brand={brand}
          setBrand={setBrand}
          grain={grain}
          setGrain={setGrain}
          roundCount={roundCount}
          setRoundCount={setRoundCount}
          caseMaterial={caseMaterial}
          setCaseMaterial={setCaseMaterial}
          bulletType={bulletType}
          setBulletType={setBulletType}
          onSubmit={handleManualPriceCheck}
          onBack={() => setPageState('initial')}
          isLoading={isLoading}
          error={error}
        />
      )}

      {pageState === 'result' && result && (
        <PriceCheckResultDisplay result={result} onReset={handleReset} />
      )}
    </div>
  )
}

/**
 * Initial View - Scan button primary, manual entry secondary
 */
function InitialView({
  onStartScan,
  onManualEntry,
}: {
  onStartScan: () => void
  onManualEntry: () => void
}) {
  return (
    <div className="space-y-8 text-center">
      <div className="pt-8">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
          <ScanBarcode className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-xl font-semibold text-white">Check a store price fast</h1>
        <p className="text-sm text-iron-400 mt-2">
          Scan an in-store barcode or enter the box details.
        </p>
      </div>

      <div className="space-y-4">
        <Button onClick={onStartScan} className="w-full h-12 text-base" size="lg">
          <ScanBarcode className="h-5 w-5 mr-2" />
          Scan In-Store Barcode
        </Button>

        <button
          onClick={onManualEntry}
          className="text-sm text-iron-400 hover:text-white underline underline-offset-4 transition-colors"
        >
          or enter box details manually
        </button>
      </div>

      {/* How it works */}
      <div className="pt-6 border-t border-iron-800/50">
        <h2 className="text-sm font-medium text-iron-300 mb-4">How it works</h2>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl font-bold text-primary mb-1">1</div>
            <p className="text-xs text-iron-400">Scan UPC or enter caliber + price</p>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary mb-1">2</div>
            <p className="text-xs text-iron-400">We compare against online prices</p>
          </div>
          <div>
            <div className="text-2xl font-bold text-primary mb-1">3</div>
            <p className="text-xs text-iron-400">See if you're getting a fair deal</p>
          </div>
        </div>
      </div>

      {/* Sample result preview */}
      <div className="pt-4">
        <p className="text-xs text-iron-500 mb-3">Example result:</p>
        <Card className="border-blue-800/50 bg-blue-950/20 text-left">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-900/30 flex items-center justify-center">
                <Minus className="h-5 w-5 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">Typical Price</p>
                <p className="text-xs text-iron-400 mt-0.5">
                  $0.32/rd for 9mm is right in line with online prices
                </p>
                <p className="text-xs text-iron-500 mt-1">
                  Range: $0.28 – $0.38/rd from 15 retailers
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-iron-500 pt-2">
        Based on 50,000+ price points from major retailers.
        <br />
        This is not financial advice.
      </p>
    </div>
  )
}

/**
 * Looking Up View - Loading state after scan
 */
function LookingUpView({ upc }: { upc: string }) {
  return (
    <div className="space-y-6 text-center pt-16">
      <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
      <div>
        <h2 className="text-lg font-medium text-white">Looking up product...</h2>
        <p className="text-sm text-iron-400 mt-1">UPC: {upc}</p>
      </div>
    </div>
  )
}

/**
 * Product Found View - Shows product card + price entry
 */
function ProductFoundView({
  product,
  boxPrice,
  setBoxPrice,
  onSubmit,
  onScanAnother,
  onManualEntry,
  isLoading,
  error,
}: {
  product: UpcLookupProduct
  boxPrice: string
  setBoxPrice: (v: string) => void
  onSubmit: (e: React.FormEvent) => void
  onScanAnother: () => void
  onManualEntry: () => void
  isLoading: boolean
  error: string | null
}) {
  return (
    <div className="space-y-6">
      {/* Product Card */}
      <Card className="bg-iron-900 border-iron-800">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            {product.imageUrl ? (
              <Image
                src={product.imageUrl}
                alt={product.name}
                width={80}
                height={80}
                className="rounded-md object-cover"
              />
            ) : (
              <div className="w-20 h-20 bg-iron-800 rounded-md flex items-center justify-center">
                <ScanBarcode className="h-8 w-8 text-iron-500" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="font-medium text-sm leading-tight line-clamp-2 text-white">
                {product.name}
              </h2>
              <div className="text-xs text-iron-400 mt-1 space-y-0.5">
                {product.brand && <p>{product.brand}</p>}
                {product.caliber && <p>{product.caliber}</p>}
                {product.roundCount && <p>{product.roundCount} rounds</p>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Price Entry Form */}
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="boxPrice" className="text-iron-200">What in-store price are you seeing?</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-iron-500">
              $
            </span>
            <Input
              id="boxPrice"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="14.99"
              value={boxPrice}
              onChange={(e) => setBoxPrice(e.target.value)}
              className="pl-7 text-lg h-12 bg-iron-900 border-iron-700 text-white placeholder:text-iron-500"
              autoFocus
            />
          </div>
          <p className="text-xs text-iron-500">
            Enter the total box price (not price per round)
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={!boxPrice || isLoading}
        >
          {isLoading ? 'Checking...' : 'Check Price'}
        </Button>
      </form>

      <div className="flex justify-center gap-4 text-sm">
        <button
          onClick={onScanAnother}
          className="text-iron-400 hover:text-white underline underline-offset-4 transition-colors"
        >
          Scan different product
        </button>
        <span className="text-iron-600">|</span>
        <button
          onClick={onManualEntry}
          className="text-iron-400 hover:text-white underline underline-offset-4 transition-colors"
        >
          Enter manually
        </button>
      </div>
    </div>
  )
}

/**
 * Product Not Found View
 */
function ProductNotFoundView({
  upc,
  onScanAgain,
  onManualEntry,
  error,
}: {
  upc: string
  onScanAgain: () => void
  onManualEntry: () => void
  error: string | null
}) {
  return (
    <div className="space-y-6 text-center pt-8">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-900/30">
        <AlertCircle className="h-8 w-8 text-amber-400" />
      </div>

      <div>
        <h2 className="text-lg font-medium text-white">Product Not Found</h2>
        <p className="text-sm text-iron-400 mt-2">
          {error || `We don't have this product in our database yet.`}
        </p>
        {upc && (
          <p className="text-xs text-iron-500 mt-1">UPC: {upc}</p>
        )}
      </div>

      <div className="space-y-3">
        <Button onClick={onScanAgain} className="w-full">
          <ScanBarcode className="h-4 w-4 mr-2" />
          Try Scanning Again
        </Button>
        <Button variant="outline" onClick={onManualEntry} className="w-full border-iron-700 text-iron-300 hover:bg-iron-800 hover:text-white">
          Enter Details Manually
        </Button>
      </div>
    </div>
  )
}

/**
 * Manual Entry Form
 */
function ManualEntryForm({
  caliber,
  setCaliber,
  price,
  setPrice,
  brand,
  setBrand,
  grain,
  setGrain,
  roundCount,
  setRoundCount,
  caseMaterial,
  setCaseMaterial,
  bulletType,
  setBulletType,
  onSubmit,
  onBack,
  isLoading,
  error,
}: {
  caliber: CaliberValue | ''
  setCaliber: (v: CaliberValue | '') => void
  price: string
  setPrice: (v: string) => void
  brand: string
  setBrand: (v: string) => void
  grain: string
  setGrain: (v: string) => void
  roundCount: string
  setRoundCount: (v: string) => void
  caseMaterial: string
  setCaseMaterial: (v: string) => void
  bulletType: BulletType | ''
  setBulletType: (v: BulletType | '') => void
  onSubmit: (e: React.FormEvent) => void
  onBack: () => void
  isLoading: boolean
  error: string | null
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-iron-400 hover:text-white hover:bg-iron-800">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-white">Manual Store Price Check</h1>
          <p className="text-sm text-iron-400">
            Enter the details you see on the box
          </p>
        </div>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Caliber - Required */}
        <div className="space-y-2">
          <Label htmlFor="caliber" className="text-iron-200">Caliber *</Label>
          <Select
            value={caliber}
            onValueChange={(v) => setCaliber(v as CaliberValue)}
          >
            <SelectTrigger id="caliber" className="bg-iron-900 border-iron-700 text-white">
              <SelectValue placeholder="Select caliber" />
            </SelectTrigger>
            <SelectContent className="bg-iron-900 border-iron-700">
              {CALIBERS.map((c) => (
                <SelectItem key={c.value} value={c.value} className="text-iron-200 focus:bg-iron-800 focus:text-white">
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Price - Required */}
        <div className="space-y-2">
          <Label htmlFor="price" className="text-iron-200">Price per round *</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-iron-500">
              $
            </span>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0.01"
              max="10"
              placeholder="0.30"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="pl-7 bg-iron-900 border-iron-700 text-white placeholder:text-iron-500"
            />
          </div>
          <p className="text-xs text-iron-500">
            Enter the price per round (e.g., $0.30 for 30 cents/rd)
          </p>
        </div>

        {/* Optional: Brand */}
        <div className="space-y-2">
          <Label htmlFor="brand" className="text-iron-200">Brand (optional)</Label>
          <Input
            id="brand"
            placeholder="e.g., Federal, Winchester"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="bg-iron-900 border-iron-700 text-white placeholder:text-iron-500"
          />
        </div>

        {/* Optional: Grain */}
        <div className="space-y-2">
          <Label htmlFor="grain" className="text-iron-200">Grain weight (optional)</Label>
          <Input
            id="grain"
            type="number"
            min="1"
            max="1000"
            placeholder="e.g., 115, 124, 147"
            value={grain}
            onChange={(e) => setGrain(e.target.value)}
            className="bg-iron-900 border-iron-700 text-white placeholder:text-iron-500"
          />
        </div>

        {/* Optional: Round count */}
        <div className="space-y-2">
          <Label htmlFor="roundCount" className="text-iron-200">Box count (optional)</Label>
          <Input
            id="roundCount"
            type="number"
            min="1"
            max="5000"
            placeholder="e.g., 20, 50, 100"
            value={roundCount}
            onChange={(e) => setRoundCount(e.target.value)}
            className="bg-iron-900 border-iron-700 text-white placeholder:text-iron-500"
          />
        </div>

        {/* Optional: Case material */}
        <div className="space-y-2">
          <Label htmlFor="caseMaterial" className="text-iron-200">Case material (optional)</Label>
          <Input
            id="caseMaterial"
            placeholder="e.g., Brass, Steel, Aluminum"
            value={caseMaterial}
            onChange={(e) => setCaseMaterial(e.target.value)}
            className="bg-iron-900 border-iron-700 text-white placeholder:text-iron-500"
          />
        </div>

        {/* Optional: Bullet type */}
        <div className="space-y-2">
          <Label htmlFor="bulletType" className="text-iron-200">Bullet type (optional)</Label>
          <Select
            value={bulletType}
            onValueChange={(v) => setBulletType(v === '' ? '' : (v as BulletType))}
          >
            <SelectTrigger id="bulletType" className="bg-iron-900 border-iron-700 text-white">
              <SelectValue placeholder="Select bullet type" />
            </SelectTrigger>
            <SelectContent className="bg-iron-900 border-iron-700">
              <SelectItem value="" className="text-iron-200 focus:bg-iron-800 focus:text-white">
                Not specified
              </SelectItem>
              {Object.entries(BULLET_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value} className="text-iron-200 focus:bg-iron-800 focus:text-white">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={!caliber || !price || isLoading}
        >
          {isLoading ? 'Checking...' : 'Check Price'}
        </Button>
      </form>

      <p className="text-xs text-center text-iron-500">
        Prices compared against recent online listings from major retailers.
        <br />
        This is not financial advice.
      </p>
    </div>
  )
}

/**
 * Price Check Result Display
 */
function PriceCheckResultDisplay({
  result,
  onReset,
}: {
  result: PriceCheckResult
  onReset: () => void
}) {
  const { classification, message, context, freshnessIndicator, caliber, enteredPricePerRound } =
    result

  return (
    <div className="space-y-6">
      {/* Classification Result */}
      <Card className={getClassificationCardClass(classification)}>
        <CardContent className="pt-6">
          <div className="text-center">
            <ClassificationIcon classification={classification} />
            <h2 className="text-2xl font-bold mt-3 text-white">{message}</h2>
            <p className="text-lg mt-1 text-iron-300">
              ${enteredPricePerRound.toFixed(2)}/rd for{' '}
              {CALIBERS.find((c) => c.value === caliber)?.label || caliber}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Context Information */}
      {context.pricePointCount > 0 && (
        <Card className="bg-iron-900 border-iron-800">
          <CardContent className="pt-6">
            <h3 className="font-medium mb-3 text-white">Recent Online Range</h3>
            <div className="flex items-center justify-between text-sm">
              <span className="text-iron-400">Low</span>
              <span className="text-iron-400">High</span>
            </div>
            <div className="relative h-3 bg-iron-800 rounded-full mt-1 mb-2">
              {/* Range bar */}
              <div
                className="absolute inset-y-0 bg-primary/30 rounded-full"
                style={{ left: '0%', right: '0%' }}
              />
              {/* Position indicator */}
              {context.minPrice !== null && context.maxPrice !== null && (
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full border-2 border-iron-950"
                  style={{
                    left: `${getPositionPercent(enteredPricePerRound, context.minPrice, context.maxPrice)}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              )}
            </div>
            <div className="flex items-center justify-between text-sm font-medium text-white">
              <span>${context.minPrice?.toFixed(2) || '---'}/rd</span>
              <span>${context.maxPrice?.toFixed(2) || '---'}/rd</span>
            </div>

            {/* Freshness indicator */}
            <p className="text-xs text-iron-500 mt-4 flex items-center gap-1">
              <Info className="h-3 w-3" />
              {freshnessIndicator}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="space-y-3">
        <Button onClick={onReset} className="w-full">
          Check Another Price
        </Button>

        {!result._meta.hasGunLocker && (
          <Link href="/dashboard/gun-locker">
            <Button variant="outline" className="w-full border-iron-700 text-iron-300 hover:bg-iron-800 hover:text-white">
              <Plus className="h-4 w-4 mr-2" />
              Add to Gun Locker for personalized results
            </Button>
          </Link>
        )}
      </div>

      <p className="text-xs text-center text-iron-500">
        Price data is for informational purposes only. No guarantees.
      </p>
    </div>
  )
}

function ClassificationIcon({ classification }: { classification: PriceClassification }) {
  switch (classification) {
    case 'LOWER':
      return (
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-900/30">
          <TrendingDown className="h-8 w-8 text-green-400" />
        </div>
      )
    case 'HIGHER':
      return (
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-900/30">
          <TrendingUp className="h-8 w-8 text-red-400" />
        </div>
      )
    case 'TYPICAL':
      return (
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-900/30">
          <Minus className="h-8 w-8 text-blue-400" />
        </div>
      )
    case 'INSUFFICIENT_DATA':
      return (
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-900/30">
          <AlertCircle className="h-8 w-8 text-amber-400" />
        </div>
      )
  }
}

function getClassificationCardClass(classification: PriceClassification): string {
  switch (classification) {
    case 'LOWER':
      return 'border-green-800 bg-green-950/20'
    case 'HIGHER':
      return 'border-red-800 bg-red-950/20'
    case 'TYPICAL':
      return 'border-blue-800 bg-blue-950/20'
    case 'INSUFFICIENT_DATA':
      return 'border-amber-800 bg-amber-950/20'
  }
}

function getPositionPercent(value: number, min: number, max: number): number {
  if (max === min) return 50
  const position = ((value - min) / (max - min)) * 100
  return Math.max(0, Math.min(100, position))
}

/**
 * Map product caliber string to canonical CaliberValue
 */
function mapToCaliber(caliberStr: string | null): CaliberValue | null {
  if (!caliberStr) return null

  const lower = caliberStr.toLowerCase().trim()

  // Direct matches
  for (const c of CALIBERS) {
    if (c.value.toLowerCase() === lower) {
      return c.value
    }
  }

  // Common variations
  const caliberMap: Record<string, CaliberValue> = {
    '9mm': '9mm',
    '9mm luger': '9mm',
    '9mm parabellum': '9mm',
    '9x19': '9mm',
    '9x19mm': '9mm',
    '.45 acp': '.45 ACP',
    '45 acp': '.45 ACP',
    '.45acp': '.45 ACP',
    '.45 auto': '.45 ACP',
    '.40 s&w': '.40 S&W',
    '40 s&w': '.40 S&W',
    '.40sw': '.40 S&W',
    '.380 acp': '.380 ACP',
    '380 acp': '.380 ACP',
    '.380acp': '.380 ACP',
    '.380 auto': '.380 ACP',
    '.22 lr': '.22 LR',
    '22 lr': '.22 LR',
    '.22lr': '.22 LR',
    '.22 long rifle': '.22 LR',
    '.223 rem': '.223/5.56',
    '.223 remington': '.223/5.56',
    '223 rem': '.223/5.56',
    '5.56': '.223/5.56',
    '5.56mm': '.223/5.56',
    '5.56x45': '.223/5.56',
    '5.56 nato': '.223/5.56',
    '.223/5.56': '.223/5.56',
    '.308 win': '.308/7.62x51',
    '.308 winchester': '.308/7.62x51',
    '308 win': '.308/7.62x51',
    '7.62x51': '.308/7.62x51',
    '7.62x51mm': '.308/7.62x51',
    '7.62 nato': '.308/7.62x51',
    '.308/7.62x51': '.308/7.62x51',
    '.30-06': '.30-06',
    '30-06': '.30-06',
    '.30-06 springfield': '.30-06',
    '6.5 creedmoor': '6.5 Creedmoor',
    '6.5mm creedmoor': '6.5 Creedmoor',
    '6.5 cm': '6.5 Creedmoor',
    '7.62x39': '7.62x39',
    '7.62x39mm': '7.62x39',
    '12 gauge': '12ga',
    '12 ga': '12ga',
    '12ga': '12ga',
    '12g': '12ga',
    '20 gauge': '20ga',
    '20 ga': '20ga',
    '20ga': '20ga',
    '20g': '20ga',
  }

  return caliberMap[lower] || null
}
