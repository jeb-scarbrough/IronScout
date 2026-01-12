-- Add click event tracking fields for affiliate reconciliation
-- Renames merchantId -> retailerId (fixing dealer/merchant naming confusion)
-- clickId: Unique ID passed to affiliates as subId for conversion tracking
-- sourceId, sourceProductId: FK references for analytics
-- targetUrl: The final affiliate URL that was clicked

-- Step 1: Add new columns
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "clickId" TEXT;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "sourceId" TEXT;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "sourceProductId" TEXT;
ALTER TABLE "click_events" ADD COLUMN IF NOT EXISTS "targetUrl" TEXT;

-- Step 2: Rename merchantId to retailerId (if merchantId exists) or create retailerId
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'click_events' AND column_name = 'merchantid') THEN
    -- Drop old FK constraint if exists
    ALTER TABLE "click_events" DROP CONSTRAINT IF EXISTS "click_events_merchantId_fkey";
    -- Rename the column
    ALTER TABLE "click_events" RENAME COLUMN "merchantId" TO "retailerId";
    -- Drop old index
    DROP INDEX IF EXISTS "click_events_merchantId_idx";
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'click_events' AND column_name = 'retailerid') THEN
    -- Neither merchantId nor retailerId exists, create retailerId
    ALTER TABLE "click_events" ADD COLUMN "retailerId" TEXT;
  END IF;
END $$;

-- Step 3: Generate clickId for existing rows (using id as fallback)
UPDATE "click_events" SET "clickId" = id WHERE "clickId" IS NULL;

-- Step 4: Make clickId NOT NULL and UNIQUE after backfill
ALTER TABLE "click_events" ALTER COLUMN "clickId" SET NOT NULL;
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_clickId_key" UNIQUE ("clickId");

-- Step 5: Add/update foreign key constraints
-- retailerId is required, others are optional (SET NULL on delete)
ALTER TABLE "click_events" DROP CONSTRAINT IF EXISTS "click_events_retailerId_fkey";
ALTER TABLE "click_events"
  ADD CONSTRAINT "click_events_retailerId_fkey"
  FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "click_events"
  ADD CONSTRAINT "click_events_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "click_events"
  ADD CONSTRAINT "click_events_sourceProductId_fkey"
  FOREIGN KEY ("sourceProductId") REFERENCES "source_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 6: Add indexes for query performance
CREATE INDEX IF NOT EXISTS "click_events_clickId_idx" ON "click_events"("clickId");
CREATE INDEX IF NOT EXISTS "click_events_retailerId_idx" ON "click_events"("retailerId");
CREATE INDEX IF NOT EXISTS "click_events_sourceId_idx" ON "click_events"("sourceId");
CREATE INDEX IF NOT EXISTS "click_events_sourceProductId_idx" ON "click_events"("sourceProductId");
