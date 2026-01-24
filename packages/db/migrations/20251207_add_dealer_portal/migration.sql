-- Dealer Portal Migration
-- Adds all tables and enums for the dealer portal MVP

-- =============================================
-- ENUMS
-- =============================================

CREATE TYPE "DealerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');
CREATE TYPE "DealerTier" AS ENUM ('FOUNDING', 'BASIC', 'PRO', 'ENTERPRISE');
CREATE TYPE "StoreType" AS ENUM ('ONLINE_ONLY', 'RETAIL_AND_ONLINE');
CREATE TYPE "ShippingType" AS ENUM ('FLAT', 'PER_UNIT', 'CALCULATED', 'FREE', 'UNKNOWN');
CREATE TYPE "FeedType" AS ENUM ('URL', 'AUTH_URL', 'FTP', 'SFTP', 'UPLOAD');
CREATE TYPE "FeedStatus" AS ENUM ('PENDING', 'HEALTHY', 'WARNING', 'FAILED');
CREATE TYPE "FeedRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'WARNING', 'FAILURE');
CREATE TYPE "MappingConfidence" AS ENUM ('HIGH', 'MEDIUM', 'LOW', 'NONE');
CREATE TYPE "BenchmarkSource" AS ENUM ('INTERNAL', 'EXTERNAL', 'MIXED');
CREATE TYPE "BenchmarkConfidence" AS ENUM ('HIGH', 'MEDIUM', 'NONE');
CREATE TYPE "InsightType" AS ENUM ('OVERPRICED', 'UNDERPRICED', 'STOCK_OPPORTUNITY', 'ATTRIBUTE_GAP');
CREATE TYPE "InsightConfidence" AS ENUM ('HIGH', 'MEDIUM');

-- =============================================
-- TABLES
-- =============================================

-- Dealers
CREATE TABLE "dealers" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifyToken" TEXT,
    "resetToken" TEXT,
    "resetTokenExp" TIMESTAMP(3),
    "businessName" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "phone" TEXT,
    "storeType" "StoreType" NOT NULL DEFAULT 'ONLINE_ONLY',
    "status" "DealerStatus" NOT NULL DEFAULT 'PENDING',
    "tier" "DealerTier" NOT NULL DEFAULT 'FOUNDING',
    "pixelApiKey" TEXT,
    "pixelEnabled" BOOLEAN NOT NULL DEFAULT false,
    "shippingType" "ShippingType" NOT NULL DEFAULT 'UNKNOWN',
    "shippingFlat" DECIMAL(10, 2),
    "shippingPerUnit" DECIMAL(10, 2),
    "retailerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealers_pkey" PRIMARY KEY ("id")
);

-- Dealer Feeds
CREATE TABLE "dealer_feeds" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "name" TEXT,
    "feedType" "FeedType" NOT NULL,
    "url" TEXT,
    "username" TEXT,
    "password" TEXT,
    "scheduleMinutes" INTEGER NOT NULL DEFAULT 60,
    "status" "FeedStatus" NOT NULL DEFAULT 'PENDING',
    "feedHash" TEXT,
    "lastSuccessAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealer_feeds_pkey" PRIMARY KEY ("id")
);

-- Dealer Feed Runs
CREATE TABLE "dealer_feed_runs" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "feedId" TEXT NOT NULL,
    "status" "FeedRunStatus" NOT NULL,
    "errors" JSONB,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "processedCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "dealer_feed_runs_pkey" PRIMARY KEY ("id")
);

-- Canonical SKUs (master product catalog for benchmarking)
CREATE TABLE "canonical_skus" (
    "id" TEXT NOT NULL,
    "upc" TEXT,
    "caliber" TEXT NOT NULL,
    "grain" INTEGER NOT NULL,
    "caseType" TEXT,
    "bulletType" TEXT,
    "brand" TEXT NOT NULL,
    "packSize" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "productId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "canonical_skus_pkey" PRIMARY KEY ("id")
);

-- Dealer SKUs (raw SKU data from dealer feeds)
CREATE TABLE "dealer_skus" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "feedId" TEXT,
    "feedRunId" TEXT,
    "rawTitle" TEXT NOT NULL,
    "rawDescription" TEXT,
    "rawPrice" DECIMAL(10, 2) NOT NULL,
    "rawUpc" TEXT,
    "rawSku" TEXT,
    "rawCaliber" TEXT,
    "rawGrain" TEXT,
    "rawCase" TEXT,
    "rawBulletType" TEXT,
    "rawBrand" TEXT,
    "rawPackSize" INTEGER,
    "rawInStock" BOOLEAN NOT NULL DEFAULT true,
    "rawUrl" TEXT,
    "rawImageUrl" TEXT,
    "canonicalSkuId" TEXT,
    "mappingConfidence" "MappingConfidence" NOT NULL DEFAULT 'NONE',
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "mappedAt" TIMESTAMP(3),
    "mappedBy" TEXT,
    "parsedCaliber" TEXT,
    "parsedGrain" INTEGER,
    "parsedPackSize" INTEGER,
    "parsedBulletType" TEXT,
    "parsedBrand" TEXT,
    "parseConfidence" DECIMAL(3, 2),
    "dealerSkuHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealer_skus_pkey" PRIMARY KEY ("id")
);

-- Pricing Snapshots
CREATE TABLE "pricing_snapshots" (
    "id" TEXT NOT NULL,
    "canonicalSkuId" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "price" DECIMAL(10, 2) NOT NULL,
    "pricePerRound" DECIMAL(10, 4),
    "packSize" INTEGER NOT NULL,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_snapshots_pkey" PRIMARY KEY ("id")
);

-- Benchmarks
CREATE TABLE "benchmarks" (
    "id" TEXT NOT NULL,
    "canonicalSkuId" TEXT NOT NULL,
    "medianPrice" DECIMAL(10, 2) NOT NULL,
    "minPrice" DECIMAL(10, 2) NOT NULL,
    "maxPrice" DECIMAL(10, 2) NOT NULL,
    "avgPrice" DECIMAL(10, 2),
    "sellerCount" INTEGER NOT NULL,
    "source" "BenchmarkSource" NOT NULL,
    "confidence" "BenchmarkConfidence" NOT NULL,
    "dataPoints" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "benchmarks_pkey" PRIMARY KEY ("id")
);

-- Dealer Insights
CREATE TABLE "dealer_insights" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "dealerSkuId" TEXT,
    "canonicalSkuId" TEXT,
    "type" "InsightType" NOT NULL,
    "confidence" "InsightConfidence" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "dealerPrice" DECIMAL(10, 2),
    "marketMedian" DECIMAL(10, 2),
    "marketMin" DECIMAL(10, 2),
    "marketMax" DECIMAL(10, 2),
    "sellerCount" INTEGER,
    "priceDelta" DECIMAL(10, 2),
    "deltaPercent" DECIMAL(5, 2),
    "metadata" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "dismissedAt" TIMESTAMP(3),
    "dismissedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealer_insights_pkey" PRIMARY KEY ("id")
);

-- Pixel Events (conversion tracking)
CREATE TABLE "pixel_events" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderValue" DECIMAL(10, 2) NOT NULL,
    "orderCurrency" TEXT NOT NULL DEFAULT 'USD',
    "skuList" JSONB,
    "clickEventId" TEXT,
    "attributedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipHash" TEXT,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pixel_events_pkey" PRIMARY KEY ("id")
);

-- Click Events
CREATE TABLE "click_events" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "dealerSkuId" TEXT,
    "canonicalSkuId" TEXT,
    "sessionId" TEXT,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "referrer" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "click_events_pkey" PRIMARY KEY ("id")
);

-- Dealer Notification Preferences
CREATE TABLE "dealer_notification_prefs" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "fatalFeedErrors" BOOLEAN NOT NULL DEFAULT true,
    "nonFatalFeedIssues" BOOLEAN NOT NULL DEFAULT false,
    "successfulUpdates" BOOLEAN NOT NULL DEFAULT false,
    "weeklyPulse" BOOLEAN NOT NULL DEFAULT true,
    "insightAlerts" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealer_notification_prefs_pkey" PRIMARY KEY ("id")
);

-- Admin Audit Log
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "dealerId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- =============================================
-- UNIQUE CONSTRAINTS
-- =============================================

ALTER TABLE "dealers" ADD CONSTRAINT "dealers_email_key" UNIQUE ("email");
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_pixelApiKey_key" UNIQUE ("pixelApiKey");
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_retailerId_key" UNIQUE ("retailerId");
ALTER TABLE "canonical_skus" ADD CONSTRAINT "canonical_skus_upc_key" UNIQUE ("upc");
ALTER TABLE "benchmarks" ADD CONSTRAINT "benchmarks_canonicalSkuId_key" UNIQUE ("canonicalSkuId");
ALTER TABLE "dealer_notification_prefs" ADD CONSTRAINT "dealer_notification_prefs_dealerId_key" UNIQUE ("dealerId");
ALTER TABLE "dealer_skus" ADD CONSTRAINT "dealer_skus_dealerId_dealerSkuHash_key" UNIQUE ("dealerId", "dealerSkuHash");

-- =============================================
-- INDEXES
-- =============================================

-- Dealers
CREATE INDEX "dealers_status_idx" ON "dealers"("status");
CREATE INDEX "dealers_tier_idx" ON "dealers"("tier");

-- Dealer Feeds
CREATE INDEX "dealer_feeds_dealerId_idx" ON "dealer_feeds"("dealerId");
CREATE INDEX "dealer_feeds_status_idx" ON "dealer_feeds"("status");

-- Dealer Feed Runs
CREATE INDEX "dealer_feed_runs_dealerId_idx" ON "dealer_feed_runs"("dealerId");
CREATE INDEX "dealer_feed_runs_feedId_idx" ON "dealer_feed_runs"("feedId");
CREATE INDEX "dealer_feed_runs_startedAt_idx" ON "dealer_feed_runs"("startedAt");

-- Canonical SKUs
CREATE INDEX "canonical_skus_upc_idx" ON "canonical_skus"("upc");
CREATE INDEX "canonical_skus_caliber_grain_brand_packSize_idx" ON "canonical_skus"("caliber", "grain", "brand", "packSize");
CREATE INDEX "canonical_skus_productId_idx" ON "canonical_skus"("productId");

-- Dealer SKUs
CREATE INDEX "dealer_skus_dealerId_idx" ON "dealer_skus"("dealerId");
CREATE INDEX "dealer_skus_feedId_idx" ON "dealer_skus"("feedId");
CREATE INDEX "dealer_skus_canonicalSkuId_idx" ON "dealer_skus"("canonicalSkuId");
CREATE INDEX "dealer_skus_needsReview_idx" ON "dealer_skus"("needsReview");
CREATE INDEX "dealer_skus_isActive_idx" ON "dealer_skus"("isActive");

-- Pricing Snapshots
CREATE INDEX "pricing_snapshots_canonicalSkuId_idx" ON "pricing_snapshots"("canonicalSkuId");
CREATE INDEX "pricing_snapshots_dealerId_idx" ON "pricing_snapshots"("dealerId");
CREATE INDEX "pricing_snapshots_createdAt_idx" ON "pricing_snapshots"("createdAt");

-- Dealer Insights
CREATE INDEX "dealer_insights_dealerId_idx" ON "dealer_insights"("dealerId");
CREATE INDEX "dealer_insights_type_idx" ON "dealer_insights"("type");
CREATE INDEX "dealer_insights_isActive_idx" ON "dealer_insights"("isActive");

-- Pixel Events
CREATE INDEX "pixel_events_dealerId_idx" ON "pixel_events"("dealerId");
CREATE INDEX "pixel_events_orderId_idx" ON "pixel_events"("orderId");
CREATE INDEX "pixel_events_createdAt_idx" ON "pixel_events"("createdAt");

-- Click Events
CREATE INDEX "click_events_dealerId_idx" ON "click_events"("dealerId");
CREATE INDEX "click_events_dealerSkuId_idx" ON "click_events"("dealerSkuId");
CREATE INDEX "click_events_sessionId_idx" ON "click_events"("sessionId");
CREATE INDEX "click_events_createdAt_idx" ON "click_events"("createdAt");

-- Admin Audit Logs
CREATE INDEX "admin_audit_logs_adminUserId_idx" ON "admin_audit_logs"("adminUserId");
CREATE INDEX "admin_audit_logs_dealerId_idx" ON "admin_audit_logs"("dealerId");
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");

-- =============================================
-- FOREIGN KEYS
-- =============================================

-- Dealer → Retailer
ALTER TABLE "dealers" ADD CONSTRAINT "dealers_retailerId_fkey" 
    FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DealerFeed → Dealer
ALTER TABLE "dealer_feeds" ADD CONSTRAINT "dealer_feeds_dealerId_fkey" 
    FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DealerFeedRun → DealerFeed
ALTER TABLE "dealer_feed_runs" ADD CONSTRAINT "dealer_feed_runs_feedId_fkey" 
    FOREIGN KEY ("feedId") REFERENCES "dealer_feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CanonicalSku → Product
ALTER TABLE "canonical_skus" ADD CONSTRAINT "canonical_skus_productId_fkey" 
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DealerSku → Dealer
ALTER TABLE "dealer_skus" ADD CONSTRAINT "dealer_skus_dealerId_fkey" 
    FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DealerSku → DealerFeed
ALTER TABLE "dealer_skus" ADD CONSTRAINT "dealer_skus_feedId_fkey" 
    FOREIGN KEY ("feedId") REFERENCES "dealer_feeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DealerSku → CanonicalSku
ALTER TABLE "dealer_skus" ADD CONSTRAINT "dealer_skus_canonicalSkuId_fkey" 
    FOREIGN KEY ("canonicalSkuId") REFERENCES "canonical_skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PricingSnapshot → CanonicalSku
ALTER TABLE "pricing_snapshots" ADD CONSTRAINT "pricing_snapshots_canonicalSkuId_fkey" 
    FOREIGN KEY ("canonicalSkuId") REFERENCES "canonical_skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Benchmark → CanonicalSku
ALTER TABLE "benchmarks" ADD CONSTRAINT "benchmarks_canonicalSkuId_fkey" 
    FOREIGN KEY ("canonicalSkuId") REFERENCES "canonical_skus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DealerInsight → Dealer
ALTER TABLE "dealer_insights" ADD CONSTRAINT "dealer_insights_dealerId_fkey" 
    FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DealerInsight → DealerSku
ALTER TABLE "dealer_insights" ADD CONSTRAINT "dealer_insights_dealerSkuId_fkey" 
    FOREIGN KEY ("dealerSkuId") REFERENCES "dealer_skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- PixelEvent → Dealer
ALTER TABLE "pixel_events" ADD CONSTRAINT "pixel_events_dealerId_fkey" 
    FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ClickEvent → Dealer
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_dealerId_fkey" 
    FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DealerNotificationPref → Dealer
ALTER TABLE "dealer_notification_prefs" ADD CONSTRAINT "dealer_notification_prefs_dealerId_fkey" 
    FOREIGN KEY ("dealerId") REFERENCES "dealers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
