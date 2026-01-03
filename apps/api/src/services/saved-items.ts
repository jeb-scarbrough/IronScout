/**
 * Saved Items Service (ADR-011 Phase 2)
 *
 * Core business logic for the unified Saved Items concept.
 * Single save action creates both tracking (WatchlistItem) and notifications (Alert).
 *
 * Design principle:
 * Alert records are declarative rule markers; all user preferences and runtime state
 * are stored on WatchlistItem.
 */

import { prisma, AlertRuleType, Prisma } from '@ironscout/db'
import { visiblePriceWhere } from '../config/tiers'

// ============================================================================
// Types
// ============================================================================

export interface SavedItemDTO {
  id: string
  productId: string
  name: string
  brand: string
  caliber: string
  price: number | null
  inStock: boolean
  imageUrl: string | null
  savedAt: string

  // Notification preferences
  notificationsEnabled: boolean
  priceDropEnabled: boolean
  backInStockEnabled: boolean
  minDropPercent: number
  minDropAmount: number
  stockAlertCooldownHours: number
}

export interface SavedItemsResponse {
  items: SavedItemDTO[]
  _meta: {
    tier: string
    itemCount: number
    itemLimit: number
    canAddMore: boolean
  }
}

export interface UpdatePrefsInput {
  notificationsEnabled?: boolean
  priceDropEnabled?: boolean
  backInStockEnabled?: boolean
  minDropPercent?: number
  minDropAmount?: number
  stockAlertCooldownHours?: number
}

// Validation constraints
const PREFS_VALIDATION = {
  minDropPercent: { min: 0, max: 100 },
  minDropAmount: { min: 0 },
  stockAlertCooldownHours: { min: 1, max: 168 }, // 1 hour to 1 week
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Save an item (idempotent)
 *
 * Creates WatchlistItem with defaults if missing.
 * Creates Alert rows for PRICE_DROP and BACK_IN_STOCK if missing.
 * All in one DB transaction.
 */
export async function saveItem(
  userId: string,
  productId: string
): Promise<SavedItemDTO> {
  // Verify product exists
  const product = await prisma.products.findUnique({
    where: { id: productId },
    select: { id: true, name: true, brand: true, caliber: true, imageUrl: true }
  })

  if (!product) {
    throw new Error('Product not found')
  }

  // Upsert in transaction
  const result = await prisma.$transaction(async (tx) => {
    // Upsert WatchlistItem
    const watchlistItem = await tx.watchlist_items.upsert({
      where: {
        userId_productId: { userId, productId }
      },
      create: {
        userId,
        productId,
        // Defaults from schema
        notificationsEnabled: true,
        priceDropEnabled: true,
        backInStockEnabled: true,
        minDropPercent: 5,
        minDropAmount: 5.0,
        stockAlertCooldownHours: 24,
      },
      update: {
        // No-op on conflict - item already exists
        updatedAt: new Date(),
      },
    })

    // Upsert PRICE_DROP alert
    await tx.alerts.upsert({
      where: {
        userId_productId_ruleType: {
          userId,
          productId,
          ruleType: 'PRICE_DROP',
        },
      },
      create: {
        userId,
        productId,
        watchlistItemId: watchlistItem.id,
        ruleType: 'PRICE_DROP',
        isEnabled: true,
      },
      update: {
        // No-op - alert already exists
        updatedAt: new Date(),
      },
    })

    // Upsert BACK_IN_STOCK alert
    await tx.alerts.upsert({
      where: {
        userId_productId_ruleType: {
          userId,
          productId,
          ruleType: 'BACK_IN_STOCK',
        },
      },
      create: {
        userId,
        productId,
        watchlistItemId: watchlistItem.id,
        ruleType: 'BACK_IN_STOCK',
        isEnabled: true,
      },
      update: {
        // No-op - alert already exists
        updatedAt: new Date(),
      },
    })

    return watchlistItem
  })

  // Fetch full DTO with product info
  return await getSavedItemById(userId, result.id)
}

/**
 * Unsave an item
 *
 * Hard deletes WatchlistItem. Alerts cascade delete via FK.
 */
export async function unsaveItem(
  userId: string,
  productId: string
): Promise<void> {
  const deleted = await prisma.watchlist_items.deleteMany({
    where: { userId, productId }
  })

  if (deleted.count === 0) {
    throw new Error('Item not found')
  }
}

/**
 * Get all saved items for a user
 */
export async function getSavedItems(userId: string): Promise<SavedItemDTO[]> {
  const items = await prisma.watchlist_items.findMany({
    where: { userId },
    include: {
      products: {
        select: {
          id: true,
          name: true,
          brand: true,
          caliber: true,
          imageUrl: true,
          prices: {
            where: {
              inStock: true,
              ...visiblePriceWhere(),
            },
            orderBy: [{ price: 'asc' }],
            take: 1,
            select: {
              price: true,
              inStock: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return items.map(mapToDTO)
}

/**
 * Get a single saved item by WatchlistItem ID
 */
export async function getSavedItemById(
  userId: string,
  id: string
): Promise<SavedItemDTO> {
  const item = await prisma.watchlist_items.findFirst({
    where: { id, userId },
    include: {
      products: {
        select: {
          id: true,
          name: true,
          brand: true,
          caliber: true,
          imageUrl: true,
          prices: {
            where: {
              inStock: true,
              ...visiblePriceWhere(),
            },
            orderBy: [{ price: 'asc' }],
            take: 1,
            select: {
              price: true,
              inStock: true,
            },
          },
        },
      },
    },
  })

  if (!item) {
    throw new Error('Item not found')
  }

  return mapToDTO(item)
}

/**
 * Get a single saved item by productId
 */
export async function getSavedItemByProductId(
  userId: string,
  productId: string
): Promise<SavedItemDTO | null> {
  const item = await prisma.watchlist_items.findUnique({
    where: {
      userId_productId: { userId, productId }
    },
    include: {
      products: {
        select: {
          id: true,
          name: true,
          brand: true,
          caliber: true,
          imageUrl: true,
          prices: {
            where: {
              inStock: true,
              ...visiblePriceWhere(),
            },
            orderBy: [{ price: 'asc' }],
            take: 1,
            select: {
              price: true,
              inStock: true,
            },
          },
        },
      },
    },
  })

  if (!item) {
    return null
  }

  return mapToDTO(item)
}

/**
 * Update saved item preferences
 */
export async function updateSavedItemPrefs(
  userId: string,
  productId: string,
  prefs: UpdatePrefsInput
): Promise<SavedItemDTO> {
  // Validate input
  validatePrefs(prefs)

  // Find existing item
  const existing = await prisma.watchlist_items.findUnique({
    where: {
      userId_productId: { userId, productId }
    },
  })

  if (!existing) {
    throw new Error('Item not found')
  }

  // Build update data
  const updateData: Prisma.watchlist_itemsUpdateInput = {}

  if (prefs.notificationsEnabled !== undefined) {
    updateData.notificationsEnabled = prefs.notificationsEnabled
  }
  if (prefs.priceDropEnabled !== undefined) {
    updateData.priceDropEnabled = prefs.priceDropEnabled
  }
  if (prefs.backInStockEnabled !== undefined) {
    updateData.backInStockEnabled = prefs.backInStockEnabled
  }
  if (prefs.minDropPercent !== undefined) {
    updateData.minDropPercent = prefs.minDropPercent
  }
  if (prefs.minDropAmount !== undefined) {
    updateData.minDropAmount = prefs.minDropAmount
  }
  if (prefs.stockAlertCooldownHours !== undefined) {
    updateData.stockAlertCooldownHours = prefs.stockAlertCooldownHours
  }

  // Update
  await prisma.watchlist_items.update({
    where: { id: existing.id },
    data: updateData,
  })

  // Return updated DTO
  return await getSavedItemById(userId, existing.id)
}

/**
 * Count saved items for a user
 */
export async function countSavedItems(userId: string): Promise<number> {
  return await prisma.watchlist_items.count({
    where: { userId }
  })
}

// ============================================================================
// Helpers
// ============================================================================

type WatchlistItemWithProduct = Prisma.watchlist_itemsGetPayload<{
  include: {
    products: {
      select: {
        id: true
        name: true
        brand: true
        caliber: true
        imageUrl: true
        prices: {
          select: {
            price: true
            inStock: true
          }
        }
      }
    }
  }
}>

function mapToDTO(item: WatchlistItemWithProduct): SavedItemDTO {
  const lowestPrice = item.products.prices[0]

  return {
    id: item.id,
    productId: item.productId,
    name: item.products.name,
    brand: item.products.brand || '',
    caliber: item.products.caliber || '',
    price: lowestPrice ? parseFloat(lowestPrice.price.toString()) : null,
    inStock: item.products.prices.length > 0 && lowestPrice?.inStock === true,
    imageUrl: item.products.imageUrl || null,
    savedAt: item.createdAt.toISOString(),

    notificationsEnabled: item.notificationsEnabled,
    priceDropEnabled: item.priceDropEnabled,
    backInStockEnabled: item.backInStockEnabled,
    minDropPercent: item.minDropPercent,
    minDropAmount: parseFloat(item.minDropAmount.toString()),
    stockAlertCooldownHours: item.stockAlertCooldownHours,
  }
}

function validatePrefs(prefs: UpdatePrefsInput): void {
  if (prefs.minDropPercent !== undefined) {
    if (prefs.minDropPercent < PREFS_VALIDATION.minDropPercent.min ||
        prefs.minDropPercent > PREFS_VALIDATION.minDropPercent.max) {
      throw new Error(`minDropPercent must be between ${PREFS_VALIDATION.minDropPercent.min} and ${PREFS_VALIDATION.minDropPercent.max}`)
    }
  }

  if (prefs.minDropAmount !== undefined) {
    if (prefs.minDropAmount < PREFS_VALIDATION.minDropAmount.min) {
      throw new Error(`minDropAmount must be >= ${PREFS_VALIDATION.minDropAmount.min}`)
    }
  }

  if (prefs.stockAlertCooldownHours !== undefined) {
    if (prefs.stockAlertCooldownHours < PREFS_VALIDATION.stockAlertCooldownHours.min ||
        prefs.stockAlertCooldownHours > PREFS_VALIDATION.stockAlertCooldownHours.max) {
      throw new Error(`stockAlertCooldownHours must be between ${PREFS_VALIDATION.stockAlertCooldownHours.min} and ${PREFS_VALIDATION.stockAlertCooldownHours.max}`)
    }
  }
}
