-- =====================================================
-- Drop Stale Indexes
--
-- These indexes reference columns that no longer exist in the schema.
-- They were created in previous migrations but the columns have since
-- been removed.
--
-- Identified by: pnpm audit:migrations
--
-- NOTE: Cannot use CONCURRENTLY - Prisma runs migrations in transactions
-- =====================================================

-- subscriptions: stripeCustomerId column was replaced with stripeId
DROP INDEX IF EXISTS idx_subscriptions_stripe_customer;

-- click_events: retailerSkuId column was removed
DROP INDEX IF EXISTS idx_click_events_retailerskuid;
DROP INDEX IF EXISTS click_events_retailerskuid_idx;

-- retailer_skus: These columns were removed (canonicalSkuId, mappingConfidence, needsReview)
DROP INDEX IF EXISTS idx_retailer_skus_canonical;
DROP INDEX IF EXISTS idx_retailer_skus_mapping_confidence;
DROP INDEX IF EXISTS idx_retailer_skus_needs_review;
DROP INDEX IF EXISTS retailer_skus_canonicalskuid_idx;
DROP INDEX IF EXISTS retailer_skus_mappingconfidence_idx;
DROP INDEX IF EXISTS retailer_skus_needsreview_idx;
