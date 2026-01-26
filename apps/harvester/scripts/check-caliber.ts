import 'dotenv/config';
import { prisma } from '@ironscout/db';

async function checkCaliber() {
  console.log('Checking caliberNorm field...');

  // Count products with and without caliberNorm
  const withCaliberNorm = await prisma.products.count({
    where: { caliberNorm: { not: null } }
  });
  const withoutCaliberNorm = await prisma.products.count({
    where: { OR: [{ caliberNorm: null }, { caliberNorm: '' }] }
  });
  const total = await prisma.products.count();

  console.log(`Products with caliberNorm: ${withCaliberNorm} / ${total}`);
  console.log(`Products without caliberNorm: ${withoutCaliberNorm}`);

  // Sample some products to see their caliber fields
  const sample = await prisma.products.findMany({
    take: 5,
    select: {
      id: true,
      name: true,
      caliber: true,
      caliberNorm: true,
    }
  });

  console.log('\nSample products:');
  sample.forEach(p => {
    console.log(`  ${p.name}`);
    console.log(`    caliber: "${p.caliber}" | caliberNorm: "${p.caliberNorm}"`);
  });

  // Check products with 9mm specifically
  const products9mm = await prisma.products.count({
    where: { caliberNorm: { contains: '9mm', mode: 'insensitive' } }
  });
  console.log(`\nProducts with caliberNorm containing "9mm": ${products9mm}`);

  // Check products with embeddings
  const withEmbeddings = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM products WHERE embedding IS NOT NULL
  `;
  console.log(`Products with embeddings: ${withEmbeddings[0].count}`);

  await prisma.$disconnect();
}

checkCaliber().catch(console.error);
