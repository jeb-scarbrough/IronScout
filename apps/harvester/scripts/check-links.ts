import 'dotenv/config';
import { prisma } from '@ironscout/db';

async function checkLinks() {
  console.log('Checking product_links status...');

  const linksByStatus = await prisma.product_links.groupBy({
    by: ['status'],
    _count: { status: true }
  });

  console.log('Product links by status:');
  linksByStatus.forEach(l => {
    console.log(`  ${l.status}: ${l._count.status}`);
  });

  const [products, prices, sourceProducts] = await Promise.all([
    prisma.products.count(),
    prisma.prices.count(),
    prisma.source_products.count()
  ]);

  console.log('\nCounts:');
  console.log('  Products:', products);
  console.log('  Source Products:', sourceProducts);
  console.log('  Prices:', prices);

  const matchedLinks = await prisma.product_links.count({
    where: { status: { in: ['MATCHED', 'CREATED'] } }
  });
  console.log('  MATCHED/CREATED links:', matchedLinks);

  await prisma.$disconnect();
}

checkLinks().catch(console.error);
