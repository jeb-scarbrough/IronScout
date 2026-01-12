-- Brand Aliases for Resolver Normalization
-- Per brand-aliases-v1 spec: Admin-managed, auditable mapping from brand aliases
-- to canonical brand names to improve resolver match rates.

-- Create enums
DO $$ BEGIN
  CREATE TYPE "BrandAliasSourceType" AS ENUM ('RETAILER_FEED', 'AFFILIATE_FEED', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "BrandAliasStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create brand_aliases table
CREATE TABLE IF NOT EXISTS "brand_aliases" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "canonicalName" TEXT NOT NULL,
  "canonicalNorm" TEXT NOT NULL,
  "normalizationVersion" INTEGER NOT NULL DEFAULT 1,
  "aliasName" TEXT NOT NULL,
  "aliasNorm" TEXT NOT NULL,
  "status" "BrandAliasStatus" NOT NULL DEFAULT 'DRAFT',
  "sourceType" "BrandAliasSourceType" NOT NULL,
  "sourceRef" TEXT,
  "evidence" JSONB,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdBy" TEXT NOT NULL,
  "updatedBy" TEXT NOT NULL,
  "disabledAt" TIMESTAMP(3),
  "disabledBy" TEXT,
  "disableReason" TEXT,

  CONSTRAINT "brand_aliases_pkey" PRIMARY KEY ("id")
);

-- Create unique constraint on aliasNorm (one alias maps to one canonical)
CREATE UNIQUE INDEX IF NOT EXISTS "brand_aliases_aliasNorm_key" ON "brand_aliases"("aliasNorm");

-- Create indexes for queries
CREATE INDEX IF NOT EXISTS "brand_aliases_canonicalNorm_idx" ON "brand_aliases"("canonicalNorm");
CREATE INDEX IF NOT EXISTS "brand_aliases_status_idx" ON "brand_aliases"("status");
CREATE INDEX IF NOT EXISTS "brand_aliases_createdAt_idx" ON "brand_aliases"("createdAt");

-- Create daily application tracking table
CREATE TABLE IF NOT EXISTS "brand_alias_applications_daily" (
  "aliasId" UUID NOT NULL,
  "date" DATE NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "brand_alias_applications_daily_pkey" PRIMARY KEY ("aliasId", "date"),
  CONSTRAINT "brand_alias_applications_daily_aliasId_fkey"
    FOREIGN KEY ("aliasId") REFERENCES "brand_aliases"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Create indexes for daily tracking
CREATE INDEX IF NOT EXISTS "brand_alias_applications_daily_date_idx" ON "brand_alias_applications_daily"("date");
CREATE INDEX IF NOT EXISTS "brand_alias_applications_daily_aliasId_idx" ON "brand_alias_applications_daily"("aliasId");

-- Seed with existing in-code aliases from resolver
-- These are the hardcoded BRAND_ALIASES that need to be migrated to DB
INSERT INTO "brand_aliases" ("canonicalName", "canonicalNorm", "aliasName", "aliasNorm", "status", "sourceType", "createdBy", "updatedBy", "notes")
VALUES
  ('PMC', 'pmc', 'PMC Ammunition', 'pmc ammunition', 'ACTIVE', 'MANUAL', 'system', 'system', 'Migrated from hardcoded resolver aliases'),
  ('CCI', 'cci', 'CCI Ammunition', 'cci ammunition', 'ACTIVE', 'MANUAL', 'system', 'system', 'Migrated from hardcoded resolver aliases'),
  ('Federal Premium', 'federal premium', 'Federal', 'federal', 'ACTIVE', 'MANUAL', 'system', 'system', 'Migrated from hardcoded resolver aliases'),
  ('Federal Premium', 'federal premium', 'Federal Ammunition', 'federal ammunition', 'ACTIVE', 'MANUAL', 'system', 'system', 'Migrated from hardcoded resolver aliases')
ON CONFLICT ("aliasNorm") DO NOTHING;
