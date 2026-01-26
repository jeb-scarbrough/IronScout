import 'dotenv/config';
import { prisma } from '@ironscout/db';

async function checkNeedsReview() {
  console.log('Checking NEEDS_REVIEW links...\n');

  // Count by status
  const statusCounts = await prisma.product_links.groupBy({
    by: ['status'],
    _count: { status: true },
  });
  console.log('Status distribution:');
  statusCounts.forEach(s => console.log(`  ${s.status}: ${s._count.status}`));

  // Get NEEDS_REVIEW links with their source products
  const needsReviewLinks = await prisma.product_links.findMany({
    where: { status: 'NEEDS_REVIEW' },
    select: {
      id: true,
      sourceProductId: true,
      source_products: {
        select: {
          id: true,
          sourceId: true,
          identityKey: true,
          title: true,
        },
      },
    },
    take: 20,
  });

  console.log('\nSample NEEDS_REVIEW links:');
  let withSourceProduct = 0;
  let withIdentityKey = 0;
  let withoutSourceProduct = 0;
  let withoutIdentityKey = 0;

  for (const link of needsReviewLinks) {
    const hasSource = !!link.source_products;
    const hasIdentityKey = link.source_products?.identityKey ? true : false;

    if (hasSource) withSourceProduct++;
    else withoutSourceProduct++;

    if (hasIdentityKey) withIdentityKey++;
    else withoutIdentityKey++;

    console.log(`  Link ${link.id.slice(0, 8)}...`);
    console.log(`    sourceProductId: ${link.sourceProductId}`);
    console.log(`    has source_product: ${hasSource}`);
    if (hasSource) {
      console.log(`    identityKey: ${link.source_products?.identityKey || 'NULL'}`);
      console.log(`    title: ${link.source_products?.title?.slice(0, 50)}`);
    }
    console.log('');
  }

  console.log('\nSummary of sample:');
  console.log(`  With source_product: ${withSourceProduct}`);
  console.log(`  Without source_product: ${withoutSourceProduct}`);
  console.log(`  With identityKey: ${withIdentityKey}`);
  console.log(`  Without identityKey: ${withoutIdentityKey}`);

  // Count all NEEDS_REVIEW links without source_products
  const allNeedsReview = await prisma.product_links.findMany({
    where: { status: 'NEEDS_REVIEW' },
    select: {
      id: true,
      sourceProductId: true,
    },
  });

  const sourceProductIds = allNeedsReview.map(l => l.sourceProductId);
  const existingSourceProducts = await prisma.source_products.findMany({
    where: { id: { in: sourceProductIds } },
    select: { id: true, identityKey: true },
  });

  const existingIds = new Set(existingSourceProducts.map(sp => sp.id));
  const withIdentityKeyIds = new Set(
    existingSourceProducts.filter(sp => sp.identityKey).map(sp => sp.id)
  );

  const totalNeedsReview = allNeedsReview.length;
  const missingSourceProducts = allNeedsReview.filter(l => !existingIds.has(l.sourceProductId)).length;
  const missingIdentityKey = allNeedsReview.filter(
    l => existingIds.has(l.sourceProductId) && !withIdentityKeyIds.has(l.sourceProductId)
  ).length;
  const reprocessable = allNeedsReview.filter(
    l => withIdentityKeyIds.has(l.sourceProductId)
  ).length;

  console.log('\nFull analysis:');
  console.log(`  Total NEEDS_REVIEW links: ${totalNeedsReview}`);
  console.log(`  Missing source_products: ${missingSourceProducts}`);
  console.log(`  Missing identityKey: ${missingIdentityKey}`);
  console.log(`  Reprocessable (has source + identityKey): ${reprocessable}`);

  await prisma.$disconnect();
}

checkNeedsReview().catch(console.error);
