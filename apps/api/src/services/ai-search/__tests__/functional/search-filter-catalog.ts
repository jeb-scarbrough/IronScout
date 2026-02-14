import type { ExplicitFilters } from '../../search-service'

export interface FilterDimension {
  key: keyof ExplicitFilters
  values: Array<ExplicitFilters[keyof ExplicitFilters] | undefined>
}

// Keep matrix dimensions binary (unset/set) for fast pairwise generation in CI.
export const FUNCTIONAL_FILTER_DIMENSIONS: FilterDimension[] = [
  { key: 'caliber', values: [undefined, '9mm'] },
  { key: 'purpose', values: [undefined, 'Target'] },
  { key: 'brand', values: [undefined, 'Federal'] },
  { key: 'caseMaterial', values: [undefined, 'Brass'] },
  { key: 'minGrain', values: [undefined, 115] },
  { key: 'maxGrain', values: [undefined, 124] },
  { key: 'bulletType', values: [undefined, 'FMJ'] },
  { key: 'pressureRating', values: [undefined, 'STANDARD'] },
  { key: 'isSubsonic', values: [undefined, true] },
  { key: 'shortBarrelOptimized', values: [undefined, true] },
  { key: 'suppressorSafe', values: [undefined, true] },
  { key: 'lowFlash', values: [undefined, true] },
  { key: 'lowRecoil', values: [undefined, true] },
  { key: 'matchGrade', values: [undefined, true] },
  { key: 'controlledExpansion', values: [undefined, true] },
  { key: 'minVelocity', values: [undefined, 1000] },
  { key: 'maxVelocity', values: [undefined, 1200] },
  { key: 'minPrice', values: [undefined, 0.3] },
  { key: 'maxPrice', values: [undefined, 1.0] },
  { key: 'inStock', values: [undefined, true] },
]
