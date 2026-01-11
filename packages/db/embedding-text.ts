/**
 * Shared embedding text builder
 *
 * Used by both API (embedding-service.ts) and Harvester (embedding/worker.ts)
 * to ensure consistent embedding text generation.
 *
 * IMPORTANT: Any changes here affect embedding quality across the platform.
 * After changes, existing embeddings may need to be regenerated.
 */

export interface ProductForEmbedding {
  name: string
  description?: string | null
  brand?: string | null
  caliber?: string | null
  grainWeight?: number | null
  caseMaterial?: string | null
  purpose?: string | null
  category?: string | null
}

/**
 * Build a rich text representation of a product for embedding generation.
 *
 * The text is structured to prioritize important attributes (name, brand, caliber)
 * while including semantic enrichment for common use cases.
 *
 * @param product - Product attributes to include in embedding text
 * @returns Newline-separated text suitable for embedding
 */
export function buildProductText(product: ProductForEmbedding): string {
  const parts: string[] = []

  // Product name is most important
  parts.push(product.name)

  // Add structured attributes
  if (product.brand) {
    parts.push(`Brand: ${product.brand}`)
  }

  if (product.caliber) {
    parts.push(`Caliber: ${product.caliber}`)
  }

  if (product.grainWeight) {
    parts.push(`Grain weight: ${product.grainWeight}gr`)
  }

  if (product.caseMaterial) {
    parts.push(`Case: ${product.caseMaterial}`)
  }

  if (product.purpose) {
    parts.push(`Use: ${product.purpose}`)

    // Add semantic enrichment based on purpose
    if (product.purpose === 'Defense') {
      parts.push('self-defense home protection carry concealed')
    } else if (product.purpose === 'Hunting') {
      parts.push('game hunting deer elk hog varmint')
    } else if (product.purpose === 'Target') {
      parts.push('target practice range training plinking competition')
    }
  }

  if (product.category) {
    parts.push(`Category: ${product.category}`)
  }

  // Description last (can be verbose)
  if (product.description) {
    parts.push(product.description)
  }

  return parts.join('\n')
}
