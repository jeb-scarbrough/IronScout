-- Phase 1: Retailer Eligibility and Provenance Migration
-- Per ADR-005 and Merchant-and-Retailer-Reference

-- ============================================================================
-- Phase 1A: RetailerVisibility enum and fields on retailers
-- ============================================================================

-- Create RetailerVisibility enum
DO $$ BEGIN
    CREATE TYPE "RetailerVisibility" AS ENUM ('ELIGIBLE', 'INELIGIBLE', 'SUSPENDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add visibility fields to retailers
ALTER TABLE "retailers" ADD COLUMN IF NOT EXISTS "visibilityStatus" "RetailerVisibility" NOT NULL DEFAULT 'ELIGIBLE';
ALTER TABLE "retailers" ADD COLUMN IF NOT EXISTS "visibilityReason" TEXT;
ALTER TABLE "retailers" ADD COLUMN IF NOT EXISTS "visibilityUpdatedAt" TIMESTAMP(3);
ALTER TABLE "retailers" ADD COLUMN IF NOT EXISTS "visibilityUpdatedBy" TEXT;

-- Create index on visibilityStatus for query-time filtering
CREATE INDEX IF NOT EXISTS "retailers_visibilityStatus_idx" ON "retailers"("visibilityStatus");

-- ============================================================================
-- Phase 1B: Merchant-Retailer relationship tables
-- ============================================================================

-- Create MerchantRetailerStatus enum
DO $$ BEGIN
    CREATE TYPE "MerchantRetailerStatus" AS ENUM ('ACTIVE', 'PENDING', 'SUSPENDED', 'INACTIVE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create MerchantRetailerRole enum
DO $$ BEGIN
    CREATE TYPE "MerchantRetailerRole" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create merchant_retailers join table
CREATE TABLE IF NOT EXISTS "merchant_retailers" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "status" "MerchantRetailerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_retailers_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint and indexes
-- V1 Constraint: One Retailer can only belong to one Merchant (UNIQUE retailerId)
DO $$ BEGIN
    ALTER TABLE "merchant_retailers" ADD CONSTRAINT "merchant_retailers_retailerId_key" UNIQUE ("retailerId");
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "merchant_retailers" ADD CONSTRAINT "merchant_retailers_merchantId_retailerId_key" UNIQUE ("merchantId", "retailerId");
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "merchant_retailers_merchantId_idx" ON "merchant_retailers"("merchantId");
CREATE INDEX IF NOT EXISTS "merchant_retailers_retailerId_idx" ON "merchant_retailers"("retailerId");
CREATE INDEX IF NOT EXISTS "merchant_retailers_status_idx" ON "merchant_retailers"("status");

-- Add foreign keys (only if referenced tables exist)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchants') THEN
        ALTER TABLE "merchant_retailers" ADD CONSTRAINT "merchant_retailers_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "merchant_retailers" ADD CONSTRAINT "merchant_retailers_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create merchant_user_retailers table for per-retailer permissions
CREATE TABLE IF NOT EXISTS "merchant_user_retailers" (
    "id" TEXT NOT NULL,
    "merchantUserId" TEXT NOT NULL,
    "merchantRetailerId" TEXT NOT NULL,
    "role" "MerchantRetailerRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_user_retailers_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint and indexes
DO $$ BEGIN
    ALTER TABLE "merchant_user_retailers" ADD CONSTRAINT "merchant_user_retailers_merchantUserId_merchantRetailerId_key" UNIQUE ("merchantUserId", "merchantRetailerId");
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "merchant_user_retailers_merchantUserId_idx" ON "merchant_user_retailers"("merchantUserId");
CREATE INDEX IF NOT EXISTS "merchant_user_retailers_merchantRetailerId_idx" ON "merchant_user_retailers"("merchantRetailerId");

-- Add foreign keys (only if referenced tables exist)
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchant_users') THEN
        ALTER TABLE "merchant_user_retailers" ADD CONSTRAINT "merchant_user_retailers_merchantUserId_fkey" FOREIGN KEY ("merchantUserId") REFERENCES "merchant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "merchant_user_retailers" ADD CONSTRAINT "merchant_user_retailers_merchantRetailerId_fkey" FOREIGN KEY ("merchantRetailerId") REFERENCES "merchant_retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- Phase 1C: ADR-015 Provenance fields on prices
-- ============================================================================

-- Create IngestionRunType enum
DO $$ BEGIN
    CREATE TYPE "IngestionRunType" AS ENUM ('SCRAPE', 'AFFILIATE_FEED', 'MERCHANT_FEED', 'MANUAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add provenance fields to prices
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "ingestionRunType" "IngestionRunType";
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "ingestionRunId" TEXT;
ALTER TABLE "prices" ADD COLUMN IF NOT EXISTS "affiliateId" TEXT;

-- Create indexes for provenance queries and corrections
CREATE INDEX IF NOT EXISTS "prices_ingestionRunType_idx" ON "prices"("ingestionRunType");
CREATE INDEX IF NOT EXISTS "prices_ingestionRunId_idx" ON "prices"("ingestionRunId");

-- ============================================================================
-- Phase 1D: Listing entitlements for consumer visibility
-- Per Merchant-and-Retailer-Reference: Merchant pays to list each retailer.
-- Consumer visibility = retailers.visibilityStatus=ELIGIBLE AND listingStatus=LISTED AND status=ACTIVE
-- ============================================================================

-- Create MerchantRetailerListingStatus enum
DO $$ BEGIN
    CREATE TYPE "MerchantRetailerListingStatus" AS ENUM ('LISTED', 'UNLISTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add listing fields to merchant_retailers
ALTER TABLE "merchant_retailers" ADD COLUMN IF NOT EXISTS "listingStatus" "MerchantRetailerListingStatus" NOT NULL DEFAULT 'UNLISTED';
ALTER TABLE "merchant_retailers" ADD COLUMN IF NOT EXISTS "listedAt" TIMESTAMP(3);
ALTER TABLE "merchant_retailers" ADD COLUMN IF NOT EXISTS "listedBy" TEXT;
ALTER TABLE "merchant_retailers" ADD COLUMN IF NOT EXISTS "unlistedAt" TIMESTAMP(3);
ALTER TABLE "merchant_retailers" ADD COLUMN IF NOT EXISTS "unlistedBy" TEXT;
ALTER TABLE "merchant_retailers" ADD COLUMN IF NOT EXISTS "unlistedReason" TEXT;

-- Create index for listing status queries
CREATE INDEX IF NOT EXISTS "merchant_retailers_listingStatus_idx" ON "merchant_retailers"("listingStatus");

COMMENT ON COLUMN "merchant_retailers"."listingStatus" IS 'Paid entitlement for consumer visibility. UNLISTED by default, becomes LISTED when merchant pays.';
COMMENT ON COLUMN "merchant_retailers"."unlistedReason" IS 'Reason for unlisting (billing_delinquent, manual, policy_violation, etc.)';

-- ============================================================================
-- Data Migration: Backfill merchant_retailers from retailers.merchantId
-- ============================================================================

-- Create merchant_retailers records from existing retailers.merchantId links
-- Only run if merchants table exists and retailers has merchantId column
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'merchants')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retailers' AND column_name = 'merchantId') THEN
        INSERT INTO "merchant_retailers" ("id", "merchantId", "retailerId", "status", "createdAt", "updatedAt")
        SELECT
            gen_random_uuid()::text,
            r."merchantId",
            r."id",
            'ACTIVE'::"MerchantRetailerStatus",
            r."createdAt",
            NOW()
        FROM "retailers" r
        WHERE r."merchantId" IS NOT NULL
        ON CONFLICT ("merchantId", "retailerId") DO NOTHING;
    END IF;
END $$;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON COLUMN "retailers"."visibilityStatus" IS 'Consumer visibility state per ADR-005. ELIGIBLE = visible in consumer search, alerts, watchlists. INELIGIBLE = hidden. SUSPENDED = explicit block.';

-- Only add merchantId comment if the column exists
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'retailers' AND column_name = 'merchantId') THEN
        COMMENT ON COLUMN "retailers"."merchantId" IS 'DEPRECATED: Legacy optional link to merchant. Use merchant_retailers join table. Retained for migration compatibility only.';
    END IF;
END $$;

COMMENT ON TABLE "merchant_retailers" IS 'Explicit Merchant↔Retailer relationship per Merchant-and-Retailer-Reference. One Merchant can administer many Retailers.';
COMMENT ON TABLE "merchant_user_retailers" IS 'Per-retailer permissions for merchant users per Merchant-and-Retailer-Reference.';

COMMENT ON COLUMN "prices"."ingestionRunType" IS 'ADR-015 Provenance: Type of ingestion run that created this price.';
COMMENT ON COLUMN "prices"."ingestionRunId" IS 'ADR-015 Provenance: ID of the specific run (execution, affiliate_feed_run, merchant_feed_run).';
COMMENT ON COLUMN "prices"."affiliateId" IS 'ADR-015 Provenance: Affiliate network ID if from affiliate feed.';
