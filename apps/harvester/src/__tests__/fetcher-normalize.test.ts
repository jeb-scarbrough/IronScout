import { describe, it, expect } from 'vitest'
import { safeExtractArray } from '../utils/arrays'

describe('safeExtractArray', () => {
  it('returns array as-is', () => {
    const items = [{ id: 1 }, { id: 2 }]
    expect(safeExtractArray(items)).toEqual(items)
  })

  it('returns products array when present', () => {
    const products = [{ id: 'a' }]
    expect(safeExtractArray({ products, foo: 'bar' })).toEqual(products)
  })

  it('returns items array when present', () => {
    const items = [{ id: 'x' }]
    expect(safeExtractArray({ items })).toEqual(items)
  })

  it('returns data array when present', () => {
    const data = [{ id: 'y' }]
    expect(safeExtractArray({ data })).toEqual(data)
  })

  it('returns results array when present', () => {
    const results = [{ id: 'z' }]
    expect(safeExtractArray({ results })).toEqual(results)
  })

  it('fails closed ([]) when products/items are not arrays', () => {
    expect(safeExtractArray({ items: { not: 'iterable' } })).toEqual([])
    expect(safeExtractArray({ products: { also: 'not iterable' } })).toEqual([])
  })

  it('fails closed ([]) for null/undefined', () => {
    expect(safeExtractArray(null)).toEqual([])
    expect(safeExtractArray(undefined)).toEqual([])
  })

  it('fails closed ([]) for primitives', () => {
    expect(safeExtractArray('string')).toEqual([])
    expect(safeExtractArray(123)).toEqual([])
  })
})
