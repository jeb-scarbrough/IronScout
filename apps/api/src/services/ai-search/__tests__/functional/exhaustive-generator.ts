import type { ExplicitFilters } from '../../search-service'
import type { FilterDimension } from './search-filter-catalog'

export function countExhaustiveFilterCombos(dimensions: FilterDimension[]): number {
  return dimensions.reduce((count, dim) => count * dim.values.length, 1)
}

export function* generateExhaustiveFilterCombos(
  dimensions: FilterDimension[]
): Generator<ExplicitFilters> {
  const current: ExplicitFilters = {}

  function* walk(index: number): Generator<ExplicitFilters> {
    if (index >= dimensions.length) {
      yield { ...current }
      return
    }

    const dim = dimensions[index]
    for (const value of dim.values) {
      if (value === undefined) {
        delete current[dim.key]
      } else {
        current[dim.key] = value as never
      }
      yield* walk(index + 1)
    }
  }

  yield* walk(0)
}
