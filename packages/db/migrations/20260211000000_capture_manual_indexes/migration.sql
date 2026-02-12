-- Capture indexes that were added manually to the dev database.
-- This migration brings the migration history in sync with the actual schema.
-- Index names use the Prisma convention (tableName_columnName_idx) to match existing DB state.
-- All statements use IF NOT EXISTS so they are safe to re-run.

-- alerts
CREATE INDEX IF NOT EXISTS "alerts_createdAt_idx" ON alerts ("createdAt");
CREATE INDEX IF NOT EXISTS "alerts_userId_idx" ON alerts ("userId");
CREATE INDEX IF NOT EXISTS "alerts_userId_productId_ruleType_idx" ON alerts ("userId", "productId", "ruleType");

-- execution_logs
CREATE INDEX IF NOT EXISTS "execution_logs_executionId_level_idx" ON execution_logs ("executionId", level);
CREATE INDEX IF NOT EXISTS "execution_logs_executionId_timestamp_idx" ON execution_logs ("executionId", timestamp);
CREATE INDEX IF NOT EXISTS "execution_logs_timestamp_idx" ON execution_logs (timestamp);

-- executions
CREATE INDEX IF NOT EXISTS "executions_sourceId_idx" ON executions ("sourceId");
CREATE INDEX IF NOT EXISTS "executions_sourceId_startedAt_idx" ON executions ("sourceId", "startedAt");
CREATE INDEX IF NOT EXISTS "executions_sourceId_status_idx" ON executions ("sourceId", status);
CREATE INDEX IF NOT EXISTS "executions_status_idx" ON executions (status);

-- prices
CREATE INDEX IF NOT EXISTS "prices_createdAt_idx" ON prices ("createdAt");
CREATE INDEX IF NOT EXISTS "prices_price_inStock_idx" ON prices (price, "inStock");
CREATE INDEX IF NOT EXISTS "prices_productId_retailerId_createdAt_idx" ON prices ("productId", "retailerId", "createdAt");

-- products
CREATE INDEX IF NOT EXISTS idx_products_brand ON products (brand);
CREATE INDEX IF NOT EXISTS "products_category_idx" ON products (category);
CREATE INDEX IF NOT EXISTS "products_createdAt_idx" ON products ("createdAt");
CREATE INDEX IF NOT EXISTS "products_updatedAt_idx" ON products ("updatedAt");

-- retailers
CREATE INDEX IF NOT EXISTS "retailers_tier_idx" ON retailers (tier);
CREATE INDEX IF NOT EXISTS "retailers_tier_name_idx" ON retailers (tier, name);
CREATE INDEX IF NOT EXISTS "retailers_website_idx" ON retailers (website);

-- sources
CREATE INDEX IF NOT EXISTS "sources_type_idx" ON sources (type);
CREATE INDEX IF NOT EXISTS "sources_updatedAt_idx" ON sources ("updatedAt");

-- subscriptions
CREATE INDEX IF NOT EXISTS "subscriptions_status_idx" ON subscriptions (status);
CREATE INDEX IF NOT EXISTS "subscriptions_userId_idx" ON subscriptions ("userId");

-- users
CREATE INDEX IF NOT EXISTS "users_email_idx" ON users (email);
CREATE INDEX IF NOT EXISTS "users_tier_idx" ON users (tier);
