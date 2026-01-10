import {
  extractGrainWeight,
  extractRoundCount,
  normalizeCaliberString,
} from '../normalizer/ammo-utils'

export interface ParsedSignals {
  caliber?: string
  grainWeight?: number
  roundCount?: number
}

export function parseAttributes(value: string | undefined): ParsedSignals {
  if (!value) return {}

  try {
    const raw = JSON.parse(value) as Record<string, unknown>
    const caliberRaw =
      typeof raw.caliber === 'string'
        ? raw.caliber
        : typeof raw.gauge === 'string' || typeof raw.gauge === 'number'
          ? `${raw.gauge} Gauge`
          : undefined
    const grainRaw = parseNumber(raw.grain)
    const roundsRaw = parseNumber(raw.rounds)

    return {
      caliber: caliberRaw ? normalizeCaliberString(caliberRaw) ?? caliberRaw : undefined,
      grainWeight: grainRaw ?? undefined,
      roundCount: roundsRaw ?? undefined,
    }
  } catch {
    return {}
  }
}

export function parseUrlSignals(url: string): ParsedSignals {
  try {
    const parsed = new URL(url)
    const rawSlug = parsed.pathname.split('/').filter(Boolean).pop()
    if (!rawSlug) return {}

    const slug = decodeURIComponent(rawSlug)
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[-_]+/g, ' ')

    return {
      caliber: normalizeCaliberString(slug) ?? undefined,
      grainWeight: extractGrainWeight(slug) ?? undefined,
      roundCount: extractRoundCount(slug) ?? undefined,
    }
  } catch {
    return {}
  }
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) return parsed
  }
  return undefined
}
