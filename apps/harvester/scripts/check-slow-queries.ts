import 'dotenv/config';
import { prisma } from '@ironscout/db';

/**
 * Check slow queries using pg_stat_statements.
 * Run enable-pg-stat-statements.ts first if not already enabled.
 */

async function checkSlowQueries() {
  console.log('=== Slow Query Analysis ===\n');

  try {
    // Check if extension is available
    const extensions = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'pg_stat_statements'
    `;

    if (extensions.length === 0) {
      console.log('❌ pg_stat_statements not enabled.');
      console.log('Run: pnpm --filter @ironscout/harvester exec tsx scripts/enable-pg-stat-statements.ts');
      await prisma.$disconnect();
      return;
    }

    // Top 20 slowest queries by total time
    console.log('--- Top 20 Slowest Queries (by total time) ---\n');
    const slowest = await prisma.$queryRaw<Array<{
      query: string;
      calls: bigint;
      total_time_ms: number;
      mean_time_ms: number;
      rows: bigint;
    }>>`
      SELECT
        query,
        calls,
        round(total_exec_time::numeric, 2) as total_time_ms,
        round(mean_exec_time::numeric, 2) as mean_time_ms,
        rows
      FROM pg_stat_statements
      WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user)
      ORDER BY total_exec_time DESC
      LIMIT 20
    `;

    for (const q of slowest) {
      const shortQuery = q.query.replace(/\s+/g, ' ').slice(0, 100);
      console.log(`Total: ${q.total_time_ms}ms | Mean: ${q.mean_time_ms}ms | Calls: ${q.calls} | Rows: ${q.rows}`);
      console.log(`  ${shortQuery}...`);
      console.log('');
    }

    // Queries with high mean time (potentially problematic)
    console.log('\n--- Queries with High Mean Time (>100ms) ---\n');
    const highMean = await prisma.$queryRaw<Array<{
      query: string;
      calls: bigint;
      mean_time_ms: number;
      rows: bigint;
    }>>`
      SELECT
        query,
        calls,
        round(mean_exec_time::numeric, 2) as mean_time_ms,
        rows
      FROM pg_stat_statements
      WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user)
        AND mean_exec_time > 100
        AND calls > 5
      ORDER BY mean_exec_time DESC
      LIMIT 10
    `;

    if (highMean.length === 0) {
      console.log('No queries with mean time > 100ms (good!)');
    } else {
      for (const q of highMean) {
        const shortQuery = q.query.replace(/\s+/g, ' ').slice(0, 100);
        console.log(`Mean: ${q.mean_time_ms}ms | Calls: ${q.calls} | Rows: ${q.rows}`);
        console.log(`  ${shortQuery}...`);
        console.log('');
      }
    }

    // Most called queries
    console.log('\n--- Most Called Queries ---\n');
    const mostCalled = await prisma.$queryRaw<Array<{
      query: string;
      calls: bigint;
      total_time_ms: number;
      mean_time_ms: number;
    }>>`
      SELECT
        query,
        calls,
        round(total_exec_time::numeric, 2) as total_time_ms,
        round(mean_exec_time::numeric, 2) as mean_time_ms
      FROM pg_stat_statements
      WHERE userid = (SELECT usesysid FROM pg_user WHERE usename = current_user)
      ORDER BY calls DESC
      LIMIT 10
    `;

    for (const q of mostCalled) {
      const shortQuery = q.query.replace(/\s+/g, ' ').slice(0, 80);
      console.log(`Calls: ${q.calls} | Total: ${q.total_time_ms}ms | Mean: ${q.mean_time_ms}ms`);
      console.log(`  ${shortQuery}...`);
      console.log('');
    }

  } catch (error: any) {
    if (error.message?.includes('pg_stat_statements')) {
      console.log('❌ pg_stat_statements not available.');
      console.log('Run enable-pg-stat-statements.ts first.');
    } else {
      console.error('Error:', error);
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkSlowQueries();
