-- Migration: Add ADR-015 provenance columns to prices table
-- These columns track the origin of each price record for corrections and auditing

-- Create IngestionRunType enum if it doesn't exist
DO $$ BEGIN
    CREATE TYPE "IngestionRunType" AS ENUM ('SCRAPE', 'AFFILIATE_FEED', 'MERCHANT_FEED', 'MANUAL');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- Add observedAt column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'prices' AND column_name = 'observedAt') THEN
        ALTER TABLE "prices" ADD COLUMN "observedAt" TIMESTAMPTZ DEFAULT now();

        -- Backfill from createdAt for existing records
        UPDATE "prices" SET "observedAt" = "createdAt" WHERE "observedAt" IS NULL;

        -- Create index for observedAt
        CREATE INDEX IF NOT EXISTS "prices_observedAt_idx" ON "prices"("observedAt");
    END IF;
END $$;

-- Add ingestionRunType column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'prices' AND column_name = 'ingestionRunType') THEN
        ALTER TABLE "prices" ADD COLUMN "ingestionRunType" "IngestionRunType";

        -- Create index for ingestionRunType
        CREATE INDEX IF NOT EXISTS "prices_ingestionRunType_idx" ON "prices"("ingestionRunType");
    END IF;
END $$;

-- Add ingestionRunId column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'prices' AND column_name = 'ingestionRunId') THEN
        ALTER TABLE "prices" ADD COLUMN "ingestionRunId" TEXT;

        -- Create index for ingestionRunId
        CREATE INDEX IF NOT EXISTS "prices_ingestionRunId_idx" ON "prices"("ingestionRunId");
    END IF;
END $$;

-- Add affiliateId column if it doesn't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'prices' AND column_name = 'affiliateId') THEN
        ALTER TABLE "prices" ADD COLUMN "affiliateId" TEXT;
    END IF;
END $$;
