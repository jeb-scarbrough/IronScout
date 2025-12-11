import { createPrismaClient } from './client.js'

const prisma = createPrismaClient()

// Comprehensive ammunition data across popular calibers
const ammoData = [
  // ========== 223 / 5.56 NATO ==========
  {
    brand: 'Federal',
    name: 'Federal American Eagle 5.56 NATO 55gr FMJ',
    caliber: '5.56 NATO',
    grainWeight: 55,
    caseMaterial: 'Brass',
    purpose: 'Target',
    roundCount: 20,
    description: 'Federal American Eagle 5.56 NATO 55 Grain Full Metal Jacket M193',
    upc: '029465088156',
    prices: [
      { retailer: 'Palmetto State Armory', price: 9.99 },
      { retailer: 'Sportsman\'s Warehouse', price: 10.49 },
    ]
  },
  {
    brand: 'Winchester',
    name: 'Winchester USA 223 Remington 55gr FMJ',
    caliber: '.223 Remington',
    grainWeight: 55,
    caseMaterial: 'Brass',
    purpose: 'Target',
    roundCount: 20,
    description: 'Winchester USA 223 Remington 55 Grain Full Metal Jacket',
    upc: '020892102316',
    prices: [
      { retailer: 'Bass Pro Shops', price: 11.99 },
      { retailer: 'Cabela\'s', price: 12.49 },
    ]
  },
  {
    brand: 'Hornady',
    name: 'Hornady BLACK 5.56 NATO 62gr FMJ',
    caliber: '5.56 NATO',
    grainWeight: 62,
    caseMaterial: 'Brass',
    purpose: 'Target',
    roundCount: 20,
    description: 'Hornady BLACK 5.56 NATO 62 Grain Full Metal Jacket',
    upc: '090255808285',
    prices: [
      { retailer: 'MidwayUSA', price: 13.99 },
      { retailer: 'Brownells', price: 14.49 },
    ]
  },

  // ========== 9mm LUGER ==========
  {
    brand: 'Federal',
    name: 'Federal American Eagle 9mm 115gr FMJ',
    caliber: '9mm Luger',
    grainWeight: 115,
    caseMaterial: 'Brass',
    purpose: 'Target',
    roundCount: 50,
    description: 'Federal American Eagle 9mm Luger 115 Grain Full Metal Jacket',
    upc: '029465088446',
    prices: [
      { retailer: 'Palmetto State Armory', price: 15.99 },
      { retailer: 'Sportsman\'s Warehouse', price: 16.49 },
      { retailer: 'Bass Pro Shops', price: 16.99 }
    ]
  },
  {
    brand: 'Speer',
    name: 'Speer Gold Dot 9mm 124gr +P JHP',
    caliber: '9mm Luger',
    grainWeight: 124,
    caseMaterial: 'Brass',
    purpose: 'Defense',
    roundCount: 50,
    description: 'Speer Gold Dot 9mm Luger +P 124 Grain Jacketed Hollow Point',
    upc: '076683535443',
    prices: [
      { retailer: 'MidwayUSA', price: 38.99 },
      { retailer: 'Brownells', price: 39.49 },
    ]
  },
  {
    brand: 'Hornady',
    name: 'Hornady Critical Defense 9mm 115gr FTX',
    caliber: '9mm Luger',
    grainWeight: 115,
    caseMaterial: 'Brass',
    purpose: 'Defense',
    roundCount: 25,
    description: 'Hornady Critical Defense 9mm Luger 115 Grain Flex Tip eXpanding',
    upc: '090255900231',
    prices: [
      { retailer: 'Bass Pro Shops', price: 24.99 },
      { retailer: 'Cabela\'s', price: 24.99 },
    ]
  },

  // ========== 7.62x39 ==========
  {
    brand: 'Wolf',
    name: 'Wolf Performance 7.62x39 122gr FMJ',
    caliber: '7.62x39',
    grainWeight: 122,
    caseMaterial: 'Steel',
    purpose: 'Target',
    roundCount: 20,
    description: 'Wolf Performance 7.62x39mm 122 Grain Full Metal Jacket - Steel Case',
    upc: '640632006714',
    prices: [
      { retailer: 'Palmetto State Armory', price: 7.99 },
      { retailer: 'Sportsman\'s Guide', price: 8.49 },
    ]
  },
  {
    brand: 'Hornady',
    name: 'Hornady BLACK 7.62x39 123gr SST',
    caliber: '7.62x39',
    grainWeight: 123,
    caseMaterial: 'Brass',
    purpose: 'Hunting',
    roundCount: 20,
    description: 'Hornady BLACK 7.62x39mm 123 Grain Super Shock Tip',
    upc: '090255809275',
    prices: [
      { retailer: 'MidwayUSA', price: 18.99 },
      { retailer: 'Brownells', price: 19.49 },
    ]
  },

  // ========== 22 LR ==========
  {
    brand: 'Federal',
    name: 'Federal Champion 22 LR 40gr Lead Round Nose',
    caliber: '.22 LR',
    grainWeight: 40,
    caseMaterial: 'Brass',
    purpose: 'Target',
    roundCount: 50,
    description: 'Federal Champion 22 Long Rifle 40 Grain Lead Round Nose',
    upc: '029465085209',
    prices: [
      { retailer: 'Academy Sports', price: 5.49 },
      { retailer: 'Sportsman\'s Warehouse', price: 5.99 },
    ]
  },
  {
    brand: 'CCI',
    name: 'CCI Mini-Mag 22 LR 40gr CPRN',
    caliber: '.22 LR',
    grainWeight: 40,
    caseMaterial: 'Brass',
    purpose: 'Target',
    roundCount: 100,
    description: 'CCI Mini-Mag 22 Long Rifle 40 Grain Copper Plated Round Nose',
    upc: '076683000309',
    prices: [
      { retailer: 'Bass Pro Shops', price: 9.99 },
      { retailer: 'Cabela\'s', price: 10.49 },
    ]
  },
  {
    brand: 'Aguila',
    name: 'Aguila Super Extra 22 LR 38gr CPHP',
    caliber: '.22 LR',
    grainWeight: 38,
    caseMaterial: 'Brass',
    purpose: 'Target',
    roundCount: 50,
    description: 'Aguila Super Extra 22 Long Rifle 38 Grain Copper Plated Hollow Point',
    upc: '640420000107',
    prices: [
      { retailer: 'Lucky Gunner', price: 6.99 },
      { retailer: 'Natchez Shooters Supplies', price: 7.49 },
    ]
  },

  // ========== 308 WIN / 7.62 NATO ==========
  {
    brand: 'Federal',
    name: 'Federal American Eagle 308 Win 150gr FMJ',
    caliber: '.308 Winchester',
    grainWeight: 150,
    caseMaterial: 'Brass',
    purpose: 'Target',
    roundCount: 20,
    description: 'Federal American Eagle 308 Winchester 150 Grain Full Metal Jacket Boat Tail',
    upc: '029465092894',
    prices: [
      { retailer: 'Palmetto State Armory', price: 19.99 },
      { retailer: 'Sportsman\'s Warehouse', price: 20.49 },
    ]
  },
  {
    brand: 'Hornady',
    name: 'Hornady Precision Hunter 308 Win 178gr ELD-X',
    caliber: '.308 Winchester',
    grainWeight: 178,
    caseMaterial: 'Brass',
    purpose: 'Hunting',
    roundCount: 20,
    description: 'Hornady Precision Hunter 308 Winchester 178 Grain ELD-X',
    upc: '090255809497',
    prices: [
      { retailer: 'MidwayUSA', price: 36.99 },
      { retailer: 'Brownells', price: 37.49 },
    ]
  },

  // ========== 45 ACP ==========
  {
    brand: 'Federal',
    name: 'Federal American Eagle 45 ACP 230gr FMJ',
    caliber: '.45 ACP',
    grainWeight: 230,
    caseMaterial: 'Brass',
    purpose: 'Target',
    roundCount: 50,
    description: 'Federal American Eagle 45 ACP 230 Grain Full Metal Jacket',
    upc: '029465088729',
    prices: [
      { retailer: 'Palmetto State Armory', price: 29.99 },
      { retailer: 'Bass Pro Shops', price: 31.49 },
    ]
  },
  {
    brand: 'Winchester',
    name: 'Winchester Ranger T-Series 45 ACP 230gr JHP',
    caliber: '.45 ACP',
    grainWeight: 230,
    caseMaterial: 'Brass',
    purpose: 'Defense',
    roundCount: 50,
    description: 'Winchester Ranger T-Series 45 ACP 230 Grain Jacketed Hollow Point',
    upc: '020892218643',
    prices: [
      { retailer: 'Sportsman\'s Warehouse', price: 44.99 },
      { retailer: 'MidwayUSA', price: 45.49 },
    ]
  },
  {
    brand: 'Speer',
    name: 'Speer Gold Dot 45 ACP 230gr JHP',
    caliber: '.45 ACP',
    grainWeight: 230,
    caseMaterial: 'Brass',
    purpose: 'Defense',
    roundCount: 50,
    description: 'Speer Gold Dot 45 ACP 230 Grain Jacketed Hollow Point',
    upc: '076683536129',
    prices: [
      { retailer: 'Lucky Gunner', price: 43.99 },
      { retailer: 'Brownells', price: 44.49 },
    ]
  },

  // ========== 40 S&W ==========
  {
    brand: 'Federal',
    name: 'Federal American Eagle 40 S&W 180gr FMJ',
    caliber: '.40 S&W',
    grainWeight: 180,
    caseMaterial: 'Brass',
    purpose: 'Target',
    roundCount: 50,
    description: 'Federal American Eagle 40 S&W 180 Grain Full Metal Jacket',
    upc: '029465088637',
    prices: [
      { retailer: 'Palmetto State Armory', price: 24.99 },
      { retailer: 'Academy Sports', price: 25.49 },
    ]
  },
  {
    brand: 'Speer',
    name: 'Speer Gold Dot 40 S&W 180gr JHP',
    caliber: '.40 S&W',
    grainWeight: 180,
    caseMaterial: 'Brass',
    purpose: 'Defense',
    roundCount: 50,
    description: 'Speer Gold Dot 40 S&W 180 Grain Jacketed Hollow Point',
    upc: '076683536013',
    prices: [
      { retailer: 'MidwayUSA', price: 36.99 },
      { retailer: 'Brownells', price: 37.49 },
    ]
  },

  // ========== 22 WMR ==========
  {
    brand: 'CCI',
    name: 'CCI Maxi-Mag 22 WMR 40gr TMJ',
    caliber: '.22 WMR',
    grainWeight: 40,
    caseMaterial: 'Brass',
    purpose: 'Target',
    roundCount: 50,
    description: 'CCI Maxi-Mag 22 Winchester Magnum Rimfire 40 Grain Total Metal Jacket',
    upc: '076683000576',
    prices: [
      { retailer: 'Bass Pro Shops', price: 14.99 },
      { retailer: 'Cabela\'s', price: 15.49 },
    ]
  },
  {
    brand: 'Hornady',
    name: 'Hornady Varmint Express 22 WMR 30gr V-MAX',
    caliber: '.22 WMR',
    grainWeight: 30,
    caseMaterial: 'Brass',
    purpose: 'Hunting',
    roundCount: 50,
    description: 'Hornady Varmint Express 22 Winchester Magnum Rimfire 30 Grain V-MAX',
    upc: '090255830279',
    prices: [
      { retailer: 'MidwayUSA', price: 18.99 },
      { retailer: 'Sportsman\'s Warehouse', price: 19.49 },
    ]
  },

  // ========== 38 SPECIAL ==========
  {
    brand: 'Federal',
    name: 'Federal American Eagle 38 Special 130gr FMJ',
    caliber: '.38 Special',
    grainWeight: 130,
    caseMaterial: 'Brass',
    purpose: 'Target',
    roundCount: 50,
    description: 'Federal American Eagle 38 Special 130 Grain Full Metal Jacket',
    upc: '029465088842',
    prices: [
      { retailer: 'Palmetto State Armory', price: 26.99 },
      { retailer: 'Lucky Gunner', price: 27.49 },
    ]
  },
  {
    brand: 'Speer',
    name: 'Speer Gold Dot 38 Special +P 135gr JHP',
    caliber: '.38 Special',
    grainWeight: 135,
    caseMaterial: 'Brass',
    purpose: 'Defense',
    roundCount: 50,
    description: 'Speer Gold Dot 38 Special +P 135 Grain Jacketed Hollow Point',
    upc: '076683537010',
    prices: [
      { retailer: 'MidwayUSA', price: 35.99 },
      { retailer: 'Brownells', price: 36.49 },
    ]
  },

  // ========== 380 ACP ==========
  {
    brand: 'Federal',
    name: 'Federal American Eagle 380 ACP 95gr FMJ',
    caliber: '.380 ACP',
    grainWeight: 95,
    caseMaterial: 'Brass',
    purpose: 'Target',
    roundCount: 50,
    description: 'Federal American Eagle 380 ACP 95 Grain Full Metal Jacket',
    upc: '029465088668',
    prices: [
      { retailer: 'Palmetto State Armory', price: 19.99 },
      { retailer: 'Academy Sports', price: 20.49 },
    ]
  },
  {
    brand: 'Hornady',
    name: 'Hornady Critical Defense 380 ACP 90gr FTX',
    caliber: '.380 ACP',
    grainWeight: 90,
    caseMaterial: 'Brass',
    purpose: 'Defense',
    roundCount: 25,
    description: 'Hornady Critical Defense 380 ACP 90 Grain Flex Tip eXpanding',
    upc: '090255900293',
    prices: [
      { retailer: 'Bass Pro Shops', price: 22.99 },
      { retailer: 'Cabela\'s', price: 23.49 },
    ]
  },

  // ========== 6.5 GRENDEL ==========
  {
    brand: 'Hornady',
    name: 'Hornady BLACK 6.5 Grendel 123gr ELD Match',
    caliber: '6.5 Grendel',
    grainWeight: 123,
    caseMaterial: 'Brass',
    purpose: 'Target',
    roundCount: 20,
    description: 'Hornady BLACK 6.5 Grendel 123 Grain ELD Match',
    upc: '090255809343',
    prices: [
      { retailer: 'MidwayUSA', price: 24.99 },
      { retailer: 'Brownells', price: 25.49 },
    ]
  },
  {
    brand: 'Federal',
    name: 'Federal Fusion 6.5 Grendel 120gr SP',
    caliber: '6.5 Grendel',
    grainWeight: 120,
    caseMaterial: 'Brass',
    purpose: 'Hunting',
    roundCount: 20,
    description: 'Federal Fusion 6.5 Grendel 120 Grain Soft Point',
    upc: '029465099268',
    prices: [
      { retailer: 'Bass Pro Shops', price: 27.99 },
      { retailer: 'Cabela\'s', price: 28.49 },
    ]
  },

  // ========== 300 BLACKOUT ==========
  {
    brand: 'Hornady',
    name: 'Hornady BLACK 300 Blackout 208gr A-MAX',
    caliber: '300 AAC Blackout',
    grainWeight: 208,
    caseMaterial: 'Brass',
    purpose: 'Target',
    roundCount: 20,
    description: 'Hornady BLACK 300 AAC Blackout 208 Grain A-MAX Subsonic',
    upc: '090255808414',
    prices: [
      { retailer: 'MidwayUSA', price: 26.99 },
      { retailer: 'Brownells', price: 27.49 },
    ]
  },
  {
    brand: 'Sig Sauer',
    name: 'Sig Sauer Elite Hunting 300 Blackout 120gr HT',
    caliber: '300 AAC Blackout',
    grainWeight: 120,
    caseMaterial: 'Brass',
    purpose: 'Hunting',
    roundCount: 20,
    description: 'Sig Sauer Elite Hunting 300 AAC Blackout 120 Grain Hunting Tip',
    upc: '798681544738',
    prices: [
      { retailer: 'Palmetto State Armory', price: 24.99 },
      { retailer: 'Sportsman\'s Warehouse', price: 25.49 },
    ]
  },

  // ========== 12 GAUGE ==========
  {
    brand: 'Federal',
    name: 'Federal Top Gun 12 Gauge 2-3/4" #8 Shot',
    caliber: '12 Gauge',
    grainWeight: null,
    caseMaterial: 'Plastic',
    purpose: 'Target',
    roundCount: 25,
    description: 'Federal Top Gun 12 Gauge 2-3/4" 1-1/8 oz #8 Lead Shot - Target Load',
    upc: '029465091057',
    prices: [
      { retailer: 'Bass Pro Shops', price: 8.99 },
      { retailer: 'Cabela\'s', price: 9.49 },
    ]
  },
  {
    brand: 'Hornady',
    name: 'Hornady Critical Defense 12 Gauge 00 Buckshot',
    caliber: '12 Gauge',
    grainWeight: null,
    caseMaterial: 'Plastic',
    purpose: 'Defense',
    roundCount: 10,
    description: 'Hornady Critical Defense 12 Gauge 2-3/4" 00 Buckshot - 8 Pellets',
    upc: '090255862652',
    prices: [
      { retailer: 'MidwayUSA', price: 14.99 },
      { retailer: 'Brownells', price: 15.49 },
    ]
  },
  {
    brand: 'Remington',
    name: 'Remington Express 12 Gauge 2-3/4" Rifled Slug',
    caliber: '12 Gauge',
    grainWeight: null,
    caseMaterial: 'Plastic',
    purpose: 'Hunting',
    roundCount: 5,
    description: 'Remington Express 12 Gauge 2-3/4" 1 oz Rifled Slug',
    upc: '047700419701',
    prices: [
      { retailer: 'Academy Sports', price: 6.99 },
      { retailer: 'Sportsman\'s Warehouse', price: 7.49 },
    ]
  },

  // ========== 10mm AUTO ==========
  {
    brand: 'Federal',
    name: 'Federal American Eagle 10mm 180gr FMJ',
    caliber: '10mm Auto',
    grainWeight: 180,
    caseMaterial: 'Brass',
    purpose: 'Target',
    roundCount: 50,
    description: 'Federal American Eagle 10mm Auto 180 Grain Full Metal Jacket',
    upc: '029465088521',
    prices: [
      { retailer: 'Palmetto State Armory', price: 32.99 },
      { retailer: 'Lucky Gunner', price: 33.49 },
    ]
  },
  {
    brand: 'Hornady',
    name: 'Hornady Custom 10mm 180gr XTP',
    caliber: '10mm Auto',
    grainWeight: 180,
    caseMaterial: 'Brass',
    purpose: 'Defense',
    roundCount: 25,
    description: 'Hornady Custom 10mm Auto 180 Grain XTP Jacketed Hollow Point',
    upc: '090255919363',
    prices: [
      { retailer: 'MidwayUSA', price: 29.99 },
      { retailer: 'Brownells', price: 30.49 },
    ]
  },
  {
    brand: 'Underwood',
    name: 'Underwood 10mm 220gr Hard Cast',
    caliber: '10mm Auto',
    grainWeight: 220,
    caseMaterial: 'Brass',
    purpose: 'Hunting',
    roundCount: 20,
    description: 'Underwood 10mm Auto 220 Grain Hard Cast Flat Nose - Heavy Load',
    upc: '816874020484',
    prices: [
      { retailer: 'Lucky Gunner', price: 34.99 },
      { retailer: 'Natchez Shooters Supplies', price: 35.49 },
    ]
  },

  // ========== 5.7x28 ==========
  {
    brand: 'FN Herstal',
    name: 'FN 5.7x28mm 40gr V-MAX',
    caliber: '5.7x28mm',
    grainWeight: 40,
    caseMaterial: 'Brass',
    purpose: 'Target',
    roundCount: 50,
    description: 'FN 5.7x28mm 40 Grain Hornady V-MAX',
    upc: '845737003326',
    prices: [
      { retailer: 'MidwayUSA', price: 39.99 },
      { retailer: 'Brownells', price: 40.49 },
    ]
  },
  {
    brand: 'Speer',
    name: 'Speer Gold Dot 5.7x28mm 40gr JHP',
    caliber: '5.7x28mm',
    grainWeight: 40,
    caseMaterial: 'Brass',
    purpose: 'Defense',
    roundCount: 50,
    description: 'Speer Gold Dot 5.7x28mm 40 Grain Jacketed Hollow Point',
    upc: '076683539755',
    prices: [
      { retailer: 'Palmetto State Armory', price: 44.99 },
      { retailer: 'Lucky Gunner', price: 45.49 },
    ]
  },
]

async function seedAmmoData() {
  console.log('🔫 Starting comprehensive ammunition data seed...')

  try {
    // Create retailers
    console.log('📦 Creating retailers...')
    const retailers = await Promise.all([
      'Palmetto State Armory',
      'Sportsman\'s Warehouse',
      'Bass Pro Shops',
      'Cabela\'s',
      'Academy Sports',
      'Lucky Gunner',
      'MidwayUSA',
      'Brownells',
      'Natchez Shooters Supplies',
      'Sportsman\'s Guide'
    ].map(name => prisma.retailer.upsert({
      where: { website: name.toLowerCase().replace(/['\s]/g, '') + '.com' },
      update: {},
      create: {
        name,
        website: name.toLowerCase().replace(/['\s]/g, '') + '.com',
        tier: 'STANDARD'
      }
    })))

    console.log(`✅ Created ${retailers.length} retailers`)

    // Create products and prices
    console.log('🎯 Creating products and prices...')
    let productsCreated = 0
    let pricesCreated = 0

    for (const ammo of ammoData) {
      // Create or update product
      const product = await prisma.product.upsert({
        where: { upc: ammo.upc },
        update: {
          name: ammo.name,
          brand: ammo.brand,
          caliber: ammo.caliber,
          grainWeight: ammo.grainWeight,
          caseMaterial: ammo.caseMaterial,
          purpose: ammo.purpose,
          roundCount: ammo.roundCount,
          description: ammo.description,
          category: 'Ammunition',
          updatedAt: new Date()
        },
        create: {
          name: ammo.name,
          brand: ammo.brand,
          caliber: ammo.caliber,
          grainWeight: ammo.grainWeight,
          caseMaterial: ammo.caseMaterial,
          purpose: ammo.purpose,
          roundCount: ammo.roundCount,
          description: ammo.description,
          category: 'Ammunition',
          upc: ammo.upc
        }
      })

      productsCreated++

      // Create prices for each retailer
      for (const priceData of ammo.prices) {
        const retailer = retailers.find(r => r.name === priceData.retailer)
        if (!retailer) continue

        await prisma.price.create({
          data: {
            productId: product.id,
            retailerId: retailer.id,
            price: priceData.price,
            url: `https://${retailer.website}/products/${product.upc}`,
            inStock: true,
            currency: 'USD'
          }
        })

        pricesCreated++
      }
    }

    console.log(`✅ Created ${productsCreated} products`)
    console.log(`✅ Created ${pricesCreated} prices`)

    // Summary by caliber
    console.log('\n📊 Products by Caliber:')
    const caliberCounts = ammoData.reduce((acc, ammo) => {
      acc[ammo.caliber] = (acc[ammo.caliber] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    Object.entries(caliberCounts).forEach(([caliber, count]) => {
      console.log(`   ${caliber}: ${count} products`)
    })

    console.log('\n🎉 Seed completed successfully!')
    console.log(`\n   Total Retailers: ${retailers.length}`)
    console.log(`   Total Products: ${productsCreated}`)
    console.log(`   Total Prices: ${pricesCreated}`)
    console.log(`   Calibers Covered: ${Object.keys(caliberCounts).length}`)

  } catch (error) {
    console.error('❌ Error seeding ammunition data:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seedAmmoData()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
