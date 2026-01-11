import { createHash } from 'crypto'

export function generateSkuHash(title: string, upc?: string, sku?: string): string {
  const components = [
    title.toLowerCase().trim(),
    upc || '',
    sku || '',
  ]

  const hash = createHash('sha256')
    .update(components.join('|'))
    .digest('hex')

  return hash.substring(0, 32)
}

export function generateContentHash(record: {
  price?: number
  inStock?: boolean
  description?: string
  imageUrl?: string
  caliber?: string
  grainWeight?: number
  roundCount?: number
  brand?: string
  bulletType?: string
  caseType?: string
}): string {
  const components = [
    record.price != null ? String(record.price) : '',
    record.inStock != null ? String(record.inStock) : '',
    record.description || '',
    record.imageUrl || '',
    record.caliber || '',
    record.grainWeight != null ? String(record.grainWeight) : '',
    record.roundCount != null ? String(record.roundCount) : '',
    record.brand || '',
    record.bulletType || '',
    record.caseType || '',
  ]

  const hash = createHash('sha256')
    .update(components.join('|'))
    .digest('hex')

  return hash.substring(0, 32)
}
