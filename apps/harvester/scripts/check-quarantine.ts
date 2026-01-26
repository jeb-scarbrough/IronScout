import 'dotenv/config';
import { prisma } from '@ironscout/db';

async function check() {
  console.log('Checking quarantine records...\n');

  const counts = await prisma.quarantined_records.groupBy({
    by: ['status'],
    _count: { id: true }
  });

  console.log('Quarantine records by status:');
  for (const c of counts) {
    console.log(`  ${c.status}: ${c._count.id}`);
  }

  const total = await prisma.quarantined_records.count();
  console.log(`  Total: ${total}`);

  if (total > 0) {
    // Sample of quarantined records
    const sample = await prisma.quarantined_records.findMany({
      where: { status: 'QUARANTINED' },
      take: 5,
      select: {
        id: true,
        feedType: true,
        matchKey: true,
        blockingErrors: true,
      }
    });

    if (sample.length > 0) {
      console.log('\nSample QUARANTINED records:');
      for (const r of sample) {
        console.log(`  ${r.id} (${r.feedType})`);
        console.log(`    matchKey: ${r.matchKey}`);
        const errors = r.blockingErrors as Array<{code: string}>;
        console.log(`    errors: ${errors?.map(e => e.code).join(', ') || 'none'}`);
      }
    }
  }

  await prisma.$disconnect();
}

check().catch(console.error);
