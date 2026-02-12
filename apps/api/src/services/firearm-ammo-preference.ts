/**
 * Firearm Ammo Preference Service
 *
 * Per firearm_preferred_ammo_mapping_spec_v3.md:
 * - User-declared ammo usage context for firearms
 * - NOT a recommendation system
 * - Supports recall and re-purchase workflows
 *
 * Key invariants:
 * - Use-case enum only (TRAINING | CARRY | COMPETITION | GENERAL)
 * - No inference, ranking, or recommendations
 * - Soft-delete with delete_reason
 * - Superseded SKUs resolve to canonical at read time
 */

import { prisma } from '@ironscout/db'
import { AmmoUseCase, AmmoPreferenceDeleteReason } from '@ironscout/db/generated/prisma'
import { loggers } from '../config/logger'

const log = loggers.watchlist // User data operations

// ============================================================================
// Types
// ============================================================================

export { AmmoUseCase, AmmoPreferenceDeleteReason }

export interface AmmoPreference {
  id: string
  firearmId: string
  ammoSkuId: string
  useCase: AmmoUseCase
  createdAt: Date
  updatedAt: Date
  // Resolved ammo SKU data (with supersession)
  ammoSku: {
    id: string
    name: string
    brand: string | null
    caliber: string | null
    grainWeight: number | null
    roundCount: number | null
    isActive: boolean
  }
}

export interface AmmoPreferenceGroup {
  useCase: AmmoUseCase
  preferences: AmmoPreference[]
}

// Use case display order per spec: CARRY, TRAINING, COMPETITION, GENERAL
const USE_CASE_ORDER: AmmoUseCase[] = ['CARRY', 'TRAINING', 'COMPETITION', 'GENERAL']

// ============================================================================
// Caliber Equivalence
// ============================================================================

/**
 * Caliber equivalence groups.
 * Each group contains caliber strings that refer to the same cartridge.
 * The first entry in each group is the Gun Locker canonical value (from CALIBERS).
 * All comparisons are case-insensitive.
 */
const CALIBER_EQUIVALENCE_GROUPS: string[][] = [
  ['9mm', '9mm luger', '9mm parabellum', '9x19mm', '9x19', '9mm nato'],
  ['.380 acp', '.380 auto', '380 acp', '380 auto', '9mm short', '9x17mm'],
  ['.45 acp', '45 acp', '.45 auto', '45 auto'],
  ['.40 s&w', '40 s&w', '.40 smith & wesson'],
  ['.38 special', '38 special', '.38 spl', '38 spl'],
  ['.357 magnum', '357 magnum', '.357 mag', '357 mag'],
  ['.223/5.56', '.223 remington', '223 remington', '.223 rem', '223 rem', '5.56 nato', '5.56x45mm', '5.56x45', '5.56mm nato', '5.56'],
  ['.308/7.62x51', '.308 winchester', '308 winchester', '.308 win', '308 win', '7.62x51mm', '7.62x51 nato', '7.62x51', '7.62 nato'],
  ['.22 lr', '22 lr', '.22 long rifle', '22 long rifle'],
  ['.22 wmr', '22 wmr', '.22 magnum', '22 magnum', '.22 mag', '22 mag'],
  ['12ga', '12 gauge', '12ga.', '12 ga', '12 ga.'],
  ['20ga', '20 gauge', '20ga.', '20 ga', '20 ga.'],
  ['16ga', '16 gauge', '16ga.', '16 ga', '16 ga.'],
  ['.410 bore', '410 bore', '.410', '410'],
  ['.300 aac blackout', '300 blackout', '.300 blk', '300 blk', '.300 aac', '300 aac'],
  ['6.5 creedmoor', '6.5mm creedmoor', '6.5 cm'],
  ['7.62x39', '7.62x39mm'],
  ['.30-06', '30-06', '.30-06 springfield', '30-06 springfield', '.30-06 sprg'],
  ['.270 winchester', '270 winchester', '.270 win', '270 win'],
  ['.243 winchester', '243 winchester', '.243 win', '243 win'],
  ['.30-30 winchester', '30-30 winchester', '.30-30 win', '30-30 win', '.30-30'],
  ['10mm auto', '10mm', '10mm auto'],
  ['.25 acp', '25 acp', '.25 auto'],
  ['.32 acp', '32 acp', '.32 auto'],
  ['.45 colt', '45 colt', '.45 long colt', '45 long colt', '.45 lc'],
  ['.17 hmr', '17 hmr', '.17 hornady magnum rimfire'],
]

// Build a lookup map: normalized caliber string → group index
const CALIBER_GROUP_MAP = new Map<string, number>()
for (let i = 0; i < CALIBER_EQUIVALENCE_GROUPS.length; i++) {
  for (const cal of CALIBER_EQUIVALENCE_GROUPS[i]) {
    CALIBER_GROUP_MAP.set(cal.toLowerCase(), i)
  }
}

/**
 * Check if two caliber strings refer to the same cartridge.
 * Returns true if they match exactly (case-insensitive) or belong to the same equivalence group.
 */
function calibersAreCompatible(calA: string, calB: string): boolean {
  const a = calA.toLowerCase().trim()
  const b = calB.toLowerCase().trim()
  if (a === b) return true
  const groupA = CALIBER_GROUP_MAP.get(a)
  const groupB = CALIBER_GROUP_MAP.get(b)
  if (groupA !== undefined && groupB !== undefined && groupA === groupB) return true
  return false
}

// ============================================================================
// Helper Functions
// ============================================================================

/** Shape used for product selects throughout this module */
const PRODUCT_SELECT = {
  id: true,
  name: true,
  brand: true,
  caliber: true,
  grainWeight: true,
  roundCount: true,
  isActiveSku: true,
  supersededById: true,
} as const

type ProductData = {
  id: string
  name: string
  brand: string | null
  caliber: string | null
  grainWeight: number | null
  roundCount: number | null
  isActiveSku: boolean
  supersededById: string | null
}

/**
 * Resolve superseded SKU to canonical SKU (single-product path for addPreference)
 * Per spec: "Deprecated SKUs resolve to canonical SKU at read time"
 */
async function resolveSupersededSku(productId: string): Promise<string> {
  let currentId = productId
  const visited = new Set<string>()

  while (true) {
    if (visited.has(currentId)) {
      log.warn('Supersession cycle detected', { productId, visited: Array.from(visited) })
      break
    }
    visited.add(currentId)

    const product = await prisma.products.findUnique({
      where: { id: currentId },
      select: { supersededById: true, isActiveSku: true },
    })

    if (!product || !product.supersededById || product.isActiveSku) {
      break
    }

    currentId = product.supersededById
  }

  return currentId
}

/**
 * Batch-preload all products in supersession chains.
 * Returns a map of productId → ProductData for in-memory chain resolution.
 * Loads in breadth-first waves to avoid N+1 queries.
 */
async function batchPreloadSupersessionChains(
  records: Array<{ products: ProductData }>
): Promise<Map<string, ProductData>> {
  const productMap = new Map<string, ProductData>()

  // Seed with products already loaded via Prisma include
  for (const r of records) {
    productMap.set(r.products.id, r.products)
  }

  // Collect supersededById targets not yet in the map
  const pendingIds = new Set<string>()
  for (const r of records) {
    if (!r.products.isActiveSku && r.products.supersededById && !productMap.has(r.products.supersededById)) {
      pendingIds.add(r.products.supersededById)
    }
  }

  // Breadth-first loading: follow chains until no new IDs to load
  while (pendingIds.size > 0) {
    const batch = [...pendingIds]
    pendingIds.clear()

    const loaded = await prisma.products.findMany({
      where: { id: { in: batch } },
      select: PRODUCT_SELECT,
    })

    for (const p of loaded) {
      productMap.set(p.id, p)
      // If this product is also superseded, queue its target
      if (!p.isActiveSku && p.supersededById && !productMap.has(p.supersededById)) {
        pendingIds.add(p.supersededById)
      }
    }

    // Mark any IDs that weren't found (broken chain) so we don't loop
    for (const id of batch) {
      if (!productMap.has(id)) {
        // Product doesn't exist — stop following this chain
        productMap.set(id, undefined as any) // sentinel
      }
    }
  }

  return productMap
}

/**
 * Resolve a supersession chain in-memory using the preloaded product map.
 * Returns the canonical product ID, or the original if chain cannot be followed.
 */
function resolveSupersededSkuFromMap(
  productId: string,
  productMap: Map<string, ProductData>
): string {
  let currentId = productId
  const visited = new Set<string>()

  while (true) {
    if (visited.has(currentId)) {
      log.warn('Supersession cycle detected', { productId, visited: Array.from(visited) })
      break
    }
    visited.add(currentId)

    const product = productMap.get(currentId)
    if (!product || !product.supersededById || product.isActiveSku) {
      break
    }

    currentId = product.supersededById
  }

  return currentId
}

// Internal type for tracking supersession during dedupe
interface MappedPreference extends AmmoPreference {
  _originalId: string // Original preference ID (for soft-delete tracking)
  _originalSkuId: string // Original SKU ID before supersession resolution
  _wasSuperseded: boolean // True if SKU was resolved via supersession
}

/**
 * Map database records to AmmoPreferences with resolved SKU data (batch).
 * Uses preloaded product map to avoid N+1 queries.
 * Tracks original IDs for supersession soft-delete.
 */
function mapToAmmoPreferences(
  records: Array<{
    id: string
    firearmId: string
    ammoSkuId: string
    useCase: AmmoUseCase
    createdAt: Date
    updatedAt: Date
    products: ProductData
  }>,
  productMap: Map<string, ProductData>
): MappedPreference[] {
  return records.map((record) => {
    let ammoSku = record.products
    let wasSuperseded = false

    if (!ammoSku.isActiveSku && ammoSku.supersededById) {
      const canonicalId = resolveSupersededSkuFromMap(record.ammoSkuId, productMap)
      if (canonicalId !== record.ammoSkuId) {
        const canonical = productMap.get(canonicalId)
        if (canonical) {
          ammoSku = canonical
          wasSuperseded = true
        }
      }
    }

    return {
      id: record.id,
      firearmId: record.firearmId,
      ammoSkuId: ammoSku.id,
      useCase: record.useCase,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      ammoSku: {
        id: ammoSku.id,
        name: ammoSku.name,
        brand: ammoSku.brand,
        caliber: ammoSku.caliber,
        grainWeight: ammoSku.grainWeight,
        roundCount: ammoSku.roundCount,
        isActive: ammoSku.isActiveSku,
      },
      _originalId: record.id,
      _originalSkuId: record.ammoSkuId,
      _wasSuperseded: wasSuperseded,
    }
  })
}

/**
 * Map a single database record to AmmoPreference with resolved SKU data.
 * Used for single-record paths (addPreference, updatePreferenceUseCase).
 */
async function mapToAmmoPreference(
  record: {
    id: string
    firearmId: string
    ammoSkuId: string
    useCase: AmmoUseCase
    createdAt: Date
    updatedAt: Date
    products: ProductData
  }
): Promise<MappedPreference> {
  let ammoSku = record.products
  let wasSuperseded = false

  if (!ammoSku.isActiveSku && ammoSku.supersededById) {
    const canonicalId = await resolveSupersededSku(record.ammoSkuId)
    if (canonicalId !== record.ammoSkuId) {
      const canonical = await prisma.products.findUnique({
        where: { id: canonicalId },
        select: PRODUCT_SELECT,
      })
      if (canonical) {
        ammoSku = canonical
        wasSuperseded = true
      }
    }
  }

  return {
    id: record.id,
    firearmId: record.firearmId,
    ammoSkuId: ammoSku.id,
    useCase: record.useCase,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ammoSku: {
      id: ammoSku.id,
      name: ammoSku.name,
      brand: ammoSku.brand,
      caliber: ammoSku.caliber,
      grainWeight: ammoSku.grainWeight,
      roundCount: ammoSku.roundCount,
      isActive: ammoSku.isActiveSku,
    },
    _originalId: record.id,
    _originalSkuId: record.ammoSkuId,
    _wasSuperseded: wasSuperseded,
  }
}

/**
 * Dedupe preferences after supersession resolution
 * Per spec: "If both deprecated and canonical SKUs are mapped, render canonical only.
 *           Soft-delete deprecated mapping with delete_reason = SKU_SUPERSEDED."
 *
 * IMPORTANT: Always prefer canonical (non-superseded) over deprecated, regardless of updatedAt.
 * This ensures "render canonical only" even if deprecated was updated more recently.
 */
async function dedupeAndSoftDeleteSuperseded(
  mapped: MappedPreference[]
): Promise<AmmoPreference[]> {
  const seenKeys = new Map<string, { pref: MappedPreference; index: number }>()
  const toSoftDelete: string[] = [] // preference IDs to soft-delete
  const result: MappedPreference[] = []

  for (const pref of mapped) {
    const key = `${pref.firearmId}:${pref.ammoSkuId}:${pref.useCase}`

    if (!seenKeys.has(key)) {
      // First occurrence - tentatively add it
      seenKeys.set(key, { pref, index: result.length })
      result.push(pref)
    } else {
      // Duplicate found - decide which to keep based on supersession status
      const existing = seenKeys.get(key)!

      if (existing.pref._wasSuperseded && !pref._wasSuperseded) {
        // Existing is deprecated, new is canonical → replace with canonical
        // Soft-delete the deprecated one
        toSoftDelete.push(existing.pref._originalId)
        log.info('Supersession dedupe: replacing deprecated with canonical', {
          deprecatedPrefId: existing.pref._originalId,
          deprecatedSkuId: existing.pref._originalSkuId,
          canonicalPrefId: pref._originalId,
          canonicalSkuId: pref.ammoSkuId,
        })
        result[existing.index] = pref
        seenKeys.set(key, { pref, index: existing.index })
      } else if (!existing.pref._wasSuperseded && pref._wasSuperseded) {
        // Existing is canonical, new is deprecated → keep existing, soft-delete new
        toSoftDelete.push(pref._originalId)
        log.info('Supersession dedupe: keeping canonical, soft-deleting deprecated', {
          canonicalPrefId: existing.pref._originalId,
          deprecatedPrefId: pref._originalId,
          deprecatedSkuId: pref._originalSkuId,
        })
      } else {
        // Both same status (both canonical or both deprecated) → keep first (most recent due to orderBy)
        // Soft-delete the duplicate if it was superseded
        if (pref._wasSuperseded) {
          toSoftDelete.push(pref._originalId)
          log.info('Supersession dedupe: soft-deleting duplicate deprecated mapping', {
            keptPrefId: existing.pref._originalId,
            deprecatedPrefId: pref._originalId,
            deprecatedSkuId: pref._originalSkuId,
          })
        }
      }
    }
  }

  // Soft-delete deprecated mappings in background (don't block read)
  if (toSoftDelete.length > 0) {
    prisma.firearm_ammo_preferences
      .updateMany({
        where: { id: { in: toSoftDelete } },
        data: {
          deletedAt: new Date(),
          deleteReason: 'SKU_SUPERSEDED',
        },
      })
      .catch((err) => {
        log.error('Failed to soft-delete superseded mappings', { error: err.message, ids: toSoftDelete })
      })
  }

  // Strip internal tracking fields for return
  return result.map(({ _originalId, _originalSkuId, _wasSuperseded, ...cleanPref }) => cleanPref)
}

// ============================================================================
// Core Operations
// ============================================================================

/**
 * Get all ammo preferences for a firearm, grouped by use case
 * Per spec: Fixed display order CARRY, TRAINING, COMPETITION, GENERAL
 */
export async function getPreferencesForFirearm(
  userId: string,
  firearmId: string
): Promise<AmmoPreferenceGroup[]> {
  // Verify firearm belongs to user
  const firearm = await prisma.user_guns.findUnique({
    where: { id: firearmId },
  })

  if (!firearm || firearm.userId !== userId) {
    throw new Error('Firearm not found')
  }

  // Get active preferences
  const preferences = await prisma.firearm_ammo_preferences.findMany({
    where: {
      userId,
      firearmId,
      deletedAt: null,
    },
    include: {
      products: {
        select: PRODUCT_SELECT,
      },
    },
    orderBy: [
      { updatedAt: 'desc' },
      { ammoSkuId: 'asc' }, // Tie-breaker for deterministic ordering per spec
    ],
  })

  // Batch-preload supersession chains, then map + dedupe (no N+1)
  const productMap = await batchPreloadSupersessionChains(preferences)
  const mapped = mapToAmmoPreferences(preferences, productMap)
  const deduped = await dedupeAndSoftDeleteSuperseded(mapped)

  // Group by use case in fixed order
  const groups: AmmoPreferenceGroup[] = []
  for (const useCase of USE_CASE_ORDER) {
    const prefs = deduped.filter((p) => p.useCase === useCase)
    if (prefs.length > 0) {
      groups.push({ useCase, preferences: prefs })
    }
  }

  return groups
}

/**
 * Get all ammo preferences for a user (for My Loadout)
 * Per spec: "Most recently updated mapping first"
 */
export async function getPreferencesForUser(
  userId: string
): Promise<AmmoPreference[]> {
  const preferences = await prisma.firearm_ammo_preferences.findMany({
    where: {
      userId,
      deletedAt: null,
    },
    include: {
      products: {
        select: PRODUCT_SELECT,
      },
    },
    orderBy: [
      { updatedAt: 'desc' },
      { ammoSkuId: 'asc' }, // Tie-breaker per spec
    ],
  })

  // Batch-preload supersession chains, then map + dedupe (no N+1)
  const productMap = await batchPreloadSupersessionChains(preferences)
  const mapped = mapToAmmoPreferences(preferences, productMap)
  return dedupeAndSoftDeleteSuperseded(mapped)
}

/**
 * Add ammo preference for a firearm
 * Per spec: "Ammo can be mapped in ≤2 focused user decisions"
 */
export async function addPreference(
  userId: string,
  firearmId: string,
  ammoSkuId: string,
  useCase: AmmoUseCase
): Promise<AmmoPreference> {
  // Verify firearm belongs to user
  const firearm = await prisma.user_guns.findUnique({
    where: { id: firearmId },
  })

  if (!firearm || firearm.userId !== userId) {
    throw new Error('Firearm not found')
  }

  // Verify ammo SKU exists
  const ammoSku = await prisma.products.findUnique({
    where: { id: ammoSkuId },
    select: PRODUCT_SELECT,
  })

  if (!ammoSku) {
    throw new Error('Ammo SKU not found')
  }

  // A6: Caliber compatibility validation (fail-closed per ADR-009 and spec)
  // Per spec: "Fail-closed on ambiguous caliber mapping"
  // Ambiguity triggers: Unknown firearm caliber, unknown ammo caliber, or mismatch
  // Uses equivalence groups to handle variant names (e.g. "9mm" == "9mm Luger")
  const firearmCaliberKnown = !!firearm.caliber
  const ammoCaliberKnown = !!ammoSku.caliber
  const calibersMatch = firearmCaliberKnown && ammoCaliberKnown
    ? calibersAreCompatible(firearm.caliber!, ammoSku.caliber!)
    : false

  let blockReason: string | null = null
  if (!firearmCaliberKnown) {
    blockReason = 'unknown_firearm_caliber'
  } else if (!ammoCaliberKnown) {
    blockReason = 'unknown_ammo_caliber'
  } else if (!calibersMatch) {
    blockReason = 'caliber_mismatch'
  }

  if (blockReason) {
    // Emit firearm_ammo_preference.blocked event per spec
    log.warn('firearm_ammo_preference.blocked', {
      event: 'firearm_ammo_preference.blocked',
      reason: blockReason,
      userId,
      firearmId,
      ammoSkuId,
      firearmCaliber: firearm.caliber ?? 'unknown',
      ammoCaliber: ammoSku.caliber ?? 'unknown',
    })

    const errorMessage =
      blockReason === 'unknown_firearm_caliber'
        ? 'Cannot add ammo: firearm caliber is unknown'
        : blockReason === 'unknown_ammo_caliber'
          ? 'Cannot add ammo: ammo caliber is unknown'
          : `Caliber mismatch: firearm is ${firearm.caliber}, ammo is ${ammoSku.caliber}`

    throw new Error(errorMessage)
  }

  // Resolve to canonical if superseded
  let resolvedSkuId = ammoSkuId
  if (!ammoSku.isActiveSku && ammoSku.supersededById) {
    resolvedSkuId = await resolveSupersededSku(ammoSkuId)
  }

  // Check for existing active preference (partial unique index handles DB constraint)
  const existing = await prisma.firearm_ammo_preferences.findFirst({
    where: {
      userId,
      firearmId,
      ammoSkuId: resolvedSkuId,
      useCase,
      deletedAt: null,
    },
  })

  if (existing) {
    throw new Error('Preference already exists for this ammo and use case')
  }

  // Create preference
  const preference = await prisma.firearm_ammo_preferences.create({
    data: {
      userId,
      firearmId,
      ammoSkuId: resolvedSkuId,
      useCase,
    },
    include: {
      products: {
        select: PRODUCT_SELECT,
      },
    },
  })

  return mapToAmmoPreference(preference)
}

/**
 * Update ammo preference use case
 * Per spec: "Overflow: Change use case / Remove"
 */
export async function updatePreferenceUseCase(
  userId: string,
  preferenceId: string,
  newUseCase: AmmoUseCase
): Promise<AmmoPreference> {
  const preference = await prisma.firearm_ammo_preferences.findUnique({
    where: { id: preferenceId },
  })

  if (!preference || preference.userId !== userId || preference.deletedAt) {
    throw new Error('Preference not found')
  }

  // Check for conflict with existing preference at new use case
  const conflict = await prisma.firearm_ammo_preferences.findFirst({
    where: {
      userId,
      firearmId: preference.firearmId,
      ammoSkuId: preference.ammoSkuId,
      useCase: newUseCase,
      deletedAt: null,
      id: { not: preferenceId },
    },
  })

  if (conflict) {
    throw new Error('Preference already exists for this ammo and use case')
  }

  const updated = await prisma.firearm_ammo_preferences.update({
    where: { id: preferenceId },
    data: { useCase: newUseCase },
    include: {
      products: {
        select: PRODUCT_SELECT,
      },
    },
  })

  return mapToAmmoPreference(updated)
}

/**
 * Remove ammo preference (soft delete)
 * Per spec: "Mappings are soft-deleted"
 */
export async function removePreference(
  userId: string,
  preferenceId: string,
  reason: AmmoPreferenceDeleteReason = 'USER_REMOVED'
): Promise<void> {
  const preference = await prisma.firearm_ammo_preferences.findUnique({
    where: { id: preferenceId },
  })

  if (!preference || preference.userId !== userId) {
    throw new Error('Preference not found')
  }

  if (preference.deletedAt) {
    // Already deleted
    return
  }

  await prisma.firearm_ammo_preferences.update({
    where: { id: preferenceId },
    data: {
      deletedAt: new Date(),
      deleteReason: reason,
    },
  })
}

/**
 * Handle firearm deletion - cascade soft-delete preferences
 * Per spec: "Firearm deletion: Cascade soft-delete all mappings with delete_reason = FIREARM_DELETED"
 */
export async function cascadeFirearmDeletion(
  userId: string,
  firearmId: string
): Promise<number> {
  const result = await prisma.firearm_ammo_preferences.updateMany({
    where: {
      userId,
      firearmId,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
      deleteReason: 'FIREARM_DELETED',
    },
  })

  log.info('Cascade firearm deletion: soft-deleted ammo preferences', {
    userId,
    firearmId,
    count: result.count,
  })

  return result.count
}

/**
 * Handle user deletion - cascade soft-delete all preferences
 * Per spec: "User deletion: Cascade soft-delete all mappings"
 * Called before hard-deleting user to preserve audit trail for future GDPR purge workflow
 */
export async function cascadeUserDeletion(userId: string): Promise<number> {
  const result = await prisma.firearm_ammo_preferences.updateMany({
    where: {
      userId,
      deletedAt: null,
    },
    data: {
      deletedAt: new Date(),
      deleteReason: 'USER_REMOVED', // Closest reason; spec doesn't define USER_DELETED
    },
  })

  log.info('Cascade user deletion: soft-deleted ammo preferences', {
    userId,
    count: result.count,
  })

  return result.count
}

/**
 * Handle SKU supersession - migrate preferences to canonical
 * Per spec: "If both deprecated and canonical SKUs are mapped:
 *   - Render canonical only.
 *   - Soft-delete deprecated mapping with delete_reason = SKU_SUPERSEDED."
 */
export async function handleSkuSupersession(
  deprecatedSkuId: string,
  canonicalSkuId: string
): Promise<number> {
  // Find all preferences pointing to deprecated SKU
  const deprecatedPrefs = await prisma.firearm_ammo_preferences.findMany({
    where: {
      ammoSkuId: deprecatedSkuId,
      deletedAt: null,
    },
  })

  let migratedCount = 0

  for (const pref of deprecatedPrefs) {
    // Check if canonical already exists for same user+firearm+useCase
    const existingCanonical = await prisma.firearm_ammo_preferences.findFirst({
      where: {
        userId: pref.userId,
        firearmId: pref.firearmId,
        ammoSkuId: canonicalSkuId,
        useCase: pref.useCase,
        deletedAt: null,
      },
    })

    if (existingCanonical) {
      // Both exist - soft-delete deprecated
      await prisma.firearm_ammo_preferences.update({
        where: { id: pref.id },
        data: {
          deletedAt: new Date(),
          deleteReason: 'SKU_SUPERSEDED',
        },
      })
    } else {
      // Only deprecated exists - migrate to canonical
      await prisma.firearm_ammo_preferences.update({
        where: { id: pref.id },
        data: { ammoSkuId: canonicalSkuId },
      })
    }

    migratedCount++
  }

  return migratedCount
}

/**
 * Get caliber compatibility check for firearm-scoped search
 * Per spec: "Firearm-Scoped Search: Apply caliber compatibility filter"
 */
export async function getFirearmCaliber(
  userId: string,
  firearmId: string
): Promise<string | null> {
  const firearm = await prisma.user_guns.findUnique({
    where: { id: firearmId },
  })

  if (!firearm || firearm.userId !== userId) {
    throw new Error('Firearm not found')
  }

  return firearm.caliber
}
