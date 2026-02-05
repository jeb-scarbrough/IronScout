/**
 * Account Deletion — Query Analytics Anonymization Tests
 *
 * Verifies that finalizeAccountDeletion() nullifies user-linked fields
 * in search_query_logs and price_check_query_logs for DSAR compliance.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUpdateManySearchLogs = vi.fn().mockResolvedValue({ count: 2 })
const mockUpdateManyPriceCheckLogs = vi.fn().mockResolvedValue({ count: 1 })
const mockUpdateManyProductReports = vi.fn().mockResolvedValue({ count: 0 })
const mockDeleteManyWatchlistItems = vi.fn().mockResolvedValue({ count: 0 })
const mockDeleteManyWatchlistCollections = vi.fn().mockResolvedValue({ count: 0 })
const mockDeleteManyDataSubscriptions = vi.fn().mockResolvedValue({ count: 0 })
const mockDeleteManyUserGuns = vi.fn().mockResolvedValue({ count: 0 })
const mockDeleteManySubscriptions = vi.fn().mockResolvedValue({ count: 0 })
const mockDeleteManySessions = vi.fn().mockResolvedValue({ count: 0 })
const mockDeleteManyAccounts = vi.fn().mockResolvedValue({ count: 0 })
const mockUsersUpdate = vi.fn().mockResolvedValue({})
const mockAuditCreate = vi.fn().mockResolvedValue({})

const TX_CLIENT = {
  watchlist_items: { deleteMany: mockDeleteManyWatchlistItems },
  watchlist_collections: { deleteMany: mockDeleteManyWatchlistCollections },
  data_subscriptions: { deleteMany: mockDeleteManyDataSubscriptions },
  user_guns: { deleteMany: mockDeleteManyUserGuns },
  product_reports: { updateMany: mockUpdateManyProductReports },
  search_query_logs: { updateMany: mockUpdateManySearchLogs },
  price_check_query_logs: { updateMany: mockUpdateManyPriceCheckLogs },
  subscriptions: { deleteMany: mockDeleteManySubscriptions },
  session: { deleteMany: mockDeleteManySessions },
  Account: { deleteMany: mockDeleteManyAccounts },
  users: { update: mockUsersUpdate },
  admin_audit_logs: { create: mockAuditCreate },
}

vi.mock('@ironscout/db', () => ({
  prisma: {
    users: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        status: 'PENDING_DELETION',
        deletionScheduledFor: new Date('2020-01-01'),
      }),
    },
    $transaction: vi.fn().mockImplementation(async (fn: (tx: typeof TX_CLIENT) => Promise<void>) => {
      await fn(TX_CLIENT)
    }),
  },
}))

vi.mock('../../config/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}))

vi.mock('../email', () => ({
  sendAccountDeletionEmail: vi.fn(),
}))

vi.mock('../firearm-ammo-preference', () => ({
  cascadeUserDeletion: vi.fn().mockResolvedValue(0),
}))

describe('finalizeAccountDeletion — query analytics anonymization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('anonymizes userId, userAgent, referrer, gunLockerCalibers in search_query_logs', async () => {
    const { finalizeAccountDeletion } = await import('../account-deletion')

    const result = await finalizeAccountDeletion('user-123')
    expect(result.success).toBe(true)

    expect(mockUpdateManySearchLogs).toHaveBeenCalledWith({
      where: { userId: 'user-123' },
      data: { userId: null, userAgent: null, referrer: null, gunLockerCalibers: [] },
    })
  })

  it('anonymizes userId, userAgent, referrer, gunLockerCalibers in price_check_query_logs', async () => {
    const { finalizeAccountDeletion } = await import('../account-deletion')

    const result = await finalizeAccountDeletion('user-123')
    expect(result.success).toBe(true)

    expect(mockUpdateManyPriceCheckLogs).toHaveBeenCalledWith({
      where: { userId: 'user-123' },
      data: { userId: null, userAgent: null, referrer: null, gunLockerCalibers: [] },
    })
  })
})
