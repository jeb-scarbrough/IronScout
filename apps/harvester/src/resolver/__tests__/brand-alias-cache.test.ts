import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { EventEmitter } from 'events'

vi.mock('@ironscout/db', () => ({
  PrismaClient: vi.fn(),
  Prisma: {
    BrandAliasStatus: { ACTIVE: 'ACTIVE', PENDING_REVIEW: 'PENDING_REVIEW', DISABLED: 'DISABLED' },
  },
}))

// Mock Redis client - stored globally for test access
const mockRedisInstances: EventEmitter[] = []

class MockRedisClass extends EventEmitter {
  connect = vi.fn().mockResolvedValue(undefined)
  subscribe = vi.fn().mockResolvedValue(undefined)
  unsubscribe = vi.fn().mockResolvedValue(undefined)
  quit = vi.fn().mockResolvedValue(undefined)

  constructor() {
    super()
    mockRedisInstances.push(this)
  }
}

vi.mock('ioredis', () => ({
  default: MockRedisClass,
}))

vi.mock('../config/redis', () => ({
  redisConnection: { host: 'localhost', port: 6379 },
  getSharedBullMQConnection: vi.fn(() => ({})),
}))

vi.mock('@ironscout/notifications', () => ({
  sendSlackMessage: vi.fn().mockResolvedValue({ success: true }),
  slackHeader: (text: string) => ({ type: 'header', text: { type: 'plain_text', text } }),
  slackFieldsSection: () => ({ type: 'section', text: { type: 'mrkdwn', text: 'fields' } }),
  slackActions: (...elements: unknown[]) => ({ type: 'actions', elements }),
  slackButton: (text: string, url: string) => ({
    type: 'button',
    text: { type: 'plain_text', text },
    url,
  }),
  slackContext: (...texts: string[]) => ({
    type: 'context',
    elements: texts.map(text => ({ type: 'mrkdwn', text })),
  }),
  SLACK_CONFIG: { adminPortalUrl: 'https://admin.test' },
  wrapLoggerWithSlack: (logger: unknown) => logger,
}))

describe('recordAliasApplication', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    process.env.BRAND_ALIAS_HIGH_IMPACT_THRESHOLD = '2'
  })

  it('sends Slack alert when count reaches threshold within 24h', async () => {
    const { recordAliasApplication } = await import('../brand-alias-cache')
    const notifications = await import('@ironscout/notifications')
    const sendSlackMessage = notifications.sendSlackMessage as Mock

    const prisma = {
      brand_alias_applications_daily: {
        upsert: vi.fn().mockResolvedValue({ count: 2 }),
      },
      brand_aliases: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'alias-1',
          aliasNorm: 'federal',
          canonicalNorm: 'federal premium',
          status: 'ACTIVE',
          createdAt: new Date(Date.now() - 1000),
          updatedAt: new Date(),
        }),
      },
    }

    await recordAliasApplication(prisma as any, 'alias-1')

    expect(sendSlackMessage).toHaveBeenCalledTimes(1)
  })

  it('does not send Slack alert when below threshold', async () => {
    const { recordAliasApplication } = await import('../brand-alias-cache')
    const notifications = await import('@ironscout/notifications')
    const sendSlackMessage = notifications.sendSlackMessage as Mock

    const prisma = {
      brand_alias_applications_daily: {
        upsert: vi.fn().mockResolvedValue({ count: 1 }),
      },
      brand_aliases: {
        findUnique: vi.fn(),
      },
    }

    await recordAliasApplication(prisma as any, 'alias-1')

    expect(sendSlackMessage).not.toHaveBeenCalled()
    expect(prisma.brand_aliases.findUnique).not.toHaveBeenCalled()
  })
})

describe('BrandAliasCache', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockRedisInstances.length = 0 // Clear instances
  })

  describe('concurrent invalidation during refresh', () => {
    it('queues re-refresh when invalidation arrives during active refresh', async () => {
      const { brandAliasCache } = await import('../brand-alias-cache')

      let dbQueryCount = 0
      let resolveSlowQuery: () => void
      const mockPrisma = {
        brand_aliases: {
          findMany: vi.fn().mockImplementation(() => {
            dbQueryCount++
            // First call (from initialize) returns fast
            // Second call (our test refresh) returns slow
            // Third call (re-refresh) returns fast
            if (dbQueryCount === 2) {
              return new Promise<never[]>((resolve) => {
                resolveSlowQuery = () => resolve([])
              })
            }
            return Promise.resolve([])
          }),
        },
      }

      await brandAliasCache.initialize(mockPrisma as any)
      // dbQueryCount is now 1 from initialize

      // Start slow refresh (will block on promise)
      const refresh1Promise = brandAliasCache.refresh()

      // While refresh is in progress, trigger another (should set pendingInvalidation)
      brandAliasCache.refresh()

      // Complete the slow query
      resolveSlowQuery!()
      await refresh1Promise

      // Wait for setImmediate to fire the queued re-refresh
      await new Promise((r) => setImmediate(r))
      await new Promise((r) => setImmediate(r))

      // Should have 3 queries: init + test refresh + re-refresh from pending
      expect(dbQueryCount).toBe(3)

      await brandAliasCache.stop()
    })
  })

  describe('subscriber reconnection', () => {
    it('re-subscribes to channel on Redis reconnect', async () => {
      const { brandAliasCache } = await import('../brand-alias-cache')

      const mockPrisma = {
        brand_aliases: {
          findMany: vi.fn().mockResolvedValue([]),
        },
      }

      await brandAliasCache.initialize(mockPrisma as any)

      // Get the Redis subscriber instance
      const redisSubscriber = mockRedisInstances[mockRedisInstances.length - 1] as MockRedisClass

      // Initial subscription during initialize (1 from ready event + 1 from explicit call)
      const initialCallCount = redisSubscriber.subscribe.mock.calls.length

      // Simulate Redis reconnection by emitting 'ready' event
      redisSubscriber.emit('ready')

      // Wait for async subscribe
      await new Promise((r) => setImmediate(r))

      // Should have one more subscribe call after reconnect
      expect(redisSubscriber.subscribe.mock.calls.length).toBe(initialCallCount + 1)
      expect(redisSubscriber.subscribe).toHaveBeenCalledWith('brand-alias:invalidate')

      await brandAliasCache.stop()
    })
  })

  describe('bulk invalidation coalescing', () => {
    it('coalesces concurrent refreshes via isRefreshing guard', async () => {
      const { brandAliasCache } = await import('../brand-alias-cache')

      let dbQueryCount = 0
      let resolveSlowQuery: () => void
      const mockPrisma = {
        brand_aliases: {
          findMany: vi.fn().mockImplementation(() => {
            dbQueryCount++
            // First call (from initialize) returns fast
            // Second call (our test) returns slow to allow coalescing
            // Third call (re-refresh) returns fast
            if (dbQueryCount === 2) {
              return new Promise<never[]>((resolve) => {
                resolveSlowQuery = () => resolve([])
              })
            }
            return Promise.resolve([])
          }),
        },
      }

      await brandAliasCache.initialize(mockPrisma as any)
      // dbQueryCount is now 1 from initialize

      // Start first refresh (slow)
      const refresh1 = brandAliasCache.refresh()

      // While first is in progress, trigger 5 more (all should be coalesced)
      brandAliasCache.refresh()
      brandAliasCache.refresh()
      brandAliasCache.refresh()
      brandAliasCache.refresh()
      brandAliasCache.refresh()

      // Complete slow query
      resolveSlowQuery!()
      await refresh1

      // Wait for setImmediate (triggers re-refresh from pendingInvalidation)
      await new Promise((r) => setImmediate(r))
      await new Promise((r) => setImmediate(r))

      // Should only be 3: init + test refresh + one re-refresh (not 1 + 6)
      expect(dbQueryCount).toBe(3)

      await brandAliasCache.stop()
    })
  })
})
