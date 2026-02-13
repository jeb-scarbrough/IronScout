'use server';

import { prisma } from '@ironscout/db';
import { revalidatePath } from 'next/cache';
import { getAdminSession, logAdminAction } from '@/lib/auth';
import { loggers } from '@/lib/logger';
import {
  SETTING_KEYS,
  SETTING_DEFAULTS,
  SETTING_DESCRIPTIONS,
  SETTING_TYPES,
  NUMBER_SETTING_RANGES,
  DANGER_ZONE_KEYS,
  OPERATIONS_KEYS,
  QUEUE_HISTORY_KEYS,
  LOG_LEVELS,
  type SettingKey,
  type LogLevel,
} from './constants';

// =============================================================================
// Types
// =============================================================================

export interface SettingValue {
  value: boolean | number | string;
  updatedAt: Date | null;
  updatedBy: string | null;
}

export interface AllSettings {
  dangerZone: {
    allowPlainFtp: SettingValue;
    harvesterSchedulerEnabled: SettingValue;
    affiliateSchedulerEnabled: SettingValue;
    circuitBreakerBypass: SettingValue;
  };
  operations: {
    affiliateBatchSize: SettingValue;
    priceHeartbeatHours: SettingValue;
    affiliateRunRetentionDays: SettingValue;
    harvesterLogLevel: SettingValue;
    harvesterDebugSampleRate: SettingValue;
    harvesterDebugFirstN: SettingValue;
    harvesterLogRawExcerpts: SettingValue;
  };
  queueHistory: {
    retentionCount: SettingValue;
    crawl: SettingValue;
    fetch: SettingValue;
    extract: SettingValue;
    normalize: SettingValue;
    write: SettingValue;
    alert: SettingValue;
    retailerFeedIngest: SettingValue;
    // Note: retailerSkuMatch, retailerBenchmark, retailerInsight removed (benchmark subsystem removed for v1)
    affiliateFeed: SettingValue;
    affiliateScheduler: SettingValue;
  };
  featureFlags: {
    maintenanceMode: SettingValue;
    registrationEnabled: SettingValue;
    aiSearchEnabled: SettingValue;
    vectorSearchEnabled: SettingValue;
    emailNotificationsEnabled: SettingValue;
    alertProcessingEnabled: SettingValue;
    autoEmbeddingEnabled: SettingValue;
  };
}

// =============================================================================
// Read Operations
// =============================================================================

export async function getSystemSetting(key: SettingKey): Promise<SettingValue> {
  const setting = await prisma.system_settings.findUnique({
    where: { key },
  });

  if (!setting) {
    return {
      value: SETTING_DEFAULTS[key],
      updatedAt: null,
      updatedBy: null,
    };
  }

  return {
    value: setting.value as boolean | number | string,
    updatedAt: setting.updatedAt,
    updatedBy: setting.updatedBy,
  };
}

export async function getAllSettings(): Promise<{ success: boolean; error?: string; settings: AllSettings | null }> {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized', settings: null };
  }

  try {
    // Fetch all settings in parallel
    const [
      allowPlainFtp,
      harvesterSchedulerEnabled,
      affiliateSchedulerEnabled,
      circuitBreakerBypass,
      affiliateBatchSize,
      priceHeartbeatHours,
      affiliateRunRetentionDays,
      harvesterLogLevel,
      harvesterDebugSampleRate,
      harvesterDebugFirstN,
      harvesterLogRawExcerpts,
      // Queue history settings
      queueHistoryRetentionCount,
      queueHistoryCrawl,
      queueHistoryFetch,
      queueHistoryExtract,
      queueHistoryNormalize,
      queueHistoryWrite,
      queueHistoryAlert,
      queueHistoryRetailerFeedIngest,
      queueHistoryAffiliateFeed,
      queueHistoryAffiliateScheduler,
      // Feature flags
      maintenanceMode,
      registrationEnabled,
      aiSearchEnabled,
      vectorSearchEnabled,
      emailNotificationsEnabled,
      alertProcessingEnabled,
      autoEmbeddingEnabled,
    ] = await Promise.all([
      getSystemSetting(SETTING_KEYS.ALLOW_PLAIN_FTP),
      getSystemSetting(SETTING_KEYS.HARVESTER_SCHEDULER_ENABLED),
      getSystemSetting(SETTING_KEYS.AFFILIATE_SCHEDULER_ENABLED),
      getSystemSetting(SETTING_KEYS.CIRCUIT_BREAKER_BYPASS),
      getSystemSetting(SETTING_KEYS.AFFILIATE_BATCH_SIZE),
      getSystemSetting(SETTING_KEYS.PRICE_HEARTBEAT_HOURS),
      getSystemSetting(SETTING_KEYS.AFFILIATE_RUN_RETENTION_DAYS),
      getSystemSetting(SETTING_KEYS.HARVESTER_LOG_LEVEL),
      getSystemSetting(SETTING_KEYS.HARVESTER_DEBUG_SAMPLE_RATE),
      getSystemSetting(SETTING_KEYS.HARVESTER_DEBUG_FIRST_N),
      getSystemSetting(SETTING_KEYS.HARVESTER_LOG_RAW_EXCERPTS),
      // Queue history settings
      getSystemSetting(SETTING_KEYS.QUEUE_HISTORY_RETENTION_COUNT),
      getSystemSetting(SETTING_KEYS.QUEUE_HISTORY_CRAWL),
      getSystemSetting(SETTING_KEYS.QUEUE_HISTORY_FETCH),
      getSystemSetting(SETTING_KEYS.QUEUE_HISTORY_EXTRACT),
      getSystemSetting(SETTING_KEYS.QUEUE_HISTORY_NORMALIZE),
      getSystemSetting(SETTING_KEYS.QUEUE_HISTORY_WRITE),
      getSystemSetting(SETTING_KEYS.QUEUE_HISTORY_ALERT),
      getSystemSetting(SETTING_KEYS.QUEUE_HISTORY_RETAILER_FEED_INGEST),
      getSystemSetting(SETTING_KEYS.QUEUE_HISTORY_AFFILIATE_FEED),
      getSystemSetting(SETTING_KEYS.QUEUE_HISTORY_AFFILIATE_SCHEDULER),
      // Feature flags
      getSystemSetting(SETTING_KEYS.MAINTENANCE_MODE),
      getSystemSetting(SETTING_KEYS.REGISTRATION_ENABLED),
      getSystemSetting(SETTING_KEYS.AI_SEARCH_ENABLED),
      getSystemSetting(SETTING_KEYS.VECTOR_SEARCH_ENABLED),
      getSystemSetting(SETTING_KEYS.EMAIL_NOTIFICATIONS_ENABLED),
      getSystemSetting(SETTING_KEYS.ALERT_PROCESSING_ENABLED),
      getSystemSetting(SETTING_KEYS.AUTO_EMBEDDING_ENABLED),
    ]);

    return {
      success: true,
      settings: {
        dangerZone: {
          allowPlainFtp,
          harvesterSchedulerEnabled,
          affiliateSchedulerEnabled,
          circuitBreakerBypass,
        },
        operations: {
          affiliateBatchSize,
          priceHeartbeatHours,
          affiliateRunRetentionDays,
          harvesterLogLevel,
          harvesterDebugSampleRate,
          harvesterDebugFirstN,
          harvesterLogRawExcerpts,
        },
        queueHistory: {
          retentionCount: queueHistoryRetentionCount,
          crawl: queueHistoryCrawl,
          fetch: queueHistoryFetch,
          extract: queueHistoryExtract,
          normalize: queueHistoryNormalize,
          write: queueHistoryWrite,
          alert: queueHistoryAlert,
          retailerFeedIngest: queueHistoryRetailerFeedIngest,
          affiliateFeed: queueHistoryAffiliateFeed,
          affiliateScheduler: queueHistoryAffiliateScheduler,
        },
        featureFlags: {
          maintenanceMode,
          registrationEnabled,
          aiSearchEnabled,
          vectorSearchEnabled,
          emailNotificationsEnabled,
          alertProcessingEnabled,
          autoEmbeddingEnabled,
        },
      },
    };
  } catch (error) {
    loggers.settings.error('Failed to get settings', {}, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to load settings', settings: null };
  }
}

// Backwards compatibility
export async function getAllDangerZoneSettings() {
  const result = await getAllSettings();
  if (!result.success || !result.settings) {
    return { success: false, error: result.error, settings: null };
  }
  return {
    success: true,
    settings: {
      allowPlainFtp: result.settings.dangerZone.allowPlainFtp,
    },
  };
}

// =============================================================================
// Write Operations
// =============================================================================

/**
 * Update a danger zone setting (requires double confirmation)
 */
export async function updateDangerZoneSetting(
  key: SettingKey,
  value: boolean,
  confirmationCode: string
) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  // Verify this is actually a danger zone setting
  if (!DANGER_ZONE_KEYS.includes(key as any)) {
    return { success: false, error: 'Not a danger zone setting' };
  }

  // Double confirmation: require exact confirmation code
  const expectedCode = value ? 'ENABLE' : 'DISABLE';
  if (confirmationCode !== expectedCode) {
    return { success: false, error: `Invalid confirmation code. Expected: ${expectedCode}` };
  }

  return updateSetting(key, value, session);
}

/**
 * Update an operations setting (number value)
 */
export async function updateOperationsSetting(
  key: SettingKey,
  value: number
) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  // Validate type
  if (SETTING_TYPES[key] !== 'number') {
    return { success: false, error: 'Invalid setting type' };
  }

  // Validate range
  const range = NUMBER_SETTING_RANGES[key];
  if (range) {
    if (value < range.min || value > range.max) {
      return { success: false, error: `Value must be between ${range.min} and ${range.max}` };
    }
  }

  return updateSetting(key, value, session);
}

/**
 * Update an operations boolean setting (e.g. raw excerpts toggle)
 */
export async function updateOperationsBooleanSetting(
  key: SettingKey,
  value: boolean
) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  // Verify this is an operations setting with boolean type
  if (!OPERATIONS_KEYS.includes(key as any)) {
    return { success: false, error: 'Not an operations setting' };
  }
  if (SETTING_TYPES[key] !== 'boolean') {
    return { success: false, error: 'Invalid setting type' };
  }

  return updateSetting(key, value, session);
}

/**
 * Update a feature flag setting (boolean value)
 */
export async function updateFeatureFlagSetting(
  key: SettingKey,
  value: boolean
) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  // Validate type
  if (SETTING_TYPES[key] !== 'boolean') {
    return { success: false, error: 'Invalid setting type' };
  }

  return updateSetting(key, value, session);
}

/**
 * Update the harvester log level setting
 */
export async function updateLogLevelSetting(
  value: string
) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  // Validate that it's a valid log level
  if (!LOG_LEVELS.includes(value as LogLevel)) {
    return { success: false, error: `Invalid log level. Must be one of: ${LOG_LEVELS.join(', ')}` };
  }

  return updateSetting(SETTING_KEYS.HARVESTER_LOG_LEVEL, value, session);
}

/**
 * Update a queue history setting (boolean or number value)
 */
export async function updateQueueHistorySetting(
  key: SettingKey,
  value: boolean | number
) {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  // Verify this is a queue history setting
  if (!QUEUE_HISTORY_KEYS.includes(key as any)) {
    return { success: false, error: 'Not a queue history setting' };
  }

  // Validate type
  const expectedType = SETTING_TYPES[key];
  if (expectedType === 'number' && typeof value !== 'number') {
    return { success: false, error: 'Expected number value' };
  }
  if (expectedType === 'boolean' && typeof value !== 'boolean') {
    return { success: false, error: 'Expected boolean value' };
  }

  // Validate range for number settings
  if (expectedType === 'number') {
    const range = NUMBER_SETTING_RANGES[key];
    if (range && (value as number < range.min || value as number > range.max)) {
      return { success: false, error: `Value must be between ${range.min} and ${range.max}` };
    }
  }

  return updateSetting(key, value, session);
}

/**
 * Internal helper to update a setting
 */
async function updateSetting(
  key: SettingKey,
  value: boolean | number | string,
  session: { userId: string; email: string }
) {
  try {
    const oldSetting = await prisma.system_settings.findUnique({
      where: { key },
    });

    const oldValue = oldSetting?.value ?? SETTING_DEFAULTS[key];

    await prisma.system_settings.upsert({
      where: { key },
      create: {
        key,
        value,
        description: SETTING_DESCRIPTIONS[key],
        updatedBy: session.email,
      },
      update: {
        value,
        updatedBy: session.email,
      },
    });

    await logAdminAction(session.userId, 'UPDATE_SYSTEM_SETTING', {
      resource: 'SystemSetting',
      resourceId: key,
      oldValue: { value: oldValue },
      newValue: { value },
    });

    revalidatePath('/settings');

    return { success: true };
  } catch (error) {
    loggers.settings.error('Failed to update system setting', { key }, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to update setting' };
  }
}

// =============================================================================
// Public API for checking settings from other services
// =============================================================================

/**
 * Check if plain FTP is allowed (for use by validation code)
 */
export async function isPlainFtpAllowed(): Promise<boolean> {
  // Check env var first (for local dev override)
  if (process.env.AFFILIATE_FEED_ALLOW_PLAIN_FTP === 'true') {
    return true;
  }

  const setting = await getSystemSetting(SETTING_KEYS.ALLOW_PLAIN_FTP);
  return setting.value as boolean;
}

/**
 * Check if a feature flag is enabled
 */
export async function isFeatureEnabled(key: SettingKey): Promise<boolean> {
  // Check env var first (for local override)
  const envValue = process.env[key];
  if (envValue === 'true') return true;
  if (envValue === 'false') return false;

  const setting = await getSystemSetting(key);
  return setting.value as boolean;
}

/**
 * Get an operations setting value
 */
export async function getOperationsValue(key: SettingKey): Promise<number> {
  // Check env var first (for local override)
  const envValue = process.env[key];
  if (envValue) {
    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed)) return parsed;
  }

  const setting = await getSystemSetting(key);
  return setting.value as number;
}

// =============================================================================
// Data Integrity Checks
// =============================================================================

export interface IntegrityCheckResult {
  name: string;
  description: string;
  status: 'ok' | 'warning' | 'error';
  count: number;
  message: string;
  lastChecked: Date;
}

export interface DataIntegrityResults {
  checks: IntegrityCheckResult[];
  overallStatus: 'ok' | 'warning' | 'error';
  lastChecked: Date;
}

/**
 * Run all data integrity checks
 */
export async function runDataIntegrityChecks(): Promise<{ success: boolean; error?: string; results?: DataIntegrityResults }> {
  const session = await getAdminSession();

  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const checks: IntegrityCheckResult[] = [];
    const now = new Date();

    // NOTE: pricing_snapshots checks removed - table deleted (benchmark subsystem removed for v1)

    // Check 1: Orphaned prices (sourceId points to deleted source)
    const orphanedPrices = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM prices p
      WHERE p."sourceId" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM sources s WHERE s.id = p."sourceId"
        )
    `;
    const orphanedPricesCount = Number(orphanedPrices[0]?.count ?? 0);
    checks.push({
      name: 'Orphaned Price Records',
      description: 'Orphaned prices break provenance chains and ADR-015 correction scoping. Indicates a source was hard-deleted without cleanup.',
      status: orphanedPricesCount === 0 ? 'ok' : 'warning',
      count: orphanedPricesCount,
      message: orphanedPricesCount === 0
        ? 'No orphaned price records found'
        : `${orphanedPricesCount} prices reference deleted sources`,
      lastChecked: now,
    });

    // Check 3: Sources without retailer (should not exist per ADR-016)
    const sourcesWithoutRetailer = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM sources s
      WHERE s."retailerId" IS NULL
    `;
    const sourcesWithoutRetailerCount = Number(sourcesWithoutRetailer[0]?.count ?? 0);
    checks.push({
      name: 'Sources Without Retailer',
      description: 'Per ADR-016, every source must belong to a retailer. NULL retailerId breaks the visibility chain.',
      status: sourcesWithoutRetailerCount === 0 ? 'ok' : 'error',
      count: sourcesWithoutRetailerCount,
      message: sourcesWithoutRetailerCount === 0
        ? 'All sources have valid retailer associations'
        : `${sourcesWithoutRetailerCount} sources missing retailerId (data integrity violation)`,
      lastChecked: now,
    });

    // Check 4: Alerts with suppressed but still enabled
    const suppressedEnabledAlerts = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM alerts a
      WHERE a."suppressedAt" IS NOT NULL
        AND a."isEnabled" = true
    `;
    const suppressedEnabledCount = Number(suppressedEnabledAlerts[0]?.count ?? 0);
    checks.push({
      name: 'Suppressed But Enabled Alerts',
      description: 'Suppressed alerts (ADR-015 correction) with isEnabled=true indicate incomplete suppression cleanup.',
      status: suppressedEnabledCount === 0 ? 'ok' : 'warning',
      count: suppressedEnabledCount,
      message: suppressedEnabledCount === 0
        ? 'No conflicting alert states found'
        : `${suppressedEnabledCount} alerts are both suppressed and enabled`,
      lastChecked: now,
    });

    // Check 5: Recent prices missing provenance (ADR-015 requirement)
    // New writes MUST include ingestionRunType and ingestionRunId
    const recentPricesWithoutProvenance = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM prices p
      WHERE p."createdAt" > NOW() - INTERVAL '24 hours'
        AND (p."ingestionRunType" IS NULL OR p."ingestionRunId" IS NULL)
    `;
    const pricesWithoutProvenanceCount = Number(recentPricesWithoutProvenance[0]?.count ?? 0);
    checks.push({
      name: 'Recent Prices Without Provenance',
      description: 'ADR-015: Prices without provenance cannot participate in correction/ignore workflows.',
      status: pricesWithoutProvenanceCount === 0 ? 'ok' : 'warning',
      count: pricesWithoutProvenanceCount,
      message: pricesWithoutProvenanceCount === 0
        ? 'All recent prices have provenance fields'
        : `${pricesWithoutProvenanceCount} prices in last 24h missing provenance`,
      lastChecked: now,
    });

    // NOTE: pricing_snapshots provenance check removed - table deleted (benchmark subsystem removed for v1)

    // =========================================================================
    // Check 5: Stuck Runs (ADR-001)
    // =========================================================================
    const stuckAffiliate = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM affiliate_feed_runs
      WHERE status = 'RUNNING' AND "finishedAt" IS NULL
        AND "expiryBlocked" = false
        AND "startedAt" < NOW() - INTERVAL '2 hours'
    `;
    const stuckExecutions = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM executions
      WHERE status = 'RUNNING' AND "completedAt" IS NULL
        AND "startedAt" < NOW() - INTERVAL '1 hour'
    `;
    const stuckScrape = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM scrape_runs
      WHERE status = 'RUNNING' AND "completedAt" IS NULL
        AND "startedAt" < NOW() - INTERVAL '1 hour'
    `;
    const stuckTotal = Number(stuckAffiliate[0]?.count ?? 0)
      + Number(stuckExecutions[0]?.count ?? 0)
      + Number(stuckScrape[0]?.count ?? 0);
    checks.push({
      name: 'Stuck Runs',
      description: 'Runs stuck in RUNNING indicate worker crash/deadlock. Blocks scheduling and leaves CVP stale.',
      status: stuckTotal === 0 ? 'ok' : 'error',
      count: stuckTotal,
      message: stuckTotal === 0
        ? 'No stuck runs detected'
        : `${stuckTotal} runs stuck in RUNNING state (affiliate >2h, execution/scrape >1h)`,
      lastChecked: now,
    });

    // =========================================================================
    // Check 6: Ignored Run Prices Still Visible (ADR-015)
    // =========================================================================
    const ignoredRunPrices = await prisma.$queryRaw<{ count: bigint }[]>`
      WITH ignored_affiliate AS (
        SELECT id FROM affiliate_feed_runs WHERE "ignoredAt" IS NOT NULL
      ),
      ignored_retailer AS (
        SELECT id FROM retailer_feed_runs WHERE "ignoredAt" IS NOT NULL
      ),
      ignored_execution AS (
        SELECT id FROM executions WHERE "ignoredAt" IS NOT NULL
      ),
      all_ignored AS (
        SELECT id FROM ignored_affiliate
        UNION ALL SELECT id FROM ignored_retailer
        UNION ALL SELECT id FROM ignored_execution
      )
      SELECT COUNT(*) as count
      FROM current_visible_prices cvp
      LEFT JOIN prices p ON p.id = cvp.id
      WHERE (
        (p."ingestionRunType" = 'AFFILIATE_FEED' AND p."ingestionRunId" IN (SELECT id FROM ignored_affiliate))
        OR (p."ingestionRunType" = 'RETAILER_FEED' AND p."ingestionRunId" IN (SELECT id FROM ignored_retailer))
        OR (p."ingestionRunType" = 'SCRAPE' AND p."ingestionRunId" IN (SELECT id FROM ignored_execution))
        OR (p."ingestionRunType" IS NULL AND p."ingestionRunId" IN (SELECT id FROM all_ignored))
        OR (p."affiliateFeedRunId" IN (SELECT id FROM ignored_affiliate))
      )
    `;
    const ignoredRunPricesCount = Number(ignoredRunPrices[0]?.count ?? 0);
    checks.push({
      name: 'Ignored Run Prices Still Visible',
      description: 'ADR-015: Prices from ignored runs must not appear in current_visible_prices.',
      status: ignoredRunPricesCount === 0 ? 'ok' : 'error',
      count: ignoredRunPricesCount,
      message: ignoredRunPricesCount === 0
        ? 'No ignored-run prices in current_visible_prices'
        : `${ignoredRunPricesCount} prices from ignored runs still visible — recompute may not have run`,
      lastChecked: now,
    });

    // =========================================================================
    // Check 7: Stale Current Visible Prices
    // =========================================================================
    const cvpStats = await prisma.$queryRaw<{ stale_count: bigint; total_count: bigint }[]>`
      SELECT
        COUNT(*) FILTER (WHERE "recomputedAt" < NOW() - INTERVAL '30 minutes') as stale_count,
        COUNT(*) as total_count
      FROM current_visible_prices
    `;
    const staleCount = Number(cvpStats[0]?.stale_count ?? 0);
    const cvpTotalCount = Number(cvpStats[0]?.total_count ?? 0);

    let cvpEmpty = false;
    if (cvpTotalCount === 0) {
      const recentRuns = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM (
          (SELECT 1 FROM affiliate_feed_runs WHERE status = 'SUCCEEDED' AND "pricesWritten" > 0 AND "finishedAt" > NOW() - INTERVAL '24 hours' LIMIT 1)
          UNION ALL
          (SELECT 1 FROM retailer_feed_runs WHERE status IN ('SUCCESS', 'WARNING') AND "completedAt" > NOW() - INTERVAL '24 hours' LIMIT 1)
          UNION ALL
          (SELECT 1 FROM executions WHERE status = 'SUCCESS' AND "itemsUpserted" > 0 AND "completedAt" > NOW() - INTERVAL '24 hours' LIMIT 1)
          UNION ALL
          (SELECT 1 FROM scrape_runs WHERE status = 'SUCCESS' AND "completedAt" > NOW() - INTERVAL '24 hours' LIMIT 1)
        ) recent_runs
      `;
      cvpEmpty = Number(recentRuns[0]?.count ?? 0) > 0;
    }

    const staleCvpWarning = staleCount > 0 || cvpEmpty;
    checks.push({
      name: 'Stale Current Visible Prices',
      description: 'CVP table should be refreshed every 5 min by recompute scheduler. Stale or empty = consumers see outdated data.',
      status: staleCvpWarning ? 'warning' : 'ok',
      count: staleCount || (cvpEmpty ? -1 : 0),
      message: cvpEmpty
        ? 'Empty CVP with recent ingestion activity. May be legitimate if all data is filtered by eligibility/corrections — investigate recompute logs.'
        : staleCount > 0
          ? `${staleCount} rows have recomputedAt >30 min old`
          : `${cvpTotalCount} rows, all fresh`,
      lastChecked: now,
    });

    // =========================================================================
    // Check 8: Provenance Run ID Validity (ADR-015)
    // =========================================================================
    const invalidProvenance = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM prices p
      WHERE p."ingestionRunId" IS NOT NULL
        AND p."ingestionRunType" IS NOT NULL
        AND p."ingestionRunType" IN ('AFFILIATE_FEED', 'RETAILER_FEED', 'SCRAPE')
        AND p."createdAt" > NOW() - INTERVAL '7 days'
        AND NOT (
          (p."ingestionRunType" = 'AFFILIATE_FEED' AND EXISTS (SELECT 1 FROM affiliate_feed_runs WHERE id = p."ingestionRunId"))
          OR (p."ingestionRunType" = 'RETAILER_FEED' AND EXISTS (SELECT 1 FROM retailer_feed_runs WHERE id = p."ingestionRunId"))
          OR (p."ingestionRunType" = 'SCRAPE' AND (
            EXISTS (SELECT 1 FROM scrape_runs WHERE id = p."ingestionRunId")
            OR EXISTS (SELECT 1 FROM executions WHERE id = p."ingestionRunId")
          ))
        )
    `;
    const invalidProvenanceCount = Number(invalidProvenance[0]?.count ?? 0);
    checks.push({
      name: 'Provenance Run ID Validity',
      description: 'ADR-015: ingestionRunId must reference a valid run in the corresponding table. Broken provenance blocks corrections.',
      status: invalidProvenanceCount === 0 ? 'ok' : 'error',
      count: invalidProvenanceCount,
      message: invalidProvenanceCount === 0
        ? 'All recent prices reference valid runs'
        : `${invalidProvenanceCount} prices (last 7 days) reference non-existent runs`,
      lastChecked: now,
    });

    // =========================================================================
    // Check 9: Provenance Consistency (ADR-015)
    // =========================================================================
    const provenanceMismatch = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM prices p
      WHERE p."createdAt" > NOW() - INTERVAL '7 days'
        AND (
          (p."affiliateFeedRunId" IS NOT NULL AND p."ingestionRunType" IS DISTINCT FROM 'AFFILIATE_FEED')
          OR (p."ingestionRunType" = 'AFFILIATE_FEED' AND p."affiliateFeedRunId" IS NULL AND p."ingestionRunId" IS NOT NULL)
        )
    `;
    const provenanceMismatchCount = Number(provenanceMismatch[0]?.count ?? 0);
    checks.push({
      name: 'Provenance Consistency',
      description: 'Legacy affiliateFeedRunId and new ingestionRunType/Id must agree. Mismatches cause inconsistent ignore filtering.',
      status: provenanceMismatchCount === 0 ? 'ok' : 'warning',
      count: provenanceMismatchCount,
      message: provenanceMismatchCount === 0
        ? 'Legacy and new provenance fields are consistent'
        : `${provenanceMismatchCount} prices (last 7 days) have mismatched provenance fields`,
      lastChecked: now,
    });

    // =========================================================================
    // Check 10: ObservedAt Future Timestamps
    // =========================================================================
    const futureObservedAt = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM prices
      WHERE "observedAt" > NOW() + INTERVAL '5 minutes'
        AND "createdAt" > NOW() - INTERVAL '24 hours'
    `;
    const futureObservedAtCount = Number(futureObservedAt[0]?.count ?? 0);
    checks.push({
      name: 'ObservedAt Future Timestamps',
      description: 'Future observedAt breaks correction matching, price ordering, and lookback queries. 5-min skew tolerance applied.',
      status: futureObservedAtCount === 0 ? 'ok' : 'warning',
      count: futureObservedAtCount,
      message: futureObservedAtCount === 0
        ? 'No future-dated prices in last 24h'
        : `${futureObservedAtCount} prices (last 24h) have observedAt >5 min in the future`,
      lastChecked: now,
    });

    // =========================================================================
    // Check 11: Visible Prices Violating Retailer Visibility (ADR-005)
    // =========================================================================
    const visibilityViolations = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM current_visible_prices cvp
      JOIN retailers r ON r.id = cvp."retailerId"
      WHERE r."visibilityStatus" != 'ELIGIBLE'
        OR (
          r."visibilityStatus" = 'ELIGIBLE'
          AND EXISTS (
            SELECT 1 FROM merchant_retailers mr
            WHERE mr."retailerId" = r.id AND mr.status = 'ACTIVE'
          )
          AND NOT EXISTS (
            SELECT 1 FROM merchant_retailers mr
            WHERE mr."retailerId" = r.id AND mr.status = 'ACTIVE' AND mr."listingStatus" = 'LISTED'
          )
        )
    `;
    const visibilityViolationsCount = Number(visibilityViolations[0]?.count ?? 0);
    checks.push({
      name: 'Visible Prices Violating Retailer Visibility',
      description: 'ADR-005: CVP rows from ineligible/unlisted retailers. Trust violation — consumers see hidden prices.',
      status: visibilityViolationsCount === 0 ? 'ok' : 'error',
      count: visibilityViolationsCount,
      message: visibilityViolationsCount === 0
        ? 'All visible prices comply with retailer visibility rules'
        : `${visibilityViolationsCount} CVP rows violate ADR-005 visibility. May resolve after next recompute cycle.`,
      lastChecked: now,
    });

    // =========================================================================
    // Check 12: SCRAPE Guardrail Compliance (ADR-021)
    // =========================================================================
    const scrapeViolations = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM current_visible_prices cvp
      LEFT JOIN sources s ON s.id = cvp."sourceId"
      LEFT JOIN scrape_adapter_status sas ON sas."adapterId" = s."adapterId"
      WHERE cvp."ingestionRunType" = 'SCRAPE'
        AND (
          s.id IS NULL
          OR s."robotsCompliant" = false
          OR s."tosReviewedAt" IS NULL
          OR s."tosApprovedBy" IS NULL
          OR sas."adapterId" IS NULL
          OR sas."enabled" = false
        )
    `;
    const scrapeViolationsCount = Number(scrapeViolations[0]?.count ?? 0);
    checks.push({
      name: 'SCRAPE Guardrail Compliance',
      description: 'ADR-021: Visible SCRAPE data must pass visibility guardrails (robots, ToS, adapter). Legal/compliance risk.',
      status: scrapeViolationsCount === 0 ? 'ok' : 'error',
      count: scrapeViolationsCount,
      message: scrapeViolationsCount === 0
        ? 'All visible SCRAPE prices pass guardrails'
        : `${scrapeViolationsCount} SCRAPE prices visible with failing guardrails`,
      lastChecked: now,
    });

    // =========================================================================
    // Check 13: Orphaned Product Supersession Chains
    // =========================================================================
    const orphanedSupersession = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM products p
      WHERE p."supersededById" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM products p2 WHERE p2.id = p."supersededById"
        )
    `;
    const orphanedSupersessionCount = Number(orphanedSupersession[0]?.count ?? 0);
    checks.push({
      name: 'Orphaned Product Supersession Chains',
      description: 'supersededById pointing to non-existent product breaks resolveSupersededSku() chain resolution.',
      status: orphanedSupersessionCount === 0 ? 'ok' : 'warning',
      count: orphanedSupersessionCount,
      message: orphanedSupersessionCount === 0
        ? 'All supersession chains are valid'
        : `${orphanedSupersessionCount} products have broken supersession links`,
      lastChecked: now,
    });

    // =========================================================================
    // Check 14: Supersession Cycle Reachability
    // =========================================================================
    const supersessionCycles = await prisma.$queryRaw<{ count: bigint }[]>`
      WITH RECURSIVE chain AS (
        SELECT
          id as origin_id,
          "supersededById" as next_id,
          ARRAY[id] as visited,
          false as is_cycle
        FROM products
        WHERE "supersededById" IS NOT NULL
        UNION ALL
        SELECT
          c.origin_id,
          p."supersededById",
          c.visited || c.next_id,
          p."supersededById" IS NOT NULL AND p."supersededById" = ANY(c.visited || c.next_id) as is_cycle
        FROM chain c
        JOIN products p ON p.id = c.next_id
        WHERE c.is_cycle = false
          AND array_length(c.visited, 1) < 10
      ),
      cycle_members AS (
        SELECT DISTINCT unnest(visited || next_id) as product_id
        FROM chain
        WHERE is_cycle = true
      )
      SELECT COUNT(*) as count FROM cycle_members
    `;
    const supersessionCycleCount = Number(supersessionCycles[0]?.count ?? 0);
    checks.push({
      name: 'Supersession Cycle Reachability',
      description: 'Products whose supersession chain enters a cycle cannot resolve to a valid current SKU.',
      status: supersessionCycleCount === 0 ? 'ok' : 'warning',
      count: supersessionCycleCount,
      message: supersessionCycleCount === 0
        ? 'No supersession cycles detected'
        : `${supersessionCycleCount} products whose supersession chain enters a cycle`,
      lastChecked: now,
    });

    // =========================================================================
    // Check 15: Duplicate Active Watchlist Items (ADR-011)
    // =========================================================================
    const duplicateWatchlist = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM (
        SELECT "userId", "productId"
        FROM watchlist_items
        WHERE "intent_type" = 'SKU'
          AND "deleted_at" IS NULL
          AND "productId" IS NOT NULL
        GROUP BY "userId", "productId"
        HAVING COUNT(*) > 1
      ) dupes
    `;
    const duplicateWatchlistCount = Number(duplicateWatchlist[0]?.count ?? 0);
    checks.push({
      name: 'Duplicate Active Watchlist Items',
      description: 'ADR-011: Partial unique index should prevent duplicates. Indicates race condition or index corruption.',
      status: duplicateWatchlistCount === 0 ? 'ok' : 'error',
      count: duplicateWatchlistCount,
      message: duplicateWatchlistCount === 0
        ? 'No duplicate active watchlist items'
        : `${duplicateWatchlistCount} user+product pairs have duplicate active SKU items`,
      lastChecked: now,
    });

    // =========================================================================
    // Check 16: SKU Intent Invariants (ADR-011)
    // =========================================================================
    const skuInvariantViolations = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM watchlist_items
      WHERE "deleted_at" IS NULL
        AND (
          "intent_type" != 'SKU'
          OR ("intent_type" = 'SKU' AND "productId" IS NULL)
        )
    `;
    const skuInvariantCount = Number(skuInvariantViolations[0]?.count ?? 0);
    checks.push({
      name: 'SKU Intent Invariants',
      description: 'V1 only supports SKU intent with non-null productId. Violations crash alerter/API/dashboard.',
      status: skuInvariantCount === 0 ? 'ok' : 'error',
      count: skuInvariantCount,
      message: skuInvariantCount === 0
        ? 'All active watchlist items have valid SKU intent'
        : `${skuInvariantCount} active items violate SKU intent invariants`,
      lastChecked: now,
    });

    // =========================================================================
    // Check 17: Stale Notification Claims
    // =========================================================================
    const staleClaims = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM watchlist_items
      WHERE "deleted_at" IS NULL
        AND (
          ("price_notification_claimed_at" IS NOT NULL
           AND "price_notification_claimed_at" < NOW() - INTERVAL '15 minutes')
          OR
          ("stock_notification_claimed_at" IS NOT NULL
           AND "stock_notification_claimed_at" < NOW() - INTERVAL '15 minutes')
        )
    `;
    const staleClaimsCount = Number(staleClaims[0]?.count ?? 0);
    checks.push({
      name: 'Stale Notification Claims',
      description: 'Claims >15 min old (3x stale threshold) indicate systematic worker failures — notifications not being delivered.',
      status: staleClaimsCount === 0 ? 'ok' : 'warning',
      count: staleClaimsCount,
      message: staleClaimsCount === 0
        ? 'No stale notification claims'
        : `${staleClaimsCount} watchlist items with claims older than 15 minutes`,
      lastChecked: now,
    });

    // =========================================================================
    // Check 18: Enabled Alerts for Deleted Watchlist Items
    // =========================================================================
    const enabledAlertsDeleted = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM alerts a
      JOIN watchlist_items wi ON wi.id = a."watchlistItemId"
      WHERE a."isEnabled" = true
        AND wi."deleted_at" IS NOT NULL
    `;
    const enabledAlertsDeletedCount = Number(enabledAlertsDeleted[0]?.count ?? 0);
    checks.push({
      name: 'Enabled Alerts for Deleted Watchlist Items',
      description: 'Soft-delete cleanup should disable associated alerts. Enabled alerts on deleted items send unwanted notifications.',
      status: enabledAlertsDeletedCount === 0 ? 'ok' : 'warning',
      count: enabledAlertsDeletedCount,
      message: enabledAlertsDeletedCount === 0
        ? 'No enabled alerts on deleted watchlist items'
        : `${enabledAlertsDeletedCount} alerts still enabled for soft-deleted items`,
      lastChecked: now,
    });

    // =========================================================================
    // Check 19: Invalid Corrections (ADR-015)
    // =========================================================================
    const invalidCorrections = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM price_corrections
      WHERE "revokedAt" IS NULL
        AND (
          "startTs" >= "endTs"
          OR (action = 'MULTIPLIER' AND (value IS NULL OR value <= 0))
          OR (action = 'IGNORE' AND value IS NOT NULL)
        )
    `;
    const invalidCorrectionsCount = Number(invalidCorrections[0]?.count ?? 0);
    checks.push({
      name: 'Invalid Corrections',
      description: 'ADR-015: Active corrections with inverted windows, invalid MULTIPLIER values, or contradictory IGNORE values.',
      status: invalidCorrectionsCount === 0 ? 'ok' : 'error',
      count: invalidCorrectionsCount,
      message: invalidCorrectionsCount === 0
        ? 'All active corrections have valid parameters'
        : `${invalidCorrectionsCount} active corrections with invalid parameters`,
      lastChecked: now,
    });

    // =========================================================================
    // Check 20: Fully Orphaned Alert Events — Last 30 Days (ADR-009)
    // =========================================================================
    const orphanedEvents = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM alert_events
      WHERE "createdAt" > NOW() - INTERVAL '30 days'
        AND "userId" IS NULL
        AND "productId" IS NULL
        AND "retailerId" IS NULL
        AND "watchlistItemId" IS NULL
        AND "alertId" IS NULL
        AND "sourceId" IS NULL
        AND "triggerPriceId" IS NULL
    `;
    const orphanedEventsCount = Number(orphanedEvents[0]?.count ?? 0);
    checks.push({
      name: 'Fully Orphaned Alert Events',
      description: 'ADR-009: Events with all 7 FKs nulled have lost all context. Growing count suggests excessive entity deletions.',
      status: orphanedEventsCount === 0 ? 'ok' : 'warning',
      count: orphanedEventsCount,
      message: orphanedEventsCount === 0
        ? 'No fully orphaned alert events in last 30 days'
        : `${orphanedEventsCount} alert events (last 30 days) with all parent FKs null`,
      lastChecked: now,
    });

    // =========================================================================
    // Check 21: CVP Rows Orphaned from Prices
    // =========================================================================
    const cvpOrphaned = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM current_visible_prices cvp
      LEFT JOIN prices p ON p.id = cvp.id
      WHERE p.id IS NULL
    `;
    const cvpOrphanedCount = Number(cvpOrphaned[0]?.count ?? 0);
    checks.push({
      name: 'CVP Rows Orphaned from Prices',
      description: 'CVP rows with no matching prices row indicate failed recompute or unsafe price deletion.',
      status: cvpOrphanedCount === 0 ? 'ok' : 'error',
      count: cvpOrphanedCount,
      message: cvpOrphanedCount === 0
        ? 'All CVP rows reference valid prices'
        : `${cvpOrphanedCount} current_visible_prices rows have no matching price record`,
      lastChecked: now,
    });

    // Determine overall status
    let overallStatus: 'ok' | 'warning' | 'error' = 'ok';
    for (const check of checks) {
      if (check.status === 'error') {
        overallStatus = 'error';
        break;
      }
      if (check.status === 'warning') {
        overallStatus = 'warning';
      }
    }

    await logAdminAction(session.userId, 'RUN_DATA_INTEGRITY_CHECKS', {
      resource: 'DataIntegrity',
      newValue: { checksRun: checks.length, overallStatus },
    });

    return {
      success: true,
      results: {
        checks,
        overallStatus,
        lastChecked: now,
      },
    };
  } catch (error) {
    loggers.settings.error('Failed to run data integrity checks', {}, error instanceof Error ? error : new Error(String(error)));
    return { success: false, error: 'Failed to run integrity checks' };
  }
}
