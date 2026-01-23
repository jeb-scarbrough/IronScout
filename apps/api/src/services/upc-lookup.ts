/**
 * UPC Lookup Service
 *
 * Provides product lookup by UPC code for barcode scanning feature.
 * Queries both canonical products (upcNorm) and source_product_identifiers.
 */

import { prisma } from '@ironscout/db'
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
 * Normalize a UPC code to standard 12-digit format
 * - Strips non-numeric characters
 * - Handles EAN-13 (removes leading 0 if present)
 * - Zero-pads shorter codes
 */
export function normalizeUpc(upc: string): string | null {
  // Strip all non-numeric characters
  const digits = upc.replace(/\D/g, '')

  if (digits.length === 0) {
    return null
  }

  // Handle EAN-13 (13 digits) - if starts with 0, it's likely a UPC-A with check digit
  if (digits.length === 13 && digits.startsWith('0')) {
    return digits.slice(1) // Remove leading 0 to get 12-digit UPC-A
  }

  // Handle UPC-A (12 digits)
  if (digits.length === 12) {
    return digits
  }

  // Handle UPC-E (8 digits) - expand to 12 digits
  if (digits.length === 8) {
    return expandUpcE(digits)
  }

  // Handle short codes - zero-pad to 12 digits
  if (digits.length < 12) {
    return digits.padStart(12, '0')
  }

  // Longer codes are invalid UPCs
  return null
}

/**
 * Expand UPC-E (8 digit) to UPC-A (12 digit)
 */
function expandUpcE(upcE: string): string {
  if (upcE.length !== 8) {
    return upcE.padStart(12, '0')
  }

  const numberSystem = upcE[0]
  const lastDigit = upcE[6]
  let manufacturer = ''
  let product = ''

  // UPC-E to UPC-A conversion rules
  switch (lastDigit) {
    case '0':
    case '1':
    case '2':
      manufacturer = upcE.slice(1, 3) + lastDigit + '00'
      product = '00' + upcE.slice(3, 6)
      break
    case '3':
      manufacturer = upcE.slice(1, 4) + '00'
      product = '000' + upcE.slice(4, 6)
      break
    case '4':
      manufacturer = upcE.slice(1, 5) + '0'
      product = '0000' + upcE[5]
      break
    default:
      manufacturer = upcE.slice(1, 6)
      product = '0000' + lastDigit
  }

  return numberSystem + manufacturer + product + upcE[7]
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
  const normalizedUpc = normalizeUpc(upc)

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
