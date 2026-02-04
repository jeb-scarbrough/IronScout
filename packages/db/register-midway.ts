import 'dotenv/config'
import { prisma } from './index.js'

async function main() {
  try {
    // 1. Check/create MidwayUSA retailer
    let retailer = await prisma.retailers.findFirst({
      where: {
        OR: [
          { name: { contains: 'Midway', mode: 'insensitive' } },
          { website: { contains: 'midwayusa.com' } },
        ],
      },
    })

    if (!retailer) {
      console.log('Creating MidwayUSA retailer...')
      // Per spec §12.3: New retailers start ineligible until admin review
      retailer = await prisma.retailers.create({
        data: {
          name: 'MidwayUSA',
          website: 'https://www.midwayusa.com',
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
      where: { adapterId: 'midwayusa' },
      create: {
        adapterId: 'midwayusa',
        enabled: true,
      },
      update: {
        enabled: true,
      },
    })
    console.log('Adapter status:', adapter.adapterId, 'enabled:', adapter.enabled)

    // 2. Check/create MidwayUSA source
    let source = await prisma.sources.findFirst({
      where: {
        OR: [
          { name: { contains: 'Midway', mode: 'insensitive' } },
          { url: { contains: 'midwayusa.com' } },
        ],
      },
    })

    if (!source) {
      console.log('Creating MidwayUSA source...')
      // Per spec §12.3: scrapeEnabled=false by default until admin review
      source = await prisma.sources.create({
        data: {
          name: 'MidwayUSA Scraper',
          url: 'https://www.midwayusa.com',
          type: 'HTML',
          enabled: true,
          retailerId: retailer.id,
          adapterId: 'midwayusa',
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
          adapterId: 'midwayusa',
        },
      })
      console.log('Updated source:', source.id, source.name)
    }

    console.log('\n✓ MidwayUSA is ready for scraping!')
    console.log('  Retailer ID:', retailer.id)
    console.log('  Source ID:', source.id)
    console.log('  Adapter ID: midwayusa')
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
