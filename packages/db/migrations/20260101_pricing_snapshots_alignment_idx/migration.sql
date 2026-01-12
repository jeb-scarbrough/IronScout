-- Migration: Add composite index for retailer-merchant alignment on pricing_snapshots
-- Supports validation queries that check retailerId maps to merchantId via merchant_retailers
-- Per v1 constraint: one retailer belongs to one merchant

-- Only create if pricing_snapshots table exists and has the required columns
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pricing_snapshots') THEN
        -- Add merchantId column if it doesn't exist (required FK to merchants)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'pricing_snapshots' AND column_name = 'merchantId') THEN
            -- Add as nullable first (for existing rows), schema requires NOT NULL but enforced at app layer
            ALTER TABLE "pricing_snapshots" ADD COLUMN "merchantId" TEXT;

            -- Add FK constraint only if merchants table exists
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchants') THEN
                ALTER TABLE "pricing_snapshots" ADD CONSTRAINT "pricing_snapshots_merchantId_fkey"
                FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
            END IF;

            -- Add single-column index
            CREATE INDEX "pricing_snapshots_merchantId_idx" ON "pricing_snapshots"("merchantId");
        END IF;

        -- Add retailerId column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'pricing_snapshots' AND column_name = 'retailerId') THEN
            ALTER TABLE "pricing_snapshots" ADD COLUMN "retailerId" TEXT;

            -- Add FK constraint only if retailers table exists
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'retailers') THEN
                ALTER TABLE "pricing_snapshots" ADD CONSTRAINT "pricing_snapshots_retailerId_fkey"
                FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
            END IF;

            -- Add single-column index
            CREATE INDEX "pricing_snapshots_retailerId_idx" ON "pricing_snapshots"("retailerId");
        END IF;

        -- Add sourceId column if it doesn't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'pricing_snapshots' AND column_name = 'sourceId') THEN
            ALTER TABLE "pricing_snapshots" ADD COLUMN "sourceId" TEXT;

            -- Add FK constraint only if sources table exists
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sources') THEN
                ALTER TABLE "pricing_snapshots" ADD CONSTRAINT "pricing_snapshots_sourceId_fkey"
                FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
            END IF;

            -- Add single-column index
            CREATE INDEX "pricing_snapshots_sourceId_idx" ON "pricing_snapshots"("sourceId");
        END IF;

        -- Add provenance columns if they don't exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'pricing_snapshots' AND column_name = 'ingestionRunType') THEN
            -- Create enum if needed (use DO block to handle if exists)
            BEGIN
                CREATE TYPE "IngestionRunType" AS ENUM ('SCRAPE', 'AFFILIATE_FEED', 'MERCHANT_FEED', 'MANUAL');
            EXCEPTION
                WHEN duplicate_object THEN NULL;
            END;

            ALTER TABLE "pricing_snapshots" ADD COLUMN "ingestionRunType" "IngestionRunType";
            CREATE INDEX "pricing_snapshots_ingestionRunType_idx" ON "pricing_snapshots"("ingestionRunType");
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'pricing_snapshots' AND column_name = 'ingestionRunId') THEN
            ALTER TABLE "pricing_snapshots" ADD COLUMN "ingestionRunId" TEXT;
            CREATE INDEX "pricing_snapshots_ingestionRunId_idx" ON "pricing_snapshots"("ingestionRunId");
        END IF;

        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'pricing_snapshots' AND column_name = 'observedAt') THEN
            ALTER TABLE "pricing_snapshots" ADD COLUMN "observedAt" TIMESTAMPTZ DEFAULT now();
            -- Backfill from createdAt
            UPDATE "pricing_snapshots" SET "observedAt" = "createdAt" WHERE "observedAt" IS NULL;
            ALTER TABLE "pricing_snapshots" ALTER COLUMN "observedAt" SET NOT NULL;
            CREATE INDEX "pricing_snapshots_observedAt_idx" ON "pricing_snapshots"("observedAt");
        END IF;

        -- Create composite index for retailer-merchant alignment (only if both columns exist)
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pricing_snapshots' AND column_name = 'retailerId')
           AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pricing_snapshots' AND column_name = 'merchantId') THEN
            CREATE INDEX IF NOT EXISTS "pricing_snapshots_retailer_merchant_idx"
            ON "pricing_snapshots"("retailerId", "merchantId");
        END IF;
    END IF;
END $$;
