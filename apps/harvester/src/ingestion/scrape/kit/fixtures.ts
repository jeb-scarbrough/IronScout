import { createHash } from 'node:crypto'
import type { NormalizedScrapeOffer } from '../types.js'

function stableSortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => stableSortObjectKeys(item))
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const sortedKeys = Object.keys(obj).sort((a, b) => a.localeCompare(b))
    const next: Record<string, unknown> = {}
    for (const key of sortedKeys) {
      next[key] = stableSortObjectKeys(obj[key])
    }
    return next
  }
  return value
}

export function sortOffersForHash(offers: NormalizedScrapeOffer[]): NormalizedScrapeOffer[] {
  return [...offers].sort((a, b) => {
    const aTuple = `${a.url}|${a.retailerProductId ?? ''}|${a.retailerSku ?? ''}`
    const bTuple = `${b.url}|${b.retailerProductId ?? ''}|${b.retailerSku ?? ''}`
    return aTuple.localeCompare(bTuple)
  })
}

export function deterministicHash(value: unknown): string {
  const payload = stableSortObjectKeys(value)
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}
