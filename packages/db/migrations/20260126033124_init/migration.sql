-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "AffiliateFeedRunStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "AffiliateFeedRunTrigger" AS ENUM ('SCHEDULED', 'MANUAL', 'MANUAL_PENDING', 'ADMIN_TEST', 'RETRY');

-- CreateEnum
CREATE TYPE "AffiliateFeedStatus" AS ENUM ('DRAFT', 'ENABLED', 'PAUSED', 'DISABLED');

-- CreateEnum
CREATE TYPE "AffiliateNetwork" AS ENUM ('IMPACT', 'AVANTLINK', 'SHAREASALE', 'CJ', 'RAKUTEN');

-- CreateEnum
CREATE TYPE "BrandAliasSourceType" AS ENUM ('RETAILER_FEED', 'AFFILIATE_FEED', 'MANUAL');

-- CreateEnum
CREATE TYPE "BrandAliasStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "AlertRuleType" AS ENUM ('PRICE_DROP', 'BACK_IN_STOCK');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('PRICE_DROP', 'BACK_IN_STOCK', 'NEW_PRODUCT');

-- CreateEnum
CREATE TYPE "BulletType" AS ENUM ('JHP', 'HP', 'BJHP', 'XTP', 'HST', 'GDHP', 'VMAX', 'FMJ', 'TMJ', 'CMJ', 'MC', 'BALL', 'SP', 'JSP', 'PSP', 'RN', 'FPRN', 'FRANGIBLE', 'AP', 'TRACER', 'BLANK', 'WADCUTTER', 'SWC', 'LSWC', 'BUCKSHOT', 'BIRDSHOT', 'SLUG', 'OTHER');

-- CreateEnum
CREATE TYPE "DaaSPlan" AS ENUM ('BASIC', 'PROFESSIONAL', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "DataSource" AS ENUM ('MANUFACTURER', 'RETAILER_FEED', 'PARSED', 'MANUAL', 'AI_INFERRED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "MerchantContactRole" AS ENUM ('PRIMARY', 'BILLING', 'TECHNICAL', 'MARKETING', 'OTHER');

-- CreateEnum
CREATE TYPE "MerchantPaymentMethod" AS ENUM ('STRIPE', 'PURCHASE_ORDER');

-- CreateEnum
CREATE TYPE "MerchantStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "MerchantSubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MerchantTier" AS ENUM ('FOUNDING', 'BASIC', 'PRO', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "MerchantUserRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "MerchantRetailerStatus" AS ENUM ('ACTIVE', 'PENDING', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "MerchantRetailerListingStatus" AS ENUM ('LISTED', 'UNLISTED');

-- CreateEnum
CREATE TYPE "MerchantRetailerRole" AS ENUM ('ADMIN', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "IngestionRunType" AS ENUM ('SCRAPE', 'AFFILIATE_FEED', 'RETAILER_FEED', 'MANUAL');

-- CreateEnum
CREATE TYPE "PriceCorrectionScopeType" AS ENUM ('PRODUCT', 'RETAILER', 'MERCHANT', 'SOURCE', 'AFFILIATE', 'FEED_RUN');

-- CreateEnum
CREATE TYPE "PriceCorrectionAction" AS ENUM ('IGNORE', 'MULTIPLIER');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "FeedAccessType" AS ENUM ('URL', 'AUTH_URL', 'FTP', 'SFTP', 'UPLOAD');

-- CreateEnum
CREATE TYPE "FeedCompression" AS ENUM ('NONE', 'GZIP');

-- CreateEnum
CREATE TYPE "FeedFormat" AS ENUM ('CSV');

-- CreateEnum
CREATE TYPE "FeedVariant" AS ENUM ('FULL', 'DELTA', 'REGIONAL_US', 'REGIONAL_CA', 'REGIONAL_EU', 'CATEGORY_AMMO', 'CATEGORY_ACCESSORIES');

-- CreateEnum
CREATE TYPE "FeedFormatType" AS ENUM ('GENERIC', 'AMMOSEEK_V1', 'GUNENGINE_V2', 'IMPACT');

-- CreateEnum
CREATE TYPE "FeedRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'WARNING', 'FAILURE', 'PENDING', 'SKIPPED');

-- CreateEnum
CREATE TYPE "FeedStatus" AS ENUM ('PENDING', 'HEALTHY', 'WARNING', 'FAILED');

-- CreateEnum
CREATE TYPE "FeedTransport" AS ENUM ('FTP', 'SFTP');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR');

-- CreateEnum
CREATE TYPE "PressureRating" AS ENUM ('STANDARD', 'PLUS_P', 'PLUS_P_PLUS', 'NATO', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('REGULAR', 'SALE', 'CLEARANCE');

-- CreateEnum
CREATE TYPE "ProductIssueType" AS ENUM ('INCORRECT_PRICE', 'OUT_OF_STOCK', 'INCORRECT_INFO', 'BROKEN_LINK', 'WRONG_PRODUCT', 'SPAM', 'OTHER');

-- CreateEnum
CREATE TYPE "QuarantineStatus" AS ENUM ('QUARANTINED', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "QuarantineFeedType" AS ENUM ('RETAILER', 'AFFILIATE');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "RetailerTier" AS ENUM ('STANDARD', 'PREMIUM');

-- CreateEnum
CREATE TYPE "RetailerVisibility" AS ENUM ('ELIGIBLE', 'INELIGIBLE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "ShippingType" AS ENUM ('FLAT', 'PER_UNIT', 'CALCULATED', 'FREE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('DIRECT', 'AFFILIATE_FEED', 'OTHER');

-- CreateEnum
CREATE TYPE "IdentifierType" AS ENUM ('SKU', 'UPC', 'EAN', 'GTIN', 'MPN', 'ASIN', 'URL', 'URL_HASH', 'NETWORK_ITEM_ID', 'MERCHANT_SKU', 'INTERNAL_ID');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('HTML', 'JS_RENDERED', 'RSS', 'JSON', 'FEED_CSV', 'FEED_XML', 'FEED_JSON');

-- CreateEnum
CREATE TYPE "StoreType" AS ENUM ('ONLINE_ONLY', 'RETAIL_AND_ONLINE');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SubscriptionType" AS ENUM ('USER_PREMIUM', 'RETAILER_PREMIUM');

-- CreateEnum
CREATE TYPE "TestRunStatus" AS ENUM ('PASS', 'WARN', 'FAIL');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'PENDING_DELETION', 'DELETED');

-- CreateEnum
CREATE TYPE "UserTier" AS ENUM ('FREE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "AmmoUseCase" AS ENUM ('TRAINING', 'CARRY', 'COMPETITION', 'GENERAL');

-- CreateEnum
CREATE TYPE "AmmoPreferenceDeleteReason" AS ENUM ('USER_REMOVED', 'FIREARM_DELETED', 'SKU_SUPERSEDED', 'ADMIN_CLEANUP');

-- CreateEnum
CREATE TYPE "ProductLinkMatchType" AS ENUM ('UPC', 'FINGERPRINT', 'MANUAL', 'NONE', 'ERROR');

-- CreateEnum
CREATE TYPE "ProductLinkStatus" AS ENUM ('MATCHED', 'CREATED', 'UNMATCHED', 'NEEDS_REVIEW', 'SKIPPED', 'ERROR');

-- CreateEnum
CREATE TYPE "ProductLinkReasonCode" AS ENUM ('INSUFFICIENT_DATA', 'INVALID_UPC', 'UPC_NOT_TRUSTED', 'AMBIGUOUS_FINGERPRINT', 'CONFLICTING_IDENTIFIERS', 'MANUAL_LOCKED', 'RELINK_BLOCKED_HYSTERESIS', 'SYSTEM_ERROR', 'NORMALIZATION_FAILED');

-- CreateEnum
CREATE TYPE "ProductResolveRequestStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "merchantId" TEXT,
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

-- CreateTable
CREATE TABLE "affiliate_feed_run_errors" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "rowNumber" INTEGER,
    "sample" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "affiliate_feed_run_errors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_feed_runs" (
    "id" TEXT NOT NULL,
    "feedId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "trigger" "AffiliateFeedRunTrigger" NOT NULL DEFAULT 'SCHEDULED',
    "status" "AffiliateFeedRunStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "downloadBytes" BIGINT,
    "rowsRead" INTEGER,
    "rowsParsed" INTEGER,
    "productsUpserted" INTEGER,
    "pricesWritten" INTEGER,
    "productsPromoted" INTEGER,
    "errorCount" INTEGER,
    "productsExpired" INTEGER,
    "productsRejected" INTEGER,
    "duplicateKeyCount" INTEGER,
    "urlHashFallbackCount" INTEGER,
    "activeCountBefore" INTEGER,
    "seenSuccessCount" INTEGER,
    "wouldExpireCount" INTEGER,
    "skippedReason" TEXT,
    "failureKind" TEXT,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "isPartial" BOOLEAN NOT NULL DEFAULT false,
    "expiryStepFailed" BOOLEAN NOT NULL DEFAULT false,
    "expiryBlocked" BOOLEAN NOT NULL DEFAULT false,
    "expiryBlockedReason" TEXT,
    "expiryApprovedAt" TIMESTAMP(3),
    "expiryApprovedBy" TEXT,
    "artifactUrl" TEXT,
    "correlationId" TEXT,
    "ignoredAt" TIMESTAMP(3),
    "ignoredBy" TEXT,
    "ignoredReason" TEXT,

    CONSTRAINT "affiliate_feed_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "affiliate_feeds" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "variant" "FeedVariant" NOT NULL DEFAULT 'FULL',
    "network" "AffiliateNetwork" NOT NULL,
    "status" "AffiliateFeedStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduleFrequencyHours" INTEGER,
    "nextRunAt" TIMESTAMP(3),
    "expiryHours" INTEGER NOT NULL DEFAULT 48,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "manualRunPending" BOOLEAN NOT NULL DEFAULT false,
    "transport" "FeedTransport" NOT NULL DEFAULT 'SFTP',
    "host" TEXT,
    "port" INTEGER,
    "path" TEXT,
    "username" TEXT,
    "secretCiphertext" BYTEA,
    "secretKeyId" TEXT,
    "secretVersion" INTEGER NOT NULL DEFAULT 1,
    "format" "FeedFormat" NOT NULL DEFAULT 'CSV',
    "compression" "FeedCompression" NOT NULL DEFAULT 'NONE',
    "lastRemoteMtime" TIMESTAMP(3),
    "lastRemoteSize" BIGINT,
    "lastContentHash" TEXT,
    "maxFileSizeBytes" BIGINT,
    "maxRowCount" INTEGER,
    "feedLockId" BIGSERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,

    CONSTRAINT "affiliate_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "watchlistItemId" TEXT,
    "ruleType" "AlertRuleType",
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "suppressedAt" TIMESTAMP(3),
    "suppressedBy" TEXT,
    "suppressedReason" TEXT,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "click_events" (
    "id" TEXT NOT NULL,
    "clickId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceProductId" TEXT,
    "sessionId" TEXT,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "referrer" TEXT,
    "targetUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "click_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "DaaSPlan" NOT NULL DEFAULT 'BASIC',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "apiKey" TEXT NOT NULL,
    "rateLimit" INTEGER NOT NULL DEFAULT 1000,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "data_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_contacts" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "communicationOptIn" BOOLEAN NOT NULL DEFAULT true,
    "isAccountOwner" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "roles" "MerchantContactRole"[] DEFAULT ARRAY[]::"MerchantContactRole"[],

    CONSTRAINT "merchant_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retailer_feed_runs" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "feedId" TEXT NOT NULL,
    "status" "FeedRunStatus" NOT NULL,
    "errors" JSONB,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "duration" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "primaryErrorCode" TEXT,
    "quarantinedCount" INTEGER NOT NULL DEFAULT 0,
    "coercionCount" INTEGER NOT NULL DEFAULT 0,
    "errorCodes" JSONB,
    "indexedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "ignoredAt" TIMESTAMP(3),
    "ignoredBy" TEXT,
    "ignoredReason" TEXT,

    CONSTRAINT "retailer_feed_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retailer_feed_test_runs" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "feedId" TEXT NOT NULL,
    "sampleSize" INTEGER NOT NULL DEFAULT 50,
    "status" "TestRunStatus" NOT NULL,
    "recordsParsed" INTEGER NOT NULL DEFAULT 0,
    "wouldIndex" INTEGER NOT NULL DEFAULT 0,
    "wouldQuarantine" INTEGER NOT NULL DEFAULT 0,
    "wouldReject" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "primaryErrorCode" TEXT,
    "errorSamples" JSONB,
    "coercionSummary" JSONB,
    "duration" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "retailer_feed_test_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retailer_feeds" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "name" TEXT,
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
    "accessType" "FeedAccessType" NOT NULL DEFAULT 'URL',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "formatType" "FeedFormatType" NOT NULL DEFAULT 'GENERIC',
    "lastRunAt" TIMESTAMP(3),
    "primaryErrorCode" TEXT,

    CONSTRAINT "retailer_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_invites" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "MerchantUserRole" NOT NULL DEFAULT 'MEMBER',
    "inviteToken" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_notification_prefs" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "fatalFeedErrors" BOOLEAN NOT NULL DEFAULT true,
    "nonFatalFeedIssues" BOOLEAN NOT NULL DEFAULT false,
    "successfulUpdates" BOOLEAN NOT NULL DEFAULT false,
    "weeklyPulse" BOOLEAN NOT NULL DEFAULT true,
    "insightAlerts" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_notification_prefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retailer_skus" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "feedId" TEXT,
    "feedRunId" TEXT,
    "rawTitle" TEXT NOT NULL,
    "rawDescription" TEXT,
    "rawPrice" DECIMAL(10,2) NOT NULL,
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
    "parsedCaliber" TEXT,
    "parsedGrain" INTEGER,
    "parsedPackSize" INTEGER,
    "parsedBulletType" TEXT,
    "parsedBrand" TEXT,
    "parseConfidence" DECIMAL(3,2),
    "retailerSkuHash" TEXT,
    "contentHash" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "missingCount" INTEGER NOT NULL DEFAULT 0,
    "productType" TEXT,
    "coercionsApplied" JSONB,

    CONSTRAINT "retailer_skus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_users" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "MerchantUserRole" NOT NULL DEFAULT 'MEMBER',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifyToken" TEXT,
    "resetToken" TEXT,
    "resetTokenExp" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" TEXT NOT NULL,
    "businessName" TEXT NOT NULL,
    "websiteUrl" TEXT NOT NULL,
    "phone" TEXT,
    "storeType" "StoreType" NOT NULL DEFAULT 'ONLINE_ONLY',
    "status" "MerchantStatus" NOT NULL DEFAULT 'PENDING',
    "tier" "MerchantTier" NOT NULL DEFAULT 'FOUNDING',
    "pixelApiKey" TEXT,
    "pixelEnabled" BOOLEAN NOT NULL DEFAULT false,
    "shippingType" "ShippingType" NOT NULL DEFAULT 'UNKNOWN',
    "shippingFlat" DECIMAL(10,2),
    "shippingPerUnit" DECIMAL(10,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "contactFirstName" TEXT NOT NULL,
    "contactLastName" TEXT NOT NULL,
    "lastSubscriptionNotifyAt" TIMESTAMP(3),
    "subscriptionExpiresAt" TIMESTAMP(3),
    "subscriptionGraceDays" INTEGER NOT NULL DEFAULT 7,
    "subscriptionStatus" "MerchantSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "paymentMethod" "MerchantPaymentMethod",
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_retailers" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "status" "MerchantRetailerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "listingStatus" "MerchantRetailerListingStatus" NOT NULL DEFAULT 'UNLISTED',
    "listedAt" TIMESTAMP(3),
    "listedBy" TEXT,
    "unlistedAt" TIMESTAMP(3),
    "unlistedBy" TEXT,
    "unlistedReason" TEXT,

    CONSTRAINT "merchant_retailers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_user_retailers" (
    "id" TEXT NOT NULL,
    "merchantUserId" TEXT NOT NULL,
    "merchantRetailerId" TEXT NOT NULL,
    "role" "MerchantRetailerRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_user_retailers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_logs" (
    "id" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "level" "LogLevel" NOT NULL DEFAULT 'INFO',
    "event" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "execution_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executions" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "itemsFound" INTEGER NOT NULL DEFAULT 0,
    "itemsUpserted" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "ignoredAt" TIMESTAMP(3),
    "ignoredBy" TEXT,
    "ignoredReason" TEXT,

    CONSTRAINT "executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_corrections" (
    "id" TEXT NOT NULL,
    "retailerId" TEXT NOT NULL,
    "feedId" TEXT NOT NULL,
    "quarantinedRecordId" TEXT,
    "recordRef" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pixel_events" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderValue" DECIMAL(10,2) NOT NULL,
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

-- CreateTable
CREATE TABLE "prices" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "retailerId" TEXT NOT NULL,
    "merchantId" TEXT,
    "sourceId" TEXT,
    "retailerSkuId" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "url" TEXT NOT NULL,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "freeShippingMinimum" DECIMAL(10,2),
    "shippingCost" DECIMAL(10,2),
    "shippingNotes" TEXT,
    "originalPrice" DECIMAL(10,2),
    "priceType" "PriceType",
    "saleStartsAt" TIMESTAMP(3),
    "saleEndsAt" TIMESTAMP(3),
    "affiliateFeedRunId" TEXT,
    "priceSignatureHash" TEXT,
    "sourceProductId" TEXT,
    "ingestionRunType" "IngestionRunType",
    "ingestionRunId" TEXT,
    "affiliateId" TEXT,

    CONSTRAINT "prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_corrections" (
    "id" TEXT NOT NULL,
    "scopeType" "PriceCorrectionScopeType" NOT NULL,
    "scopeId" TEXT NOT NULL,
    "startTs" TIMESTAMP(3) NOT NULL,
    "endTs" TIMESTAMP(3) NOT NULL,
    "action" "PriceCorrectionAction" NOT NULL,
    "value" DECIMAL(10,4),
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "revokedBy" TEXT,
    "revokeReason" TEXT,

    CONSTRAINT "price_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_reports" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "userId" TEXT,
    "priceId" TEXT,
    "issueType" "ProductIssueType" NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "product_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "brand" TEXT,
    "imageUrl" TEXT,
    "upc" TEXT,
    "caliber" TEXT,
    "grainWeight" INTEGER,
    "caseMaterial" TEXT,
    "purpose" TEXT,
    "roundCount" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "embedding" vector,
    "lastEmbeddedAt" TIMESTAMP(3),
    "barrelLengthReference" DECIMAL(4,2),
    "bulletType" "BulletType",
    "controlledExpansion" BOOLEAN,
    "dataConfidence" DECIMAL(3,2),
    "dataSource" "DataSource" DEFAULT 'UNKNOWN',
    "factoryNew" BOOLEAN DEFAULT true,
    "isSubsonic" BOOLEAN,
    "lowFlash" BOOLEAN,
    "lowRecoil" BOOLEAN,
    "matchGrade" BOOLEAN,
    "muzzleVelocityFps" INTEGER,
    "pressureRating" "PressureRating" DEFAULT 'STANDARD',
    "shortBarrelOptimized" BOOLEAN,
    "suppressorSafe" BOOLEAN,
    "canonicalKey" TEXT,
    "upcNorm" TEXT,
    "brandNorm" TEXT,
    "caliberNorm" TEXT,
    "specs" JSONB,
    "isActiveSku" BOOLEAN NOT NULL DEFAULT true,
    "supersededById" TEXT,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quarantined_records" (
    "id" TEXT NOT NULL,
    "feedType" "QuarantineFeedType" NOT NULL DEFAULT 'RETAILER',
    "feedId" TEXT NOT NULL,
    "runId" TEXT,
    "retailerId" TEXT,
    "sourceId" TEXT,
    "productType" TEXT,
    "matchKey" TEXT NOT NULL,
    "rawData" JSONB NOT NULL,
    "parsedFields" JSONB,
    "blockingErrors" JSONB NOT NULL,
    "status" "QuarantineStatus" NOT NULL DEFAULT 'QUARANTINED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quarantined_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retailers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "website" TEXT NOT NULL,
    "logoUrl" TEXT,
    "tier" "RetailerTier" NOT NULL DEFAULT 'STANDARD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "visibilityStatus" "RetailerVisibility" NOT NULL DEFAULT 'ELIGIBLE',
    "visibilityReason" TEXT,
    "visibilityUpdatedAt" TIMESTAMP(3),
    "visibilityUpdatedBy" TEXT,

    CONSTRAINT "retailers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_product_presence" (
    "id" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "lastSeenSuccessAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_product_presence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_product_seen" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_product_seen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_products" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "imageUrl" TEXT,
    "brand" TEXT,
    "brandNorm" TEXT,
    "description" TEXT,
    "category" TEXT,
    "caliber" TEXT,
    "grainWeight" INTEGER,
    "roundCount" INTEGER,
    "normalizedUrl" TEXT,
    "productId" TEXT,
    "createdByRunId" TEXT,
    "lastUpdatedByRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "normalizedHash" TEXT,
    "identityKey" TEXT,

    CONSTRAINT "source_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_product_identifiers" (
    "id" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "idType" "IdentifierType" NOT NULL,
    "idValue" TEXT NOT NULL,
    "namespace" TEXT NOT NULL DEFAULT '',
    "isCanonical" BOOLEAN NOT NULL DEFAULT false,
    "normalizedValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_product_identifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_links" (
    "id" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "productId" TEXT,
    "matchType" "ProductLinkMatchType" NOT NULL,
    "status" "ProductLinkStatus" NOT NULL,
    "reasonCode" "ProductLinkReasonCode",
    "confidence" DECIMAL(5,4) NOT NULL,
    "resolverVersion" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_aliases" (
    "id" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT NOT NULL,
    "updatedBy" TEXT NOT NULL,
    "disabledAt" TIMESTAMP(3),
    "disabledBy" TEXT,
    "disableReason" TEXT,

    CONSTRAINT "brand_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_alias_applications_daily" (
    "aliasId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_alias_applications_daily_pkey" PRIMARY KEY ("aliasId","date")
);

-- CreateTable
CREATE TABLE "product_aliases" (
    "id" TEXT NOT NULL,
    "fromProductId" TEXT NOT NULL,
    "toProductId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "product_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_resolve_requests" (
    "id" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "sourceProductId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "status" "ProductResolveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "resultProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_resolve_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_trust_config" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "upcTrusted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "source_trust_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" "SourceType" NOT NULL DEFAULT 'HTML',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "interval" INTEGER NOT NULL DEFAULT 3600,
    "lastRunAt" TIMESTAMP(3),
    "paginationConfig" JSONB,
    "affiliateNetwork" "AffiliateNetwork",
    "feedHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "retailerId" TEXT NOT NULL,
    "affiliateAccountId" TEXT,
    "affiliateAccountName" TEXT,
    "affiliateAdvertiserId" TEXT,
    "affiliateCampaignId" TEXT,
    "affiliateProgramId" TEXT,
    "affiliateTrackingTemplate" TEXT,
    "isDisplayPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sourceKind" "SourceKind" NOT NULL DEFAULT 'DIRECT',

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "retailerId" TEXT,
    "type" "SubscriptionType" NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stripeId" TEXT,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "password" TEXT,
    "emailVerified" TIMESTAMP(3),
    "tier" "UserTier" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletionRequestedAt" TIMESTAMP(3),
    "deletionScheduledFor" TIMESTAMP(3),
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_guns" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "caliber" TEXT NOT NULL,
    "nickname" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_guns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firearm_ammo_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firearmId" TEXT NOT NULL,
    "ammoSkuId" TEXT NOT NULL,
    "useCase" "AmmoUseCase" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "deleteReason" "AmmoPreferenceDeleteReason",

    CONSTRAINT "firearm_ammo_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlist_collections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "watchlist_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "watchlist_items" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT,
    "collectionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "intent_type" TEXT NOT NULL DEFAULT 'SKU',
    "query_snapshot" JSONB,
    "deleted_at" TIMESTAMP(3),
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "priceDropEnabled" BOOLEAN NOT NULL DEFAULT true,
    "backInStockEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minDropPercent" INTEGER NOT NULL DEFAULT 5,
    "minDropAmount" DECIMAL(10,2) NOT NULL DEFAULT 5.0,
    "stockAlertCooldownHours" INTEGER NOT NULL DEFAULT 24,
    "lastStockNotifiedAt" TIMESTAMP(3),
    "lastPriceNotifiedAt" TIMESTAMP(3),
    "price_notification_claimed_at" TIMESTAMP(3),
    "price_notification_claim_key" TEXT,
    "stock_notification_claimed_at" TIMESTAMP(3),
    "stock_notification_claim_key" TEXT,

    CONSTRAINT "watchlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "admin_audit_logs_action_idx" ON "admin_audit_logs"("action");

-- CreateIndex
CREATE INDEX "admin_audit_logs_adminUserId_idx" ON "admin_audit_logs"("adminUserId");

-- CreateIndex
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_logs_merchantId_idx" ON "admin_audit_logs"("merchantId");

-- CreateIndex
CREATE INDEX "affiliate_feed_run_errors_runId_idx" ON "affiliate_feed_run_errors"("runId");

-- CreateIndex
CREATE INDEX "affiliate_feed_runs_feedId_startedAt_idx" ON "affiliate_feed_runs"("feedId", "startedAt");

-- CreateIndex
CREATE INDEX "affiliate_feed_runs_feedId_status_startedAt_idx" ON "affiliate_feed_runs"("feedId", "status", "startedAt");

-- CreateIndex
CREATE INDEX "affiliate_feed_runs_feedId_trigger_startedAt_idx" ON "affiliate_feed_runs"("feedId", "trigger", "startedAt");

-- CreateIndex
CREATE INDEX "affiliate_feed_runs_ignoredAt_idx" ON "affiliate_feed_runs"("ignoredAt");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_feeds_feedLockId_key" ON "affiliate_feeds"("feedLockId");

-- CreateIndex
CREATE INDEX "affiliate_feeds_nextRunAt_idx" ON "affiliate_feeds"("nextRunAt");

-- CreateIndex
CREATE INDEX "affiliate_feeds_status_idx" ON "affiliate_feeds"("status");

-- CreateIndex
CREATE UNIQUE INDEX "affiliate_feeds_sourceId_variant_key" ON "affiliate_feeds"("sourceId", "variant");

-- CreateIndex
CREATE INDEX "alerts_productId_idx" ON "alerts"("productId");

-- CreateIndex
CREATE INDEX "alerts_suppressedAt_idx" ON "alerts"("suppressedAt");

-- CreateIndex
CREATE INDEX "alerts_watchlistItemId_idx" ON "alerts"("watchlistItemId");

-- CreateIndex
CREATE UNIQUE INDEX "alerts_userid_productid_ruletype_key" ON "alerts"("userId", "productId", "ruleType");

-- CreateIndex
CREATE UNIQUE INDEX "click_events_clickId_key" ON "click_events"("clickId");

-- CreateIndex
CREATE INDEX "click_events_createdAt_idx" ON "click_events"("createdAt");

-- CreateIndex
CREATE INDEX "click_events_retailerId_idx" ON "click_events"("retailerId");

-- CreateIndex
CREATE INDEX "click_events_sessionId_idx" ON "click_events"("sessionId");

-- CreateIndex
CREATE INDEX "click_events_sourceId_idx" ON "click_events"("sourceId");

-- CreateIndex
CREATE INDEX "click_events_sourceProductId_idx" ON "click_events"("sourceProductId");

-- CreateIndex
CREATE UNIQUE INDEX "data_subscriptions_apiKey_key" ON "data_subscriptions"("apiKey");

-- CreateIndex
CREATE INDEX "merchant_contacts_email_idx" ON "merchant_contacts"("email");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_contacts_merchantId_email_key" ON "merchant_contacts"("merchantId", "email");

-- CreateIndex
CREATE INDEX "retailer_feed_runs_retailerId_idx" ON "retailer_feed_runs"("retailerId");

-- CreateIndex
CREATE INDEX "retailer_feed_runs_feedId_idx" ON "retailer_feed_runs"("feedId");

-- CreateIndex
CREATE INDEX "retailer_feed_runs_startedAt_idx" ON "retailer_feed_runs"("startedAt");

-- CreateIndex
CREATE INDEX "retailer_feed_runs_ignoredAt_idx" ON "retailer_feed_runs"("ignoredAt");

-- CreateIndex
CREATE INDEX "retailer_feed_test_runs_retailerId_idx" ON "retailer_feed_test_runs"("retailerId");

-- CreateIndex
CREATE INDEX "retailer_feed_test_runs_feedId_idx" ON "retailer_feed_test_runs"("feedId");

-- CreateIndex
CREATE INDEX "retailer_feed_test_runs_startedAt_idx" ON "retailer_feed_test_runs"("startedAt");

-- CreateIndex
CREATE INDEX "retailer_feeds_retailerId_idx" ON "retailer_feeds"("retailerId");

-- CreateIndex
CREATE INDEX "retailer_feeds_enabled_idx" ON "retailer_feeds"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_invites_inviteToken_key" ON "merchant_invites"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_invites_merchantId_email_key" ON "merchant_invites"("merchantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_notification_prefs_merchantId_key" ON "merchant_notification_prefs"("merchantId");

-- CreateIndex
CREATE INDEX "retailer_skus_feedId_idx" ON "retailer_skus"("feedId");

-- CreateIndex
CREATE INDEX "retailer_skus_isActive_idx" ON "retailer_skus"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "retailer_skus_retailerId_retailerSkuHash_key" ON "retailer_skus"("retailerId", "retailerSkuHash");

-- CreateIndex
CREATE INDEX "merchant_users_email_idx" ON "merchant_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_users_merchantId_email_key" ON "merchant_users"("merchantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_pixelApiKey_key" ON "merchants"("pixelApiKey");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_stripeCustomerId_key" ON "merchants"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_stripeSubscriptionId_key" ON "merchants"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "merchant_retailers_retailerId_idx" ON "merchant_retailers"("retailerId");

-- CreateIndex
CREATE INDEX "merchant_retailers_status_idx" ON "merchant_retailers"("status");

-- CreateIndex
CREATE INDEX "merchant_retailers_listingStatus_idx" ON "merchant_retailers"("listingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_retailers_merchantId_retailerId_key" ON "merchant_retailers"("merchantId", "retailerId");

-- CreateIndex
CREATE INDEX "merchant_user_retailers_merchantRetailerId_idx" ON "merchant_user_retailers"("merchantRetailerId");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_user_retailers_merchantUserId_merchantRetailerId_key" ON "merchant_user_retailers"("merchantUserId", "merchantRetailerId");

-- CreateIndex
CREATE INDEX "execution_logs_event_idx" ON "execution_logs"("event");

-- CreateIndex
CREATE INDEX "execution_logs_executionId_idx" ON "execution_logs"("executionId");

-- CreateIndex
CREATE INDEX "execution_logs_level_idx" ON "execution_logs"("level");

-- CreateIndex
CREATE INDEX "executions_ignoredAt_idx" ON "executions"("ignoredAt");

-- CreateIndex
CREATE INDEX "feed_corrections_retailerId_idx" ON "feed_corrections"("retailerId");

-- CreateIndex
CREATE INDEX "feed_corrections_feedId_recordRef_idx" ON "feed_corrections"("feedId", "recordRef");

-- CreateIndex
CREATE INDEX "feed_corrections_quarantinedRecordId_idx" ON "feed_corrections"("quarantinedRecordId");

-- CreateIndex
CREATE INDEX "pixel_events_createdAt_idx" ON "pixel_events"("createdAt");

-- CreateIndex
CREATE INDEX "pixel_events_merchantId_idx" ON "pixel_events"("merchantId");

-- CreateIndex
CREATE INDEX "pixel_events_orderId_idx" ON "pixel_events"("orderId");

-- CreateIndex
CREATE INDEX "prices_inStock_idx" ON "prices"("inStock");

-- CreateIndex
CREATE INDEX "prices_productId_idx" ON "prices"("productId");

-- CreateIndex
CREATE INDEX "prices_retailerId_idx" ON "prices"("retailerId");

-- CreateIndex
CREATE INDEX "prices_sourceProductId_idx" ON "prices"("sourceProductId");

-- CreateIndex
CREATE INDEX "prices_merchantId_idx" ON "prices"("merchantId");

-- CreateIndex
CREATE INDEX "prices_sourceId_idx" ON "prices"("sourceId");

-- CreateIndex
CREATE INDEX "prices_retailerSkuId_idx" ON "prices"("retailerSkuId");

-- CreateIndex
CREATE INDEX "prices_ingestionRunId_idx" ON "prices"("ingestionRunId");

-- CreateIndex
CREATE INDEX "prices_observedAt_idx" ON "prices"("observedAt");

-- CreateIndex
CREATE INDEX "price_corrections_scopeType_scopeId_idx" ON "price_corrections"("scopeType", "scopeId");

-- CreateIndex
CREATE INDEX "price_corrections_startTs_endTs_idx" ON "price_corrections"("startTs", "endTs");

-- CreateIndex
CREATE INDEX "price_corrections_revokedAt_idx" ON "price_corrections"("revokedAt");

-- CreateIndex
CREATE INDEX "price_corrections_createdAt_idx" ON "price_corrections"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "products_upc_key" ON "products"("upc");

-- CreateIndex
CREATE UNIQUE INDEX "products_canonicalKey_key" ON "products"("canonicalKey");

-- CreateIndex
CREATE UNIQUE INDEX "products_upcNorm_key" ON "products"("upcNorm");

-- CreateIndex
CREATE INDEX "products_bulletType_idx" ON "products"("bulletType");

-- CreateIndex
CREATE INDEX "products_caliber_idx" ON "products"("caliber");

-- CreateIndex
CREATE INDEX "products_isSubsonic_idx" ON "products"("isSubsonic");

-- CreateIndex
CREATE INDEX "products_pressureRating_idx" ON "products"("pressureRating");

-- CreateIndex
CREATE INDEX "products_purpose_idx" ON "products"("purpose");

-- CreateIndex
CREATE INDEX "products_brandNorm_caliberNorm_idx" ON "products"("brandNorm", "caliberNorm");

-- CreateIndex
CREATE INDEX "quarantined_records_feedType_idx" ON "quarantined_records"("feedType");

-- CreateIndex
CREATE INDEX "quarantined_records_feedId_status_idx" ON "quarantined_records"("feedId", "status");

-- CreateIndex
CREATE INDEX "quarantined_records_status_idx" ON "quarantined_records"("status");

-- CreateIndex
CREATE INDEX "quarantined_records_retailerId_idx" ON "quarantined_records"("retailerId");

-- CreateIndex
CREATE INDEX "quarantined_records_sourceId_idx" ON "quarantined_records"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "quarantined_records_feedId_matchKey_key" ON "quarantined_records"("feedId", "matchKey");

-- CreateIndex
CREATE UNIQUE INDEX "retailers_website_key" ON "retailers"("website");

-- CreateIndex
CREATE INDEX "retailers_visibilityStatus_idx" ON "retailers"("visibilityStatus");

-- CreateIndex
CREATE UNIQUE INDEX "source_product_presence_sourceProductId_key" ON "source_product_presence"("sourceProductId");

-- CreateIndex
CREATE INDEX "source_product_presence_lastSeenSuccessAt_idx" ON "source_product_presence"("lastSeenSuccessAt");

-- CreateIndex
CREATE UNIQUE INDEX "source_product_seen_runId_sourceProductId_key" ON "source_product_seen"("runId", "sourceProductId");

-- CreateIndex
CREATE INDEX "source_products_productId_idx" ON "source_products"("productId");

-- CreateIndex
CREATE INDEX "source_products_sourceId_idx" ON "source_products"("sourceId");

-- CreateIndex
CREATE INDEX "source_products_normalizedHash_idx" ON "source_products"("normalizedHash");

-- CreateIndex
CREATE INDEX "source_products_identityKey_idx" ON "source_products"("identityKey");

-- CreateIndex
CREATE INDEX "source_products_brandNorm_createdAt_idx" ON "source_products"("brandNorm", "createdAt");

-- CreateIndex
CREATE INDEX "source_product_identifiers_lookup" ON "source_product_identifiers"("idType", "idValue", "namespace");

-- CreateIndex
CREATE INDEX "source_product_identifiers_canonical" ON "source_product_identifiers"("sourceProductId", "isCanonical");

-- CreateIndex
CREATE UNIQUE INDEX "source_product_identifiers_sourceProductId_idType_idValue_n_key" ON "source_product_identifiers"("sourceProductId", "idType", "idValue", "namespace");

-- CreateIndex
CREATE UNIQUE INDEX "product_links_sourceProductId_key" ON "product_links"("sourceProductId");

-- CreateIndex
CREATE INDEX "product_links_productId_idx" ON "product_links"("productId");

-- CreateIndex
CREATE INDEX "product_links_matchType_idx" ON "product_links"("matchType");

-- CreateIndex
CREATE INDEX "product_links_status_matchType_idx" ON "product_links"("status", "matchType");

-- CreateIndex
CREATE INDEX "product_links_resolverVersion_idx" ON "product_links"("resolverVersion");

-- CreateIndex
CREATE INDEX "product_links_resolvedAt_idx" ON "product_links"("resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "brand_aliases_aliasNorm_key" ON "brand_aliases"("aliasNorm");

-- CreateIndex
CREATE INDEX "brand_aliases_canonicalNorm_idx" ON "brand_aliases"("canonicalNorm");

-- CreateIndex
CREATE INDEX "brand_aliases_status_idx" ON "brand_aliases"("status");

-- CreateIndex
CREATE INDEX "brand_aliases_createdAt_idx" ON "brand_aliases"("createdAt");

-- CreateIndex
CREATE INDEX "brand_alias_applications_daily_date_idx" ON "brand_alias_applications_daily"("date");

-- CreateIndex
CREATE INDEX "brand_alias_applications_daily_aliasId_idx" ON "brand_alias_applications_daily"("aliasId");

-- CreateIndex
CREATE UNIQUE INDEX "product_aliases_fromProductId_key" ON "product_aliases"("fromProductId");

-- CreateIndex
CREATE INDEX "product_aliases_toProductId_idx" ON "product_aliases"("toProductId");

-- CreateIndex
CREATE UNIQUE INDEX "product_resolve_requests_idempotencyKey_key" ON "product_resolve_requests"("idempotencyKey");

-- CreateIndex
CREATE INDEX "product_resolve_requests_sourceProductId_idx" ON "product_resolve_requests"("sourceProductId");

-- CreateIndex
CREATE INDEX "product_resolve_requests_sourceId_idx" ON "product_resolve_requests"("sourceId");

-- CreateIndex
CREATE INDEX "product_resolve_requests_createdAt_idx" ON "product_resolve_requests"("createdAt");

-- CreateIndex
CREATE INDEX "product_resolve_requests_status_updatedAt_idx" ON "product_resolve_requests"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "source_trust_config_sourceId_key" ON "source_trust_config"("sourceId");

-- CreateIndex
CREATE INDEX "sources_retailer_id_idx" ON "sources"("retailerId");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeId_key" ON "subscriptions"("stripeId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "user_guns_userId_idx" ON "user_guns"("userId");

-- CreateIndex
CREATE INDEX "firearm_ammo_preferences_userId_firearmId_deletedAt_idx" ON "firearm_ammo_preferences"("userId", "firearmId", "deletedAt");

-- CreateIndex
CREATE INDEX "firearm_ammo_preferences_userId_ammoSkuId_deletedAt_idx" ON "firearm_ammo_preferences"("userId", "ammoSkuId", "deletedAt");

-- CreateIndex
CREATE INDEX "firearm_ammo_preferences_userId_useCase_deletedAt_idx" ON "firearm_ammo_preferences"("userId", "useCase", "deletedAt");

-- CreateIndex
CREATE INDEX "watchlist_collections_userId_idx" ON "watchlist_collections"("userId");

-- CreateIndex
CREATE INDEX "watchlist_items_collectionId_idx" ON "watchlist_items"("collectionId");

-- CreateIndex
CREATE INDEX "watchlist_items_productId_idx" ON "watchlist_items"("productId");

-- CreateIndex
CREATE INDEX "watchlist_items_userId_idx" ON "watchlist_items"("userId");

-- CreateIndex
CREATE INDEX "watchlist_items_deleted_at_idx" ON "watchlist_items"("deleted_at");

-- CreateIndex
CREATE INDEX "watchlist_items_intent_type_idx" ON "watchlist_items"("intent_type");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_feed_run_errors" ADD CONSTRAINT "affiliate_feed_run_errors_runId_fkey" FOREIGN KEY ("runId") REFERENCES "affiliate_feed_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_feed_runs" ADD CONSTRAINT "affiliate_feed_runs_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "affiliate_feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "affiliate_feeds" ADD CONSTRAINT "affiliate_feeds_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_watchlistItemId_fkey" FOREIGN KEY ("watchlistItemId") REFERENCES "watchlist_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "click_events" ADD CONSTRAINT "click_events_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "source_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_subscriptions" ADD CONSTRAINT "data_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_contacts" ADD CONSTRAINT "merchant_contacts_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retailer_feed_runs" ADD CONSTRAINT "retailer_feed_runs_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "retailer_feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retailer_feed_test_runs" ADD CONSTRAINT "retailer_feed_test_runs_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "retailer_feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retailer_feeds" ADD CONSTRAINT "retailer_feeds_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_invites" ADD CONSTRAINT "merchant_invites_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_invites" ADD CONSTRAINT "merchant_invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "merchant_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_notification_prefs" ADD CONSTRAINT "merchant_notification_prefs_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retailer_skus" ADD CONSTRAINT "retailer_skus_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retailer_skus" ADD CONSTRAINT "retailer_skus_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "retailer_feeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_users" ADD CONSTRAINT "merchant_users_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_retailers" ADD CONSTRAINT "merchant_retailers_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_retailers" ADD CONSTRAINT "merchant_retailers_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_user_retailers" ADD CONSTRAINT "merchant_user_retailers_merchantUserId_fkey" FOREIGN KEY ("merchantUserId") REFERENCES "merchant_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_user_retailers" ADD CONSTRAINT "merchant_user_retailers_merchantRetailerId_fkey" FOREIGN KEY ("merchantRetailerId") REFERENCES "merchant_retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_logs" ADD CONSTRAINT "execution_logs_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "executions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executions" ADD CONSTRAINT "executions_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_corrections" ADD CONSTRAINT "feed_corrections_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "retailer_feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_corrections" ADD CONSTRAINT "feed_corrections_quarantinedRecordId_fkey" FOREIGN KEY ("quarantinedRecordId") REFERENCES "quarantined_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pixel_events" ADD CONSTRAINT "pixel_events_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prices" ADD CONSTRAINT "prices_affiliateFeedRunId_fkey" FOREIGN KEY ("affiliateFeedRunId") REFERENCES "affiliate_feed_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prices" ADD CONSTRAINT "prices_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prices" ADD CONSTRAINT "prices_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prices" ADD CONSTRAINT "prices_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prices" ADD CONSTRAINT "prices_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prices" ADD CONSTRAINT "prices_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "source_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prices" ADD CONSTRAINT "prices_retailerSkuId_fkey" FOREIGN KEY ("retailerSkuId") REFERENCES "retailer_skus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reports" ADD CONSTRAINT "product_reports_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "prices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reports" ADD CONSTRAINT "product_reports_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_reports" ADD CONSTRAINT "product_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_product_presence" ADD CONSTRAINT "source_product_presence_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "source_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_product_seen" ADD CONSTRAINT "source_product_seen_runId_fkey" FOREIGN KEY ("runId") REFERENCES "affiliate_feed_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_product_seen" ADD CONSTRAINT "source_product_seen_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "source_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_products" ADD CONSTRAINT "source_products_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_products" ADD CONSTRAINT "source_products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_product_identifiers" ADD CONSTRAINT "source_product_identifiers_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "source_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_links" ADD CONSTRAINT "product_links_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "source_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_links" ADD CONSTRAINT "product_links_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_alias_applications_daily" ADD CONSTRAINT "brand_alias_applications_daily_aliasId_fkey" FOREIGN KEY ("aliasId") REFERENCES "brand_aliases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_fromProductId_fkey" FOREIGN KEY ("fromProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_toProductId_fkey" FOREIGN KEY ("toProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_resolve_requests" ADD CONSTRAINT "product_resolve_requests_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "source_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_resolve_requests" ADD CONSTRAINT "product_resolve_requests_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_resolve_requests" ADD CONSTRAINT "product_resolve_requests_resultProductId_fkey" FOREIGN KEY ("resultProductId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_trust_config" ADD CONSTRAINT "source_trust_config_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_retailerId_fkey" FOREIGN KEY ("retailerId") REFERENCES "retailers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_guns" ADD CONSTRAINT "user_guns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firearm_ammo_preferences" ADD CONSTRAINT "firearm_ammo_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firearm_ammo_preferences" ADD CONSTRAINT "firearm_ammo_preferences_firearmId_fkey" FOREIGN KEY ("firearmId") REFERENCES "user_guns"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firearm_ammo_preferences" ADD CONSTRAINT "firearm_ammo_preferences_ammoSkuId_fkey" FOREIGN KEY ("ammoSkuId") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_collections" ADD CONSTRAINT "watchlist_collections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "watchlist_collections"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
