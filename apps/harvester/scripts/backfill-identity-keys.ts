import 'dotenv/config';
import { prisma } from '@ironscout/db';
import crypto from 'crypto';

/**
 * Backfill identityKey for source_products that have NULL
 *
 * The affiliate feed processor was not writing identityKey to the database,
 * only tracking it internally for deduplication. This script computes
 * the identityKey from the URL (same logic as the processor) and updates
 * the records.
 */

function computeUrlHash(url: string): string {
  return crypto.createHash('sha256').update(url).digest('hex').slice(0, 16);
}

async function backfillIdentityKeys() {
  console.log('Backfilling identityKey for source_products...\n');

  // Count records needing backfill
  const nullCount = await prisma.source_products.count({
    where: { identityKey: null },
  });

  console.log(`Found ${nullCount} source_products with NULL identityKey\n`);

  if (nullCount === 0) {
    console.log('Nothing to backfill!');
    return;
  }

  // Process in batches
  const BATCH_SIZE = 1000;
  let processed = 0;
  let updated = 0;

  while (processed < nullCount) {
    // Get batch of records
    const batch = await prisma.source_products.findMany({
      where: { identityKey: null },
      select: { id: true, url: true },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    // Update each record
    for (const record of batch) {
      const identityKey = `URL_HASH:${computeUrlHash(record.url)}`;

      await prisma.source_products.update({
        where: { id: record.id },
        data: { identityKey },
      });

      updated++;
    }

    processed += batch.length;
    console.log(`Progress: ${processed}/${nullCount} (${updated} updated)`);
  }

  console.log(`\nBackfill complete! Updated ${updated} records.`);

  // Verify
  const remainingNull = await prisma.source_products.count({
    where: { identityKey: null },
  });
  console.log(`Remaining NULL identityKey: ${remainingNull}`);

  await prisma.$disconnect();
}

backfillIdentityKeys().catch(console.error);
