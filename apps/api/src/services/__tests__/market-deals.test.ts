/**
 * ADR-021: Market deals queries must include SCRAPE guardrails
 * and avoid duplicate join aliases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@ironscout/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

vi.mock('../../config/redis', () => ({
  getRedisClient: () => ({
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue('OK'),
  }),
}))

vi.mock('../../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  loggers: {
    dashboard: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  },
}))

import { prisma } from '@ironscout/db'
import { getMarketDeals } from '../market-deals'

const mockPrisma = prisma as any

const getQueryText = (call: any[]): string => {
  const strings = call[0]
  if (Array.isArray(strings)) {
    return strings.join('')
  }
  if (strings?.raw && Array.isArray(strings.raw)) {
    return strings.raw.join('')
  }
  return ''
}

const countOccurrences = (text: string, needle: string): number =>
  text.split(needle).length - 1

const expectScrapeGuardrail = (query: string) => {
  expect(query).toContain('"ingestionRunType"')
  expect(query).toContain("= 'SCRAPE'")
  expect(query).toContain('scrape_adapter_status')
  expect(query).toContain('s."adapterId" IS NOT NULL')
}

describe('market deals ADR-021 compliance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$queryRaw.mockResolvedValue([])
  })

  it('includes SCRAPE guardrails and avoids duplicate joins', async () => {
    await getMarketDeals()

    const queries = mockPrisma.$queryRaw.mock.calls.map(getQueryText)
    const guardrailQueries = queries.filter((q) => q.includes("ingestionRunType") && q.includes("'SCRAPE'"))

    expect(guardrailQueries.length).toBeGreaterThan(0)

    for (const query of guardrailQueries) {
      expectScrapeGuardrail(query)
      expect(countOccurrences(query, 'LEFT JOIN sources s')).toBe(1)
      expect(countOccurrences(query, 'LEFT JOIN scrape_adapter_status sas')).toBe(1)
    }
  })
})
