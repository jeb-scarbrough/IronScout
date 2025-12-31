'use server';

import { prisma } from '@ironscout/db';
import { revalidatePath } from 'next/cache';
import { getAdminSession, logAdminAction } from '@/lib/auth';

/**
 * Approve a product suggestion - creates a new CanonicalSku and maps the dealer's SKU
 */
export async function approveSuggestion(suggestionId: string) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const suggestion = await prisma.productSuggestion.findUnique({
      where: { id: suggestionId },
      include: {
        dealer: { select: { businessName: true } },
        dealerSku: { select: { id: true, rawUpc: true } },
      },
    });

    if (!suggestion) {
      return { success: false, error: 'Suggestion not found' };
    }

    if (suggestion.status !== 'PENDING') {
      return { success: false, error: 'Suggestion already processed' };
    }

    // Check for duplicate by name/caliber/grain/packSize/brand
    const existing = await prisma.canonicalSku.findFirst({
      where: {
        OR: [
          // Match by UPC if provided
          suggestion.suggestedUpc ? { upc: suggestion.suggestedUpc } : {},
          // Match by attributes
          {
            caliber: suggestion.caliber,
            grain: suggestion.grain || 0,
            packSize: suggestion.packSize || 1,
            brand: suggestion.brand || '',
          },
        ].filter(o => Object.keys(o).length > 0),
      },
    });

    if (existing) {
      return {
        success: false,
        error: `Similar product already exists: ${existing.name}. Use "Merge" instead.`,
        existingId: existing.id,
      };
    }

    // Create the canonical SKU
    const canonicalSku = await prisma.canonicalSku.create({
      data: {
        name: suggestion.suggestedName,
        upc: suggestion.suggestedUpc || null,
        caliber: suggestion.caliber,
        grain: suggestion.grain || 0,
        packSize: suggestion.packSize || 1,
        brand: suggestion.brand || 'Unknown',
        bulletType: suggestion.bulletType,
        caseType: suggestion.caseType,
      },
    });

    // Update the suggestion
    await prisma.productSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: 'APPROVED',
        resolvedAt: new Date(),
        resolvedBy: session.email,
        canonicalSkuId: canonicalSku.id,
      },
    });

    // Map the dealer's SKU if one was provided
    if (suggestion.dealerSkuId) {
      await prisma.dealerSku.update({
        where: { id: suggestion.dealerSkuId },
        data: {
          canonicalSkuId: canonicalSku.id,
          mappingConfidence: 'HIGH',
          needsReview: false,
          mappedAt: new Date(),
          mappedBy: `admin:${session.email}`,
        },
      });
    }

    await logAdminAction(session.userId, 'APPROVE_PRODUCT_SUGGESTION', {
      resource: 'ProductSuggestion',
      resourceId: suggestionId,
      newValue: {
        canonicalSkuId: canonicalSku.id,
        dealerSkuId: suggestion.dealerSkuId,
      },
    });

    revalidatePath('/product-suggestions');

    return {
      success: true,
      message: `Created "${canonicalSku.name}" and mapped dealer SKU`,
      canonicalSkuId: canonicalSku.id,
    };
  } catch (error) {
    console.error('Failed to approve suggestion:', error);
    return { success: false, error: 'Failed to approve suggestion' };
  }
}

/**
 * Merge a suggestion with an existing CanonicalSku
 */
export async function mergeSuggestion(suggestionId: string, canonicalSkuId: string) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const suggestion = await prisma.productSuggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!suggestion) {
      return { success: false, error: 'Suggestion not found' };
    }

    if (suggestion.status !== 'PENDING') {
      return { success: false, error: 'Suggestion already processed' };
    }

    const canonicalSku = await prisma.canonicalSku.findUnique({
      where: { id: canonicalSkuId },
    });

    if (!canonicalSku) {
      return { success: false, error: 'Canonical SKU not found' };
    }

    // Update the suggestion
    await prisma.productSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: 'MERGED',
        resolvedAt: new Date(),
        resolvedBy: session.email,
        canonicalSkuId,
      },
    });

    // Map the dealer's SKU
    if (suggestion.dealerSkuId) {
      await prisma.dealerSku.update({
        where: { id: suggestion.dealerSkuId },
        data: {
          canonicalSkuId,
          mappingConfidence: 'HIGH',
          needsReview: false,
          mappedAt: new Date(),
          mappedBy: `admin:${session.email}`,
        },
      });
    }

    await logAdminAction(session.userId, 'MERGE_PRODUCT_SUGGESTION', {
      resource: 'ProductSuggestion',
      resourceId: suggestionId,
      newValue: {
        canonicalSkuId,
        dealerSkuId: suggestion.dealerSkuId,
      },
    });

    revalidatePath('/product-suggestions');

    return {
      success: true,
      message: `Merged with "${canonicalSku.name}"`,
    };
  } catch (error) {
    console.error('Failed to merge suggestion:', error);
    return { success: false, error: 'Failed to merge suggestion' };
  }
}

/**
 * Reject a product suggestion
 */
export async function rejectSuggestion(suggestionId: string, reason: string) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const suggestion = await prisma.productSuggestion.findUnique({
      where: { id: suggestionId },
    });

    if (!suggestion) {
      return { success: false, error: 'Suggestion not found' };
    }

    if (suggestion.status !== 'PENDING') {
      return { success: false, error: 'Suggestion already processed' };
    }

    await prisma.productSuggestion.update({
      where: { id: suggestionId },
      data: {
        status: 'REJECTED',
        resolvedAt: new Date(),
        resolvedBy: session.email,
        rejectionNote: reason,
      },
    });

    await logAdminAction(session.userId, 'REJECT_PRODUCT_SUGGESTION', {
      resource: 'ProductSuggestion',
      resourceId: suggestionId,
      newValue: { reason },
    });

    revalidatePath('/product-suggestions');

    return { success: true, message: 'Suggestion rejected' };
  } catch (error) {
    console.error('Failed to reject suggestion:', error);
    return { success: false, error: 'Failed to reject suggestion' };
  }
}
