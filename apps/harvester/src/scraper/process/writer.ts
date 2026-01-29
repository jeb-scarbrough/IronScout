/**
 * Scrape Writer
 *
 * Per scraper-framework-01 spec v0.5 §9.2, §10.2
 *
 * Writes scraped offers to:
 * 1. source_products table (upsert by identityKey)
 * 2. prices table (append with provenance)
 * 3. source_product_identifiers table (for UPC etc.)
 *
 * Key design decisions:
 * - source_product_id precedence: explicit link > identityKey upsert
 * - All prices have ingestionRunType='SCRAPE' per ADR-015
 * - Prices are in cents internally, converted to Decimal on write
 */

import { Decimal } from '@ironscout/db/generated/prisma'
import { prisma } from '@ironscout/db'
import type { ScrapedOffer } from '../types.js'
import { mapAvailabilityToInStock } from '../types.js'
import type { Logger } from '@ironscout/logger'

/**
 * Target information for a scrape write.
 * Includes optional source_product_id for price refresh scenarios.
 */
export interface ScrapeTarget {
  id: string
  sourceProductId: string | null
}

/**
 * Result of writing a scraped offer.
 */
export interface WriteResult {
  success: boolean
  sourceProductId: string
  priceId: string
  error?: string
}

/**
 * Convert cents (integer) to Decimal for database write.
 */
function centsToDecimal(cents: number): Decimal {
  return new Decimal(cents).div(100)
}

/**
 * Resolve source_product for a scraped offer.
 *
 * PRECEDENCE (per spec §9.2):
 * 1. If scrape_targets.source_product_id is set → use it directly (price refresh)
 * 2. Otherwise → upsert by (source_id, identity_key)
 *
 * RECONCILIATION:
 * - If source_product_id is set AND identityKey differs from existing record:
 *   - Log warning (potential data drift)
 *   - Use source_product_id (it was explicitly linked)
 *   - DO NOT update the existing record's identityKey
 */
async function resolveSourceProduct(
  offer: ScrapedOffer,
  target: ScrapeTarget,
  logger: Logger
): Promise<string> {
  // Case 1: Explicit source_product_id (price refresh scenario)
  if (target.sourceProductId) {
    const existing = await prisma.source_products.findUnique({
      where: { id: target.sourceProductId },
      select: { id: true, identityKey: true },
    })

    if (!existing) {
      // source_product was deleted - fall back to upsert
      logger.warn('source_product_id not found, falling back to identityKey upsert', {
        targetId: target.id,
        sourceProductId: target.sourceProductId,
      })
      return upsertByIdentityKey(offer, logger)
    }

    // Reconciliation check
    if (existing.identityKey !== offer.identityKey) {
      logger.warn('identityKey mismatch on linked source_product', {
        targetId: target.id,
        sourceProductId: target.sourceProductId,
        existingIdentityKey: existing.identityKey,
        offerIdentityKey: offer.identityKey,
      })
      // Use the linked source_product anyway - explicit link takes precedence
    }

    return target.sourceProductId
  }

  // Case 2: No explicit link - upsert by identityKey
  return upsertByIdentityKey(offer, logger)
}

/**
 * Upsert source_product by (sourceId, identityKey).
 */
async function upsertByIdentityKey(offer: ScrapedOffer, _logger: Logger): Promise<string> {
  const result = await prisma.source_products.upsert({
    where: {
      source_products_source_identity_key_unique: {
        sourceId: offer.sourceId,
        identityKey: offer.identityKey,
      },
    },
    create: {
      sourceId: offer.sourceId,
      identityKey: offer.identityKey,
      title: offer.title,
      url: offer.url,
      brand: offer.brand,
      brandNorm: offer.brand?.toLowerCase().trim(),
      caliber: offer.caliber,
      grainWeight: offer.grainWeight,
      roundCount: offer.roundCount,
      imageUrl: offer.imageUrl,
      normalizedUrl: offer.url, // Already canonical
    },
    update: {
      // Update mutable fields only
      title: offer.title,
      url: offer.url,
      brand: offer.brand,
      brandNorm: offer.brand?.toLowerCase().trim(),
      caliber: offer.caliber,
      grainWeight: offer.grainWeight,
      roundCount: offer.roundCount,
      imageUrl: offer.imageUrl,
      normalizedUrl: offer.url,
      updatedAt: new Date(),
    },
    select: { id: true },
  })

  return result.id
}

/**
 * Write identifiers to source_product_identifiers table.
 */
async function writeIdentifiers(
  sourceProductId: string,
  offer: ScrapedOffer
): Promise<void> {
  // Write UPC if present
  if (offer.upc) {
    await prisma.source_product_identifiers.upsert({
      where: {
        source_product_identifiers_unique: {
          sourceProductId,
          idType: 'UPC',
          idValue: offer.upc,
          namespace: '',
        },
      },
      create: {
        sourceProductId,
        idType: 'UPC',
        idValue: offer.upc,
        namespace: '',
        normalizedValue: offer.upc.replace(/[^0-9]/g, ''),
        isCanonical: true, // UPC is canonical if present
      },
      update: {
        normalizedValue: offer.upc.replace(/[^0-9]/g, ''),
        updatedAt: new Date(),
      },
    })
  }

  // Write SKU if present
  if (offer.retailerSku) {
    await prisma.source_product_identifiers.upsert({
      where: {
        source_product_identifiers_unique: {
          sourceProductId,
          idType: 'SKU',
          idValue: offer.retailerSku,
          namespace: offer.retailerId,
        },
      },
      create: {
        sourceProductId,
        idType: 'SKU',
        idValue: offer.retailerSku,
        namespace: offer.retailerId,
        normalizedValue: offer.retailerSku.toUpperCase().trim(),
        isCanonical: !offer.upc, // Canonical only if no UPC
      },
      update: {
        normalizedValue: offer.retailerSku.toUpperCase().trim(),
        updatedAt: new Date(),
      },
    })
  }
}

/**
 * Write price to prices table with full provenance.
 */
async function writePrice(
  sourceProductId: string,
  offer: ScrapedOffer,
  runId: string
): Promise<string> {
  const result = await prisma.prices.create({
    data: {
      retailerId: offer.retailerId,
      sourceId: offer.sourceId,
      sourceProductId,
      price: centsToDecimal(offer.priceCents),
      currency: offer.currency,
      url: offer.url,
      inStock: mapAvailabilityToInStock(offer.availability),
      observedAt: offer.observedAt,
      shippingCost: offer.shippingCents != null ? centsToDecimal(offer.shippingCents) : null,
      // ADR-015 Provenance
      ingestionRunType: 'SCRAPE',
      ingestionRunId: runId,
    },
    select: { id: true },
  })

  return result.id
}

/**
 * Write a scraped offer to the database.
 *
 * This is the main entry point for the writer module.
 * Handles source_product resolution, identifier writing, and price creation.
 *
 * @param offer - The validated offer to write
 * @param target - The scrape target (may have source_product_id)
 * @param runId - The scrape_runs.id for provenance
 * @param logger - Logger instance
 * @returns WriteResult with IDs of created records
 */
export async function writeScrapeOffer(
  offer: ScrapedOffer,
  target: ScrapeTarget,
  runId: string,
  logger: Logger
): Promise<WriteResult> {
  try {
    // 1. Resolve or upsert source_product
    const sourceProductId = await resolveSourceProduct(offer, target, logger)

    // 2. Write identifiers (UPC, SKU)
    await writeIdentifiers(sourceProductId, offer)

    // 3. Write price record
    const priceId = await writePrice(sourceProductId, offer, runId)

    logger.debug('Wrote scraped offer', {
      sourceProductId,
      priceId,
      identityKey: offer.identityKey,
      priceCents: offer.priceCents,
    })

    return {
      success: true,
      sourceProductId,
      priceId,
    }
  } catch (error) {
    const err = error as Error
    logger.error('Failed to write scraped offer', {
      error: err.message,
      identityKey: offer.identityKey,
      url: offer.url,
    })

    return {
      success: false,
      sourceProductId: '',
      priceId: '',
      error: err.message,
    }
  }
}

/**
 * Update scrape_targets tracking fields after processing.
 */
export async function updateTargetTracking(
  targetId: string,
  success: boolean
): Promise<void> {
  if (success) {
    await prisma.scrape_targets.update({
      where: { id: targetId },
      data: {
        lastScrapedAt: new Date(),
        lastStatus: 'SUCCESS',
        consecutiveFailures: 0,
      },
    })
  } else {
    await prisma.scrape_targets.update({
      where: { id: targetId },
      data: {
        lastScrapedAt: new Date(),
        lastStatus: 'FAILED',
        consecutiveFailures: { increment: 1 },
      },
    })
  }
}

/**
 * Mark a target as BROKEN after too many consecutive failures.
 */
export async function markTargetBroken(targetId: string): Promise<void> {
  await prisma.scrape_targets.update({
    where: { id: targetId },
    data: {
      status: 'BROKEN',
      updatedAt: new Date(),
    },
  })
}

/**
 * Update scrape_runs with final metrics.
 */
export async function finalizeRun(
  runId: string,
  metrics: {
    urlsAttempted: number
    urlsSucceeded: number
    urlsFailed: number
    offersExtracted: number
    offersValid: number
    offersDropped: number
    offersQuarantined: number
    oosNoPriceCount: number
  },
  status: 'SUCCESS' | 'FAILED' | 'QUARANTINED'
): Promise<void> {
  const completedAt = new Date()

  // Calculate derived metrics
  const failureRate = metrics.urlsAttempted > 0
    ? (metrics.urlsFailed - metrics.oosNoPriceCount) / metrics.urlsAttempted
    : null

  const yieldRate = metrics.urlsAttempted > 0
    ? metrics.offersValid / metrics.urlsAttempted
    : null

  const dropRate = metrics.offersExtracted > 0
    ? metrics.offersDropped / metrics.offersExtracted
    : null

  await prisma.scrape_runs.update({
    where: { id: runId },
    data: {
      status,
      completedAt,
      durationMs: completedAt.getTime() - Date.now(), // Will be recalculated
      ...metrics,
      failureRate: failureRate != null ? new Decimal(failureRate) : null,
      yieldRate: yieldRate != null ? new Decimal(yieldRate) : null,
      dropRate: dropRate != null ? new Decimal(dropRate) : null,
    },
  })
}
