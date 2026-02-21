'use server'

/**
 * Scraper Management Server Actions
 *
 * Per scraper-framework-01 spec v0.5 Phase 3
 *
 * CRUD operations for scrape_targets, scrape_runs, and adapter management.
 */

import { prisma, Prisma } from '@ironscout/db'
import { revalidatePath } from 'next/cache'
import { getAdminSession, logAdminAction } from '@/lib/auth'
import { loggers } from '@/lib/logger'
import { resolveSourceAdapterId } from '@/lib/scraper-adapter-status'
import { KNOWN_ADAPTERS } from '@/lib/scraper-constants'
import { createRedisClient } from '@ironscout/redis'
import CronParser from 'cron-parser'

const log = loggers.admin

const DEFAULT_ADAPTER_CRON_SCHEDULE = '0 0,4,8,12,16,20 * * *'

function computeNextAdapterRunAt(schedule: string | null, now: Date = new Date()): Date | null {
  const cronExpr = schedule || DEFAULT_ADAPTER_CRON_SCHEDULE
  try {
    const interval = CronParser.parse(cronExpr, {
      currentDate: now,
      tz: 'UTC',
    })
    return interval.next().toDate()
  } catch (error) {
    log.warn('Invalid adapter cron schedule; next run time unavailable', {
      schedule: cronExpr,
      error: (error as Error).message,
    })
    return null
  }
}

// =============================================================================
// URL Canonicalization (per scraper-framework-01 Appendix A)
// =============================================================================

/**
 * Tracking parameters to remove from URLs.
 * Per Appendix A: Remove marketing/analytics parameters.
 */
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'fbclid',
  'gclid',
  'ref',
  'source',
  'campaign',
])

/**
 * Canonicalize a URL for deduplication.
 * Per scraper-framework-01 Appendix A:
 * 1. Enforce https
 * 2. Remove tracking parameters
 * 3. Remove fragment identifiers
 * 4. Lowercase hostname
 * 5. Remove trailing slash (except root)
 * 6. Remove empty query parameters
 * 7. Sort query parameters alphabetically
 */
function canonicalizeUrl(url: string): string {
  const parsed = new URL(url)

  // 1. Enforce https
  parsed.protocol = 'https:'

  // 2. Lowercase hostname
  parsed.hostname = parsed.hostname.toLowerCase()

  // 3. Remove tracking params
  for (const param of TRACKING_PARAMS) {
    parsed.searchParams.delete(param)
  }

  // Also remove any utm_* params not in our explicit list
  const keysToDelete: string[] = []
  for (const key of parsed.searchParams.keys()) {
    if (key.startsWith('utm_')) {
      keysToDelete.push(key)
    }
  }
  for (const key of keysToDelete) {
    parsed.searchParams.delete(key)
  }

  // 4. Remove empty query parameters
  const emptyKeys: string[] = []
  for (const [key, value] of parsed.searchParams.entries()) {
    if (value === '') {
      emptyKeys.push(key)
    }
  }
  for (const key of emptyKeys) {
    parsed.searchParams.delete(key)
  }

  // 5. Sort remaining params alphabetically
  parsed.searchParams.sort()

  // 6. Remove fragment
  parsed.hash = ''

  // 7. Remove trailing slash (except root)
  if (parsed.pathname !== '/' && parsed.pathname.endsWith('/')) {
    parsed.pathname = parsed.pathname.slice(0, -1)
  }

  return parsed.toString()
}

// =============================================================================
// Types
// =============================================================================

export interface ScrapeTargetDTO {
  id: string
  url: string
  canonicalUrl: string
  sourceId: string
  sourceName: string
  adapterId: string
  adapterEnabled: boolean
  status: string
  enabled: boolean
  priority: number
  schedule: string | null
  lastScrapedAt: Date | null
  lastStatus: string | null
  consecutiveFailures: number
  createdAt: Date
}

export interface ScrapeRunDTO {
  id: string
  adapterId: string
  adapterVersion: string
  sourceId: string
  retailerId: string
  trigger: string
  status: string
  startedAt: Date
  completedAt: Date | null
  durationMs: number | null
  urlsAttempted: number
  urlsSucceeded: number
  urlsFailed: number
  offersExtracted: number
  offersValid: number
  offersDropped: number
  offersQuarantined: number
  failureRate: number | null
  yieldRate: number | null
}

export interface AdapterStatusDTO {
  adapterId: string
  enabled: boolean
  ingestionPaused: boolean
  ingestionPausedAt: Date | null
  ingestionPausedReason: string | null
  ingestionPausedBy: string | null
  lastRunAt: Date | null
  nextRunAt: Date | null
  consecutiveFailedBatches: number
  disabledAt: Date | null
  disabledReason: string | null
  totalRuns: number
  successRate: number | null
  schedule: string | null
}

export interface CreateTargetInput {
  url: string
  sourceId: string
  adapterId: string
  priority?: number
  enabled?: boolean
}

// =============================================================================
// Validation
// =============================================================================

function validateUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return 'URL must use http or https protocol'
    }
    return null
  } catch {
    return 'Invalid URL format'
  }
}

function validateCreateInput(data: CreateTargetInput): string | null {
  if (!data.url?.trim()) return 'URL is required'
  const urlError = validateUrl(data.url)
  if (urlError) return urlError
  if (!data.sourceId?.trim()) return 'Source is required'
  if (!data.adapterId?.trim()) return 'Adapter is required'
  if (data.priority !== undefined && (data.priority < 0 || data.priority > 100)) {
    return 'Priority must be between 0 and 100'
  }
  return null
}

// =============================================================================
// Scrape Targets
// =============================================================================

export async function listScrapeTargets(options?: {
  status?: string
  adapterId?: string
  sourceId?: string
  search?: string
  enabledOnly?: boolean
  disabledOnly?: boolean
  limit?: number
  offset?: number
}): Promise<{ success: boolean; error?: string; targets: ScrapeTargetDTO[]; total: number }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized', targets: [], total: 0 }

  try {
    const where: Prisma.scrape_targetsWhereInput = {}

    if (options?.status) {
      where.status = options.status as Prisma.EnumScrapeTargetStatusFilter
    }
    if (options?.adapterId) {
      where.adapterId = options.adapterId
    }
    if (options?.sourceId) {
      where.sourceId = options.sourceId
    }
    if (options?.enabledOnly) {
      where.enabled = true
    }
    if (options?.disabledOnly) {
      where.enabled = false
    }
    if (options?.search) {
      const searchTerm = options.search.trim()
      where.OR = [
        { url: { contains: searchTerm, mode: 'insensitive' } },
        { canonicalUrl: { contains: searchTerm, mode: 'insensitive' } },
        { sources: { name: { contains: searchTerm, mode: 'insensitive' } } },
      ]
    }

    const [targets, total] = await Promise.all([
      prisma.scrape_targets.findMany({
        where,
        include: {
          sources: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: [{ status: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
        take: options?.limit ?? 50,
        skip: options?.offset ?? 0,
      }),
      prisma.scrape_targets.count({ where }),
    ])

    // Get adapter enabled status for all unique adapters in the results
    const adapterIds = [...new Set(targets.map((t) => t.adapterId))]
    const adapterStatuses = await prisma.scrape_adapter_status.findMany({
      where: { adapterId: { in: adapterIds } },
      select: { adapterId: true, enabled: true },
    })
    const adapterEnabledMap = new Map(adapterStatuses.map((a) => [a.adapterId, a.enabled]))

    const dtos: ScrapeTargetDTO[] = targets.map((t) => ({
      id: t.id,
      url: t.url,
      canonicalUrl: t.canonicalUrl,
      sourceId: t.sourceId,
      sourceName: t.sources.name,
      adapterId: t.adapterId,
      adapterEnabled: adapterEnabledMap.get(t.adapterId) ?? true, // Default to true if no status record
      status: t.status,
      enabled: t.enabled,
      priority: t.priority,
      schedule: t.schedule,
      lastScrapedAt: t.lastScrapedAt,
      lastStatus: t.lastStatus,
      consecutiveFailures: t.consecutiveFailures,
      createdAt: t.createdAt,
    }))

    return { success: true, targets: dtos, total }
  } catch (error) {
    log.error('Failed to list scrape targets', {}, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to list targets', targets: [], total: 0 }
  }
}

export async function getScrapeTarget(id: string): Promise<{ success: boolean; error?: string; target?: ScrapeTargetDTO }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    const target = await prisma.scrape_targets.findUnique({
      where: { id },
      include: {
        sources: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    if (!target) {
      return { success: false, error: 'Target not found' }
    }

    // Get adapter enabled status
    const adapterStatus = await prisma.scrape_adapter_status.findUnique({
      where: { adapterId: target.adapterId },
      select: { enabled: true },
    })

    return {
      success: true,
      target: {
        id: target.id,
        url: target.url,
        canonicalUrl: target.canonicalUrl,
        sourceId: target.sourceId,
        sourceName: target.sources.name,
        adapterId: target.adapterId,
        adapterEnabled: adapterStatus?.enabled ?? true,
        status: target.status,
        enabled: target.enabled,
        priority: target.priority,
        schedule: target.schedule,
        lastScrapedAt: target.lastScrapedAt,
        lastStatus: target.lastStatus,
        consecutiveFailures: target.consecutiveFailures,
        createdAt: target.createdAt,
      },
    }
  } catch (error) {
    log.error('Failed to get scrape target', { id }, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to get target' }
  }
}

export async function createScrapeTarget(data: CreateTargetInput): Promise<{ success: boolean; error?: string; targetId?: string }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  const validationError = validateCreateInput(data)
  if (validationError) return { success: false, error: validationError }

  try {
    // Canonicalize URL per scraper-framework-01 Appendix A
    const canonicalUrl = canonicalizeUrl(data.url.trim())

    // Check for duplicate
    const existing = await prisma.scrape_targets.findFirst({
      where: {
        sourceId: data.sourceId,
        canonicalUrl,
      },
    })

    if (existing) {
      return { success: false, error: 'A target with this URL already exists for this source' }
    }

    // Verify source exists and has matching adapter
    const source = await prisma.sources.findUnique({
      where: { id: data.sourceId },
      select: { id: true, adapterId: true, scrapeEnabled: true },
    })

    if (!source) {
      return { success: false, error: 'Source not found' }
    }

    if (source.adapterId && source.adapterId !== data.adapterId) {
      return { success: false, error: `Source adapter (${source.adapterId}) does not match provided adapter (${data.adapterId})` }
    }

    const target = await prisma.scrape_targets.create({
      data: {
        url: data.url.trim(),
        canonicalUrl,
        sourceId: data.sourceId,
        adapterId: data.adapterId,
        priority: data.priority ?? 0,
        enabled: data.enabled ?? true,
        status: 'ACTIVE',
      },
    })

    await logAdminAction(session.userId, 'CREATE_SCRAPE_TARGET', {
      resource: 'ScrapeTarget',
      resourceId: target.id,
      newValue: { url: data.url, sourceId: data.sourceId, adapterId: data.adapterId },
    })

    revalidatePath('/scrapers')
    return { success: true, targetId: target.id }
  } catch (error) {
    log.error('Failed to create scrape target', { data }, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to create target' }
  }
}

// =============================================================================
// Bulk Import
// =============================================================================

export interface BulkCreateResult {
  success: boolean
  created: number
  skipped: number
  errors: Array<{ row: number; url: string; error: string }>
}

export async function bulkCreateScrapeTargets(
  rows: Array<{ url: string; adapterId: string; priority?: number }>,
  sourceId: string
): Promise<BulkCreateResult> {
  const session = await getAdminSession()
  if (!session) return { success: false, created: 0, skipped: 0, errors: [{ row: 0, url: '', error: 'Unauthorized' }] }

  if (!sourceId?.trim()) {
    return { success: false, created: 0, skipped: 0, errors: [{ row: 0, url: '', error: 'Source is required' }] }
  }

  if (!rows || rows.length === 0) {
    return { success: false, created: 0, skipped: 0, errors: [{ row: 0, url: '', error: 'No rows provided' }] }
  }

  try {
    // Verify source exists
    const source = await prisma.sources.findUnique({
      where: { id: sourceId },
      select: { id: true, adapterId: true, scrapeEnabled: true },
    })

    if (!source) {
      return { success: false, created: 0, skipped: 0, errors: [{ row: 0, url: '', error: 'Source not found' }] }
    }

    // Validate and prepare rows
    const validRows: Array<{
      url: string
      canonicalUrl: string
      sourceId: string
      adapterId: string
      priority: number
      enabled: boolean
      status: 'ACTIVE'
    }> = []
    const errors: Array<{ row: number; url: string; error: string }> = []
    const canonicalsSeen = new Set<string>()

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!
      const rowNum = i + 1 // 1-indexed for user display

      // Validate URL
      const urlError = validateUrl(row.url?.trim())
      if (urlError) {
        errors.push({ row: rowNum, url: row.url, error: urlError })
        continue
      }

      // Validate adapter matches source
      if (source.adapterId && row.adapterId !== source.adapterId) {
        errors.push({
          row: rowNum,
          url: row.url,
          error: `Adapter "${row.adapterId}" does not match source adapter "${source.adapterId}"`,
        })
        continue
      }

      // Validate priority
      const priority = row.priority ?? 0
      if (priority < 0 || priority > 100) {
        errors.push({ row: rowNum, url: row.url, error: 'Priority must be between 0 and 100' })
        continue
      }

      // Canonicalize
      let canonical: string
      try {
        canonical = canonicalizeUrl(row.url.trim())
      } catch {
        errors.push({ row: rowNum, url: row.url, error: 'Failed to canonicalize URL' })
        continue
      }

      // Deduplicate within the batch
      if (canonicalsSeen.has(canonical)) {
        continue // silently skip in-batch duplicates
      }
      canonicalsSeen.add(canonical)

      validRows.push({
        url: row.url.trim(),
        canonicalUrl: canonical,
        sourceId,
        adapterId: row.adapterId,
        priority,
        enabled: true,
        status: 'ACTIVE',
      })
    }

    if (validRows.length === 0) {
      return { success: true, created: 0, skipped: 0, errors }
    }

    // Check for existing targets to count skipped
    const existingTargets = await prisma.scrape_targets.findMany({
      where: {
        sourceId,
        canonicalUrl: { in: validRows.map((r) => r.canonicalUrl) },
      },
      select: { canonicalUrl: true },
    })
    const existingCanonicals = new Set(existingTargets.map((t) => t.canonicalUrl))
    const skipped = validRows.filter((r) => existingCanonicals.has(r.canonicalUrl)).length

    // Bulk insert, skip duplicates
    const result = await prisma.scrape_targets.createMany({
      data: validRows,
      skipDuplicates: true,
    })

    await logAdminAction(session.userId, 'BULK_CREATE_SCRAPE_TARGETS', {
      resource: 'ScrapeTarget',
      newValue: {
        sourceId,
        totalRows: rows.length,
        created: result.count,
        skipped,
        errors: errors.length,
      },
    })

    revalidatePath('/scrapers')
    return { success: true, created: result.count, skipped, errors }
  } catch (error) {
    log.error('Failed to bulk create scrape targets', { sourceId, rowCount: rows.length }, error instanceof Error ? error : new Error(String(error)))
    return { success: false, created: 0, skipped: 0, errors: [{ row: 0, url: '', error: 'Failed to create targets' }] }
  }
}

export async function updateScrapeTarget(
  id: string,
  data: { priority?: number; schedule?: string | null; enabled?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    const existing = await prisma.scrape_targets.findUnique({
      where: { id },
      select: { id: true, priority: true, schedule: true, enabled: true },
    })

    if (!existing) {
      return { success: false, error: 'Target not found' }
    }

    await prisma.scrape_targets.update({
      where: { id },
      data: {
        priority: data.priority ?? existing.priority,
        schedule: data.schedule !== undefined ? data.schedule : existing.schedule,
        enabled: data.enabled ?? existing.enabled,
        updatedAt: new Date(),
      },
    })

    await logAdminAction(session.userId, 'UPDATE_SCRAPE_TARGET', {
      resource: 'ScrapeTarget',
      resourceId: id,
      oldValue: { priority: existing.priority, schedule: existing.schedule, enabled: existing.enabled },
      newValue: data,
    })

    revalidatePath('/scrapers')
    revalidatePath(`/scrapers/targets/${id}`)
    return { success: true }
  } catch (error) {
    log.error('Failed to update scrape target', { id, data }, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to update target' }
  }
}

export async function pauseScrapeTarget(id: string): Promise<{ success: boolean; error?: string }> {
  return updateScrapeTarget(id, { enabled: false })
}

export async function resumeScrapeTarget(id: string): Promise<{ success: boolean; error?: string }> {
  return updateScrapeTarget(id, { enabled: true })
}

export async function deleteScrapeTarget(id: string): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    const existing = await prisma.scrape_targets.findUnique({
      where: { id },
      select: { id: true, url: true, sourceId: true },
    })

    if (!existing) {
      return { success: false, error: 'Target not found' }
    }

    await prisma.scrape_targets.delete({
      where: { id },
    })

    await logAdminAction(session.userId, 'DELETE_SCRAPE_TARGET', {
      resource: 'ScrapeTarget',
      resourceId: id,
      oldValue: { url: existing.url, sourceId: existing.sourceId },
    })

    revalidatePath('/scrapers')
    return { success: true }
  } catch (error) {
    log.error('Failed to delete scrape target', { id }, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to delete target' }
  }
}

// =============================================================================
// Scrape Runs
// =============================================================================

/**
 * Cancel a stuck scrape run.
 *
 * Use this when a run is stuck in RUNNING status but the worker has crashed or
 * otherwise failed to complete it. This marks the run as FAILED so the scheduler
 * can pick up new work for that source.
 */
export async function cancelScrapeRun(runId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    const run = await prisma.scrape_runs.findUnique({
      where: { id: runId },
      select: { id: true, status: true, adapterId: true, sourceId: true, startedAt: true },
    })

    if (!run) {
      return { success: false, error: 'Run not found' }
    }

    if (run.status !== 'RUNNING') {
      return { success: false, error: `Run is not in RUNNING status (current: ${run.status})` }
    }

    await prisma.scrape_runs.update({
      where: { id: runId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
      },
    })

    await logAdminAction(session.userId, 'CANCEL_SCRAPE_RUN', {
      resource: 'ScrapeRun',
      resourceId: runId,
      oldValue: { status: 'RUNNING', startedAt: run.startedAt },
      newValue: { status: 'FAILED', reason: 'MANUAL_CANCEL' },
    })

    log.info('Scrape run cancelled', { runId, adapterId: run.adapterId, sourceId: run.sourceId, userId: session.userId })

    revalidatePath('/scrapers/runs')
    return { success: true }
  } catch (error) {
    log.error('Failed to cancel scrape run', { runId }, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to cancel run' }
  }
}

export async function listScrapeRuns(options?: {
  adapterId?: string
  sourceId?: string
  status?: string
  limit?: number
}): Promise<{ success: boolean; error?: string; runs: ScrapeRunDTO[] }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized', runs: [] }

  try {
    const where: Prisma.scrape_runsWhereInput = {}

    if (options?.adapterId) {
      where.adapterId = options.adapterId
    }
    if (options?.sourceId) {
      where.sourceId = options.sourceId
    }
    if (options?.status) {
      where.status = options.status as Prisma.EnumScrapeRunStatusFilter
    }

    const runs = await prisma.scrape_runs.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: options?.limit ?? 50,
    })

    const dtos: ScrapeRunDTO[] = runs.map((r) => ({
      id: r.id,
      adapterId: r.adapterId,
      adapterVersion: r.adapterVersion,
      sourceId: r.sourceId,
      retailerId: r.retailerId,
      trigger: r.trigger,
      status: r.status,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      durationMs: r.durationMs,
      urlsAttempted: r.urlsAttempted,
      urlsSucceeded: r.urlsSucceeded,
      urlsFailed: r.urlsFailed,
      offersExtracted: r.offersExtracted,
      offersValid: r.offersValid,
      offersDropped: r.offersDropped,
      offersQuarantined: r.offersQuarantined,
      failureRate: r.failureRate ? Number(r.failureRate) : null,
      yieldRate: r.yieldRate ? Number(r.yieldRate) : null,
    }))

    return { success: true, runs: dtos }
  } catch (error) {
    log.error('Failed to list scrape runs', {}, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to list runs', runs: [] }
  }
}

// =============================================================================
// Adapter Status
// =============================================================================

export async function listAdapterStatuses(): Promise<{ success: boolean; error?: string; adapters: AdapterStatusDTO[] }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized', adapters: [] }

  try {
    const statuses = await prisma.scrape_adapter_status.findMany({
      orderBy: { adapterId: 'asc' },
    })

    // Get run counts per adapter
    const runCounts = await prisma.scrape_runs.groupBy({
      by: ['adapterId'],
      _count: { id: true },
      where: {
        startedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // Last 30 days
      },
    })

    const runCountMap = new Map(runCounts.map((r) => [r.adapterId, r._count.id]))

    // Get success rates per adapter
    const successRates = await prisma.scrape_runs.groupBy({
      by: ['adapterId'],
      _avg: { yieldRate: true },
      where: {
        startedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
        status: 'SUCCESS',
      },
    })

    const successRateMap = new Map(successRates.map((r) => [r.adapterId, r._avg?.yieldRate ? Number(r._avg.yieldRate) : null]))

    // Get last run time per adapter
    const lastRuns = await prisma.scrape_runs.groupBy({
      by: ['adapterId'],
      _max: { startedAt: true },
    })

    const lastRunMap = new Map(lastRuns.map((r) => [r.adapterId, r._max?.startedAt ?? null]))

    const dtos: AdapterStatusDTO[] = statuses.map((s) => ({
      adapterId: s.adapterId,
      enabled: s.enabled,
      ingestionPaused: s.ingestionPaused,
      ingestionPausedAt: s.ingestionPausedAt,
      ingestionPausedReason: s.ingestionPausedReason,
      ingestionPausedBy: s.ingestionPausedBy,
      lastRunAt: lastRunMap.get(s.adapterId) ?? null,
      nextRunAt: computeNextAdapterRunAt(s.schedule),
      consecutiveFailedBatches: s.consecutiveFailedBatches,
      disabledAt: s.disabledAt,
      disabledReason: s.disabledReason,
      totalRuns: runCountMap.get(s.adapterId) ?? 0,
      successRate: successRateMap.get(s.adapterId) ?? null,
      schedule: s.schedule,
    }))

    return { success: true, adapters: dtos }
  } catch (error) {
    log.error('Failed to list adapter statuses', {}, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to list adapters', adapters: [] }
  }
}

export async function registerKnownAdapters(): Promise<{ success: boolean; error?: string; createdCount?: number }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    const existing = await prisma.scrape_adapter_status.findMany({
      select: { adapterId: true },
    })
    const existingIds = new Set(existing.map((row) => row.adapterId))

    const now = new Date()
    const toCreate = KNOWN_ADAPTERS.filter((adapter) => !existingIds.has(adapter.id))

    if (toCreate.length === 0) {
      return { success: true, createdCount: 0 }
    }

    await prisma.scrape_adapter_status.createMany({
      data: toCreate.map((adapter) => ({
        adapterId: adapter.id,
        enabled: false,
        disabledAt: now,
        disabledReason: 'MANUAL',
      })),
      skipDuplicates: true,
    })

    await logAdminAction(session.userId, 'REGISTER_SCRAPE_ADAPTERS', {
      resource: 'ScrapeAdapter',
      newValue: {
        createdAdapters: toCreate.map((adapter) => adapter.id),
        createdCount: toCreate.length,
      },
    })

    revalidatePath('/scrapers/adapters')
    return { success: true, createdCount: toCreate.length }
  } catch (error) {
    log.error('Failed to register adapters', {}, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to register adapters' }
  }
}

export async function toggleAdapterEnabled(adapterId: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    const existing = await prisma.scrape_adapter_status.findUnique({
      where: { adapterId },
    })

    if (!existing) {
      // Create if doesn't exist
      await prisma.scrape_adapter_status.create({
        data: {
          adapterId,
          enabled,
          disabledAt: enabled ? null : new Date(),
          disabledReason: enabled ? null : 'MANUAL',
        },
      })
    } else {
      await prisma.scrape_adapter_status.update({
        where: { adapterId },
        data: {
          enabled,
          disabledAt: enabled ? null : new Date(),
          disabledReason: enabled ? null : 'MANUAL',
          consecutiveFailedBatches: enabled ? 0 : existing.consecutiveFailedBatches,
        },
      })
    }

    await logAdminAction(session.userId, enabled ? 'ENABLE_SCRAPE_ADAPTER' : 'DISABLE_SCRAPE_ADAPTER', {
      resource: 'ScrapeAdapter',
      resourceId: adapterId,
      newValue: { enabled },
    })

    revalidatePath('/scrapers/adapters')
    return { success: true }
  } catch (error) {
    log.error('Failed to toggle adapter', { adapterId, enabled }, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to toggle adapter' }
  }
}

export async function toggleAdapterIngestionPaused(adapterId: string, paused: boolean): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    const existing = await prisma.scrape_adapter_status.findUnique({
      where: { adapterId },
    })

    const now = new Date()

    if (!existing) {
      await prisma.scrape_adapter_status.create({
        data: {
          adapterId,
          enabled: true,
          ingestionPaused: paused,
          ingestionPausedAt: paused ? now : null,
          ingestionPausedReason: paused ? 'MANUAL' : null,
          ingestionPausedBy: paused ? (session.email ?? session.userId) : null,
        },
      })
    } else {
      await prisma.scrape_adapter_status.update({
        where: { adapterId },
        data: {
          ingestionPaused: paused,
          ingestionPausedAt: paused ? now : null,
          ingestionPausedReason: paused ? 'MANUAL' : null,
          ingestionPausedBy: paused ? (session.email ?? session.userId) : null,
        },
      })
    }

    await logAdminAction(session.userId, paused ? 'PAUSE_ADAPTER_INGESTION' : 'RESUME_ADAPTER_INGESTION', {
      resource: 'ScrapeAdapter',
      resourceId: adapterId,
      newValue: { ingestionPaused: paused },
    })

    revalidatePath('/scrapers/adapters')
    return { success: true }
  } catch (error) {
    log.error('Failed to toggle adapter ingestion', { adapterId, paused }, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to toggle adapter ingestion' }
  }
}

export interface AdapterDetailDTO extends AdapterStatusDTO {
  baselineFailureRate: number | null
  baselineYieldRate: number | null
  baselineSampleSize: number
  baselineUpdatedAt: Date | null
  lastBatchFailureRate: number | null
  lastRunHadZeroPrice: boolean
  disabledBy: string | null
  targetCount: number
  // Adapter-level scheduling fields
  schedule: string | null
  lastCycleStartedAt: Date | null
  currentCycleId: string | null
  cycleTimeoutMinutes: number
}

export async function getAdapterDetail(adapterId: string): Promise<{ success: boolean; error?: string; adapter?: AdapterDetailDTO }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    const adapter = await prisma.scrape_adapter_status.findUnique({
      where: { adapterId },
    })

    if (!adapter) {
      return { success: false, error: 'Adapter not found' }
    }

    // Get target count for this adapter
    const targetCount = await prisma.scrape_targets.count({
      where: { adapterId },
    })

    // Get run stats
    const [totalRuns, lastRun, successfulRuns] = await Promise.all([
      prisma.scrape_runs.count({
        where: {
          adapterId,
          startedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.scrape_runs.findFirst({
        where: { adapterId },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true },
      }),
      prisma.scrape_runs.count({
        where: {
          adapterId,
          status: 'SUCCESS',
          startedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
    ])

    const totalRecentRuns = await prisma.scrape_runs.count({
      where: {
        adapterId,
        startedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    })

    const successRate = totalRecentRuns > 0 ? successfulRuns / totalRecentRuns : null

    return {
      success: true,
      adapter: {
        adapterId: adapter.adapterId,
        enabled: adapter.enabled,
        ingestionPaused: adapter.ingestionPaused,
        ingestionPausedAt: adapter.ingestionPausedAt,
        ingestionPausedReason: adapter.ingestionPausedReason,
        ingestionPausedBy: adapter.ingestionPausedBy,
        lastRunAt: lastRun?.startedAt ?? null,
        nextRunAt: computeNextAdapterRunAt(adapter.schedule),
        consecutiveFailedBatches: adapter.consecutiveFailedBatches,
        disabledAt: adapter.disabledAt,
        disabledReason: adapter.disabledReason,
        disabledBy: adapter.disabledBy,
        totalRuns,
        successRate,
        baselineFailureRate: adapter.baselineFailureRate ? Number(adapter.baselineFailureRate) : null,
        baselineYieldRate: adapter.baselineYieldRate ? Number(adapter.baselineYieldRate) : null,
        baselineSampleSize: adapter.baselineSampleSize,
        baselineUpdatedAt: adapter.baselineUpdatedAt,
        lastBatchFailureRate: adapter.lastBatchFailureRate ? Number(adapter.lastBatchFailureRate) : null,
        lastRunHadZeroPrice: adapter.lastRunHadZeroPrice,
        targetCount,
        // Adapter-level scheduling fields
        schedule: adapter.schedule,
        lastCycleStartedAt: adapter.lastCycleStartedAt,
        currentCycleId: adapter.currentCycleId,
        cycleTimeoutMinutes: adapter.cycleTimeoutMinutes,
      },
    }
  } catch (error) {
    log.error('Failed to get adapter detail', { adapterId }, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to get adapter' }
  }
}

export async function resetAdapterFailures(adapterId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    const existing = await prisma.scrape_adapter_status.findUnique({
      where: { adapterId },
    })

    if (!existing) {
      return { success: false, error: 'Adapter not found' }
    }

    await prisma.scrape_adapter_status.update({
      where: { adapterId },
      data: {
        consecutiveFailedBatches: 0,
        lastBatchFailureRate: null,
        lastRunHadZeroPrice: false,
      },
    })

    await logAdminAction(session.userId, 'RESET_ADAPTER_FAILURES', {
      resource: 'ScrapeAdapter',
      resourceId: adapterId,
      oldValue: {
        consecutiveFailedBatches: existing.consecutiveFailedBatches,
        lastBatchFailureRate: existing.lastBatchFailureRate,
        lastRunHadZeroPrice: existing.lastRunHadZeroPrice,
      },
      newValue: {
        consecutiveFailedBatches: 0,
        lastBatchFailureRate: null,
        lastRunHadZeroPrice: false,
      },
    })

    log.info('Adapter failures reset', { adapterId, userId: session.userId })

    revalidatePath('/scrapers/adapters')
    return { success: true }
  } catch (error) {
    log.error('Failed to reset adapter failures', { adapterId }, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to reset failures' }
  }
}

// =============================================================================
// Manual Trigger
// =============================================================================

/**
 * Trigger a manual scrape for a target.
 *
 * NOTE: This creates a scrape_runs record with trigger=MANUAL and status=RUNNING.
 * The harvester scheduler picks up targets that need manual runs on its next cycle.
 * Direct queue access is not available from the admin app.
 */
export async function triggerManualScrape(targetId: string): Promise<{ success: boolean; error?: string; runId?: string; retryAfterMs?: number }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    const target = await prisma.scrape_targets.findUnique({
      where: { id: targetId },
      include: {
        sources: {
          select: {
            id: true,
            retailerId: true,
            scrapeEnabled: true,
            robotsCompliant: true,
          },
        },
      },
    })

    if (!target) {
      return { success: false, error: 'Target not found' }
    }

    if (!target.sources.scrapeEnabled) {
      return { success: false, error: 'Source scraping is disabled' }
    }

    if (!target.sources.robotsCompliant) {
      return { success: false, error: 'Source is not robots compliant' }
    }

    // Check adapter is enabled and not paused
    const adapterStatus = await prisma.scrape_adapter_status.findUnique({
      where: { adapterId: target.adapterId },
    })

    if (adapterStatus && !adapterStatus.enabled) {
      return { success: false, error: 'Adapter is disabled' }
    }

    if (adapterStatus?.ingestionPaused) {
      return { success: false, error: 'Adapter ingestion is paused' }
    }

    // Per spec §8.2: Check queue capacity before accepting manual triggers
    // Check both pending manual AND enqueued targets as proxy for actual queue capacity
    const [pendingManualCount, enqueuedCount] = await Promise.all([
      prisma.scrape_targets.count({
        where: {
          adapterId: target.adapterId,
          lastStatus: 'PENDING_MANUAL',
        },
      }),
      prisma.scrape_targets.count({
        where: {
          adapterId: target.adapterId,
          lastStatus: 'ENQUEUED',
        },
      }),
    ])

    // Per spec §8.2: Cap manual requests per adapter
    const MAX_PENDING_MANUAL_PER_ADAPTER = 10
    if (pendingManualCount >= MAX_PENDING_MANUAL_PER_ADAPTER) {
      const retryAfterMs = Math.min(pendingManualCount * 30000, 300000) // Cap at 5 min
      return {
        success: false,
        error: `Too many pending manual requests for this adapter (${pendingManualCount}). Please wait ${Math.ceil(retryAfterMs / 1000)} seconds and try again.`,
        retryAfterMs,
      }
    }

    // Per spec §8.2: Check actual queue capacity (enqueued jobs)
    // Per spec §8.1: MAX_PENDING_PER_ADAPTER default is 1000
    const MAX_ENQUEUED_PER_ADAPTER = 1000
    if (enqueuedCount >= MAX_ENQUEUED_PER_ADAPTER) {
      const retryAfterMs = 120000 // 2 minutes - queue is at capacity
      return {
        success: false,
        error: `Queue is at capacity for this adapter (${enqueuedCount} jobs). Please wait ${Math.ceil(retryAfterMs / 1000)} seconds and try again.`,
        retryAfterMs,
      }
    }

    // Also check total pending across all adapters for global backpressure
    const totalPending = await prisma.scrape_targets.count({
      where: {
        lastStatus: { in: ['PENDING_MANUAL', 'ENQUEUED'] },
      },
    })

    // Per spec §8.1: MAX_PENDING_TOTAL default is 10000
    const MAX_TOTAL_PENDING = 10000
    if (totalPending >= MAX_TOTAL_PENDING) {
      const retryAfterMs = 120000 // 2 minutes
      return {
        success: false,
        error: `System queue is at capacity (${totalPending} jobs). Please wait ${Math.ceil(retryAfterMs / 1000)} seconds and try again.`,
        retryAfterMs,
      }
    }

    // Mark target as pending manual scrape
    // The harvester scheduler will create the run record with correct adapter version
    // per scraper-framework-01 spec: admin doesn't have access to adapter registry
    await prisma.scrape_targets.update({
      where: { id: targetId },
      data: {
        lastStatus: 'PENDING_MANUAL',
        updatedAt: new Date(),
      },
    })

    await logAdminAction(session.userId, 'TRIGGER_MANUAL_SCRAPE', {
      resource: 'ScrapeTarget',
      resourceId: targetId,
    })

    revalidatePath('/scrapers')
    revalidatePath(`/scrapers/targets/${targetId}`)
    return { success: true }
  } catch (error) {
    log.error('Failed to trigger manual scrape', { targetId }, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to trigger scrape' }
  }
}

// =============================================================================
// Source Scrape Toggle
// =============================================================================

export async function toggleSourceScrapeEnabled(sourceId: string, enabled: boolean): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    const existing = await prisma.sources.findUnique({
      where: { id: sourceId },
      select: {
        id: true,
        name: true,
        scrapeEnabled: true,
        tosReviewedAt: true,
        tosApprovedBy: true,
      },
    })

    if (!existing) {
      return { success: false, error: 'Source not found' }
    }

    const now = new Date()
    const shouldStampTos = enabled && (!existing.tosReviewedAt || !existing.tosApprovedBy)

    await prisma.sources.update({
      where: { id: sourceId },
      data: {
        scrapeEnabled: enabled,
        ...(shouldStampTos && {
          tosReviewedAt: existing.tosReviewedAt ?? now,
          tosApprovedBy: existing.tosApprovedBy ?? session.userId,
        }),
      },
    })

    await logAdminAction(session.userId, enabled ? 'ENABLE_SOURCE_SCRAPING' : 'DISABLE_SOURCE_SCRAPING', {
      resource: 'Source',
      resourceId: sourceId,
      oldValue: { scrapeEnabled: existing.scrapeEnabled },
      newValue: {
        scrapeEnabled: enabled,
        ...(shouldStampTos && {
          tosReviewedAt: existing.tosReviewedAt ?? now,
          tosApprovedBy: existing.tosApprovedBy ?? session.userId,
        }),
      },
    })

    revalidatePath('/scrapers')
    return { success: true }
  } catch (error) {
    log.error('Failed to toggle source scraping', { sourceId, enabled }, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to toggle source scraping' }
  }
}

// =============================================================================
// Source Scrape Configuration
// =============================================================================

export async function updateSourceScrapeConfig(
  sourceId: string,
  data: {
    scrapeEnabled?: boolean
    adapterId?: string | null
    robotsCompliant?: boolean
  }
): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    const existing = await prisma.sources.findUnique({
      where: { id: sourceId },
      select: {
        id: true,
        name: true,
        scrapeEnabled: true,
        adapterId: true,
        robotsCompliant: true,
        tosReviewedAt: true,
        tosApprovedBy: true,
      },
    })

    if (!existing) {
      return { success: false, error: 'Source not found' }
    }

    let resolvedAdapterId = existing.adapterId
    if (data.adapterId !== undefined) {
      const adapterResolution = await resolveSourceAdapterId(data.adapterId)
      if (adapterResolution.error) {
        return { success: false, error: adapterResolution.error }
      }
      resolvedAdapterId = adapterResolution.adapterId
    }

    const now = new Date()
    const shouldStampTos = data.scrapeEnabled === true && (!existing.tosReviewedAt || !existing.tosApprovedBy)

    await prisma.sources.update({
      where: { id: sourceId },
      data: {
        scrapeEnabled: data.scrapeEnabled ?? existing.scrapeEnabled,
        adapterId: resolvedAdapterId,
        robotsCompliant: data.robotsCompliant ?? existing.robotsCompliant,
        ...(shouldStampTos && {
          tosReviewedAt: existing.tosReviewedAt ?? now,
          tosApprovedBy: existing.tosApprovedBy ?? session.userId,
        }),
      },
    })

    await logAdminAction(session.userId, 'UPDATE_SOURCE_SCRAPE_CONFIG', {
      resource: 'Source',
      resourceId: sourceId,
      oldValue: {
        scrapeEnabled: existing.scrapeEnabled,
        adapterId: existing.adapterId,
        robotsCompliant: existing.robotsCompliant,
      },
      newValue: {
        ...data,
        ...(shouldStampTos && {
          tosReviewedAt: existing.tosReviewedAt ?? now,
          tosApprovedBy: existing.tosApprovedBy ?? session.userId,
        }),
      },
    })

    revalidatePath('/retailers')
    revalidatePath('/scrapers')
    return { success: true }
  } catch (error) {
    log.error('Failed to update source scrape config', { sourceId, data }, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to update source scrape config' }
  }
}

// =============================================================================
// Stats
// =============================================================================

export async function getScrapeStats(): Promise<{
  success: boolean
  error?: string
  stats?: {
    totalTargets: number
    activeTargets: number
    pausedTargets: number
    brokenTargets: number
    recentRuns: number
    recentFailures: number
    adaptersEnabled: number
    adaptersDisabled: number
  }
}> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    const [
      totalTargets,
      activeTargets,
      pausedTargets,
      brokenTargets,
      recentRuns,
      recentFailures,
      adaptersEnabled,
      adaptersDisabled,
    ] = await Promise.all([
      prisma.scrape_targets.count(),
      prisma.scrape_targets.count({ where: { status: 'ACTIVE', enabled: true } }),
      prisma.scrape_targets.count({ where: { enabled: false } }),
      prisma.scrape_targets.count({ where: { status: 'BROKEN' } }),
      prisma.scrape_runs.count({
        where: { startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      prisma.scrape_runs.count({
        where: {
          startedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          status: 'FAILED',
        },
      }),
      prisma.scrape_adapter_status.count({ where: { enabled: true } }),
      prisma.scrape_adapter_status.count({ where: { enabled: false } }),
    ])

    return {
      success: true,
      stats: {
        totalTargets,
        activeTargets,
        pausedTargets,
        brokenTargets,
        recentRuns,
        recentFailures,
        adaptersEnabled,
        adaptersDisabled,
      },
    }
  } catch (error) {
    log.error('Failed to get scrape stats', {}, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to get stats' }
  }
}

// =============================================================================
// Emergency Stop
// =============================================================================

/**
 * Emergency stop for the scraper system.
 *
 * This will:
 * 1. Disable the harvester scheduler via system setting
 * 2. Mark all RUNNING scrape runs as FAILED
 * 3. Clear all scraper-related BullMQ queues in Redis
 *
 * Use this when you discover a critical error and need to stop all scraping immediately.
 */
export async function emergencyStopScraper(confirmationCode: string): Promise<{
  success: boolean
  error?: string
  runsAborted?: number
  queuesCleared?: number
}> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  // Require explicit confirmation
  if (confirmationCode !== 'EMERGENCY_STOP') {
    return { success: false, error: 'Invalid confirmation code. Type EMERGENCY_STOP to confirm.' }
  }

  try {
    log.warn('EMERGENCY STOP initiated', { userId: session.userId, email: session.email })

    // 1. Disable the harvester scheduler
    await prisma.system_settings.upsert({
      where: { key: 'HARVESTER_SCHEDULER_ENABLED' },
      create: {
        key: 'HARVESTER_SCHEDULER_ENABLED',
        value: false,
        description: 'Enable the main harvester scheduler',
        updatedBy: session.email,
      },
      update: {
        value: false,
        updatedBy: session.email,
      },
    })

    // 2. Abort all RUNNING scrape runs
    const abortResult = await prisma.scrape_runs.updateMany({
      where: { status: 'RUNNING' },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
      },
    })

    // 3. Clear Redis queues
    let queuesCleared = 0
    try {
      const redis = createRedisClient()

      // Find and delete all scraper-related BullMQ keys
      // Queue names: scrape-url, product-resolve (from queues.ts QUEUE_NAMES)
      const scrapeUrlKeys = await redis.keys('bull:scrape-url:*')
      const productResolveKeys = await redis.keys('bull:product-resolve:*')
      const allKeys = [...scrapeUrlKeys, ...productResolveKeys]

      if (allKeys.length > 0) {
        queuesCleared = await redis.del(...allKeys)
      }

      await redis.quit()
    } catch (redisError) {
      log.error('Failed to clear Redis queues during emergency stop', {}, redisError instanceof Error ? redisError : new Error(String(redisError)))
      // Continue - the scheduler disable and run abort are the critical parts
    }

    await logAdminAction(session.userId, 'EMERGENCY_STOP_SCRAPER', {
      resource: 'Scraper',
      newValue: {
        schedulerDisabled: true,
        runsAborted: abortResult.count,
        queuesCleared,
      },
    })

    log.warn('EMERGENCY STOP completed', {
      userId: session.userId,
      runsAborted: abortResult.count,
      queuesCleared,
    })

    revalidatePath('/scrapers')
    revalidatePath('/settings')

    return {
      success: true,
      runsAborted: abortResult.count,
      queuesCleared,
    }
  } catch (error) {
    log.error('Failed to execute emergency stop', {}, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to execute emergency stop' }
  }
}

/**
 * Get the current scraper enabled status
 */
export async function getScraperStatus(): Promise<{
  success: boolean
  error?: string
  enabled?: boolean
  runningRuns?: number
  pendingJobs?: number
}> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    // Check scheduler setting
    const setting = await prisma.system_settings.findUnique({
      where: { key: 'HARVESTER_SCHEDULER_ENABLED' },
    })
    const enabled = setting ? (setting.value as boolean) : true // Default true

    // Count running runs
    const runningRuns = await prisma.scrape_runs.count({
      where: { status: 'RUNNING' },
    })

    // Count pending manual requests
    const pendingJobs = await prisma.scrape_targets.count({
      where: {
        lastStatus: { in: ['PENDING_MANUAL', 'ENQUEUED'] },
      },
    })

    return {
      success: true,
      enabled,
      runningRuns,
      pendingJobs,
    }
  } catch (error) {
    log.error('Failed to get scraper status', {}, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to get status' }
  }
}

/**
 * Enable the scraper scheduler
 */
export async function enableScraperScheduler(): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    await prisma.system_settings.upsert({
      where: { key: 'HARVESTER_SCHEDULER_ENABLED' },
      create: {
        key: 'HARVESTER_SCHEDULER_ENABLED',
        value: true,
        description: 'Enable the main harvester scheduler',
        updatedBy: session.email,
      },
      update: {
        value: true,
        updatedBy: session.email,
      },
    })

    await logAdminAction(session.userId, 'ENABLE_SCRAPER_SCHEDULER', {
      resource: 'Scraper',
      newValue: { enabled: true },
    })

    log.info('Scraper scheduler enabled', { userId: session.userId })

    revalidatePath('/scrapers')
    revalidatePath('/settings')

    return { success: true }
  } catch (error) {
    log.error('Failed to enable scraper scheduler', {}, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to enable scheduler' }
  }
}

// =============================================================================
// Adapter-Level Scheduling
// =============================================================================

export interface CycleDTO {
  id: string
  adapterId: string
  status: string
  trigger: string
  startedAt: Date
  completedAt: Date | null
  durationMs: number | null
  totalTargets: number
  targetsCompleted: number
  targetsFailed: number
  targetsSkipped: number
  offersExtracted: number
  offersValid: number
  lastProcessedTargetId: string | null
  progressPercent: number
}

/**
 * Update an adapter's schedule.
 */
export async function updateAdapterSchedule(
  adapterId: string,
  schedule: string | null
): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    const existing = await prisma.scrape_adapter_status.findUnique({
      where: { adapterId },
      select: { adapterId: true, schedule: true },
    })

    if (!existing) {
      // Create adapter status if doesn't exist
      await prisma.scrape_adapter_status.create({
        data: {
          adapterId,
          enabled: true,
          schedule,
        },
      })
    } else {
      await prisma.scrape_adapter_status.update({
        where: { adapterId },
        data: { schedule },
      })
    }

    await logAdminAction(session.userId, 'UPDATE_ADAPTER_SCHEDULE', {
      resource: 'ScrapeAdapter',
      resourceId: adapterId,
      oldValue: { schedule: existing?.schedule ?? null },
      newValue: { schedule },
    })

    log.info('Adapter schedule updated', { adapterId, schedule, userId: session.userId })

    revalidatePath('/scrapers/adapters')
    revalidatePath(`/scrapers/adapters/${adapterId}`)

    return { success: true }
  } catch (error) {
    log.error('Failed to update adapter schedule', { adapterId }, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to update schedule' }
  }
}

/**
 * Get the current cycle for an adapter (if any).
 */
export async function getAdapterCurrentCycle(adapterId: string): Promise<{
  success: boolean
  error?: string
  cycle?: CycleDTO | null
}> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    const adapterStatus = await prisma.scrape_adapter_status.findUnique({
      where: { adapterId },
      select: { currentCycleId: true },
    })

    if (!adapterStatus?.currentCycleId) {
      return { success: true, cycle: null }
    }

    const cycle = await prisma.scrape_cycles.findUnique({
      where: { id: adapterStatus.currentCycleId },
    })

    if (!cycle) {
      return { success: true, cycle: null }
    }

    const progressPercent = cycle.totalTargets > 0
      ? Math.round(((cycle.targetsCompleted + cycle.targetsFailed + cycle.targetsSkipped) / cycle.totalTargets) * 100)
      : 0

    return {
      success: true,
      cycle: {
        id: cycle.id,
        adapterId: cycle.adapterId,
        status: cycle.status,
        trigger: cycle.trigger,
        startedAt: cycle.startedAt,
        completedAt: cycle.completedAt,
        durationMs: cycle.durationMs,
        totalTargets: cycle.totalTargets,
        targetsCompleted: cycle.targetsCompleted,
        targetsFailed: cycle.targetsFailed,
        targetsSkipped: cycle.targetsSkipped,
        offersExtracted: cycle.offersExtracted,
        offersValid: cycle.offersValid,
        lastProcessedTargetId: cycle.lastProcessedTargetId,
        progressPercent,
      },
    }
  } catch (error) {
    log.error('Failed to get adapter current cycle', { adapterId }, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to get current cycle' }
  }
}

/**
 * List cycles for an adapter.
 */
export async function listAdapterCycles(
  adapterId: string,
  options?: { limit?: number; status?: string }
): Promise<{ success: boolean; error?: string; cycles: CycleDTO[] }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized', cycles: [] }

  try {
    const where: Prisma.scrape_cyclesWhereInput = { adapterId }
    if (options?.status) {
      where.status = options.status as Prisma.EnumScrapeCycleStatusFilter
    }

    const cycles = await prisma.scrape_cycles.findMany({
      where,
      orderBy: { startedAt: 'desc' },
      take: options?.limit ?? 20,
    })

    const dtos: CycleDTO[] = cycles.map((c) => {
      const progressPercent = c.totalTargets > 0
        ? Math.round(((c.targetsCompleted + c.targetsFailed + c.targetsSkipped) / c.totalTargets) * 100)
        : 0

      return {
        id: c.id,
        adapterId: c.adapterId,
        status: c.status,
        trigger: c.trigger,
        startedAt: c.startedAt,
        completedAt: c.completedAt,
        durationMs: c.durationMs,
        totalTargets: c.totalTargets,
        targetsCompleted: c.targetsCompleted,
        targetsFailed: c.targetsFailed,
        targetsSkipped: c.targetsSkipped,
        offersExtracted: c.offersExtracted,
        offersValid: c.offersValid,
        lastProcessedTargetId: c.lastProcessedTargetId,
        progressPercent,
      }
    })

    return { success: true, cycles: dtos }
  } catch (error) {
    log.error('Failed to list adapter cycles', { adapterId }, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to list cycles', cycles: [] }
  }
}

/**
 * Trigger a manual cycle for an adapter ("Run Now").
 *
 * Creates a new cycle with trigger=MANUAL. The scheduler will pick it up
 * and process all targets for the adapter.
 */
export async function triggerAdapterCycle(adapterId: string): Promise<{
  success: boolean
  error?: string
  cycleId?: string
}> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    // Verify adapter exists
    const adapterStatus = await prisma.scrape_adapter_status.findUnique({
      where: { adapterId },
    })

    if (!adapterStatus) {
      return { success: false, error: 'Adapter not found' }
    }

    if (!adapterStatus.enabled) {
      return { success: false, error: 'Adapter is disabled' }
    }

    if (adapterStatus.ingestionPaused) {
      return { success: false, error: 'Adapter ingestion is paused' }
    }

    // Check if there's already an active cycle
    if (adapterStatus.currentCycleId) {
      return { success: false, error: 'Adapter already has an active cycle' }
    }

    // Count targets for this adapter
    const totalTargets = await prisma.scrape_targets.count({
      where: {
        adapterId,
        enabled: true,
        status: 'ACTIVE',
        robotsPathBlocked: { not: true },
        sources: {
          scrapeEnabled: true,
          robotsCompliant: true,
        },
      },
    })

    if (totalTargets === 0) {
      return { success: false, error: 'No active targets for this adapter' }
    }

    // Create the manual cycle
    const now = new Date()
    const cycle = await prisma.scrape_cycles.create({
      data: {
        adapterId,
        status: 'RUNNING',
        trigger: 'MANUAL',
        startedAt: now,
        totalTargets,
      },
    })

    // Update adapter status
    await prisma.scrape_adapter_status.update({
      where: { adapterId },
      data: {
        currentCycleId: cycle.id,
        lastCycleStartedAt: now,
      },
    })

    await logAdminAction(session.userId, 'TRIGGER_ADAPTER_CYCLE', {
      resource: 'ScrapeAdapter',
      resourceId: adapterId,
      newValue: { cycleId: cycle.id, totalTargets },
    })

    log.info('Manual adapter cycle triggered', {
      adapterId,
      cycleId: cycle.id,
      totalTargets,
      userId: session.userId,
    })

    revalidatePath('/scrapers/adapters')
    revalidatePath(`/scrapers/adapters/${adapterId}`)

    return { success: true, cycleId: cycle.id }
  } catch (error) {
    log.error('Failed to trigger adapter cycle', { adapterId }, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to trigger cycle' }
  }
}

/**
 * Cancel an active cycle for an adapter.
 */
export async function cancelAdapterCycle(adapterId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    const adapterStatus = await prisma.scrape_adapter_status.findUnique({
      where: { adapterId },
      select: { currentCycleId: true },
    })

    if (!adapterStatus?.currentCycleId) {
      return { success: false, error: 'No active cycle to cancel' }
    }

    const now = new Date()
    const cycle = await prisma.scrape_cycles.findUnique({
      where: { id: adapterStatus.currentCycleId },
      select: { startedAt: true },
    })

    // Update cycle status
    await prisma.scrape_cycles.update({
      where: { id: adapterStatus.currentCycleId },
      data: {
        status: 'CANCELLED',
        completedAt: now,
        durationMs: cycle ? now.getTime() - cycle.startedAt.getTime() : null,
      },
    })

    // Clear current cycle from adapter status
    await prisma.scrape_adapter_status.update({
      where: { adapterId },
      data: { currentCycleId: null },
    })

    await logAdminAction(session.userId, 'CANCEL_ADAPTER_CYCLE', {
      resource: 'ScrapeAdapter',
      resourceId: adapterId,
      oldValue: { cycleId: adapterStatus.currentCycleId },
      newValue: { status: 'CANCELLED' },
    })

    log.info('Adapter cycle cancelled', {
      adapterId,
      cycleId: adapterStatus.currentCycleId,
      userId: session.userId,
    })

    revalidatePath('/scrapers/adapters')
    revalidatePath(`/scrapers/adapters/${adapterId}`)

    return { success: true }
  } catch (error) {
    log.error('Failed to cancel adapter cycle', { adapterId }, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to cancel cycle' }
  }
}

/**
 * Get adapter-level scheduling details.
 */
export async function getAdapterSchedulingDetails(adapterId: string): Promise<{
  success: boolean
  error?: string
  details?: {
    schedule: string | null
    lastCycleStartedAt: Date | null
    currentCycleId: string | null
    cycleTimeoutMinutes: number
    currentCycle: CycleDTO | null
    recentCycles: CycleDTO[]
  }
}> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    const adapterStatus = await prisma.scrape_adapter_status.findUnique({
      where: { adapterId },
      select: {
        schedule: true,
        lastCycleStartedAt: true,
        currentCycleId: true,
        cycleTimeoutMinutes: true,
      },
    })

    if (!adapterStatus) {
      return { success: false, error: 'Adapter not found' }
    }

    // Get current cycle if any
    let currentCycle: CycleDTO | null = null
    if (adapterStatus.currentCycleId) {
      const cycle = await prisma.scrape_cycles.findUnique({
        where: { id: adapterStatus.currentCycleId },
      })
      if (cycle) {
        const progressPercent = cycle.totalTargets > 0
          ? Math.round(((cycle.targetsCompleted + cycle.targetsFailed + cycle.targetsSkipped) / cycle.totalTargets) * 100)
          : 0
        currentCycle = {
          id: cycle.id,
          adapterId: cycle.adapterId,
          status: cycle.status,
          trigger: cycle.trigger,
          startedAt: cycle.startedAt,
          completedAt: cycle.completedAt,
          durationMs: cycle.durationMs,
          totalTargets: cycle.totalTargets,
          targetsCompleted: cycle.targetsCompleted,
          targetsFailed: cycle.targetsFailed,
          targetsSkipped: cycle.targetsSkipped,
          offersExtracted: cycle.offersExtracted,
          offersValid: cycle.offersValid,
          lastProcessedTargetId: cycle.lastProcessedTargetId,
          progressPercent,
        }
      }
    }

    // Get recent completed cycles
    const recentCyclesRaw = await prisma.scrape_cycles.findMany({
      where: {
        adapterId,
        status: { not: 'RUNNING' },
      },
      orderBy: { startedAt: 'desc' },
      take: 10,
    })

    const recentCycles: CycleDTO[] = recentCyclesRaw.map((c) => {
      const progressPercent = c.totalTargets > 0
        ? Math.round(((c.targetsCompleted + c.targetsFailed + c.targetsSkipped) / c.totalTargets) * 100)
        : 0
      return {
        id: c.id,
        adapterId: c.adapterId,
        status: c.status,
        trigger: c.trigger,
        startedAt: c.startedAt,
        completedAt: c.completedAt,
        durationMs: c.durationMs,
        totalTargets: c.totalTargets,
        targetsCompleted: c.targetsCompleted,
        targetsFailed: c.targetsFailed,
        targetsSkipped: c.targetsSkipped,
        offersExtracted: c.offersExtracted,
        offersValid: c.offersValid,
        lastProcessedTargetId: c.lastProcessedTargetId,
        progressPercent,
      }
    })

    return {
      success: true,
      details: {
        schedule: adapterStatus.schedule,
        lastCycleStartedAt: adapterStatus.lastCycleStartedAt,
        currentCycleId: adapterStatus.currentCycleId,
        cycleTimeoutMinutes: adapterStatus.cycleTimeoutMinutes,
        currentCycle,
        recentCycles,
      },
    }
  } catch (error) {
    log.error('Failed to get adapter scheduling details', { adapterId }, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to get scheduling details' }
  }
}

/**
 * Check if adapter-level scheduling is enabled.
 */
export async function isAdapterLevelSchedulingEnabled(): Promise<{
  success: boolean
  error?: string
  enabled?: boolean
}> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    const setting = await prisma.system_settings.findUnique({
      where: { key: 'ADAPTER_LEVEL_SCHEDULING' },
    })

    return {
      success: true,
      enabled: setting ? (setting.value === true) : false,
    }
  } catch (error) {
    log.error('Failed to check adapter-level scheduling flag', {}, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to check flag' }
  }
}

/**
 * Toggle adapter-level scheduling feature flag.
 */
export async function toggleAdapterLevelScheduling(enabled: boolean): Promise<{ success: boolean; error?: string }> {
  const session = await getAdminSession()
  if (!session) return { success: false, error: 'Unauthorized' }

  try {
    await prisma.system_settings.upsert({
      where: { key: 'ADAPTER_LEVEL_SCHEDULING' },
      create: {
        key: 'ADAPTER_LEVEL_SCHEDULING',
        value: enabled,
        description: 'Enable adapter-level scheduling (V2) instead of target-level scheduling (V1)',
        updatedBy: session.email,
      },
      update: {
        value: enabled,
        updatedBy: session.email,
      },
    })

    await logAdminAction(session.userId, enabled ? 'ENABLE_ADAPTER_LEVEL_SCHEDULING' : 'DISABLE_ADAPTER_LEVEL_SCHEDULING', {
      resource: 'Scraper',
      newValue: { enabled },
    })

    log.info('Adapter-level scheduling toggled', { enabled, userId: session.userId })

    revalidatePath('/scrapers')
    revalidatePath('/settings')

    return { success: true }
  } catch (error) {
    log.error('Failed to toggle adapter-level scheduling', { enabled }, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to toggle feature' }
  }
}
