-- Add two-phase notification claim fields to watchlist_items
-- These fields prevent duplicate notification sends under worker concurrency
-- Claims are stale after 5 minutes (allows retry if worker crashes)

ALTER TABLE "watchlist_items"
ADD COLUMN IF NOT EXISTS "price_notification_claimed_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "price_notification_claim_key" TEXT,
ADD COLUMN IF NOT EXISTS "stock_notification_claimed_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "stock_notification_claim_key" TEXT;

-- Index on claim key for fast lookups during claim verification
CREATE INDEX IF NOT EXISTS "watchlist_items_price_claim_key_idx"
ON "watchlist_items" ("price_notification_claim_key")
WHERE "price_notification_claim_key" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "watchlist_items_stock_claim_key_idx"
ON "watchlist_items" ("stock_notification_claim_key")
WHERE "stock_notification_claim_key" IS NOT NULL;
