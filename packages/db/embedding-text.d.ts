/**
 * Shared embedding text builder
 *
 * Used by both API (embedding-service.ts) and Harvester (embedding/worker.ts)
 * to ensure consistent embedding text generation.
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
export function buildProductText(product: ProductForEmbedding): string
