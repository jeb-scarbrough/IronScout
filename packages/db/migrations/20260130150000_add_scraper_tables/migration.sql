-- Add scraper framework tables (per scraper-framework-01 spec)
-- This migration was created retroactively - tables already exist in database

-- Enums for scraper status tracking
CREATE TYPE "ScrapeTargetStatus" AS ENUM ('ACTIVE', 'PAUSED', 'BROKEN', 'STALE');
CREATE TYPE "ScrapeRunTrigger" AS ENUM ('SCHEDULED', 'MANUAL', 'RETRY', 'RECHECK');
CREATE TYPE "ScrapeRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED', 'QUARANTINED');
CREATE TYPE "ScrapeAdapterDisableReason" AS ENUM ('MANUAL', 'DRIFT_DETECTED', 'TOS_VIOLATION');

-- Per-adapter health tracking (must be created first for FK references)
CREATE TABLE "scrape_adapter_status" (
    "adapterId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "disabledAt" TIMESTAMP(3),
    "disabledReason" "ScrapeAdapterDisableReason",
    "disabledBy" TEXT,
    "baselineFailureRate" DECIMAL(5,4),
    "baselineYieldRate" DECIMAL(5,4),
    "baselineSampleSize" INTEGER NOT NULL DEFAULT 0,
    "baselineUpdatedAt" TIMESTAMP(3),
    "consecutiveFailedBatches" INTEGER NOT NULL DEFAULT 0,
    "lastBatchFailureRate" DECIMAL(5,4),
    "lastRunHadZeroPrice" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scrape_adapter_status_pkey" PRIMARY KEY ("adapterId")
);

-- Scrape targets (URLs to be scraped)
CREATE TABLE "scrape_targets" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "adapterId" TEXT NOT NULL,
    "sourceProductId" TEXT,
    "schedule" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "ScrapeTargetStatus" NOT NULL DEFAULT 'ACTIVE',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "robotsPathBlocked" BOOLEAN NOT NULL DEFAULT false,
    "lastScrapedAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "scrape_targets_pkey" PRIMARY KEY ("id")
);

-- Scrape runs (audit trail for scrape executions)
CREATE TABLE "scrape_runs" (
    "id" TEXT NOT NULL,
    "adapterId" TEXT NOT NULL,
    "adapterVersion" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "trigger" "ScrapeRunTrigger" NOT NULL,
    "status" "ScrapeRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "urlsAttempted" INTEGER NOT NULL DEFAULT 0,
    "urlsSucceeded" INTEGER NOT NULL DEFAULT 0,
    "urlsFailed" INTEGER NOT NULL DEFAULT 0,
    "offersExtracted" INTEGER NOT NULL DEFAULT 0,
    "offersValid" INTEGER NOT NULL DEFAULT 0,
    "offersDropped" INTEGER NOT NULL DEFAULT 0,
    "offersQuarantined" INTEGER NOT NULL DEFAULT 0,
    "oosNoPriceCount" INTEGER NOT NULL DEFAULT 0,
    "zeroPriceCount" INTEGER NOT NULL DEFAULT 0,
    "failureRate" DECIMAL(5,4),
    "yieldRate" DECIMAL(5,4),
    "dropRate" DECIMAL(5,4),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scrape_runs_pkey" PRIMARY KEY ("id")
);

-- Add scrape-related columns to sources
ALTER TABLE "sources" ADD COLUMN "scrapeEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sources" ADD COLUMN "adapterId" TEXT;
ALTER TABLE "sources" ADD COLUMN "robotsCompliant" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "sources" ADD COLUMN "scrapeConfig" JSONB;
ALTER TABLE "sources" ADD COLUMN "tosReviewedAt" TIMESTAMP(3);
ALTER TABLE "sources" ADD COLUMN "tosApprovedBy" TEXT;

-- Add unique constraint on source_products for identity key dedup
CREATE UNIQUE INDEX "source_products_sourceId_identityKey_key" ON "source_products"("sourceId", "identityKey");

-- Add unique constraint on sources for composite FK
CREATE UNIQUE INDEX "sources_id_adapterId_key" ON "sources"("id", "adapterId");

-- Indexes for scrape_targets
CREATE UNIQUE INDEX "scrape_targets_source_canonical_unique" ON "scrape_targets"("sourceId", "canonicalUrl");
CREATE INDEX "scrape_targets_sourceId_idx" ON "scrape_targets"("sourceId");
CREATE INDEX "scrape_targets_adapterId_idx" ON "scrape_targets"("adapterId");
CREATE INDEX "scrape_targets_status_idx" ON "scrape_targets"("status");
CREATE INDEX "scrape_targets_schedule_idx" ON "scrape_targets"("schedule");
CREATE INDEX "scrape_targets_enabled_status_idx" ON "scrape_targets"("enabled", "status");

-- Indexes for scrape_runs
CREATE INDEX "scrape_runs_adapterId_idx" ON "scrape_runs"("adapterId");
CREATE INDEX "scrape_runs_sourceId_idx" ON "scrape_runs"("sourceId");
CREATE INDEX "scrape_runs_retailerId_idx" ON "scrape_runs"("retailerId");
CREATE INDEX "scrape_runs_status_idx" ON "scrape_runs"("status");
CREATE INDEX "scrape_runs_startedAt_idx" ON "scrape_runs"("startedAt");

-- Foreign keys for scrape_targets
ALTER TABLE "scrape_targets" ADD CONSTRAINT "scrape_targets_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scrape_targets" ADD CONSTRAINT "scrape_targets_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "source_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "scrape_targets" ADD CONSTRAINT "scrape_targets_adapterId_fkey" FOREIGN KEY ("adapterId") REFERENCES "scrape_adapter_status"("adapterId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Foreign keys for scrape_runs
ALTER TABLE "scrape_runs" ADD CONSTRAINT "scrape_runs_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scrape_runs" ADD CONSTRAINT "scrape_runs_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scrape_runs" ADD CONSTRAINT "scrape_runs_adapterId_fkey" FOREIGN KEY ("adapterId") REFERENCES "scrape_adapter_status"("adapterId") ON DELETE RESTRICT ON UPDATE CASCADE;
