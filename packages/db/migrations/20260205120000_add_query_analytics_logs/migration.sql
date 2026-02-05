-- CreateTable
CREATE TABLE "search_query_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "queryHash" TEXT NOT NULL,
    "queryLength" INTEGER NOT NULL,
    "queryPiiFlag" BOOLEAN NOT NULL,
    "queryNormRedacted" VARCHAR(250),
    "lensId" TEXT,
    "sortBy" TEXT,
    "page" INTEGER NOT NULL,
    "intentCalibers" TEXT[],
    "intentPurpose" TEXT,
    "intentBrands" TEXT[],
    "intentConfidence" DECIMAL(3,2),
    "filtersApplied" JSONB,
    "resultCount" INTEGER NOT NULL,
    "returnedCount" INTEGER NOT NULL,
    "vectorSearchUsed" BOOLEAN NOT NULL,
    "responseTimeMs" INTEGER NOT NULL,
    "timingBreakdown" JSONB,
    "isAuthenticated" BOOLEAN NOT NULL,
    "gunLockerCalibers" TEXT[],
    "referrer" TEXT,
    "userAgent" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_query_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_check_query_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "caliber" TEXT NOT NULL,
    "pricePerRound" DECIMAL(10,4) NOT NULL,
    "brand" TEXT,
    "grain" INTEGER,
    "roundCount" INTEGER,
    "caseMaterial" TEXT,
    "bulletType" TEXT,
    "classification" TEXT,
    "pricePointCount" INTEGER,
    "daysWithData" INTEGER,
    "medianPrice" DECIMAL(10,4),
    "isAuthenticated" BOOLEAN NOT NULL,
    "gunLockerCalibers" TEXT[],
    "referrer" TEXT,
    "userAgent" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_check_query_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: search_query_logs
CREATE INDEX "search_query_logs_createdAt_idx" ON "search_query_logs"("createdAt");
CREATE INDEX "search_query_logs_userId_createdAt_idx" ON "search_query_logs"("userId", "createdAt");
CREATE INDEX "search_query_logs_queryHash_idx" ON "search_query_logs"("queryHash");
CREATE INDEX "search_query_logs_intentCalibers_idx" ON "search_query_logs" USING GIN ("intentCalibers");

-- CreateIndex: price_check_query_logs
CREATE INDEX "price_check_query_logs_createdAt_idx" ON "price_check_query_logs"("createdAt");
CREATE INDEX "price_check_query_logs_userId_createdAt_idx" ON "price_check_query_logs"("userId", "createdAt");
CREATE INDEX "price_check_query_logs_caliber_createdAt_idx" ON "price_check_query_logs"("caliber", "createdAt");
