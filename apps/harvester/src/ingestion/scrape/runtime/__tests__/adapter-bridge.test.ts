import { describe, expect, it, vi } from 'vitest'
import type { ScrapeSitePlugin } from '../../types.js'

vi.mock('../../../../scraper/process/validator.js', () => ({
  validateOffer: vi.fn((offer: unknown) => ({ status: 'ok', offer })),
}))

import { pluginToLegacyAdapter } from '../adapter-bridge.js'

function createPlugin(overrides: Partial<ScrapeSitePlugin> = {}): ScrapeSitePlugin {
  return {
    manifest: {
      id: 'testsite',
      name: 'Test Site',
      owner: 'harvester',
      version: '1.0.0',
      mode: 'html',
      baseUrls: ['https://www.testsite.com'],
    },
    fetchRaw: vi.fn(async () => ({
      ok: true as const,
      statusCode: 200,
      body: '<html />',
      durationMs: 10,
    })),
    extractRaw: vi.fn(() => ({
      ok: true as const,
      rawOffers: [
        {
          title: 'A',
          price: '10.00',
          availability: 'IN STOCK',
          url: 'https://www.testsite.com/p/1',
        },
      ],
    })),
    normalizeRaw: vi.fn(({ sourceId, retailerId, observedAt, rawOffer, manifest }) => ({
      status: 'ok' as const,
      offer: {
        sourceId,
        retailerId,
        title: rawOffer.title,
        priceCents: 1000,
        currency: 'USD' as const,
        availability: 'IN_STOCK' as const,
        observedAt,
        url: rawOffer.url,
        identityKey: 'URL:abc',
        adapterVersion: manifest.version,
      },
    })),
    ...overrides,
  }
}

describe('pluginToLegacyAdapter bridge', () => {
  it('does not call plugin fetch in bridge mode', () => {
    const plugin = createPlugin()
    const adapter = pluginToLegacyAdapter(plugin)

    const result = adapter.extract('<html/>', 'https://www.testsite.com/p/1', {
      sourceId: 'source-1',
      retailerId: 'retailer-1',
      runId: 'run-1',
      targetId: 'target-1',
      now: new Date('2026-02-01T00:00:00.000Z'),
      logger: {} as any,
    })

    expect(result.ok).toBe(true)
    expect(plugin.fetchRaw).not.toHaveBeenCalled()
  })

  it('maps ambiguous variants to explicit legacy failure', () => {
    const plugin = createPlugin({
      extractRaw: vi.fn(() => ({
        ok: false as const,
        reason: 'AMBIGUOUS_VARIANTS' as const,
        details: 'multiple variants without stable selectors',
      })),
    })

    const adapter = pluginToLegacyAdapter(plugin)
    const result = adapter.extract('<html/>', 'https://www.testsite.com/p/1', {
      sourceId: 'source-1',
      retailerId: 'retailer-1',
      runId: 'run-1',
      targetId: 'target-1',
      now: new Date('2026-02-01T00:00:00.000Z'),
      logger: {} as any,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toBe('PAGE_STRUCTURE_CHANGED')
    expect(result.details).toContain('multiple variants')
  })
})
