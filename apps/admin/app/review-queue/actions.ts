'use server';

/**
 * Review Queue Server Actions
 *
 * These actions handle linking source products to canonical products.
 *
 * CONCURRENCY HANDLING:
 * - All mutations use conditional updates with status guards
 * - `updateMany` with `WHERE status IN (...)` ensures atomic check-and-update
 * - If another admin modifies the same record, count will be 0 and action fails gracefully
 * - `createAndLinkProduct` uses transaction with double-check for race condition protection
 * - All actions return user-friendly error if concurrent modification detected
 *
 * AUDIT LOGGING:
 * - All actions call `logAdminAction` before returning success
 * - Evidence JSON is preserved and augmented with manual block containing actor, timestamp, action
 * - See ADR-010 for operational audit requirements
 */

import { prisma } from '@ironscout/db';
import { revalidatePath } from 'next/cache';
import { getAdminSession, logAdminAction } from '@/lib/auth';
import { loggers } from '@/lib/logger';

const log = loggers.admin;

/** Statuses that are valid for review queue actions */
const REVIEWABLE_STATUSES = ['NEEDS_REVIEW', 'UNMATCHED'] as const;

interface CreateProductInput {
  name: string;
  brandNorm?: string;
  caliberNorm?: string;
  grainWeight?: number;
  roundCount?: number;
  upcNorm?: string;
}

/**
 * Link a source product to an existing canonical product
 *
 * Guards:
 * - Only allows update if current status is NEEDS_REVIEW or UNMATCHED
 * - Preserves existing resolver evidence, adds manual block
 */
export async function linkToProduct(
  sourceProductId: string,
  productId: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // Verify both exist and check current status
    const [link, product] = await Promise.all([
      prisma.product_links.findUnique({ where: { sourceProductId } }),
      prisma.products.findUnique({ where: { id: productId } }),
    ]);

    if (!link) {
      return { success: false, error: 'Product link not found' };
    }

    if (!product) {
      return { success: false, error: 'Product not found' };
    }

    // Status guard: only allow updates from reviewable states
    if (!REVIEWABLE_STATUSES.includes(link.status as typeof REVIEWABLE_STATUSES[number])) {
      return {
        success: false,
        error: `Cannot modify link with status ${link.status}. Already resolved.`,
      };
    }

    // Preserve existing evidence and add manual block
    const existingEvidence = (link.evidence as Record<string, unknown>) ?? {};

    // Conditional update with status guard for race condition protection
    const updated = await prisma.product_links.updateMany({
      where: {
        sourceProductId,
        status: { in: ['NEEDS_REVIEW', 'UNMATCHED'] },
      },
      data: {
        productId,
        matchType: 'MANUAL',
        status: 'MATCHED',
        reasonCode: null,
        confidence: 1.0,
        resolverVersion: 'MANUAL',
        resolvedAt: new Date(),
        evidence: {
          ...existingEvidence,
          manual: {
            actor: session.email,
            timestamp: new Date().toISOString(),
            action: 'LINK_TO_EXISTING',
            productId,
            previousStatus: link.status,
          },
        },
      },
    });

    if (updated.count === 0) {
      return {
        success: false,
        error: 'Link was modified by another process. Please refresh and try again.',
      };
    }

    await logAdminAction(session.userId, 'MANUAL_LINK_PRODUCT', {
      resource: 'product_links',
      resourceId: sourceProductId,
      newValue: {
        productId,
        productName: product.name,
      },
    });

    log.info('Manual link created', {
      sourceProductId,
      productId,
      actor: session.email,
    });

    revalidatePath('/review-queue');
    return { success: true };
  } catch (error) {
    log.error('Failed to link product', { sourceProductId, productId }, error);
    return { success: false, error: 'Failed to link product' };
  }
}

/**
 * Create a new canonical product and link the source product to it
 *
 * Note: This is an authorized exception to "resolver-only product creation"
 * for NEEDS_REVIEW items that require human intervention. See ADR-XXX.
 *
 * Guards:
 * - Only allows update if current status is NEEDS_REVIEW or UNMATCHED
 * - Preserves existing resolver evidence, adds manual block
 */
export async function createAndLinkProduct(
  sourceProductId: string,
  productData: CreateProductInput
): Promise<{ success: boolean; productId?: string; error?: string }> {
  const session = await getAdminSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // Verify source product and link exist, check current status
    const link = await prisma.product_links.findUnique({
      where: { sourceProductId },
      include: { source_products: true },
    });

    if (!link) {
      return { success: false, error: 'Product link not found' };
    }

    if (!link.source_products) {
      return { success: false, error: 'Source product not found' };
    }

    // Status guard: only allow updates from reviewable states
    if (!REVIEWABLE_STATUSES.includes(link.status as typeof REVIEWABLE_STATUSES[number])) {
      return {
        success: false,
        error: `Cannot modify link with status ${link.status}. Already resolved.`,
      };
    }

    // Preserve existing evidence
    const existingEvidence = (link.evidence as Record<string, unknown>) ?? {};

    // Generate canonical key
    const canonicalKey = productData.upcNorm
      ? `UPC:${productData.upcNorm}`
      : `MANUAL:${Date.now()}`;

    // Create product and update link in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Double-check status hasn't changed (race condition guard)
      const currentLink = await tx.product_links.findUnique({
        where: { sourceProductId },
        select: { status: true },
      });

      if (!currentLink || !REVIEWABLE_STATUSES.includes(currentLink.status as typeof REVIEWABLE_STATUSES[number])) {
        throw new Error('RACE_CONDITION');
      }

      // Create the canonical product
      const product = await tx.products.create({
        data: {
          name: productData.name,
          category: 'ammunition',
          canonicalKey,
          brandNorm: productData.brandNorm,
          caliberNorm: productData.caliberNorm,
          grainWeight: productData.grainWeight,
          roundCount: productData.roundCount,
          upcNorm: productData.upcNorm,
        },
      });

      // Update the product_link with merged evidence
      await tx.product_links.update({
        where: { sourceProductId },
        data: {
          productId: product.id,
          matchType: 'MANUAL',
          status: 'CREATED',
          reasonCode: null,
          confidence: 1.0,
          resolverVersion: 'MANUAL',
          resolvedAt: new Date(),
          evidence: {
            ...existingEvidence,
            manual: {
              actor: session.email,
              timestamp: new Date().toISOString(),
              action: 'CREATE_AND_LINK',
              productId: product.id,
              productName: productData.name,
              productBrand: productData.brandNorm ?? null,
              productCaliber: productData.caliberNorm ?? null,
              productGrain: productData.grainWeight ?? null,
              productRoundCount: productData.roundCount ?? null,
              productUpc: productData.upcNorm ?? null,
              previousStatus: link.status,
            },
          },
        },
      });

      return product;
    });

    await logAdminAction(session.userId, 'MANUAL_CREATE_PRODUCT', {
      resource: 'products',
      resourceId: result.id,
      newValue: {
        sourceProductId,
        productName: productData.name,
        productBrand: productData.brandNorm ?? null,
        productCaliber: productData.caliberNorm ?? null,
        productGrain: productData.grainWeight ?? null,
        productRoundCount: productData.roundCount ?? null,
        productUpc: productData.upcNorm ?? null,
      },
    });

    log.info('Manual product created and linked', {
      sourceProductId,
      productId: result.id,
      actor: session.email,
    });

    revalidatePath('/review-queue');
    return { success: true, productId: result.id };
  } catch (error) {
    if (error instanceof Error && error.message === 'RACE_CONDITION') {
      return {
        success: false,
        error: 'Link was modified by another process. Please refresh and try again.',
      };
    }
    log.error('Failed to create and link product', { sourceProductId, productData }, error);
    return { success: false, error: 'Failed to create product' };
  }
}

/**
 * Skip a review item - marks as SKIPPED terminal state
 *
 * Guards:
 * - Only allows update if current status is NEEDS_REVIEW or UNMATCHED
 * - Preserves existing resolver evidence, adds skipped block
 */
export async function skipReview(
  sourceProductId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    // Verify exists and check current status
    const link = await prisma.product_links.findUnique({
      where: { sourceProductId },
    });

    if (!link) {
      return { success: false, error: 'Product link not found' };
    }

    // Status guard: only allow updates from reviewable states
    if (!REVIEWABLE_STATUSES.includes(link.status as typeof REVIEWABLE_STATUSES[number])) {
      return {
        success: false,
        error: `Cannot modify link with status ${link.status}. Already resolved.`,
      };
    }

    // Preserve existing evidence and add skipped block
    const existingEvidence = (link.evidence as Record<string, unknown>) ?? {};

    // Conditional update with status guard for race condition protection
    const updated = await prisma.product_links.updateMany({
      where: {
        sourceProductId,
        status: { in: ['NEEDS_REVIEW', 'UNMATCHED'] },
      },
      data: {
        status: 'SKIPPED',
        resolvedAt: new Date(),
        evidence: {
          ...existingEvidence,
          skipped: {
            actor: session.email,
            timestamp: new Date().toISOString(),
            reason,
            previousStatus: link.status,
          },
        },
      },
    });

    if (updated.count === 0) {
      return {
        success: false,
        error: 'Link was modified by another process. Please refresh and try again.',
      };
    }

    await logAdminAction(session.userId, 'SKIP_REVIEW', {
      resource: 'product_links',
      resourceId: sourceProductId,
      newValue: { reason, status: 'SKIPPED' },
    });

    log.info('Review skipped', {
      sourceProductId,
      reason,
      actor: session.email,
      newStatus: 'SKIPPED',
    });

    revalidatePath('/review-queue');
    return { success: true };
  } catch (error) {
    log.error('Failed to skip review', { sourceProductId, reason }, error);
    return { success: false, error: 'Failed to skip review' };
  }
}
