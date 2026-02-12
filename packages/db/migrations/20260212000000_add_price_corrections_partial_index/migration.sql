-- Partial index on price_corrections for active (non-revoked) corrections.
-- Speeds up the NOT EXISTS subqueries in 90-day lowest price, market activity,
-- and getCaliberPriceStats queries that filter on action + scope with revokedAt IS NULL.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_price_corrections_active
ON price_corrections (action, "scopeType", "scopeId", "startTs", "endTs")
WHERE "revokedAt" IS NULL;

-- Index on prices.affiliateFeedRunId for the LEFT JOIN in market activity
-- and 90-day lowest price queries. FK exists but had no dedicated index.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_prices_affiliate_feed_run_id
ON prices ("affiliateFeedRunId");
