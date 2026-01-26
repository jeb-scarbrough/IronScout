import 'dotenv/config';
import { prisma } from '@ironscout/db';

async function check() {
  const grains = await prisma.products.groupBy({
    by: ['grainWeight'],
    _count: { id: true },
    where: { caliber: { contains: '9mm', mode: 'insensitive' } }
  });

  console.log('9mm products by grainWeight:');
  grains.sort((a, b) => (a.grainWeight || 0) - (b.grainWeight || 0));
  for (const g of grains) {
    console.log(`  ${g.grainWeight}: ${g._count.id}`);
  }

  const total = await prisma.products.count({
    where: { caliber: { contains: '9mm', mode: 'insensitive' } }
  });
  console.log(`\nTotal 9mm products: ${total}`);

  await prisma.$disconnect();
}

check();
