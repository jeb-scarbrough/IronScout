/**
 * Review Queue Export Routes
 *
 * Admin-only endpoint for exporting product_links review queue items
 * with full evidence JSON for offline analysis of matching logic.
 *
 * ADR-005 exemption: This endpoint exports resolver audit data (product_links),
 * not consumer price data. Retailer visibility filtering does not apply to
 * admin operational exports of resolver evidence.
 *
 * Endpoints:
 * - GET /api/review-queue/export — Export review queue items (NDJSON or JSON)
 */

import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '@ironscout/db'
import { requireAdmin } from '../middleware/auth'
import { loggers } from '../config/logger'

const log = loggers.reviewQueue

const router: any = Router()

// All routes require admin auth (X-Admin-Key header or admin JWT)
router.use(requireAdmin)

// ============================================================================
// VALIDATION — ADR-009: fail closed on invalid input (return 400, never widen)
// ============================================================================

const VALID_STATUSES = [
  'NEEDS_REVIEW', 'UNMATCHED', 'MATCHED', 'CREATED', 'SKIPPED', 'ERROR',
] as const

const VALID_REASON_CODES = [
  'INSUFFICIENT_DATA', 'INVALID_UPC', 'UPC_NOT_TRUSTED',
  'AMBIGUOUS_FINGERPRINT', 'CONFLICTING_IDENTIFIERS', 'MANUAL_LOCKED',
  'RELINK_BLOCKED_HYSTERESIS', 'SYSTEM_ERROR', 'NORMALIZATION_FAILED',
] as const

const VALID_MATCH_TYPES = ['UPC', 'FINGERPRINT', 'MANUAL', 'NONE', 'ERROR'] as const

const exportQuerySchema = z.object({
  status: z.string().default('NEEDS_REVIEW,UNMATCHED').transform(s =>
    s.split(',').map(v => v.trim())
  ).pipe(z.array(z.enum(VALID_STATUSES)).min(1)),
  reasonCode: z.enum(VALID_REASON_CODES).optional(),
  matchType: z.enum(VALID_MATCH_TYPES).optional(),
  sourceId: z.string().optional(),
  resolverVersion: z.string().optional(),
  format: z.enum(['ndjson', 'json']).default('ndjson'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(5000).default(500),
  cursor: z.string().optional(),
  createdAfter: z.string().datetime({ offset: true }).optional(),
  createdBefore: z.string().datetime({ offset: true }).optional(),
})

// ============================================================================
// PRISMA SELECT — shared between NDJSON and JSON paths
// ============================================================================

const ITEM_SELECT = {
  id: true,
  sourceProductId: true,
  productId: true,
  matchType: true,
  status: true,
  reasonCode: true,
  confidence: true,
  resolverVersion: true,
  evidence: true,
  resolvedAt: true,
  createdAt: true,
  updatedAt: true,
  source_products: {
    select: {
      title: true,
      url: true,
      brand: true,
      brandNorm: true,
      caliber: true,
      grainWeight: true,
      roundCount: true,
      identityKey: true,
      sourceId: true,
      sources: {
        select: {
          id: true,
          name: true,
          type: true,
          retailers: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      source_product_identifiers: {
        select: {
          idType: true,
          idValue: true,
          namespace: true,
          isCanonical: true,
        },
      },
    },
  },
} as const

// ============================================================================
// HELPERS
// ============================================================================

/** Flatten Prisma nested result into analysis-friendly structure. */
function reshapeItem(item: any) {
  const sp = item.source_products
  return {
    id: item.id,
    sourceProductId: item.sourceProductId,
    productId: item.productId,
    matchType: item.matchType,
    status: item.status,
    reasonCode: item.reasonCode,
    confidence: item.confidence,
    resolverVersion: item.resolverVersion,
    evidence: item.evidence,
    resolvedAt: item.resolvedAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    sourceProduct: sp
      ? {
          title: sp.title,
          url: sp.url,
          brand: sp.brand,
          brandNorm: sp.brandNorm,
          caliber: sp.caliber,
          grainWeight: sp.grainWeight,
          roundCount: sp.roundCount,
          identityKey: sp.identityKey,
          sourceId: sp.sourceId,
          source: {
            id: sp.sources?.id ?? null,
            name: sp.sources?.name ?? null,
            retailerName: sp.sources?.retailers?.name ?? null,
          },
          identifiers: (sp.source_product_identifiers ?? []).map((id: any) => ({
            idType: id.idType,
            idValue: id.idValue,
            namespace: id.namespace,
            isCanonical: id.isCanonical,
          })),
        }
      : null,
  }
}

/** Build Prisma where clause from validated params. */
function buildWhere(params: z.infer<typeof exportQuerySchema>) {
  const where: any = {
    status: { in: params.status },
  }
  if (params.reasonCode) where.reasonCode = params.reasonCode
  if (params.matchType) where.matchType = params.matchType
  if (params.resolverVersion) where.resolverVersion = params.resolverVersion
  if (params.sourceId) where.source_products = { sourceId: params.sourceId }
  if (params.cursor) where.id = { gt: params.cursor }
  if (params.createdAfter || params.createdBefore) {
    where.createdAt = {}
    if (params.createdAfter) where.createdAt.gte = new Date(params.createdAfter)
    if (params.createdBefore) where.createdAt.lte = new Date(params.createdBefore)
  }
  return where
}

// ============================================================================
// EXPORT ENDPOINT
// ============================================================================

/**
 * GET /api/review-queue/export
 *
 * Export review queue items with full evidence for offline analysis.
 * Default: NDJSON format, NEEDS_REVIEW + UNMATCHED statuses, 500 items.
 *
 * NDJSON: cursor-based pagination via ?cursor=<lastId>
 *   Next cursor returned in X-Next-Cursor response header when more items exist.
 * JSON: offset-based pagination via ?page=N&limit=N
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    const params = exportQuerySchema.parse(req.query)
    const where = buildWhere(params)

    // Audit log
    log.info('Review queue export requested', {
      format: params.format,
      status: params.status,
      reasonCode: params.reasonCode,
      sourceId: params.sourceId,
      limit: params.limit,
      cursor: params.cursor,
      adminKey: !!req.headers['x-admin-key'],
    })

    if (params.format === 'ndjson') {
      // Fetch limit+1 to detect if more items exist
      const items = await prisma.product_links.findMany({
        where,
        take: params.limit + 1,
        orderBy: { id: 'asc' },
        select: ITEM_SELECT,
      })

      const hasMore = items.length > params.limit
      const outputItems = hasMore ? items.slice(0, params.limit) : items

      const dateStr = new Date().toISOString().slice(0, 10)
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="review-queue-export-${dateStr}.ndjson"`,
      )
      if (hasMore) {
        res.setHeader('X-Next-Cursor', outputItems[outputItems.length - 1].id)
      }
      res.flushHeaders()

      // Abort on client disconnect
      let aborted = false
      req.on('close', () => { aborted = true })

      for (const item of outputItems) {
        if (aborted) break
        res.write(JSON.stringify(reshapeItem(item)) + '\n')
      }

      log.info('Review queue exported (NDJSON)', {
        count: outputItems.length,
        hasMore,
        status: params.status,
        reasonCode: params.reasonCode,
      })

      return res.end()
    }

    // JSON format: offset pagination
    const skip = (params.page - 1) * params.limit
    const [items, total] = await Promise.all([
      prisma.product_links.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        select: ITEM_SELECT,
      }),
      prisma.product_links.count({ where }),
    ])

    log.info('Review queue exported (JSON)', {
      count: items.length,
      total,
      page: params.page,
      status: params.status,
      reasonCode: params.reasonCode,
    })

    return res.json({
      items: items.map(reshapeItem),
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid query parameters',
        details: error.issues,
      })
    }
    log.error('Error exporting review queue', {}, error as Error)
    return res.status(500).json({ error: 'Failed to export review queue' })
  }
})

export { router as reviewQueueRouter }
