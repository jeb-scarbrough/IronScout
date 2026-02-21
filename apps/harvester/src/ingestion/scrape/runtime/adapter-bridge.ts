import { URL } from 'node:url'
import type {
  ScrapeAdapter,
  ScrapeAdapterContext,
  ExtractResult,
  NormalizeResult as LegacyNormalizeResult,
  ScrapedOffer,
} from '../../../scraper/types.js'
import { validateOffer } from '../../../scraper/process/validator.js'
import type { RawScrapeOffer, ScrapeSitePlugin } from '../types.js'

function bridgeSelectRawOffer(rawOffers: RawScrapeOffer[], url: string): RawScrapeOffer | null {
  if (rawOffers.length === 0) {
    return null
  }

  let skuParam: string | null = null
  try {
    skuParam = new URL(url).searchParams.get('sku')
  } catch {
    skuParam = null
  }

  if (skuParam) {
    const matched = rawOffers.find(offer =>
      offer.retailerProductId === skuParam || offer.retailerSku === skuParam
    )
    if (matched) {
      return matched
    }
  }

  const sorted = [...rawOffers].sort((a, b) => {
    const aKey = `${a.url}|${a.retailerProductId ?? ''}|${a.retailerSku ?? ''}`
    const bKey = `${b.url}|${b.retailerProductId ?? ''}|${b.retailerSku ?? ''}`
    return aKey.localeCompare(bKey)
  })
  return sorted[0] ?? null
}

/**
 * Bridge mode explicitly reuses the legacy worker fetch phase.
 * plugin.fetchRaw is intentionally not called here.
 */
export function pluginToLegacyAdapter(plugin: ScrapeSitePlugin): ScrapeAdapter {
  const fallbackDomain = (() => {
    try {
      const first = plugin.manifest.baseUrls[0]
      return first ? new URL(first).hostname : plugin.manifest.id
    } catch {
      return plugin.manifest.id
    }
  })()

  return {
    id: plugin.manifest.id,
    version: plugin.manifest.version,
    domain: fallbackDomain,
    requiresJsRendering: false,
    extract(html: string, url: string, ctx: ScrapeAdapterContext): ExtractResult {
      const extracted = plugin.extractRaw(html, url)
      if (!extracted.ok) {
        if (extracted.reason === 'AMBIGUOUS_VARIANTS') {
          return {
            ok: false,
            reason: 'PAGE_STRUCTURE_CHANGED',
            details: extracted.details ?? 'Ambiguous variants in plugin extraction result',
          }
        }
        return {
          ok: false,
          reason: extracted.reason,
          details: extracted.details,
        }
      }

      const selected = bridgeSelectRawOffer(extracted.rawOffers, url)
      if (!selected) {
        return {
          ok: false,
          reason: 'PAGE_STRUCTURE_CHANGED',
          details: 'Plugin returned no selectable raw offers',
        }
      }

      const normalized = plugin.normalizeRaw({
        sourceId: ctx.sourceId,
        retailerId: ctx.retailerId,
        observedAt: ctx.now,
        rawOffer: selected,
        manifest: plugin.manifest,
      })

      if (normalized.status !== 'ok') {
        return {
          ok: false,
          reason: 'PAGE_STRUCTURE_CHANGED',
          details: normalized.reason,
        }
      }

      return { ok: true, offer: normalized.offer as ScrapedOffer }
    },
    normalize(offer: ScrapedOffer): LegacyNormalizeResult {
      // Keep the legacy validator as final guardrail in bridge mode.
      return validateOffer(offer)
    },
  }
}
