import 'dotenv/config'
import { prisma } from './index.js'

const DISCOVERY_LISTING_URL =
  'https://www.primaryarms.com/api/items?c=3901023&commercecategoryurl=%2Fammo&country=US&currency=USD&fieldset=search&include=facets&language=en&limit=96&matrixchilditems_fieldset=matrixchilditems_mini&n=2&offset=0&pricelevel=5&sort=custitem_ns_sc_ext_ts_365_amount%3Adesc%2Crelevance%3Adesc&type=handgun%2Crifle%2Crimfire%2Cshotgun&use_pcv=F'
const TARGET_URL_TEMPLATE =
  'https://www.primaryarms.com/api/items?c=3901023&country=US&currency=USD&fieldset=details&include=facets&language=en&n=2&pricelevel=5&url={slug}&use_pcv=F'

async function main() {
  try {
    // 1. Check/create Primary Arms retailer
    let retailer = await prisma.retailers.findFirst({
      where: {
        OR: [
          { name: { contains: 'Primary Arms', mode: 'insensitive' } },
          { website: { contains: 'primaryarms.com' } },
        ],
      },
    })

    if (!retailer) {
      console.log('Creating Primary Arms retailer...')
      // Per spec §12.3: New retailers start ineligible until admin review
      retailer = await prisma.retailers.create({
        data: {
          name: 'Primary Arms',
          website: 'https://www.primaryarms.com',
          tier: 'STANDARD',
          visibilityStatus: 'INELIGIBLE',
        },
      })
      console.log('Created retailer:', retailer.id, retailer.name)
      console.log('⚠️  Retailer visibility is INELIGIBLE - admin must approve before data is visible')
    } else {
      console.log('Found retailer:', retailer.id, retailer.name)
    }

    // Ensure adapter status exists before attaching adapterId to sources (FK constraint)
    const adapter = await prisma.scrape_adapter_status.upsert({
      where: { adapterId: 'primaryarms' },
      create: {
        adapterId: 'primaryarms',
        enabled: true,
      },
      update: {
        enabled: true,
      },
    })
    console.log('Adapter status:', adapter.adapterId, 'enabled:', adapter.enabled)

    // 2. Check/create Primary Arms source
    let source = await prisma.sources.findFirst({
      where: {
        OR: [
          { name: { contains: 'Primary Arms', mode: 'insensitive' } },
          { url: { contains: 'primaryarms.com' } },
        ],
      },
    })

    if (!source) {
      console.log('Creating Primary Arms source...')
      // Per spec §12.3: scrapeEnabled=false by default until admin review
      source = await prisma.sources.create({
        data: {
          name: 'Primary Arms Scraper',
          url: 'https://www.primaryarms.com',
          type: 'HTML',
          enabled: true,
          retailerId: retailer.id,
          adapterId: 'primaryarms',
          scrapeEnabled: false,
          robotsCompliant: true,
        },
      })
      console.log('Created source:', source.id, source.name)

      // Create source_trust_config with safe defaults
      await prisma.source_trust_config.create({
        data: {
          sourceId: source.id,
          upcTrusted: false,
        },
      })
      console.log('Created source_trust_config with upcTrusted=false')
      console.log('⚠️  Source scraping is DISABLED - admin must enable after review')
    } else {
      // Update existing source with adapter (don't auto-enable)
      source = await prisma.sources.update({
        where: { id: source.id },
        data: {
          adapterId: 'primaryarms',
        },
      })
      console.log('Updated source:', source.id, source.name)
    }

    const existingScrapeConfig =
      source.scrapeConfig && typeof source.scrapeConfig === 'object'
        ? (source.scrapeConfig as Record<string, unknown>)
        : {}
    const existingDiscovery =
      existingScrapeConfig.discovery && typeof existingScrapeConfig.discovery === 'object'
        ? (existingScrapeConfig.discovery as Record<string, unknown>)
        : {}

    const nextScrapeConfig = {
      ...existingScrapeConfig,
      // Primary Arms /api/items endpoint returns JSON, not HTML
      // Must set Accept header to avoid 406 Not Acceptable errors
      customHeaders: {
        Accept: 'application/json',
      },
      discovery: {
        allowlist: [DISCOVERY_LISTING_URL],
        productPathPrefix: '/',
        paginate: true,
        maxPages: 10,
        maxUrls: 1000,
        targetUrlTemplate: TARGET_URL_TEMPLATE,
        ...existingDiscovery,
      },
    }

    source = await prisma.sources.update({
      where: { id: source.id },
      data: {
        scrapeConfig: nextScrapeConfig as object,
      },
    })

    console.log('\n✓ Primary Arms is ready for scraping!')
    console.log('  Retailer ID:', retailer.id)
    console.log('  Source ID:', source.id)
    console.log('  Adapter ID: primaryarms')
    console.log('  Discovery allowlist set:', DISCOVERY_LISTING_URL)
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .then(() => {
    process.exit(0)
  })
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
