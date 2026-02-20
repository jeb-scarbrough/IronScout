import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Prisma } from '@ironscout/db'
import { getRegisteredSitePluginManifest } from '../../registry.js'
import { safeJsonParse } from '../../kit/json.js'
import { validateScrapeConfig } from '../../kit/validate.js'

type ScrapeConfigMergeMode = 'deep' | 'replace'

interface DbAddRetailerSourceArgs {
  siteId: string
  retailerName: string
  website: string
  sourceName: string
  sourceUrl: string
  scrapeConfigFile?: string
  scrapeConfigJson?: string
  scrapeConfigMerge?: ScrapeConfigMergeMode
  dryRun?: boolean
}

const SITE_ID_PATTERN = /^[a-z0-9_]+$/

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeAbsoluteHttpUrl(value: string, flag: string): string {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`${flag} must be a valid absolute URL`)
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error(`${flag} must use http:// or https://`)
  }

  parsed.hash = ''
  return parsed.toString()
}

function deepMergeObjects(
  base: Record<string, unknown>,
  patch: Record<string, unknown>
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base }
  for (const [key, patchValue] of Object.entries(patch)) {
    const baseValue = merged[key]
    if (isPlainObject(baseValue) && isPlainObject(patchValue)) {
      merged[key] = deepMergeObjects(baseValue, patchValue)
      continue
    }
    merged[key] = patchValue
  }
  return merged
}

function readScrapeConfigFromInput(args: DbAddRetailerSourceArgs): {
  config?: Record<string, unknown>
  unknownTopLevelKeys: string[]
} {
  if (args.scrapeConfigFile && args.scrapeConfigJson) {
    throw new Error('--scrape-config-file and --scrape-config-json are mutually exclusive')
  }

  if (!args.scrapeConfigFile && !args.scrapeConfigJson) {
    return { config: undefined, unknownTopLevelKeys: [] }
  }

  const payload = args.scrapeConfigFile
    ? readFileSync(resolve(process.cwd(), args.scrapeConfigFile), 'utf8')
    : args.scrapeConfigJson!
  const parsed = safeJsonParse(payload)
  if (!parsed.ok) {
    throw new Error(`Invalid scrape config JSON: ${parsed.error}`)
  }

  const validation = validateScrapeConfig(parsed.value)
  if (!validation.ok) {
    throw new Error(validation.error)
  }

  return {
    config: validation.value,
    unknownTopLevelKeys: validation.unknownTopLevelKeys,
  }
}

function toAuditJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue
}

export async function runDbAddRetailerSourceCommand(
  args: DbAddRetailerSourceArgs
): Promise<number> {
  const missing = []
  if (!args.siteId) missing.push('--site-id')
  if (!args.retailerName) missing.push('--retailer-name')
  if (!args.website) missing.push('--website')
  if (!args.sourceName) missing.push('--source-name')
  if (!args.sourceUrl) missing.push('--source-url')

  if (missing.length > 0) {
    console.error(`Missing required arguments: ${missing.join(', ')}`)
    return 2
  }

  if (!SITE_ID_PATTERN.test(args.siteId)) {
    console.error('siteId must match /^[a-z0-9_]+$/')
    return 2
  }

  const manifest = getRegisteredSitePluginManifest(args.siteId)
  if (!manifest) {
    console.error(`Unknown site plugin id '${args.siteId}'. Run scraper:add first or verify registry wiring.`)
    return 2
  }

  const mergeMode = args.scrapeConfigMerge ?? 'deep'
  if (mergeMode !== 'deep' && mergeMode !== 'replace') {
    console.error("--scrape-config-merge must be either 'deep' or 'replace'")
    return 2
  }

  try {
    const { prisma } = await import('@ironscout/db')
    const website = normalizeAbsoluteHttpUrl(args.website, '--website')
    const sourceUrl = normalizeAbsoluteHttpUrl(args.sourceUrl, '--source-url')
    const { config: providedScrapeConfig, unknownTopLevelKeys } = readScrapeConfigFromInput(args)
    const actor =
      process.env.SCRAPER_CLI_ACTOR?.trim() ||
      process.env.USER?.trim() ||
      process.env.USERNAME?.trim() ||
      'SYSTEM_SCRAPER_CLI'

    const sourceType = manifest.mode === 'json' ? 'JSON' : 'HTML'

    if (args.dryRun) {
      const existingRetailer = await prisma.retailers.findUnique({
        where: { website },
        select: { id: true, name: true, visibilityStatus: true },
      })
      const existingAdapter = await prisma.scrape_adapter_status.findUnique({
        where: { adapterId: args.siteId },
        select: { adapterId: true, enabled: true, ingestionPaused: true },
      })

      console.log('DRY RUN: no DB writes performed')
      console.log(
        JSON.stringify(
          {
            siteId: args.siteId,
            retailer: existingRetailer
              ? { action: 'update', id: existingRetailer.id }
              : { action: 'create', visibilityStatus: 'INELIGIBLE' },
            scrapeAdapterStatus: existingAdapter
              ? { action: 'update', adapterId: existingAdapter.adapterId }
              : { action: 'create', adapterId: args.siteId, enabled: true },
            sourceDefaults: {
              type: sourceType,
              scrapeEnabled: false,
              robotsCompliant: true,
              upcTrusted: false,
            },
            scrapeConfigMerge: mergeMode,
            unknownTopLevelKeys,
            actor,
          },
          null,
          2
        )
      )
      return 0
    }

    const result = await prisma.$transaction(async tx => {
      const oldRetailer = await tx.retailers.findUnique({
        where: { website },
        select: {
          id: true,
          name: true,
          website: true,
          visibilityStatus: true,
          visibilityReason: true,
        },
      })

      const retailer = await tx.retailers.upsert({
        where: { website },
        create: {
          name: args.retailerName,
          website,
          visibilityStatus: 'INELIGIBLE',
        },
        update: {
          name: args.retailerName,
        },
      })

      const oldAdapterStatus = await tx.scrape_adapter_status.findUnique({
        where: { adapterId: args.siteId },
        select: {
          adapterId: true,
          enabled: true,
          disabledReason: true,
          ingestionPaused: true,
        },
      })

      const adapterStatus = await tx.scrape_adapter_status.upsert({
        where: { adapterId: args.siteId },
        create: {
          adapterId: args.siteId,
          enabled: true,
        },
        update: {},
      })

      const sourceCandidates = await tx.sources.findMany({
        where: {
          OR: [
            { adapterId: args.siteId },
            { retailerId: retailer.id, url: sourceUrl },
            { retailerId: retailer.id, name: args.sourceName },
          ],
        },
        select: {
          id: true,
          retailerId: true,
          adapterId: true,
          name: true,
          url: true,
          type: true,
          scrapeEnabled: true,
          robotsCompliant: true,
          scrapeConfig: true,
        },
      })

      const uniqueCandidates = [...new Map(sourceCandidates.map(row => [row.id, row])).values()]
      if (uniqueCandidates.length > 1) {
        throw new Error(
          `Ambiguous source match for site '${args.siteId}'. Matched ${uniqueCandidates.length} sources; refusing partial write.`
        )
      }

      const oldSource = uniqueCandidates[0] ?? null
      if (oldSource && oldSource.retailerId !== retailer.id) {
        throw new Error(
          `Matched source '${oldSource.id}' belongs to another retailer; refusing to guess ownership`
        )
      }
      if (oldSource && oldSource.adapterId && oldSource.adapterId !== args.siteId) {
        throw new Error(
          `Matched source '${oldSource.id}' already uses adapter '${oldSource.adapterId}', refusing reassignment`
        )
      }

      let resolvedScrapeConfig: Record<string, unknown> | undefined
      if (providedScrapeConfig) {
        if (mergeMode === 'replace' || !oldSource?.scrapeConfig) {
          resolvedScrapeConfig = providedScrapeConfig
        } else {
          if (!isPlainObject(oldSource.scrapeConfig)) {
            throw new Error('Existing sources.scrapeConfig is not a JSON object; deep merge is not safe')
          }
          resolvedScrapeConfig = deepMergeObjects(oldSource.scrapeConfig, providedScrapeConfig)
        }

        const validation = validateScrapeConfig(resolvedScrapeConfig)
        if (!validation.ok) {
          throw new Error(`Merged scrapeConfig is invalid: ${validation.error}`)
        }
        resolvedScrapeConfig = validation.value
      }

      const source = oldSource
        ? await tx.sources.update({
            where: { id: oldSource.id },
            data: {
              name: args.sourceName,
              url: sourceUrl,
              type: sourceType,
              adapterId: args.siteId,
              ...(resolvedScrapeConfig
                ? { scrapeConfig: resolvedScrapeConfig as Prisma.InputJsonValue }
                : {}),
            },
          })
        : await tx.sources.create({
            data: {
              name: args.sourceName,
              url: sourceUrl,
              type: sourceType,
              enabled: true,
              retailerId: retailer.id,
              adapterId: args.siteId,
              scrapeEnabled: false,
              robotsCompliant: true,
              ...(resolvedScrapeConfig
                ? { scrapeConfig: resolvedScrapeConfig as Prisma.InputJsonValue }
                : {}),
            },
          })

      const oldTrustConfig = await tx.source_trust_config.findUnique({
        where: { sourceId: source.id },
        select: {
          id: true,
          sourceId: true,
          upcTrusted: true,
          version: true,
        },
      })

      const trustConfig = await tx.source_trust_config.upsert({
        where: { sourceId: source.id },
        create: {
          sourceId: source.id,
          upcTrusted: false,
        },
        update: {},
      })

      await tx.admin_audit_logs.create({
        data: {
          adminUserId: actor,
          action: 'SCRAPER_DB_ADD_RETAILER_SOURCE',
          resource: 'scraper_source_onboarding',
          resourceId: source.id,
          oldValue: toAuditJson({
            retailer: oldRetailer,
            scrapeAdapterStatus: oldAdapterStatus,
            source: oldSource,
            sourceTrustConfig: oldTrustConfig,
          }),
          newValue: toAuditJson({
            siteId: args.siteId,
            retailer: {
              id: retailer.id,
              name: retailer.name,
              website: retailer.website,
              visibilityStatus: retailer.visibilityStatus,
            },
            scrapeAdapterStatus: {
              adapterId: adapterStatus.adapterId,
              enabled: adapterStatus.enabled,
              ingestionPaused: adapterStatus.ingestionPaused,
            },
            source: {
              id: source.id,
              name: source.name,
              url: source.url,
              type: source.type,
              retailerId: source.retailerId,
              adapterId: source.adapterId,
              scrapeEnabled: source.scrapeEnabled,
              robotsCompliant: source.robotsCompliant,
              scrapeConfig: source.scrapeConfig,
            },
            sourceTrustConfig: {
              id: trustConfig.id,
              sourceId: trustConfig.sourceId,
              upcTrusted: trustConfig.upcTrusted,
              version: trustConfig.version,
            },
            scrapeConfigMerge: mergeMode,
            unknownScrapeConfigTopLevelKeys: unknownTopLevelKeys,
          }),
        },
      })

      return {
        retailer,
        source,
        trustConfig,
        adapterStatus,
        unknownTopLevelKeys,
        created: {
          retailer: !oldRetailer,
          source: !oldSource,
          sourceTrustConfig: !oldTrustConfig,
          scrapeAdapterStatus: !oldAdapterStatus,
        },
      }
    })

    console.log(`Configured site '${args.siteId}' successfully`)
    console.log(
      JSON.stringify(
        {
          retailerId: result.retailer.id,
          sourceId: result.source.id,
          adapterId: result.adapterStatus.adapterId,
          created: result.created,
          defaults: {
            retailerVisibilityStatus: result.retailer.visibilityStatus,
            scrapeEnabled: result.source.scrapeEnabled,
            robotsCompliant: result.source.robotsCompliant,
            upcTrusted: result.trustConfig.upcTrusted,
          },
          unknownScrapeConfigTopLevelKeys: result.unknownTopLevelKeys,
        },
        null,
        2
      )
    )

    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 2
  }
}
