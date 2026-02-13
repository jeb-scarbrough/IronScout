'use server';

import { prisma } from '@ironscout/db';
import { getAdminSession } from '@/lib/auth';
import { loggers } from '@/lib/logger';
import {
  runDataIntegrityChecks,
  type DataIntegrityResults,
} from '../settings/actions';

// =============================================================================
// Types
// =============================================================================

export type OverallStatus = 'ok' | 'warning' | 'error';

export interface AffiliatePipelineMetrics {
  totalRuns: number;
  succeeded: number;
  failed: number;
  running: number;
  avgPricesWritten: number;
  stuckCount: number;
}

export interface ScrapePipelineMetrics {
  totalRuns: number;
  success: number;
  failed: number;
  running: number;
  quarantined: number;
  urlsProcessed: number;
  offersValid: number;
  stuckCount: number;
}

export interface RecomputeMetrics {
  lastRecomputeTime: Date | null;
  cvpTotalRows: number;
  staleRowCount: number;
  stalePercentage: number;
}

export interface CvpSummary {
  total: number;
  staleCount: number;
  stalePercentage: number;
  inStockCount: number;
  oosCount: number;
  maxRecomputedAt: Date | null;
  minRecomputedAt: Date | null;
}

export interface CvpByRetailer {
  retailerName: string;
  total: number;
  inStockCount: number;
  inStockPercentage: number;
}

export interface CvpByIngestionType {
  ingestionRunType: string;
  count: number;
}

export interface GuardrailAuditRow {
  sourceId: string;
  sourceName: string;
  robotsCompliant: boolean;
  tosReviewed: boolean;
  tosApproved: boolean;
  adapterEnabled: boolean | null;
  cvpRows: number;
  scrapeEnabled: boolean;
  lastRunAt: Date | null;
  recentOffers: number;
}

export interface ProductCoverage {
  totalProducts: number;
  productsWithLinks: number;
  orphanProducts: number;
  statusDistribution: { status: string; count: number }[];
}

export interface DashboardData {
  affiliate: AffiliatePipelineMetrics | null;
  scrape: ScrapePipelineMetrics | null;
  recompute: RecomputeMetrics | null;
  cvpSummary: CvpSummary | null;
  cvpByRetailer: CvpByRetailer[] | null;
  cvpByIngestionType: CvpByIngestionType[] | null;
  guardrailAudit: GuardrailAuditRow[] | null;
  productCoverage: ProductCoverage | null;
  overallStatus: OverallStatus;
  fetchedAt: Date;
}

// Re-export for integrity checks section
export type { DataIntegrityResults, IntegrityCheckResult } from '../settings/actions';

// =============================================================================
// Dashboard Data Fetching
// =============================================================================

export async function fetchDashboardData(): Promise<{
  success: boolean;
  data?: DashboardData;
  error?: string;
}> {
  const session = await getAdminSession();
  if (!session) {
    return { success: false, error: 'Unauthorized' };
  }

  try {
    const fetchedAt = new Date();

    // Run all 9 query groups in parallel, each with independent try/catch
    const [
      affiliateResult,
      stuckAffiliateResult,
      scrapeResult,
      stuckScrapeResult,
      cvpSummaryResult,
      cvpByRetailerResult,
      cvpByIngestionTypeResult,
      guardrailAuditResult,
      productCoverageResult,
    ] = await Promise.all([
      // 1. Affiliate feed runs (24h)
      fetchAffiliateMetrics(),
      // 2. Stuck affiliate runs
      fetchStuckAffiliateRuns(),
      // 3. Scrape runs (24h)
      fetchScrapeMetrics(),
      // 4. Stuck scrape runs
      fetchStuckScrapeRuns(),
      // 5. CVP summary
      fetchCvpSummary(),
      // 6. CVP by retailer
      fetchCvpByRetailer(),
      // 7. CVP by ingestion type
      fetchCvpByIngestionType(),
      // 8. Guardrail audit
      fetchGuardrailAudit(),
      // 9. Product coverage
      fetchProductCoverage(),
    ]);

    // Merge affiliate metrics with stuck count
    const affiliate: AffiliatePipelineMetrics | null = affiliateResult
      ? { ...affiliateResult, stuckCount: stuckAffiliateResult ?? 0 }
      : null;

    const scrape: ScrapePipelineMetrics | null = scrapeResult
      ? { ...scrapeResult, stuckCount: stuckScrapeResult ?? 0 }
      : null;

    // Derive recompute metrics from CVP summary
    const recompute: RecomputeMetrics | null = cvpSummaryResult
      ? {
          lastRecomputeTime: cvpSummaryResult.maxRecomputedAt,
          cvpTotalRows: cvpSummaryResult.total,
          staleRowCount: cvpSummaryResult.staleCount,
          stalePercentage: cvpSummaryResult.stalePercentage,
        }
      : null;

    // Derive overall status
    const overallStatus = deriveOverallStatus({
      affiliate,
      scrape,
      recompute,
      cvpSummary: cvpSummaryResult,
      guardrailAudit: guardrailAuditResult,
    });

    return {
      success: true,
      data: {
        affiliate,
        scrape,
        recompute,
        cvpSummary: cvpSummaryResult,
        cvpByRetailer: cvpByRetailerResult,
        cvpByIngestionType: cvpByIngestionTypeResult,
        guardrailAudit: guardrailAuditResult,
        productCoverage: productCoverageResult,
        overallStatus,
        fetchedAt,
      },
    };
  } catch (error) {
    loggers.admin.error(
      'Failed to fetch dashboard data',
      {},
      error instanceof Error ? error : new Error(String(error))
    );
    return { success: false, error: 'Failed to load dashboard data' };
  }
}

// =============================================================================
// Integrity Checks (Thin Wrapper)
// =============================================================================

export async function runIntegrityChecksAction(): Promise<{
  success: boolean;
  results?: DataIntegrityResults;
  error?: string;
}> {
  return runDataIntegrityChecks();
}

// =============================================================================
// Individual Query Functions (each wrapped in try/catch)
// =============================================================================

async function fetchAffiliateMetrics(): Promise<Omit<AffiliatePipelineMetrics, 'stuckCount'> | null> {
  try {
    const rows = await prisma.$queryRaw<
      { status: string; run_count: bigint; avg_prices: number | null }[]
    >`
      SELECT
        status::text,
        COUNT(*) as run_count,
        AVG("pricesWritten")::float as avg_prices
      FROM affiliate_feed_runs
      WHERE "startedAt" > NOW() - INTERVAL '24 hours'
      GROUP BY status
    `;

    let totalRuns = 0;
    let succeeded = 0;
    let failed = 0;
    let running = 0;
    let totalPricesWeighted = 0;
    let succeededCount = 0;

    for (const row of rows) {
      const count = Number(row.run_count);
      totalRuns += count;
      switch (row.status) {
        case 'SUCCEEDED':
          succeeded = count;
          totalPricesWeighted = (row.avg_prices ?? 0) * count;
          succeededCount = count;
          break;
        case 'FAILED':
          failed = count;
          break;
        case 'RUNNING':
          running = count;
          break;
      }
    }

    return {
      totalRuns,
      succeeded,
      failed,
      running,
      avgPricesWritten: succeededCount > 0 ? Math.round(totalPricesWeighted / succeededCount) : 0,
    };
  } catch (error) {
    loggers.admin.error('Dashboard: affiliate metrics query failed', {}, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

async function fetchStuckAffiliateRuns(): Promise<number | null> {
  try {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM affiliate_feed_runs
      WHERE status = 'RUNNING'
        AND "finishedAt" IS NULL
        AND "expiryBlocked" = false
        AND "startedAt" < NOW() - INTERVAL '2 hours'
    `;
    return Number(rows[0]?.count ?? 0);
  } catch (error) {
    loggers.admin.error('Dashboard: stuck affiliate query failed', {}, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

async function fetchScrapeMetrics(): Promise<Omit<ScrapePipelineMetrics, 'stuckCount'> | null> {
  try {
    const rows = await prisma.$queryRaw<
      { status: string; run_count: bigint; total_urls: bigint; total_offers: bigint }[]
    >`
      SELECT
        status::text,
        COUNT(*) as run_count,
        COALESCE(SUM("urlsAttempted"), 0) as total_urls,
        COALESCE(SUM("offersValid"), 0) as total_offers
      FROM scrape_runs
      WHERE "startedAt" > NOW() - INTERVAL '24 hours'
      GROUP BY status
    `;

    let totalRuns = 0;
    let success = 0;
    let failed = 0;
    let running = 0;
    let quarantined = 0;
    let urlsProcessed = 0;
    let offersValid = 0;

    for (const row of rows) {
      const count = Number(row.run_count);
      totalRuns += count;
      urlsProcessed += Number(row.total_urls);
      offersValid += Number(row.total_offers);
      switch (row.status) {
        case 'SUCCESS':
          success = count;
          break;
        case 'FAILED':
          failed = count;
          break;
        case 'RUNNING':
          running = count;
          break;
        case 'QUARANTINED':
          quarantined = count;
          break;
      }
    }

    return {
      totalRuns,
      success,
      failed,
      running,
      quarantined,
      urlsProcessed,
      offersValid,
    };
  } catch (error) {
    loggers.admin.error('Dashboard: scrape metrics query failed', {}, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

async function fetchStuckScrapeRuns(): Promise<number | null> {
  try {
    const rows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count
      FROM scrape_runs
      WHERE status = 'RUNNING'
        AND "completedAt" IS NULL
        AND "startedAt" < NOW() - INTERVAL '1 hour'
    `;
    return Number(rows[0]?.count ?? 0);
  } catch (error) {
    loggers.admin.error('Dashboard: stuck scrape query failed', {}, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

async function fetchCvpSummary(): Promise<CvpSummary | null> {
  try {
    const rows = await prisma.$queryRaw<
      {
        total: bigint;
        stale_count: bigint;
        in_stock_count: bigint;
        oos_count: bigint;
        max_recomputed: Date | null;
        min_recomputed: Date | null;
      }[]
    >`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE "recomputedAt" < NOW() - INTERVAL '30 minutes') as stale_count,
        COUNT(*) FILTER (WHERE "inStock" = true) as in_stock_count,
        COUNT(*) FILTER (WHERE "inStock" = false) as oos_count,
        MAX("recomputedAt") as max_recomputed,
        MIN("recomputedAt") as min_recomputed
      FROM current_visible_prices
    `;

    const row = rows[0];
    if (!row) return null;

    const total = Number(row.total);
    const staleCount = Number(row.stale_count);

    return {
      total,
      staleCount,
      stalePercentage: total > 0 ? Math.round((staleCount / total) * 1000) / 10 : 0,
      inStockCount: Number(row.in_stock_count),
      oosCount: Number(row.oos_count),
      maxRecomputedAt: row.max_recomputed,
      minRecomputedAt: row.min_recomputed,
    };
  } catch (error) {
    loggers.admin.error('Dashboard: CVP summary query failed', {}, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

async function fetchCvpByRetailer(): Promise<CvpByRetailer[] | null> {
  try {
    const rows = await prisma.$queryRaw<
      { retailer_name: string; total: bigint; in_stock: bigint }[]
    >`
      SELECT
        "retailerName" as retailer_name,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE "inStock" = true) as in_stock
      FROM current_visible_prices
      GROUP BY "retailerName"
      ORDER BY total DESC
    `;

    return rows.map((r) => {
      const total = Number(r.total);
      const inStockCount = Number(r.in_stock);
      return {
        retailerName: r.retailer_name,
        total,
        inStockCount,
        inStockPercentage: total > 0 ? Math.round((inStockCount / total) * 1000) / 10 : 0,
      };
    });
  } catch (error) {
    loggers.admin.error('Dashboard: CVP by retailer query failed', {}, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

async function fetchCvpByIngestionType(): Promise<CvpByIngestionType[] | null> {
  try {
    const rows = await prisma.$queryRaw<
      { ingestion_type: string | null; count: bigint }[]
    >`
      SELECT
        "ingestionRunType"::text as ingestion_type,
        COUNT(*) as count
      FROM current_visible_prices
      GROUP BY "ingestionRunType"
      ORDER BY count DESC
    `;

    return rows.map((r) => ({
      ingestionRunType: r.ingestion_type ?? 'UNKNOWN',
      count: Number(r.count),
    }));
  } catch (error) {
    loggers.admin.error('Dashboard: CVP by ingestion type query failed', {}, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

async function fetchGuardrailAudit(): Promise<GuardrailAuditRow[] | null> {
  try {
    const rows = await prisma.$queryRaw<
      {
        source_id: string;
        source_name: string;
        robots_compliant: boolean;
        tos_reviewed: boolean;
        tos_approved: boolean;
        adapter_enabled: boolean | null;
        cvp_rows: bigint;
        scrape_enabled: boolean;
        last_run_at: Date | null;
        recent_offers: bigint;
      }[]
    >`
      SELECT
        s.id as source_id,
        s.name as source_name,
        s."robotsCompliant" as robots_compliant,
        (s."tosReviewedAt" IS NOT NULL) as tos_reviewed,
        (s."tosApprovedBy" IS NOT NULL) as tos_approved,
        sas.enabled as adapter_enabled,
        COALESCE(cvp_counts.row_count, 0) as cvp_rows,
        s."scrapeEnabled" as scrape_enabled,
        sr_latest."lastRunAt" as last_run_at,
        COALESCE(sr_recent.recent_offers, 0) as recent_offers
      FROM sources s
      LEFT JOIN scrape_adapter_status sas ON sas."adapterId" = s."adapterId"
      LEFT JOIN LATERAL (
        SELECT COUNT(*) as row_count
        FROM current_visible_prices cvp
        WHERE cvp."sourceId" = s.id
      ) cvp_counts ON true
      LEFT JOIN LATERAL (
        SELECT MAX("startedAt") as "lastRunAt"
        FROM scrape_runs sr
        WHERE sr."sourceId" = s.id
      ) sr_latest ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM("offersValid"), 0) as recent_offers
        FROM scrape_runs sr
        WHERE sr."sourceId" = s.id
          AND sr."startedAt" > NOW() - INTERVAL '24 hours'
      ) sr_recent ON true
      WHERE s."adapterId" IS NOT NULL
      ORDER BY s.name
    `;

    return rows.map((r) => ({
      sourceId: r.source_id,
      sourceName: r.source_name,
      robotsCompliant: r.robots_compliant,
      tosReviewed: r.tos_reviewed,
      tosApproved: r.tos_approved,
      adapterEnabled: r.adapter_enabled,
      cvpRows: Number(r.cvp_rows),
      scrapeEnabled: r.scrape_enabled,
      lastRunAt: r.last_run_at,
      recentOffers: Number(r.recent_offers),
    }));
  } catch (error) {
    loggers.admin.error('Dashboard: guardrail audit query failed', {}, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

async function fetchProductCoverage(): Promise<ProductCoverage | null> {
  try {
    const [totalResult, linkStats, orphanResult] = await Promise.all([
      // Total products
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count FROM products
      `,
      // Product link status distribution + distinct linked products
      prisma.$queryRaw<
        { status: string; count: bigint; linked_products: bigint }[]
      >`
        SELECT
          status::text,
          COUNT(*) as count,
          COUNT(DISTINCT "productId") FILTER (WHERE "productId" IS NOT NULL) as linked_products
        FROM product_links
        GROUP BY status
      `,
      // Orphan products: no product_links with MATCHED or CREATED status
      // Exclude superseded products and products created < 1 hour ago
      prisma.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(*) as count
        FROM products p
        WHERE p."supersededById" IS NULL
          AND p."createdAt" < NOW() - INTERVAL '1 hour'
          AND NOT EXISTS (
            SELECT 1 FROM product_links pl
            WHERE pl."productId" = p.id
              AND pl.status IN ('MATCHED', 'CREATED')
          )
      `,
    ]);

    const totalProducts = Number(totalResult[0]?.count ?? 0);
    const orphanProducts = Number(orphanResult[0]?.count ?? 0);

    // Sum distinct linked products across MATCHED and CREATED statuses
    let productsWithLinks = 0;
    const statusDistribution: { status: string; count: number }[] = [];

    for (const row of linkStats) {
      statusDistribution.push({
        status: row.status,
        count: Number(row.count),
      });
      if (row.status === 'MATCHED' || row.status === 'CREATED') {
        productsWithLinks += Number(row.linked_products);
      }
    }

    return {
      totalProducts,
      productsWithLinks,
      orphanProducts,
      statusDistribution,
    };
  } catch (error) {
    loggers.admin.error('Dashboard: product coverage query failed', {}, error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

// =============================================================================
// Status Derivation
// =============================================================================

function deriveOverallStatus(params: {
  affiliate: AffiliatePipelineMetrics | null;
  scrape: ScrapePipelineMetrics | null;
  recompute: RecomputeMetrics | null;
  cvpSummary: CvpSummary | null;
  guardrailAudit: GuardrailAuditRow[] | null;
}): OverallStatus {
  const { affiliate, scrape, recompute, cvpSummary, guardrailAudit } = params;

  // Error conditions
  const stuckRuns = (affiliate?.stuckCount ?? 0) + (scrape?.stuckCount ?? 0);
  if (stuckRuns > 0) return 'error';

  // CVP empty with recent ingestion activity
  if (cvpSummary && cvpSummary.total === 0) {
    const hasRecentActivity =
      (affiliate && (affiliate.succeeded > 0 || affiliate.running > 0)) ||
      (scrape && (scrape.success > 0 || scrape.running > 0));
    if (hasRecentActivity) return 'error';
  }

  // Warning conditions
  if (recompute && recompute.stalePercentage > 10) return 'warning';

  if (scrape && scrape.totalRuns > 0) {
    const failureRate = scrape.failed / scrape.totalRuns;
    if (failureRate > 0.5) return 'warning';
  }

  // Guardrail anomaly: all flags true + CVP=0 + recent offers > 0
  if (guardrailAudit) {
    const hasAnomaly = guardrailAudit.some(
      (row) =>
        row.robotsCompliant &&
        row.tosReviewed &&
        row.tosApproved &&
        row.adapterEnabled === true &&
        row.cvpRows === 0 &&
        row.recentOffers > 0
    );
    if (hasAnomaly) return 'warning';
  }

  return 'ok';
}
