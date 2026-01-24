-- =====================================================
-- Schema Index Synchronization
--
-- This migration adds indexes that are defined in schema.prisma
-- but were missing from previous migrations.
--
-- Identified by: pnpm audit:migrations
--
-- NOTE: Cannot use CONCURRENTLY - Prisma runs migrations in transactions
-- For large production tables, consider running these manually outside Prisma
-- =====================================================

-- merchant_contacts
CREATE INDEX IF NOT EXISTS idx_merchant_contacts_email
ON merchant_contacts(email);

-- retailer_feed_runs
CREATE INDEX IF NOT EXISTS idx_retailer_feed_runs_started_at
ON retailer_feed_runs("startedAt" DESC);

CREATE INDEX IF NOT EXISTS idx_retailer_feed_runs_ignored_at
ON retailer_feed_runs("ignoredAt")
WHERE "ignoredAt" IS NOT NULL;

-- retailer_feeds
CREATE INDEX IF NOT EXISTS idx_retailer_feeds_enabled
ON retailer_feeds(enabled)
WHERE enabled = true;

-- retailer_skus
CREATE INDEX IF NOT EXISTS idx_retailer_skus_is_active
ON retailer_skus("isActive")
WHERE "isActive" = true;

-- merchant_users
CREATE INDEX IF NOT EXISTS idx_merchant_users_email
ON merchant_users(email);

-- feed_corrections
CREATE INDEX IF NOT EXISTS idx_feed_corrections_feed_record
ON feed_corrections("feedId", "recordRef");

CREATE INDEX IF NOT EXISTS idx_feed_corrections_quarantined
ON feed_corrections("quarantinedRecordId")
WHERE "quarantinedRecordId" IS NOT NULL;

-- quarantined_records
CREATE INDEX IF NOT EXISTS idx_quarantined_records_feed_status
ON quarantined_records("feedId", status);

CREATE INDEX IF NOT EXISTS idx_quarantined_records_status
ON quarantined_records(status);

-- source_products
CREATE INDEX IF NOT EXISTS idx_source_products_product_id
ON source_products("productId")
WHERE "productId" IS NOT NULL;

-- user_guns
CREATE INDEX IF NOT EXISTS idx_user_guns_user_id
ON user_guns("userId");

-- watchlist_collections
CREATE INDEX IF NOT EXISTS idx_watchlist_collections_user_id
ON watchlist_collections("userId");

-- watchlist_items (multiple indexes)
CREATE INDEX IF NOT EXISTS idx_watchlist_items_collection_id
ON watchlist_items("collectionId")
WHERE "collectionId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_watchlist_items_product_id
ON watchlist_items("productId")
WHERE "productId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_watchlist_items_user_id
ON watchlist_items("userId");

-- Named indexes from schema (using exact names from @@index map)
-- Note: Use actual DB column names (snake_case), not Prisma names (camelCase)
CREATE INDEX IF NOT EXISTS watchlist_items_deleted_at_idx
ON watchlist_items(deleted_at)
WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS watchlist_items_intent_type_idx
ON watchlist_items(intent_type);

-- Analyze affected tables
ANALYZE merchant_contacts;
ANALYZE retailer_feed_runs;
ANALYZE retailer_feeds;
ANALYZE retailer_skus;
ANALYZE merchant_users;
ANALYZE feed_corrections;
ANALYZE quarantined_records;
ANALYZE source_products;
ANALYZE user_guns;
ANALYZE watchlist_collections;
ANALYZE watchlist_items;
