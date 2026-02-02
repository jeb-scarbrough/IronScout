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
import { KNOWN_ADAPTERS } from '@/lib/scraper-constants'
import Redis from 'ioredis'

const log = loggers.admin

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
  lastRunAt: Date | null
  consecutiveFailedBatches: number
  disabledAt: Date | null
  disabledReason: string | null
  totalRuns: number
  successRate: number | null
}

export interface CreateTargetInput {
  url: string
  sourceId: string
  adapterId: string
  priority?: number
  schedule?: string
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

    const dtos: ScrapeTargetDTO[] = targets.map((t) => ({
      id: t.id,
      url: t.url,
      canonicalUrl: t.canonicalUrl,
      sourceId: t.sourceId,
      sourceName: t.sources.name,
      adapterId: t.adapterId,
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

    return {
      success: true,
      target: {
        id: target.id,
        url: target.url,
        canonicalUrl: target.canonicalUrl,
        sourceId: target.sourceId,
        sourceName: target.sources.name,
        adapterId: target.adapterId,
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
        schedule: data.schedule ?? null,
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

export async function updateScrapeTarget(
  id: string,
  data: Partial<Pick<CreateTargetInput, 'priority' | 'schedule' | 'enabled'>>
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
      lastRunAt: lastRunMap.get(s.adapterId) ?? null,
      consecutiveFailedBatches: s.consecutiveFailedBatches,
      disabledAt: s.disabledAt,
      disabledReason: s.disabledReason,
      totalRuns: runCountMap.get(s.adapterId) ?? 0,
      successRate: successRateMap.get(s.adapterId) ?? null,
    }))

    return { success: true, adapters: dtos }
  } catch (error) {
    log.error('Failed to list adapter statuses', {}, error instanceof Error ? error : new Error(String(error)))
    return { success: false, error: 'Failed to list adapters', adapters: [] }
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

    // Check adapter is enabled
    const adapterStatus = await prisma.scrape_adapter_status.findUnique({
      where: { adapterId: target.adapterId },
    })

    if (adapterStatus && !adapterStatus.enabled) {
      return { success: false, error: 'Adapter is disabled' }
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

    // Validate adapterId if provided
    if (data.adapterId !== undefined && data.adapterId !== null) {
      const validAdapter = KNOWN_ADAPTERS.find((a) => a.id === data.adapterId)
      if (!validAdapter) {
        return { success: false, error: `Invalid adapter: ${data.adapterId}` }
      }
    }

    const now = new Date()
    const shouldStampTos = data.scrapeEnabled === true && (!existing.tosReviewedAt || !existing.tosApprovedBy)

    await prisma.sources.update({
      where: { id: sourceId },
      data: {
        scrapeEnabled: data.scrapeEnabled ?? existing.scrapeEnabled,
        adapterId: data.adapterId !== undefined ? data.adapterId : existing.adapterId,
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
      const redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
      })

      // Find and delete all scraper-related BullMQ keys
      const scraperKeys = await redis.keys('bull:scraper:*')
      const resolverKeys = await redis.keys('bull:resolver:*')
      const allKeys = [...scraperKeys, ...resolverKeys]

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
