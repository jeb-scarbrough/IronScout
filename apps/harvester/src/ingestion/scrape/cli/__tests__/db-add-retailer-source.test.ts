import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getManifest: vi.fn(),
  retailersFindUnique: vi.fn(),
  retailersUpsert: vi.fn(),
  adapterFindUnique: vi.fn(),
  adapterUpsert: vi.fn(),
  sourcesFindMany: vi.fn(),
  sourcesUpdate: vi.fn(),
  sourcesCreate: vi.fn(),
  trustFindUnique: vi.fn(),
  trustUpsert: vi.fn(),
  auditCreate: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('../../registry.js', () => ({
  getRegisteredSitePluginManifest: mocks.getManifest,
}))

vi.mock('@ironscout/db', () => ({
  prisma: {
    retailers: {
      findUnique: mocks.retailersFindUnique,
      upsert: mocks.retailersUpsert,
    },
    scrape_adapter_status: {
      findUnique: mocks.adapterFindUnique,
      upsert: mocks.adapterUpsert,
    },
    sources: {
      findMany: mocks.sourcesFindMany,
      update: mocks.sourcesUpdate,
      create: mocks.sourcesCreate,
    },
    source_trust_config: {
      findUnique: mocks.trustFindUnique,
      upsert: mocks.trustUpsert,
    },
    admin_audit_logs: {
      create: mocks.auditCreate,
    },
    $transaction: mocks.transaction,
  },
}))

import { runDbAddRetailerSourceCommand } from '../commands/db-add-retailer-source.js'

describe('db:add-retailer-source command', () => {
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

    mocks.retailersFindUnique.mockResolvedValue(null)
    mocks.retailersUpsert.mockResolvedValue({
      id: 'retailer-1',
      name: 'Retailer',
      website: 'https://retailer.test/',
      visibilityStatus: 'INELIGIBLE',
    })

    mocks.adapterFindUnique.mockResolvedValue(null)
    mocks.adapterUpsert.mockResolvedValue({
      adapterId: 'testsite',
      enabled: true,
      ingestionPaused: false,
    })

    mocks.sourcesFindMany.mockResolvedValue([])
    mocks.sourcesCreate.mockResolvedValue({
      id: 'source-1',
      name: 'Source',
      url: 'https://retailer.test/products',
      type: 'HTML',
      retailerId: 'retailer-1',
      adapterId: 'testsite',
      scrapeEnabled: false,
      robotsCompliant: true,
      scrapeConfig: { customHeaders: { Accept: 'application/json' } },
    })

    mocks.trustFindUnique.mockResolvedValue(null)
    mocks.trustUpsert.mockResolvedValue({
      id: 'trust-1',
      sourceId: 'source-1',
      upcTrusted: false,
      version: 1,
    })
    mocks.auditCreate.mockResolvedValue({ id: 'audit-1' })

    mocks.transaction.mockImplementation(async (callback: any) =>
      callback({
        retailers: {
          findUnique: mocks.retailersFindUnique,
          upsert: mocks.retailersUpsert,
        },
        scrape_adapter_status: {
          findUnique: mocks.adapterFindUnique,
          upsert: mocks.adapterUpsert,
        },
        sources: {
          findMany: mocks.sourcesFindMany,
          update: mocks.sourcesUpdate,
          create: mocks.sourcesCreate,
        },
        source_trust_config: {
          findUnique: mocks.trustFindUnique,
          upsert: mocks.trustUpsert,
        },
        admin_audit_logs: {
          create: mocks.auditCreate,
        },
      })
    )
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
  })

  it('creates expected source defaults and writes audit log in one transaction', async () => {
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
    expect(mocks.transaction).toHaveBeenCalledTimes(1)
    expect(mocks.sourcesCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scrapeEnabled: false,
          robotsCompliant: true,
          adapterId: 'testsite',
        }),
      })
    )
    expect(mocks.auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'SCRAPER_DB_ADD_RETAILER_SOURCE',
          resource: 'scraper_source_onboarding',
        }),
      })
    )
  })

  it('scopes source-name matching to the same adapter or unassigned sources', async () => {
    const result = await runDbAddRetailerSourceCommand({
      siteId: 'testsite',
      retailerName: 'Retailer',
      website: 'https://retailer.test',
      sourceName: 'Source',
      sourceUrl: 'https://retailer.test/products',
    })

    expect(result).toBe(0)
    expect(mocks.sourcesFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { retailerId: 'retailer-1', name: 'Source', adapterId: 'testsite' },
            { retailerId: 'retailer-1', name: 'Source', adapterId: null },
          ]),
        }),
      })
    )
  })
})
