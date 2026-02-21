import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getManifest: vi.fn(),
  log: vi.fn(),
  error: vi.fn(),
}))

vi.mock('../../registry.js', () => ({
  getRegisteredSitePluginManifest: mocks.getManifest,
}))

import { runDbAddRetailerSourceCommand } from '../commands/db-add-retailer-source.js'

describe('db:add-retailer-source command (sql output mode)', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.getManifest.mockReturnValue({
      id: 'testsite',
      name: 'Test Site',
      owner: 'harvester',
      version: '1.0.0',
      mode: 'html',
      baseUrls: ['https://www.testsite.com'],
    })

    vi.spyOn(console, 'log').mockImplementation(mocks.log)
    vi.spyOn(console, 'error').mockImplementation(mocks.error)
  })

  it('fails closed when both scrape-config-file and scrape-config-json are passed', async () => {
    const result = await runDbAddRetailerSourceCommand({
      siteId: 'testsite',
      retailerName: 'Retailer',
      website: 'https://retailer.test',
      sourceName: 'Source',
      sourceUrl: 'https://retailer.test/products',
      scrapeConfigFile: 'tmp/config.json',
      scrapeConfigJson: '{"fetcherType":"http"}',
    })

    expect(result).toBe(2)
    expect(mocks.error).toHaveBeenCalled()
  })

  it('returns SQL onboarding script without DB access (non-dry-run)', async () => {
    const result = await runDbAddRetailerSourceCommand({
      siteId: 'testsite',
      retailerName: 'Retailer',
      website: 'https://retailer.test',
      sourceName: 'Source',
      sourceUrl: 'https://retailer.test/products',
      scrapeConfigJson: '{"customHeaders":{"Accept":"application/json"},"extra":"x"}',
      scrapeConfigMerge: 'deep',
    })

    expect(result).toBe(0)
    const sql = mocks.log.mock.calls[mocks.log.mock.calls.length - 1]?.[0]
    expect(typeof sql).toBe('string')
    expect(sql).toContain('BEGIN;')
    expect(sql).toContain('INSERT INTO retailers')
    expect(sql).toContain("v_site_id text := 'testsite';")
    expect(sql).toContain("'unknownScrapeConfigTopLevelKeys', v_unknown_top_level_keys")
    expect(sql).toContain('COMMIT;')
  })

  it('returns SQL onboarding script in dry-run mode', async () => {
    const result = await runDbAddRetailerSourceCommand({
      siteId: 'testsite',
      retailerName: 'Retailer',
      website: 'https://retailer.test',
      sourceName: 'Source',
      sourceUrl: 'https://retailer.test/products',
      dryRun: true,
    })

    expect(result).toBe(0)
    const sql = mocks.log.mock.calls[mocks.log.mock.calls.length - 1]?.[0]
    expect(typeof sql).toBe('string')
    expect(sql).toContain('BEGIN;')
    expect(sql).toContain('ROLLBACK;')
  })
})
