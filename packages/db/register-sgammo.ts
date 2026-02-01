import 'dotenv/config'
import { prisma } from './index.js'

async function main() {
  try {
  // 1. Check/create SGAmmo retailer
  let retailer = await prisma.retailers.findFirst({
    where: {
      OR: [
        { name: { contains: 'SGAmmo', mode: 'insensitive' } },
        { website: { contains: 'sgammo.com' } },
      ]
    }
  })

  if (!retailer) {
    console.log('Creating SGAmmo retailer...')
    // Per spec §12.3: New retailers start ineligible until admin review
    retailer = await prisma.retailers.create({
      data: {
        name: 'SGAmmo',
        website: 'https://www.sgammo.com',
        tier: 'STANDARD',
        visibilityStatus: 'INELIGIBLE', // Safe default - requires admin approval
      }
    })
    console.log('Created retailer:', retailer.id, retailer.name)
    console.log('⚠️  Retailer visibility is INELIGIBLE - admin must approve before data is visible')
  } else {
    console.log('Found retailer:', retailer.id, retailer.name)
  }

  // Ensure adapter status exists before attaching adapterId to sources (FK constraint)
  const adapter = await prisma.scrape_adapter_status.upsert({
    where: { adapterId: 'sgammo' },
    create: {
      adapterId: 'sgammo',
      enabled: true,
    },
    update: {
      enabled: true,
    },
  })
  console.log('Adapter status:', adapter.adapterId, 'enabled:', adapter.enabled)

  // 2. Check/create SGAmmo source
  let source = await prisma.sources.findFirst({
    where: {
      OR: [
        { name: { contains: 'SGAmmo', mode: 'insensitive' } },
        { url: { contains: 'sgammo.com' } },
      ]
    }
  })

  if (!source) {
    console.log('Creating SGAmmo source...')
    // Per spec §12.3: scrapeEnabled=false by default until admin review
    source = await prisma.sources.create({
      data: {
        name: 'SGAmmo Scraper',
        url: 'https://www.sgammo.com',
        type: 'HTML',
        enabled: true,
        retailerId: retailer.id,
        adapterId: 'sgammo',
        scrapeEnabled: false, // Safe default - requires admin approval
        robotsCompliant: true,
      }
    })
    console.log('Created source:', source.id, source.name)

    // Create source_trust_config with safe defaults
    await prisma.source_trust_config.create({
      data: {
        sourceId: source.id,
        upcTrusted: false, // Per spec §12.3: UPC not trusted until verified
      }
    })
    console.log('Created source_trust_config with upcTrusted=false')
    console.log('⚠️  Source scraping is DISABLED - admin must enable after review')
  } else {
    // Update existing source with adapter (don't auto-enable)
    source = await prisma.sources.update({
      where: { id: source.id },
      data: {
        adapterId: 'sgammo',
        // Don't auto-enable scraping on existing source
      }
    })
    console.log('Updated source:', source.id, source.name)
  }

  console.log('\n✓ SGAmmo is ready for scraping!')
  console.log('  Retailer ID:', retailer.id)
  console.log('  Source ID:', source.id)
  console.log('  Adapter ID: sgammo')
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
