'use server';

import { prisma } from '@ironscout/db';
import { BrandAliasStatus, BrandAliasSourceType, Prisma } from '@ironscout/db/generated/prisma';
import { revalidatePath } from 'next/cache';
import { getAdminSession, logAdminAction } from '@/lib/auth';
import { loggers } from '@/lib/logger';
import { publishBrandAliasInvalidation } from '@/lib/queue';

// =============================================================================
// Constants (from brand-aliases-v1 spec)
// =============================================================================

// Import normalization version from shared module to prevent drift
// Note: We duplicate the normalization function here for admin-only use,
// but the version must stay in sync with the resolver.
const BRAND_NORMALIZATION_VERSION = 1; // Duplicated from harvester — see #247

// Corporate suffix tokens to strip
const CORPORATE_SUFFIXES = new Set([
  'inc', 'incorporated', 'llc', 'ltd', 'limited', 'co', 'corp', 'corporation',
  'gmbh', 'sarl', 'sa', 'bv', 'nv',
]);

// Generic tokens that should not be standalone aliases
const GENERIC_TOKEN_BLOCKLIST = new Set([
  'ammo', 'ammunition', 'bulk', 'sale', 'discount', 'special', 'new', 'best', 'premium',
]);

// Short aliases (2-3 chars) that are explicitly allowed
const SHORT_ALIAS_ALLOWLIST = new Set([
  'pmc', 'cci', 'imi', 'ppu', 'cbc', 'wpa', 'tul', 'hsm', 'hpr',
]);

// Impact thresholds
const AUTO_ACTIVATE_THRESHOLD = 500;
const HIGH_IMPACT_ALERT_THRESHOLD = 1000;

// =============================================================================
// Types
// =============================================================================

export type AliasSourceType = 'RETAILER_FEED' | 'AFFILIATE_FEED' | 'MANUAL';
export type AliasStatus = 'DRAFT' | 'ACTIVE' | 'DISABLED';

export interface CreateAliasInput {
  canonicalName: string;
  aliasName: string;
  sourceType: AliasSourceType;
  sourceRef?: string;
  notes?: string;
  evidence?: Record<string, unknown>;
}

export interface BrandAliasDTO {
  id: string;
  canonicalName: string;
  canonicalNorm: string;
  aliasName: string;
  aliasNorm: string;
  status: AliasStatus;
  sourceType: AliasSourceType;
  sourceRef: string | null;
  notes: string | null;
  evidence: unknown;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  updatedBy: string;
  disabledAt: Date | null;
  disabledBy: string | null;
  disableReason: string | null;
  // Computed fields
  estimatedDailyImpact?: number;
  canAutoActivate?: boolean;
  autoActivateReason?: string;
}

// =============================================================================
// Normalization (mirrors harvester/resolver/brand-normalization.ts)
// =============================================================================

function normalizeBrandString(brand?: string | null): string | undefined {
  if (!brand || brand.trim().length === 0) {
    return undefined;
  }

  let normalized = brand;

  // Strip trademark symbols BEFORE NFKD normalization
  // NFKD converts ™ to "TM", so we must strip these first
  // ™ (U+2122), ® (U+00AE), © (U+00A9)
  normalized = normalized.replace(/[\u2122\u00AE\u00A9]/g, '');
  normalized = normalized.replace(/\(tm\)/gi, '');
  normalized = normalized.replace(/\(r\)/gi, '');
  normalized = normalized.replace(/\(c\)/gi, '');

  // Unicode normalization (NFKD) + strip diacritics
  normalized = normalized.normalize('NFKD');
  normalized = normalized.replace(/[\u0300-\u036f]/g, '');

  // Lowercase
  normalized = normalized.toLowerCase();

  // Normalize ampersand to "and"
  normalized = normalized.replace(/&/g, ' and ');

  // Collapse punctuation/separators to whitespace
  normalized = normalized.replace(/[\/|\\-_.,;:'"!?()[\]{}]/g, ' ');

  // Collapse repeated whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();

  // Strip corporate suffixes from end
  const tokens = normalized.split(' ');
  const filteredTokens = tokens.filter((token, index) => {
    if (index === tokens.length - 1 || index === tokens.length - 2) {
      return !CORPORATE_SUFFIXES.has(token);
    }
    return true;
  });

  normalized = filteredTokens.join(' ').replace(/\s+/g, ' ').trim();

  return normalized.length === 0 ? undefined : normalized;
}

// =============================================================================
// Validation
// =============================================================================

function validateAliasInput(aliasNorm: string, canonicalNorm: string): string[] {
  const errors: string[] = [];

  if (!aliasNorm || aliasNorm.length === 0) {
    errors.push('Alias cannot be empty');
    return errors;
  }

  if (aliasNorm.length < 2) {
    errors.push('Alias must be at least 2 characters');
  }

  // Require allowlist for 2-3 character aliases
  if (aliasNorm.length >= 2 && aliasNorm.length <= 3) {
    if (!SHORT_ALIAS_ALLOWLIST.has(aliasNorm)) {
      errors.push(`Short aliases (2-3 chars) must be on the allowlist. "${aliasNorm}" is not allowed.`);
    }
  }

  // Block generic tokens
  if (GENERIC_TOKEN_BLOCKLIST.has(aliasNorm)) {
    errors.push(`"${aliasNorm}" is a generic term and cannot be used as an alias`);
  }

  // Reject aliasNorm == canonicalNorm
  if (aliasNorm === canonicalNorm) {
    errors.push('Alias cannot be the same as the canonical name');
  }

  return errors;
}

// =============================================================================
// Impact Estimation
// =============================================================================

async function estimateDailyImpact(aliasNorm: string): Promise<number> {
  try {
    // Count source_products with matching brandNorm in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const count = await prisma.source_products.count({
      where: {
        brandNorm: aliasNorm,
        createdAt: { gte: sevenDaysAgo },
      },
    });

    // Return daily average
    return Math.ceil(count / 7);
  } catch {
    return 0;
  }
}

async function checkCanonicalExists(canonicalNorm: string): Promise<{
  inProducts: boolean;
  inActiveAliases: boolean;
}> {
  try {
    const [productCount, aliasCount] = await Promise.all([
      prisma.products.count({
        where: { brandNorm: canonicalNorm },
        take: 1,
      }),
      prisma.brand_aliases.count({
        where: {
          canonicalNorm,
          status: 'ACTIVE',
        },
        take: 1,
      }),
    ]);

    return {
      inProducts: productCount > 0,
      inActiveAliases: aliasCount > 0,
    };
  } catch {
    // Fail closed for auto-activation: return false for both
    // This prevents auto-activation on DB errors while not breaking admin views
    return {
      inProducts: false,
      inActiveAliases: false,
    };
  }
}

function determineAutoActivate(
  aliasNorm: string,
  sourceType: AliasSourceType,
  estimatedImpact: number,
  canonicalInProducts: boolean,
  canonicalInActiveAliases: boolean
): { canActivate: boolean; reason: string } {
  if (sourceType === 'MANUAL') {
    return { canActivate: false, reason: 'Manual aliases require review' };
  }

  if (aliasNorm.length < 4) {
    return { canActivate: false, reason: 'Short aliases require review' };
  }

  if (GENERIC_TOKEN_BLOCKLIST.has(aliasNorm)) {
    return { canActivate: false, reason: 'Generic terms require review' };
  }

  if (!canonicalInProducts && !canonicalInActiveAliases) {
    return { canActivate: false, reason: 'Unknown canonical brand requires review' };
  }

  if (estimatedImpact >= AUTO_ACTIVATE_THRESHOLD) {
    return { canActivate: false, reason: 'High-impact aliases require review' };
  }

  return { canActivate: true, reason: 'Meets auto-activation criteria' };
}

// =============================================================================
// CRUD Operations
// =============================================================================

/**
 * Create a new brand alias
 */
export async function createAlias(data: CreateAliasInput) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  // Normalize inputs
  const canonicalNorm = normalizeBrandString(data.canonicalName);
  const aliasNorm = normalizeBrandString(data.aliasName);

  if (!canonicalNorm) {
    return { success: false, error: 'Canonical name normalizes to empty string' };
  }

  if (!aliasNorm) {
    return { success: false, error: 'Alias name normalizes to empty string' };
  }

  // Validate
  const validationErrors = validateAliasInput(aliasNorm, canonicalNorm);
  if (validationErrors.length > 0) {
    return { success: false, error: validationErrors.join('; ') };
  }

  try {
    // Check for duplicate aliasNorm
    const existing = await prisma.brand_aliases.findUnique({
      where: { aliasNorm },
    });

    if (existing) {
      return {
        success: false,
        error: `Alias "${data.aliasName}" (normalized: "${aliasNorm}") already exists`,
      };
    }

    // Check chain protection: canonicalNorm should not be an active aliasNorm
    const canonicalAsAlias = await prisma.brand_aliases.findFirst({
      where: {
        aliasNorm: canonicalNorm,
        status: 'ACTIVE',
      },
    });

    if (canonicalAsAlias) {
      return {
        success: false,
        error: `Canonical "${data.canonicalName}" is already an alias for "${canonicalAsAlias.canonicalName}". This would create a chain.`,
      };
    }

    // Check chain protection: aliasNorm should not be an active canonicalNorm
    const aliasAsCanonical = await prisma.brand_aliases.findFirst({
      where: {
        canonicalNorm: aliasNorm,
        status: 'ACTIVE',
      },
    });

    if (aliasAsCanonical) {
      return {
        success: false,
        error: `Alias "${data.aliasName}" is already a canonical target. This would create a chain.`,
      };
    }

    // Check auto-activation eligibility (for feed-sourced aliases)
    let status: 'DRAFT' | 'ACTIVE' = 'DRAFT';
    let autoActivated = false;

    if (data.sourceType !== 'MANUAL') {
      const estimatedImpact = await estimateDailyImpact(aliasNorm);
      const canonicalCheck = await checkCanonicalExists(canonicalNorm);
      const autoActivateResult = determineAutoActivate(
        aliasNorm,
        data.sourceType,
        estimatedImpact,
        canonicalCheck.inProducts,
        canonicalCheck.inActiveAliases
      );

      if (autoActivateResult.canActivate) {
        status = 'ACTIVE';
        autoActivated = true;
      }
    }

    // Create the alias
    const alias = await prisma.brand_aliases.create({
      data: {
        canonicalName: data.canonicalName.trim(),
        canonicalNorm,
        aliasName: data.aliasName.trim(),
        aliasNorm,
        normalizationVersion: BRAND_NORMALIZATION_VERSION,
        status,
        sourceType: data.sourceType as BrandAliasSourceType,
        sourceRef: data.sourceRef?.trim() || null,
        notes: data.notes?.trim() || null,
        evidence: data.evidence as Prisma.InputJsonValue | undefined,
        createdBy: session.email,
        updatedBy: session.email,
      },
    });

    await logAdminAction(session.userId, autoActivated ? 'AUTO_ACTIVATE_BRAND_ALIAS' : 'CREATE_BRAND_ALIAS', {
      resource: 'BrandAlias',
      resourceId: alias.id,
      newValue: {
        canonicalName: data.canonicalName,
        aliasName: data.aliasName,
        sourceType: data.sourceType,
        status,
        autoActivated,
      },
    });

    revalidatePath('/brand-aliases');

    return { success: true, alias };
  } catch (error) {
    loggers.admin.error('Failed to create brand alias', {}, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to create brand alias' };
  }
}

/**
 * Activate a DRAFT alias
 */
export async function activateAlias(id: string) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const alias = await prisma.brand_aliases.findUnique({
      where: { id },
    });

    if (!alias) {
      return { success: false, error: 'Alias not found' };
    }

    if (alias.status === 'ACTIVE') {
      return { success: false, error: 'Alias is already active' };
    }

    if (alias.status === 'DISABLED' && alias.disableReason?.startsWith('REJECTED:')) {
      return {
        success: false,
        error: 'This alias was rejected and cannot be re-activated. Create a new alias instead.',
      };
    }

    // Re-check chain protection (other aliases may have been created since this was DRAFT)
    const canonicalAsAlias = await prisma.brand_aliases.findFirst({
      where: {
        aliasNorm: alias.canonicalNorm,
        status: 'ACTIVE',
      },
    });

    if (canonicalAsAlias) {
      return {
        success: false,
        error: `Cannot activate: "${alias.canonicalName}" is now an alias for "${canonicalAsAlias.canonicalName}". This would create a chain.`,
      };
    }

    const aliasAsCanonical = await prisma.brand_aliases.findFirst({
      where: {
        canonicalNorm: alias.aliasNorm,
        status: 'ACTIVE',
      },
    });

    if (aliasAsCanonical) {
      return {
        success: false,
        error: `Cannot activate: "${alias.aliasName}" is now a canonical target for "${aliasAsCanonical.aliasName}". This would create a chain.`,
      };
    }

    // Update to ACTIVE
    await prisma.brand_aliases.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        updatedBy: session.email,
        disabledAt: null,
        disabledBy: null,
        disableReason: null,
      },
    });

    await logAdminAction(session.userId, 'ACTIVATE_BRAND_ALIAS', {
      resource: 'BrandAlias',
      resourceId: id,
      oldValue: { status: alias.status },
      newValue: { status: 'ACTIVE' },
    });

    // Notify harvesters to refresh their alias cache
    await publishBrandAliasInvalidation(id, 'activate');

    revalidatePath('/brand-aliases');

    return { success: true, message: 'Alias activated successfully' };
  } catch (error) {
    loggers.admin.error('Failed to activate brand alias', { aliasId: id }, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to activate alias' };
  }
}

/**
 * Disable an alias
 */
export async function disableAlias(id: string, reason: string, isRejection: boolean = false) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  if (!reason || reason.trim().length < 3) {
    return { success: false, error: 'Disable reason is required (min 3 characters)' };
  }

  try {
    const alias = await prisma.brand_aliases.findUnique({
      where: { id },
    });

    if (!alias) {
      return { success: false, error: 'Alias not found' };
    }

    if (alias.status === 'DISABLED') {
      return { success: false, error: 'Alias is already disabled' };
    }

    // Format reason with REJECTED: prefix if this is a rejection
    const formattedReason = isRejection ? `REJECTED: ${reason.trim()}` : reason.trim();

    await prisma.brand_aliases.update({
      where: { id },
      data: {
        status: 'DISABLED',
        updatedBy: session.email,
        disabledAt: new Date(),
        disabledBy: session.email,
        disableReason: formattedReason,
      },
    });

    await logAdminAction(session.userId, 'DISABLE_BRAND_ALIAS', {
      resource: 'BrandAlias',
      resourceId: id,
      oldValue: { status: alias.status },
      newValue: {
        status: 'DISABLED',
        disableReason: formattedReason,
      },
    });

    // Notify harvesters to refresh their alias cache
    await publishBrandAliasInvalidation(id, 'disable');

    revalidatePath('/brand-aliases');

    return { success: true, message: 'Alias disabled successfully' };
  } catch (error) {
    loggers.admin.error('Failed to disable brand alias', { aliasId: id }, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to disable alias' };
  }
}

/**
 * List all brand aliases with filters
 */
export async function listAliases(options?: {
  status?: AliasStatus;
  canonicalName?: string;
  aliasName?: string;
  limit?: number;
}) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized', aliases: [] };
  }

  try {
    const where: Record<string, unknown> = {};

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.canonicalName) {
      where.canonicalName = { contains: options.canonicalName, mode: 'insensitive' };
    }

    if (options?.aliasName) {
      where.aliasName = { contains: options.aliasName, mode: 'insensitive' };
    }

    const aliases = await prisma.brand_aliases.findMany({
      where,
      orderBy: [
        { status: 'asc' }, // ACTIVE first, then DRAFT, then DISABLED
        { createdAt: 'desc' },
      ],
      take: options?.limit ?? 100,
    });

    // Enrich with impact estimation for DRAFT aliases
    const enrichedAliases: BrandAliasDTO[] = await Promise.all(
      aliases.map(async (a) => {
        let estimatedDailyImpact: number | undefined;
        let canAutoActivate: boolean | undefined;
        let autoActivateReason: string | undefined;

        if (a.status === 'DRAFT') {
          estimatedDailyImpact = await estimateDailyImpact(a.aliasNorm);
          const canonicalCheck = await checkCanonicalExists(a.canonicalNorm);
          const autoActivateResult = determineAutoActivate(
            a.aliasNorm,
            a.sourceType as AliasSourceType,
            estimatedDailyImpact,
            canonicalCheck.inProducts,
            canonicalCheck.inActiveAliases
          );
          canAutoActivate = autoActivateResult.canActivate;
          autoActivateReason = autoActivateResult.reason;
        }

        return {
          id: a.id,
          canonicalName: a.canonicalName,
          canonicalNorm: a.canonicalNorm,
          aliasName: a.aliasName,
          aliasNorm: a.aliasNorm,
          status: a.status as AliasStatus,
          sourceType: a.sourceType as AliasSourceType,
          sourceRef: a.sourceRef,
          notes: a.notes,
          evidence: a.evidence,
          createdAt: a.createdAt,
          updatedAt: a.updatedAt,
          createdBy: a.createdBy,
          updatedBy: a.updatedBy,
          disabledAt: a.disabledAt,
          disabledBy: a.disabledBy,
          disableReason: a.disableReason,
          estimatedDailyImpact,
          canAutoActivate,
          autoActivateReason,
        };
      })
    );

    return { success: true, aliases: enrichedAliases };
  } catch (error) {
    loggers.admin.error('Failed to list brand aliases', {}, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to list aliases', aliases: [] };
  }
}

/**
 * Get a single alias by ID
 */
export async function getAlias(id: string) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized', alias: null };
  }

  try {
    const alias = await prisma.brand_aliases.findUnique({
      where: { id },
    });

    if (!alias) {
      return { success: false, error: 'Alias not found', alias: null };
    }

    // Get impact and auto-activate info
    const estimatedDailyImpact = await estimateDailyImpact(alias.aliasNorm);
    const canonicalCheck = await checkCanonicalExists(alias.canonicalNorm);
    const autoActivateResult = determineAutoActivate(
      alias.aliasNorm,
      alias.sourceType as AliasSourceType,
      estimatedDailyImpact,
      canonicalCheck.inProducts,
      canonicalCheck.inActiveAliases
    );

    // Get application stats
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const applicationStats = await prisma.brand_alias_applications_daily.aggregate({
      where: {
        aliasId: id,
        date: { gte: thirtyDaysAgo },
      },
      _sum: { count: true },
    });

    const enriched: BrandAliasDTO & { totalApplications30d: number } = {
      id: alias.id,
      canonicalName: alias.canonicalName,
      canonicalNorm: alias.canonicalNorm,
      aliasName: alias.aliasName,
      aliasNorm: alias.aliasNorm,
      status: alias.status as AliasStatus,
      sourceType: alias.sourceType as AliasSourceType,
      sourceRef: alias.sourceRef,
      notes: alias.notes,
      evidence: alias.evidence,
      createdAt: alias.createdAt,
      updatedAt: alias.updatedAt,
      createdBy: alias.createdBy,
      updatedBy: alias.updatedBy,
      disabledAt: alias.disabledAt,
      disabledBy: alias.disabledBy,
      disableReason: alias.disableReason,
      estimatedDailyImpact,
      canAutoActivate: autoActivateResult.canActivate,
      autoActivateReason: autoActivateResult.reason,
      totalApplications30d: applicationStats._sum.count ?? 0,
    };

    return { success: true, alias: enriched };
  } catch (error) {
    loggers.admin.error('Failed to get brand alias', { aliasId: id }, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to get alias', alias: null };
  }
}

/**
 * Update alias notes/evidence (only allowed for DRAFT aliases)
 */
export async function updateAlias(
  id: string,
  data: { notes?: string; sourceRef?: string; evidence?: Record<string, unknown> }
) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const alias = await prisma.brand_aliases.findUnique({
      where: { id },
    });

    if (!alias) {
      return { success: false, error: 'Alias not found' };
    }

    // Only allow updates to DRAFT aliases
    if (alias.status !== 'DRAFT') {
      return {
        success: false,
        error: 'Only DRAFT aliases can be updated. Disable and create a new alias instead.',
      };
    }

    await prisma.brand_aliases.update({
      where: { id },
      data: {
        notes: data.notes?.trim() || alias.notes,
        sourceRef: data.sourceRef?.trim() || alias.sourceRef,
        evidence: (data.evidence ?? alias.evidence ?? undefined) as Prisma.InputJsonValue | undefined,
        updatedBy: session.email,
      },
    });

    await logAdminAction(session.userId, 'UPDATE_BRAND_ALIAS', {
      resource: 'BrandAlias',
      resourceId: id,
      newValue: data,
    });

    revalidatePath('/brand-aliases');

    return { success: true, message: 'Alias updated successfully' };
  } catch (error) {
    loggers.admin.error('Failed to update brand alias', { aliasId: id }, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to update alias' };
  }
}

/**
 * Get alias statistics for dashboard
 */
export async function getAliasStats() {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized', stats: null };
  }

  try {
    const [draftCount, activeCount, disabledCount, totalApplications] = await Promise.all([
      prisma.brand_aliases.count({ where: { status: 'DRAFT' } }),
      prisma.brand_aliases.count({ where: { status: 'ACTIVE' } }),
      prisma.brand_aliases.count({ where: { status: 'DISABLED' } }),
      prisma.brand_alias_applications_daily.aggregate({
        _sum: { count: true },
      }),
    ]);

    return {
      success: true,
      stats: {
        draftCount,
        activeCount,
        disabledCount,
        totalCount: draftCount + activeCount + disabledCount,
        totalApplications: totalApplications._sum.count ?? 0,
      },
    };
  } catch (error) {
    loggers.admin.error('Failed to get alias stats', {}, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to get stats', stats: null };
  }
}

/**
 * Preview normalization for a brand name
 */
export async function previewNormalization(brandName: string) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  const normalized = normalizeBrandString(brandName);

  return {
    success: true,
    original: brandName,
    normalized: normalized ?? '(empty)',
  };
}
