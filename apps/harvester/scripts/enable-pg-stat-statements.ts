import 'dotenv/config';
import { prisma } from '@ironscout/db';

/**
 * Enable pg_stat_statements extension for query performance tracking.
 *
 * Note: If this fails with "extension not available", you need to:
 * 1. Add to postgresql.conf: shared_preload_libraries = 'pg_stat_statements'
 * 2. Restart PostgreSQL
 * 3. Run this script again
 */

async function enablePgStatStatements() {
  console.log('Checking pg_stat_statements status...\n');

  try {
    // Check if extension is already installed
    const extensions = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'pg_stat_statements'
    `;

    if (extensions.length > 0) {
      console.log('✅ pg_stat_statements is already enabled!\n');
    } else {
      console.log('Extension not found, attempting to create...');

      try {
        await prisma.$executeRaw`CREATE EXTENSION IF NOT EXISTS pg_stat_statements`;
        console.log('✅ pg_stat_statements extension created!\n');
      } catch (createErr: any) {
        if (createErr.message?.includes('not available') || createErr.message?.includes('could not open')) {
          console.log('\n❌ Extension not available in PostgreSQL installation.');
          console.log('\nTo fix this, add to postgresql.conf:');
          console.log('  shared_preload_libraries = \'pg_stat_statements\'');
          console.log('\nThen restart PostgreSQL and run this script again.');
          await prisma.$disconnect();
          process.exit(1);
        }
        throw createErr;
      }
    }

    // Reset stats for a fresh baseline
    console.log('Resetting query statistics for fresh baseline...');
    await prisma.$executeRaw`SELECT pg_stat_statements_reset()`;
    console.log('✅ Statistics reset.\n');

    console.log('pg_stat_statements is now tracking queries.');
    console.log('Run check-slow-queries.ts after some activity to see results.');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

enablePgStatStatements();
