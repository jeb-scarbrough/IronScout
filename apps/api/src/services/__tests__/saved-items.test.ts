/**
 * ADR-011A: Saved Items Service Tests
 *
 * Tests for soft delete, resurrection, and deletedAt filter enforcement.
 * See: context/decisions/ADR-017-Intent-Ready-Saved-Items.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock must use inline factory - cannot reference external variables
vi.mock('@ironscout/db', () => ({
  prisma: {
    products: {
      findUnique: vi.fn(),
    },
    watchlist_items: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    alerts: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  Prisma: {},
  AlertRuleType: {},
}))

vi.mock('../../config/tiers', () => ({
  visiblePriceWhere: () => ({}),
  currentVisiblePriceWhere: () => ({}),
}))

vi.mock('../ai-search/price-resolver', () => ({
  batchGetPricesViaProductLinks: vi.fn().mockResolvedValue(new Map()),
}))

// Import the mocked prisma after vi.mock
import { prisma } from '@ironscout/db'
const mockPrisma = prisma as any

// Import after mocking
import {
  saveItem,
  unsaveItem,
  getSavedItems,
  getSavedItemById,
  getSavedItemByProductId,
  countSavedItems,
} from '../saved-items'

describe('ADR-011A: Saved Items Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('unsaveItem (soft delete)', () => {
    it('sets deletedAt instead of hard deleting', async () => {
      mockPrisma.watchlist_items.updateMany.mockResolvedValue({ count: 1 })

      await unsaveItem('user-123', 'product-456')

      expect(mockPrisma.watchlist_items.updateMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          productId: 'product-456',
          deletedAt: null,
        },
        data: {
          deletedAt: expect.any(Date),
        },
      })
    })

    it('throws error if item not found (already deleted or never existed)', async () => {
      mockPrisma.watchlist_items.updateMany.mockResolvedValue({ count: 0 })

      await expect(unsaveItem('user-123', 'product-456')).rejects.toThrow(
        'Item not found'
      )
    })

    it('only soft-deletes active items (deletedAt: null filter)', async () => {
      mockPrisma.watchlist_items.updateMany.mockResolvedValue({ count: 1 })

      await unsaveItem('user-123', 'product-456')

      const call = mockPrisma.watchlist_items.updateMany.mock.calls[0][0]
      expect(call.where.deletedAt).toBe(null)
    })
  })

  describe('saveItem (resurrection)', () => {
    const mockProduct = {
      id: 'product-456',
      name: 'Test Ammo',
      brand: 'Test Brand',
      caliber: '9mm',
      imageUrl: null,
    }

    const mockActiveItem = {
      id: 'item-123',
      userId: 'user-123',
      productId: 'product-456',
      deletedAt: null,
      intentType: 'SKU',
      notificationsEnabled: true,
      priceDropEnabled: true,
      backInStockEnabled: true,
      minDropPercent: 10,
      minDropAmount: { toString: () => '10.00' },
      stockAlertCooldownHours: 48,
      createdAt: new Date(),
      updatedAt: new Date(),
      products: {
        ...mockProduct,
        prices: [],
      },
    }

    const mockDeletedItem = {
      ...mockActiveItem,
      deletedAt: new Date('2024-01-01'),
      // Custom preferences that should be preserved
      minDropPercent: 15,
      minDropAmount: { toString: () => '20.00' },
      stockAlertCooldownHours: 72,
    }

    beforeEach(() => {
      mockPrisma.products.findUnique.mockResolvedValue(mockProduct)
      mockPrisma.alerts.upsert.mockResolvedValue({})
    })

    it('resurrects soft-deleted item instead of creating new', async () => {
      // Transaction mock that simulates finding a deleted item and resurrecting it
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          products: {
            findUnique: vi.fn().mockResolvedValue(mockProduct),
          },
          watchlist_items: {
            findFirst: vi.fn().mockResolvedValue(mockDeletedItem),
            update: vi.fn().mockResolvedValue({
              ...mockDeletedItem,
              deletedAt: null,
              updatedAt: new Date(),
            }),
            create: vi.fn(),
          },
          alerts: {
            upsert: vi.fn().mockResolvedValue({}),
          },
        }
        return callback(tx)
      })

      // Mock the getSavedItemById call after transaction
      mockPrisma.watchlist_items.findFirst.mockResolvedValue({
        ...mockActiveItem,
        minDropPercent: 15, // Preserved from deleted item
        minDropAmount: { toString: () => '20.00' },
        stockAlertCooldownHours: 72,
      })

      await saveItem('user-123', 'product-456')

      // Verify transaction was called
      expect(mockPrisma.$transaction).toHaveBeenCalled()
    })

    it('preserves preferences when resurrecting', async () => {
      let capturedUpdateData: any = null

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          products: {
            findUnique: vi.fn().mockResolvedValue(mockProduct),
          },
          watchlist_items: {
            findFirst: vi.fn().mockResolvedValue(mockDeletedItem),
            update: vi.fn().mockImplementation((args) => {
              capturedUpdateData = args.data
              return Promise.resolve({
                ...mockDeletedItem,
                deletedAt: null,
                updatedAt: new Date(),
              })
            }),
            create: vi.fn(),
          },
          alerts: {
            upsert: vi.fn().mockResolvedValue({}),
          },
        }
        return callback(tx)
      })

      mockPrisma.watchlist_items.findFirst.mockResolvedValue({
        ...mockActiveItem,
        minDropPercent: 15,
        minDropAmount: { toString: () => '20.00' },
        stockAlertCooldownHours: 72,
      })

      await saveItem('user-123', 'product-456')

      // Update should only clear deletedAt, not reset preferences
      expect(capturedUpdateData).toEqual({
        deletedAt: null,
        updatedAt: expect.any(Date),
      })
    })

    it('is idempotent for active items (no-op)', async () => {
      let updateCalled = false
      let createCalled = false

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          products: {
            findUnique: vi.fn().mockResolvedValue(mockProduct),
          },
          watchlist_items: {
            findFirst: vi.fn().mockResolvedValue(mockActiveItem), // Already active
            update: vi.fn().mockImplementation(() => {
              updateCalled = true
              return Promise.resolve(mockActiveItem)
            }),
            create: vi.fn().mockImplementation(() => {
              createCalled = true
              return Promise.resolve(mockActiveItem)
            }),
          },
          alerts: {
            upsert: vi.fn().mockResolvedValue({}),
          },
        }
        return callback(tx)
      })

      mockPrisma.watchlist_items.findFirst.mockResolvedValue(mockActiveItem)

      await saveItem('user-123', 'product-456')

      // Neither update nor create should be called for active item
      expect(updateCalled).toBe(false)
      expect(createCalled).toBe(false)
    })

    it('creates new item when no existing item found', async () => {
      let createData: any = null

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          products: {
            findUnique: vi.fn().mockResolvedValue(mockProduct),
          },
          watchlist_items: {
            findFirst: vi.fn().mockResolvedValue(null), // No existing item
            update: vi.fn(),
            create: vi.fn().mockImplementation((args) => {
              createData = args.data
              return Promise.resolve(mockActiveItem)
            }),
          },
          alerts: {
            upsert: vi.fn().mockResolvedValue({}),
          },
        }
        return callback(tx)
      })

      mockPrisma.watchlist_items.findFirst.mockResolvedValue(mockActiveItem)

      await saveItem('user-123', 'product-456')

      // Should create with defaults
      expect(createData).toMatchObject({
        userId: 'user-123',
        productId: 'product-456',
        intentType: 'SKU',
        notificationsEnabled: true,
        priceDropEnabled: true,
        backInStockEnabled: true,
        minDropPercent: 5,
        minDropAmount: 5.0,
        stockAlertCooldownHours: 24,
      })
    })
  })

  describe('deletedAt filter enforcement', () => {
    describe('getSavedItems', () => {
      it('includes deletedAt: null in query', async () => {
        mockPrisma.watchlist_items.findMany.mockResolvedValue([])

        await getSavedItems('user-123')

        expect(mockPrisma.watchlist_items.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              userId: 'user-123',
              deletedAt: null,
            }),
          })
        )
      })
    })

    describe('getSavedItemById', () => {
      it('includes deletedAt: null in query', async () => {
        mockPrisma.watchlist_items.findFirst.mockResolvedValue(null)

        await expect(getSavedItemById('user-123', 'item-456')).rejects.toThrow()

        expect(mockPrisma.watchlist_items.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              id: 'item-456',
              userId: 'user-123',
              deletedAt: null,
            }),
          })
        )
      })
    })

    describe('getSavedItemByProductId', () => {
      it('includes deletedAt: null in query', async () => {
        mockPrisma.watchlist_items.findFirst.mockResolvedValue(null)

        await getSavedItemByProductId('user-123', 'product-456')

        expect(mockPrisma.watchlist_items.findFirst).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              userId: 'user-123',
              productId: 'product-456',
              deletedAt: null,
            }),
          })
        )
      })
    })

    describe('countSavedItems', () => {
      it('includes deletedAt: null in query', async () => {
        mockPrisma.watchlist_items.count.mockResolvedValue(5)

        const count = await countSavedItems('user-123')

        expect(count).toBe(5)
        expect(mockPrisma.watchlist_items.count).toHaveBeenCalledWith({
          where: {
            userId: 'user-123',
            deletedAt: null,
          },
        })
      })
    })
  })
})
