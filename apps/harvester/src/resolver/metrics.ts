/**
 * Product Resolver Metrics (Spec v1.2 Appendix B)
 *
 * In-memory metrics collection for the Product Resolver.
 * Designed for export to Prometheus, StatsD, or other backends.
 *
 * Metrics:
 * - resolver_requests_total: Counter by source_kind
 * - resolver_decisions_total: Counter by source_kind, status
 * - resolver_failure_total: Counter by source_kind, reason_code (ERROR only)
 * - resolver_latency_ms: Histogram
 *
 * Label constraints:
 * - source_kind: SourceKind enum (DIRECT, AFFILIATE_FEED, OTHER)
 * - status: ProductLinkStatus enum (MATCHED, CREATED, UNMATCHED, ERROR)
 * - reason_code: ProductLinkReasonCode enum (bounded, only for ERROR status)
 *
 * No high-cardinality labels (no sourceProductId, productId, etc.)
 */

import type { SourceKind, ProductLinkStatus, ProductLinkReasonCode } from '@ironscout/db/generated/prisma'

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export type SourceKindLabel = SourceKind | 'UNKNOWN'
export type StatusLabel = ProductLinkStatus
export type ReasonCodeLabel = ProductLinkReasonCode | 'NONE'

// Match path types for identity-key metrics
export type MatchPathLabel = 'IDENTITY_KEY' | 'IDENTITY_KEY_SHOTGUN' | 'FUZZY' | 'UPC' | 'NONE'
export type MatchPathOutcome = 'MATCHED' | 'CREATED' | 'FALLTHROUGH'

// Missing field types for tracking extraction failures
export type MissingFieldLabel = 'brandNorm' | 'caliberNorm' | 'grain' | 'packCount' | 'titleSignature' | 'loadType' | 'shellLength'

export interface ResolverMetricsSnapshot {
  requests: Record<SourceKindLabel, number>
  decisions: Record<SourceKindLabel, Record<StatusLabel, number>>
  failures: Record<SourceKindLabel, Record<ReasonCodeLabel, number>>
  latency: {
    count: number
    sum: number
    buckets: Record<number, number> // bucket threshold -> count
  }
  // Identity-key metrics
  matchPath: Record<MatchPathLabel, Record<MatchPathOutcome, number>>
  missingFields: Record<MissingFieldLabel, number>
}

// ═══════════════════════════════════════════════════════════════════════════════
// Histogram buckets (milliseconds)
// ═══════════════════════════════════════════════════════════════════════════════

const LATENCY_BUCKETS = [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000]

// ═══════════════════════════════════════════════════════════════════════════════
// In-memory storage
// ═══════════════════════════════════════════════════════════════════════════════

const requests: Map<SourceKindLabel, number> = new Map()
const decisions: Map<string, number> = new Map() // key: `${sourceKind}:${status}`
const failures: Map<string, number> = new Map() // key: `${sourceKind}:${reasonCode}`
const latency = {
  count: 0,
  sum: 0,
  buckets: new Map<number, number>(),
}

// Identity-key path metrics
const matchPath: Map<string, number> = new Map() // key: `${path}:${outcome}`
const missingFields: Map<MissingFieldLabel, number> = new Map()

// Initialize buckets
for (const bucket of LATENCY_BUCKETS) {
  latency.buckets.set(bucket, 0)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Metric recording functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Increment resolver_requests_total
 * Call at job start
 */
export function recordRequest(sourceKind: SourceKindLabel): void {
  const current = requests.get(sourceKind) ?? 0
  requests.set(sourceKind, current + 1)
}

/**
 * Increment resolver_decisions_total
 * Call at job completion
 */
export function recordDecision(sourceKind: SourceKindLabel, status: StatusLabel): void {
  const key = `${sourceKind}:${status}`
  const current = decisions.get(key) ?? 0
  decisions.set(key, current + 1)
}

/**
 * Increment resolver_failure_total
 * Call only for ERROR status with reason_code
 */
export function recordFailure(sourceKind: SourceKindLabel, reasonCode: ReasonCodeLabel): void {
  const key = `${sourceKind}:${reasonCode}`
  const current = failures.get(key) ?? 0
  failures.set(key, current + 1)
}

/**
 * Record resolver_latency_ms
 * Call at job completion with duration
 */
export function recordLatency(durationMs: number): void {
  latency.count++
  latency.sum += durationMs

  // Update histogram buckets (cumulative)
  for (const bucket of LATENCY_BUCKETS) {
    if (durationMs <= bucket) {
      const current = latency.buckets.get(bucket) ?? 0
      latency.buckets.set(bucket, current + 1)
    }
  }
}

/**
 * Record resolver match path
 * Tracks identity-key vs fuzzy vs UPC resolution paths
 */
export function recordMatchPath(path: MatchPathLabel, outcome: MatchPathOutcome): void {
  const key = `${path}:${outcome}`
  const current = matchPath.get(key) ?? 0
  matchPath.set(key, current + 1)
}

/**
 * Record a missing field
 * Tracks which fields are most commonly missing during normalization
 */
export function recordMissingField(field: MissingFieldLabel): void {
  const current = missingFields.get(field) ?? 0
  missingFields.set(field, current + 1)
}

/**
 * Record multiple missing fields at once
 */
export function recordMissingFields(fields: MissingFieldLabel[]): void {
  for (const field of fields) {
    recordMissingField(field)
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Convenience function for full job recording
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Record all metrics for a completed resolver job
 */
export function recordResolverJob(params: {
  sourceKind: SourceKindLabel
  status: StatusLabel
  reasonCode?: ReasonCodeLabel
  durationMs: number
}): void {
  const { sourceKind, status, reasonCode, durationMs } = params

  // Decision is always recorded
  recordDecision(sourceKind, status)

  // Failure is only recorded for ERROR status
  if (status === 'ERROR' && reasonCode) {
    recordFailure(sourceKind, reasonCode)
  }

  // Latency is always recorded
  recordLatency(durationMs)
}

// ═══════════════════════════════════════════════════════════════════════════════
// Export / snapshot functions
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get current metrics snapshot
 * For export to Prometheus/StatsD/etc.
 */
export function getMetricsSnapshot(): ResolverMetricsSnapshot {
  const snapshot: ResolverMetricsSnapshot = {
    requests: {} as Record<SourceKindLabel, number>,
    decisions: {} as Record<SourceKindLabel, Record<StatusLabel, number>>,
    failures: {} as Record<SourceKindLabel, Record<ReasonCodeLabel, number>>,
    latency: {
      count: latency.count,
      sum: latency.sum,
      buckets: {} as Record<number, number>,
    },
    matchPath: {} as Record<MatchPathLabel, Record<MatchPathOutcome, number>>,
    missingFields: {} as Record<MissingFieldLabel, number>,
  }

  // Requests
  for (const [kind, count] of requests) {
    snapshot.requests[kind] = count
  }

  // Decisions
  for (const [key, count] of decisions) {
    const [kind, status] = key.split(':') as [SourceKindLabel, StatusLabel]
    if (!snapshot.decisions[kind]) {
      snapshot.decisions[kind] = {} as Record<StatusLabel, number>
    }
    snapshot.decisions[kind][status] = count
  }

  // Failures
  for (const [key, count] of failures) {
    const [kind, reasonCode] = key.split(':') as [SourceKindLabel, ReasonCodeLabel]
    if (!snapshot.failures[kind]) {
      snapshot.failures[kind] = {} as Record<ReasonCodeLabel, number>
    }
    snapshot.failures[kind][reasonCode] = count
  }

  // Latency buckets
  for (const [bucket, count] of latency.buckets) {
    snapshot.latency.buckets[bucket] = count
  }

  // Match path
  for (const [key, count] of matchPath) {
    const [path, outcome] = key.split(':') as [MatchPathLabel, MatchPathOutcome]
    if (!snapshot.matchPath[path]) {
      snapshot.matchPath[path] = {} as Record<MatchPathOutcome, number>
    }
    snapshot.matchPath[path][outcome] = count
  }

  // Missing fields
  for (const [field, count] of missingFields) {
    snapshot.missingFields[field] = count
  }

  return snapshot
}

/**
 * Get metrics in Prometheus exposition format
 */
export function getPrometheusMetrics(): string {
  const lines: string[] = []

  // resolver_requests_total
  lines.push('# HELP resolver_requests_total Total resolver job requests')
  lines.push('# TYPE resolver_requests_total counter')
  for (const [kind, count] of requests) {
    lines.push(`resolver_requests_total{source_kind="${kind}"} ${count}`)
  }

  // resolver_decisions_total
  lines.push('# HELP resolver_decisions_total Total resolver decisions by outcome')
  lines.push('# TYPE resolver_decisions_total counter')
  for (const [key, count] of decisions) {
    const [kind, status] = key.split(':')
    lines.push(`resolver_decisions_total{source_kind="${kind}",status="${status}"} ${count}`)
  }

  // resolver_failure_total
  lines.push('# HELP resolver_failure_total Total resolver failures by reason')
  lines.push('# TYPE resolver_failure_total counter')
  for (const [key, count] of failures) {
    const [kind, reasonCode] = key.split(':')
    lines.push(`resolver_failure_total{source_kind="${kind}",reason_code="${reasonCode}"} ${count}`)
  }

  // resolver_latency_ms
  lines.push('# HELP resolver_latency_ms Resolver job latency in milliseconds')
  lines.push('# TYPE resolver_latency_ms histogram')
  for (const [bucket, count] of latency.buckets) {
    lines.push(`resolver_latency_ms_bucket{le="${bucket}"} ${count}`)
  }
  lines.push(`resolver_latency_ms_bucket{le="+Inf"} ${latency.count}`)
  lines.push(`resolver_latency_ms_sum ${latency.sum}`)
  lines.push(`resolver_latency_ms_count ${latency.count}`)

  // resolver_match_path_total
  lines.push('# HELP resolver_match_path_total Total resolver resolutions by match path')
  lines.push('# TYPE resolver_match_path_total counter')
  for (const [key, count] of matchPath) {
    const [path, outcome] = key.split(':')
    lines.push(`resolver_match_path_total{path="${path}",outcome="${outcome}"} ${count}`)
  }

  // resolver_missing_field_total
  lines.push('# HELP resolver_missing_field_total Total missing fields during normalization')
  lines.push('# TYPE resolver_missing_field_total counter')
  for (const [field, count] of missingFields) {
    lines.push(`resolver_missing_field_total{field="${field}"} ${count}`)
  }

  return lines.join('\n')
}

// ═══════════════════════════════════════════════════════════════════════════════
// Reset function (for testing)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Reset all metrics (for testing only)
 */
export function resetMetrics(): void {
  requests.clear()
  decisions.clear()
  failures.clear()
  latency.count = 0
  latency.sum = 0
  for (const bucket of LATENCY_BUCKETS) {
    latency.buckets.set(bucket, 0)
  }
  matchPath.clear()
  missingFields.clear()
}

// ═══════════════════════════════════════════════════════════════════════════════
// Derived metrics helpers
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate latency percentile from histogram
 * Approximate using bucket boundaries
 */
export function getLatencyPercentile(percentile: number): number {
  if (latency.count === 0) return 0

  const targetCount = Math.ceil(latency.count * (percentile / 100))
  let cumulative = 0

  const sortedBuckets = [...latency.buckets.entries()].sort((a, b) => a[0] - b[0])

  for (const [bucket, count] of sortedBuckets) {
    cumulative += count
    if (cumulative >= targetCount) {
      return bucket
    }
  }

  return sortedBuckets[sortedBuckets.length - 1]?.[0] ?? 0
}

/**
 * Calculate failure rate
 */
export function getFailureRate(): number {
  let totalDecisions = 0
  let errorDecisions = 0

  for (const [key, count] of decisions) {
    totalDecisions += count
    if (key.endsWith(':ERROR')) {
      errorDecisions += count
    }
  }

  return totalDecisions > 0 ? errorDecisions / totalDecisions : 0
}

/**
 * Calculate match rate (MATCHED + CREATED) / total
 */
export function getMatchRate(): number {
  let totalDecisions = 0
  let matchedDecisions = 0

  for (const [key, count] of decisions) {
    totalDecisions += count
    if (key.endsWith(':MATCHED') || key.endsWith(':CREATED')) {
      matchedDecisions += count
    }
  }

  return totalDecisions > 0 ? matchedDecisions / totalDecisions : 0
}

/**
 * Get identity-key resolution rate
 * (identity-key matched + created) / total fingerprint resolutions
 */
export function getIdentityKeyRate(): number {
  let identityKeyTotal = 0
  let fuzzyTotal = 0

  for (const [key, count] of matchPath) {
    if (key.startsWith('IDENTITY_KEY:') || key.startsWith('IDENTITY_KEY_SHOTGUN:')) {
      if (!key.endsWith(':FALLTHROUGH')) {
        identityKeyTotal += count
      }
    } else if (key.startsWith('FUZZY:')) {
      fuzzyTotal += count
    }
  }

  const total = identityKeyTotal + fuzzyTotal
  return total > 0 ? identityKeyTotal / total : 0
}

/**
 * Get match path summary for display
 */
export function getMatchPathSummary(): {
  identityKey: { matched: number; created: number; fallthrough: number }
  identityKeyShotgun: { matched: number; created: number; fallthrough: number }
  fuzzy: { matched: number; created: number }
  upc: { matched: number; created: number }
  none: { matched: number }
} {
  const summary = {
    identityKey: { matched: 0, created: 0, fallthrough: 0 },
    identityKeyShotgun: { matched: 0, created: 0, fallthrough: 0 },
    fuzzy: { matched: 0, created: 0 },
    upc: { matched: 0, created: 0 },
    none: { matched: 0 },
  }

  for (const [key, count] of matchPath) {
    const [path, outcome] = key.split(':') as [MatchPathLabel, MatchPathOutcome]
    switch (path) {
      case 'IDENTITY_KEY':
        if (outcome === 'MATCHED') summary.identityKey.matched += count
        else if (outcome === 'CREATED') summary.identityKey.created += count
        else if (outcome === 'FALLTHROUGH') summary.identityKey.fallthrough += count
        break
      case 'IDENTITY_KEY_SHOTGUN':
        if (outcome === 'MATCHED') summary.identityKeyShotgun.matched += count
        else if (outcome === 'CREATED') summary.identityKeyShotgun.created += count
        else if (outcome === 'FALLTHROUGH') summary.identityKeyShotgun.fallthrough += count
        break
      case 'FUZZY':
        if (outcome === 'MATCHED') summary.fuzzy.matched += count
        else if (outcome === 'CREATED') summary.fuzzy.created += count
        break
      case 'UPC':
        if (outcome === 'MATCHED') summary.upc.matched += count
        else if (outcome === 'CREATED') summary.upc.created += count
        break
      case 'NONE':
        summary.none.matched += count
        break
    }
  }

  return summary
}

/**
 * Get top missing fields sorted by count
 */
export function getTopMissingFields(limit = 10): Array<{ field: MissingFieldLabel; count: number }> {
  const entries = [...missingFields.entries()]
    .map(([field, count]) => ({ field, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
  return entries
}
