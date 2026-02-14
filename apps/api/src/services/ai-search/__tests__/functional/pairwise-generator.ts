import type { ExplicitFilters } from '../../search-service'
import type { FilterDimension } from './search-filter-catalog'

const UNSET = '__UNSET__' as const
type NormalizedValue = ExplicitFilters[keyof ExplicitFilters] | typeof UNSET

interface PairRequirement {
  key: string
  leftDim: number
  leftValue: NormalizedValue
  rightDim: number
  rightValue: NormalizedValue
}

function normalize(value: ExplicitFilters[keyof ExplicitFilters] | undefined): NormalizedValue {
  return value === undefined ? UNSET : value
}

function denormalize(value: NormalizedValue): ExplicitFilters[keyof ExplicitFilters] | undefined {
  return value === UNSET ? undefined : value
}

function valueToken(value: NormalizedValue): string {
  return value === UNSET ? UNSET : JSON.stringify(value)
}

function pairKey(
  leftDim: number,
  leftValue: NormalizedValue,
  rightDim: number,
  rightValue: NormalizedValue
): string {
  if (leftDim < rightDim) {
    return `${leftDim}:${valueToken(leftValue)}|${rightDim}:${valueToken(rightValue)}`
  }

  return `${rightDim}:${valueToken(rightValue)}|${leftDim}:${valueToken(leftValue)}`
}

function buildPairUniverse(dimensions: FilterDimension[]): Map<string, PairRequirement> {
  const requirements = new Map<string, PairRequirement>()

  for (let i = 0; i < dimensions.length; i++) {
    const leftValues = dimensions[i].values.map(v => normalize(v as any))

    for (let j = i + 1; j < dimensions.length; j++) {
      const rightValues = dimensions[j].values.map(v => normalize(v as any))

      for (const leftValue of leftValues) {
        for (const rightValue of rightValues) {
          const key = pairKey(i, leftValue, j, rightValue)
          requirements.set(key, {
            key,
            leftDim: i,
            leftValue,
            rightDim: j,
            rightValue,
          })
        }
      }
    }
  }

  return requirements
}

function collectCoverage(row: NormalizedValue[]): string[] {
  const keys: string[] = []

  for (let i = 0; i < row.length; i++) {
    for (let j = i + 1; j < row.length; j++) {
      keys.push(pairKey(i, row[i], j, row[j]))
    }
  }

  return keys
}

function chooseBestValue(
  row: NormalizedValue[],
  dimIndex: number,
  assignedDimensions: number[],
  dimensions: FilterDimension[],
  uncovered: Set<string>
): NormalizedValue {
  let bestValue = normalize(dimensions[dimIndex].values[0] as any)
  let bestScore = -1

  for (const rawValue of dimensions[dimIndex].values) {
    const candidate = normalize(rawValue as any)
    let score = 0

    for (const assignedDim of assignedDimensions) {
      const key = pairKey(dimIndex, candidate, assignedDim, row[assignedDim])
      if (uncovered.has(key)) {
        score++
      }
    }

    if (score > bestScore) {
      bestScore = score
      bestValue = candidate
    }
  }

  return bestValue
}

function rowToFilters(row: NormalizedValue[], dimensions: FilterDimension[]): ExplicitFilters {
  const filters: ExplicitFilters = {}

  for (let i = 0; i < row.length; i++) {
    const value = denormalize(row[i])
    if (value !== undefined) {
      filters[dimensions[i].key] = value as never
    }
  }

  return filters
}

export function generatePairwiseFilterCombos(dimensions: FilterDimension[]): ExplicitFilters[] {
  const allRequirements = buildPairUniverse(dimensions)
  const uncovered = new Set<string>(allRequirements.keys())
  const selected: ExplicitFilters[] = []

  while (uncovered.size > 0) {
    const seedKey = uncovered.values().next().value as string
    const seed = allRequirements.get(seedKey)

    if (!seed) break

    const row = new Array<NormalizedValue>(dimensions.length).fill(UNSET)
    row[seed.leftDim] = seed.leftValue
    row[seed.rightDim] = seed.rightValue

    const assigned = [seed.leftDim, seed.rightDim]
    const assignedSet = new Set<number>(assigned)

    for (let dimIndex = 0; dimIndex < dimensions.length; dimIndex++) {
      if (assignedSet.has(dimIndex)) continue
      row[dimIndex] = chooseBestValue(row, dimIndex, assigned, dimensions, uncovered)
      assigned.push(dimIndex)
      assignedSet.add(dimIndex)
    }

    for (const coveredKey of collectCoverage(row)) {
      uncovered.delete(coveredKey)
    }

    selected.push(rowToFilters(row, dimensions))
  }

  return selected
}
