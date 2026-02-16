/**
 * UPC Lookup Service
 *
 * Provides product lookup by UPC code for barcode scanning feature.
 * Queries both canonical products (upcNorm) and source_product_identifiers.
 */

import { prisma } from '@ironscout/db'
import { toCanonicalUpc } from '@ironscout/upc'
import { loggers } from '../config/logger'

const log = loggers.products

/**
 * Product data returned from UPC lookup
 */
export interface UpcLookupProduct {
  id: string
  name: string
  caliber: string | null
  brand: string | null
  grainWeight: number | null
  roundCount: number | null
  imageUrl: string | null
}

/**
 * UPC lookup result
 */
export interface UpcLookupResult {
  found: boolean
  product: UpcLookupProduct | null
}

/**
 * Normalize a UPC for lookup purposes.
 *
 * Uses shared canonical normalization to align lookup behavior with
 * resolver/matcher storage in products.upcNorm.
 *
 * @returns Canonical UPC string for DB lookup, or null if invalid
 */
export function normalizeUpcForLookup(upc: string): string | null {
  return toCanonicalUpc(upc)
}

/**
 * Look up a product by UPC code
 *
 * Searches:
 * 1. Canonical products by upcNorm field
 * 2. source_product_identifiers with idType = 'UPC', then joins to canonical product
 *
 * @param upc - The UPC code to look up (raw or normalized)
 * @returns UpcLookupResult with found status and product data if found
 */
export async function lookupByUpc(upc: string): Promise<UpcLookupResult> {
  const normalizedUpc = normalizeUpcForLookup(upc)

  if (!normalizedUpc) {
    log.warn('Invalid UPC format', { upc })
    return { found: false, product: null }
  }

  log.debug('UPC lookup', { rawUpc: upc, normalizedUpc })

  // Strategy 1: Direct lookup via products.upcNorm
  const directMatch = await prisma.products.findFirst({
    where: {
      upcNorm: normalizedUpc,
    },
    select: {
      id: true,
      name: true,
      caliber: true,
      brand: true,
      grainWeight: true,
      roundCount: true,
      imageUrl: true,
    },
  })

  if (directMatch) {
    log.info('UPC lookup: direct match', { upc: normalizedUpc, productId: directMatch.id })
    return {
      found: true,
      product: directMatch,
    }
  }

  // Strategy 2: Lookup via source_product_identifiers -> product_links -> products
  const identifierMatch = await prisma.source_product_identifiers.findFirst({
    where: {
      idType: 'UPC',
      OR: [
        { idValue: normalizedUpc },
        { normalizedValue: normalizedUpc },
      ],
    },
    include: {
      source_products: {
        include: {
          product_links: {
            where: {
              status: { in: ['MATCHED', 'CREATED'] },
            },
            include: {
              products: {
                select: {
                  id: true,
                  name: true,
                  caliber: true,
                  brand: true,
                  grainWeight: true,
                  roundCount: true,
                  imageUrl: true,
                },
              },
            },
          },
        },
      },
    },
  })

  if (identifierMatch?.source_products?.product_links?.products) {
    const product = identifierMatch.source_products.product_links.products
    log.info('UPC lookup: identifier match', { upc: normalizedUpc, productId: product.id })
    return {
      found: true,
      product,
    }
  }

  log.info('UPC lookup: no match', { upc: normalizedUpc })
  return { found: false, product: null }
}
