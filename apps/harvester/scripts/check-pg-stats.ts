import 'dotenv/config';
import { prisma } from '@ironscout/db';

async function checkPgStats() {
  console.log('=== PostgreSQL Performance Analysis ===\n');

  // 1. Table sizes and row counts
  console.log('--- Table Sizes ---');
  const tableSizes = await prisma.$queryRaw<Array<{
    table_name: string;
    row_estimate: number;
    total_size: string;
    table_size: string;
    index_size: string;
  }>>`
    SELECT
      relname as table_name,
      n_live_tup as row_estimate,
      pg_size_pretty(pg_total_relation_size(relid)) as total_size,
      pg_size_pretty(pg_relation_size(relid)) as table_size,
      pg_size_pretty(pg_indexes_size(relid)) as index_size
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(relid) DESC
    LIMIT 20
  `;
  console.table(tableSizes);

  // 2. Sequential scans vs index scans (tables that need indexes)
  console.log('\n--- Tables with High Sequential Scans (may need indexes) ---');
  const seqScans = await prisma.$queryRaw<Array<{
    table_name: string;
    seq_scan: bigint;
    idx_scan: bigint;
    seq_tup_read: bigint;
    idx_tup_fetch: bigint;
    ratio: string;
  }>>`
    SELECT
      relname as table_name,
      seq_scan,
      idx_scan,
      seq_tup_read,
      idx_tup_fetch,
      CASE WHEN (seq_scan + idx_scan) > 0
        THEN round(100.0 * seq_scan / (seq_scan + idx_scan), 1)::text || '%'
        ELSE 'N/A'
      END as ratio
    FROM pg_stat_user_tables
    WHERE seq_scan > 100
    ORDER BY seq_tup_read DESC
    LIMIT 15
  `;
  console.table(seqScans);

  // 3. Unused indexes
  console.log('\n--- Unused Indexes (candidates for removal) ---');
  const unusedIndexes = await prisma.$queryRaw<Array<{
    table_name: string;
    index_name: string;
    index_size: string;
    idx_scan: bigint;
  }>>`
    SELECT
      relname as table_name,
      indexrelname as index_name,
      pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
      idx_scan
    FROM pg_stat_user_indexes
    WHERE idx_scan < 10
      AND indexrelname NOT LIKE '%pkey%'
      AND indexrelname NOT LIKE '%unique%'
    ORDER BY pg_relation_size(indexrelid) DESC
    LIMIT 15
  `;
  console.table(unusedIndexes);

  // 4. Most used indexes
  console.log('\n--- Most Used Indexes ---');
  const usedIndexes = await prisma.$queryRaw<Array<{
    table_name: string;
    index_name: string;
    idx_scan: bigint;
    idx_tup_read: bigint;
    idx_tup_fetch: bigint;
  }>>`
    SELECT
      relname as table_name,
      indexrelname as index_name,
      idx_scan,
      idx_tup_read,
      idx_tup_fetch
    FROM pg_stat_user_indexes
    ORDER BY idx_scan DESC
    LIMIT 15
  `;
  console.table(usedIndexes);

  // 5. Missing indexes - columns frequently in WHERE/JOIN without indexes
  console.log('\n--- Existing Indexes ---');
  const existingIndexes = await prisma.$queryRaw<Array<{
    table_name: string;
    index_name: string;
    index_def: string;
  }>>`
    SELECT
      tablename as table_name,
      indexname as index_name,
      indexdef as index_def
    FROM pg_indexes
    WHERE schemaname = 'public'
    ORDER BY tablename, indexname
  `;
  console.table(existingIndexes);

  // 6. Check for common query patterns that need indexes
  console.log('\n--- Recommended Index Analysis ---');

  // Check products table
  const productsColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'products' AND table_schema = 'public'
  `;
  console.log('Products columns:', productsColumns.map(c => c.column_name).join(', '));

  // Check product_links table
  const linksColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'product_links' AND table_schema = 'public'
  `;
  console.log('Product_links columns:', linksColumns.map(c => c.column_name).join(', '));

  // Check price_history table
  const priceColumns = await prisma.$queryRaw<Array<{ column_name: string }>>`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'price_history' AND table_schema = 'public'
  `;
  console.log('Price_history columns:', priceColumns.map(c => c.column_name).join(', '));

  await prisma.$disconnect();
}

checkPgStats().catch(console.error);
