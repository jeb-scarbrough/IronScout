import 'dotenv/config';
import { prisma } from '@ironscout/db';

async function checkCaseMaterial() {
  console.log('Checking caseMaterial field...');

  // Count products with and without caseMaterial
  const withCaseMaterial = await prisma.products.count({
    where: { caseMaterial: { not: null } }
  });
  const total = await prisma.products.count();

  console.log(`Products with caseMaterial: ${withCaseMaterial} / ${total}`);

  // Get distribution of caseMaterial values
  const distribution = await prisma.products.groupBy({
    by: ['caseMaterial'],
    _count: { caseMaterial: true },
    orderBy: { _count: { caseMaterial: 'desc' } }
  });

  console.log('\nCaseMaterial distribution:');
  distribution.forEach(d => {
    console.log(`  ${d.caseMaterial ?? 'NULL'}: ${d._count.caseMaterial}`);
  });

  // Check 9mm products specifically
  const products9mm = await prisma.products.findMany({
    where: { caliberNorm: { contains: '9mm', mode: 'insensitive' } },
    select: { name: true, caseMaterial: true },
    take: 5
  });

  console.log('\nSample 9mm products:');
  products9mm.forEach(p => {
    console.log(`  ${p.name}: caseMaterial = "${p.caseMaterial}"`);
  });

  // Test the exact where clause the search would use
  const searchResult = await prisma.products.count({
    where: {
      AND: [
        { OR: [{ caliberNorm: { contains: '9mm', mode: 'insensitive' } }] },
        { OR: [
          { caseMaterial: { contains: 'Brass', mode: 'insensitive' } },
          { caseMaterial: { contains: 'Steel', mode: 'insensitive' } },
          { caseMaterial: { contains: 'Nickel', mode: 'insensitive' } },
          { caseMaterial: { contains: 'Aluminum', mode: 'insensitive' } }
        ]}
      ]
    }
  });

  console.log(`\nSearch query (9mm + caseMaterial filter): ${searchResult} products`);

  await prisma.$disconnect();
}

checkCaseMaterial().catch(console.error);
