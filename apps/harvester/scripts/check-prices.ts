import 'dotenv/config';
import { prisma } from '@ironscout/db';

async function checkPrices() {
  console.log('Checking prices and visibility...');

  // Check price timestamps
  const recentPrices = await prisma.prices.count({
    where: {
      observedAt: {
        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
      }
    }
  });
  const totalPrices = await prisma.prices.count();
  console.log(`Prices within 7 days: ${recentPrices} / ${totalPrices}`);

  // Check retailer visibility
  const retailers = await prisma.retailers.findMany({
    select: {
      id: true,
      name: true,
      visibilityStatus: true,
    }
  });
  console.log('\nRetailer visibility:');
  retailers.forEach(r => {
    console.log(`  ${r.name}: ${r.visibilityStatus}`);
  });

  // Count eligible retailers
  const eligibleCount = retailers.filter(r => r.visibilityStatus === 'ELIGIBLE').length;
  console.log(`\nEligible retailers: ${eligibleCount} / ${retailers.length}`);

  // Check a sample product with prices
  const sampleProduct = await prisma.products.findFirst({
    where: { caliberNorm: { contains: '9mm', mode: 'insensitive' } },
    select: { id: true, name: true, caliber: true }
  });

  if (sampleProduct) {
    console.log(`\nSample 9mm product: ${sampleProduct.name}`);

    const links = await prisma.product_links.findMany({
      where: {
        productId: sampleProduct.id,
        status: { in: ['MATCHED', 'CREATED'] }
      },
      select: { sourceProductId: true }
    });
    console.log(`  Links: ${links.length}`);

    if (links.length > 0) {
      const prices = await prisma.prices.findMany({
        where: {
          sourceProductId: { in: links.map(l => l.sourceProductId) }
        },
        include: { retailers: { select: { name: true, visibilityStatus: true } } },
        take: 5
      });
      console.log(`  Prices found: ${prices.length}`);
      prices.forEach(p => {
        console.log(`    $${p.price} from ${p.retailers?.name} (${p.retailers?.visibilityStatus}) - observed: ${p.observedAt?.toISOString()}`);
      });
    }
  } else {
    console.log('\nNo 9mm products found');
  }

  await prisma.$disconnect();
}

checkPrices().catch(console.error);
