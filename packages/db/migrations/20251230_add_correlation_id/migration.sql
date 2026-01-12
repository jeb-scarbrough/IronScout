-- Add correlationId column to affiliate_feed_runs for failure log correlation

ALTER TABLE affiliate_feed_runs ADD COLUMN IF NOT EXISTS "correlationId" TEXT;

-- Add index for faster lookups by correlation ID
CREATE INDEX IF NOT EXISTS idx_affiliate_feed_runs_correlation_id ON affiliate_feed_runs("correlationId") WHERE "correlationId" IS NOT NULL;
