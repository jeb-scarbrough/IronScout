-- Add ingestion pause controls to scrape_adapter_status
ALTER TABLE "scrape_adapter_status"
  ADD COLUMN "ingestionPaused" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "ingestionPausedAt" TIMESTAMP(3),
  ADD COLUMN "ingestionPausedReason" TEXT,
  ADD COLUMN "ingestionPausedBy" TEXT;
