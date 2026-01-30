import 'dotenv/config'
import { prisma } from './index.js'

async function main() {
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
    retailer = await prisma.retailers.create({
      data: {
        name: 'SGAmmo',
        website: 'https://www.sgammo.com',
        tier: 'STANDARD',
        visibilityStatus: 'ELIGIBLE',
      }
    })
    console.log('Created retailer:', retailer.id, retailer.name)
  } else {
    console.log('Found retailer:', retailer.id, retailer.name)
  }

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
    source = await prisma.sources.create({
      data: {
        name: 'SGAmmo Scraper',
        url: 'https://www.sgammo.com',
        type: 'HTML',
        enabled: true,
        retailerId: retailer.id,
        adapterId: 'sgammo',
        scrapeEnabled: true,
        robotsCompliant: true,
      }
    })
    console.log('Created source:', source.id, source.name)
  } else {
    // Update existing source with adapter
    source = await prisma.sources.update({
      where: { id: source.id },
      data: {
        adapterId: 'sgammo',
        scrapeEnabled: true,
      }
    })
    console.log('Updated source:', source.id, source.name)
  }

  // 3. Register adapter status
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

  console.log('\n✓ SGAmmo is ready for scraping!')
  console.log('  Retailer ID:', retailer.id)
  console.log('  Source ID:', source.id)
  console.log('  Adapter ID: sgammo')

  await prisma.$disconnect()
}

main().catch(console.error)
