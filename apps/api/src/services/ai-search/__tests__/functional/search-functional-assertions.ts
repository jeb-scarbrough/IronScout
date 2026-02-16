import type { ExplicitFilters } from '../../search-service'
import type { SyntheticSearchProduct } from './search-functional-fixtures'

function containsInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase())
}

function expandCaliberFilter(caliber: string): string[] {
  if (caliber.includes('/')) {
    return caliber
      .split('/')
      .map(s => s.trim())
      .filter(Boolean)
  }
  return [caliber]
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  return undefined
}

function matchScalar(product: SyntheticSearchProduct, field: string, expected: unknown): boolean {
  const actual = (product as Record<string, unknown>)[field]
  if (typeof expected === 'boolean') return actual === expected
  if (typeof expected === 'string') return actual === expected
  return false
}

function matchCondition(product: SyntheticSearchProduct, condition: Record<string, unknown>): boolean {
  if (condition.OR) {
    const items = condition.OR as Array<Record<string, unknown>>
    return items.some(item => matchCondition(product, item))
  }

  if (condition.AND) {
    const items = condition.AND as Array<Record<string, unknown>>
    return items.every(item => matchCondition(product, item))
  }

  for (const [field, predicate] of Object.entries(condition)) {
    if (field === 'OR' || field === 'AND') continue

    if (predicate && typeof predicate === 'object' && !Array.isArray(predicate)) {
      const p = predicate as Record<string, unknown>
      const actual = (product as Record<string, unknown>)[field]

      if (p.contains != null) {
        if (!containsInsensitive(String(actual ?? ''), String(p.contains))) return false
      }
      if (p.gte != null) {
        const min = asNumber(p.gte)
        if (min == null || typeof actual !== 'number' || actual < min) return false
      }
      if (p.lte != null) {
        const max = asNumber(p.lte)
        if (max == null || typeof actual !== 'number' || actual > max) return false
      }
      continue
    }

    if (!matchScalar(product, field, predicate)) return false
  }

  return true
}

export function matchesWhereClause(product: SyntheticSearchProduct, where: Record<string, unknown>): boolean {
  if (!where || Object.keys(where).length === 0) return true
  return matchCondition(product, where)
}

export function matchesPriceConditions(
  product: SyntheticSearchProduct,
  conditions: { price?: { gte?: number; lte?: number }; inStock?: boolean }
): boolean {
  if (conditions.price?.gte != null && product.currentPrice < conditions.price.gte) {
    return false
  }
  if (conditions.price?.lte != null && product.currentPrice > conditions.price.lte) {
    return false
  }
  if (conditions.inStock && !product.inStock) {
    return false
  }
  return true
}

export function matchesExplicitFilterContract(
  product: SyntheticSearchProduct,
  filters: ExplicitFilters,
  isPremium: boolean
): boolean {
  if (filters.caliber) {
    const parts = expandCaliberFilter(filters.caliber)
    if (!parts.some(part => containsInsensitive(product.caliberNorm, part))) return false
  }

  if (filters.purpose && !containsInsensitive(product.purpose, filters.purpose)) return false
  if (filters.brand && !containsInsensitive(product.brand, filters.brand)) return false
  if (filters.caseMaterial && !containsInsensitive(product.caseMaterial, filters.caseMaterial)) return false

  if (filters.minGrain != null && product.grainWeight < filters.minGrain) return false
  if (filters.maxGrain != null && product.grainWeight > filters.maxGrain) return false

  if (filters.minPrice != null && product.currentPrice < filters.minPrice) return false
  if (filters.maxPrice != null && product.currentPrice > filters.maxPrice) return false
  if (filters.inStock === true && !product.inStock) return false

  if (!isPremium) return true

  if (filters.bulletType && product.bulletType !== filters.bulletType) return false
  if (filters.pressureRating && product.pressureRating !== filters.pressureRating) return false
  if (filters.isSubsonic !== undefined && product.isSubsonic !== filters.isSubsonic) return false

  if (filters.shortBarrelOptimized && !product.shortBarrelOptimized) return false
  // suppressorSafe, lowRecoil, controlledExpansion are soft-removed from
  // buildWhereClause due to limited data coverage — do not assert them here.
  if (filters.lowFlash && !product.lowFlash) return false
  if (filters.matchGrade && !product.matchGrade) return false

  if (filters.minVelocity != null && product.muzzleVelocityFps < filters.minVelocity) return false
  if (filters.maxVelocity != null && product.muzzleVelocityFps > filters.maxVelocity) return false

  return true
}

export function assertReturnedProductsMatchFilters(
  products: SyntheticSearchProduct[],
  filters: ExplicitFilters,
  isPremium: boolean
): void {
  for (const p of products) {
    if (!matchesExplicitFilterContract(p, filters, isPremium)) {
      throw new Error(`Product ${p.id} does not satisfy explicit filter contract`)
    }
  }
}

