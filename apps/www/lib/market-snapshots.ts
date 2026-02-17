import { readFileSync } from 'fs'
import { join } from 'path'
import crypto from 'node:crypto'
import { CALIBER_SLUG_MAP } from '@ironscout/db/calibers.js'

export type SnapshotDataStatus = 'SUFFICIENT' | 'INSUFFICIENT_DATA' | 'UNAVAILABLE'

export interface MarketSnapshotMethodology {
  measurementTechnique: string
  notes: string[]
}

export interface MarketSnapshotPricePerRound {
  median: number | null
  p25: number | null
  p75: number | null
  min: number | null
  max: number | null
}

export interface MarketSnapshotCounts {
  sampleCount: number
  daysWithData: number
  productCount: number
  retailerCount: number
}

export interface MarketSnapshotArtifact {
  schemaVersion: 'market-snapshot/v1'
  caliberSlug: string
  windowDays: number
  statBasis: 'dailyBestObserved'
  statLabel: string
  pricePerRound: MarketSnapshotPricePerRound
  counts: MarketSnapshotCounts
  computedAt: string | null
  windowStart: string | null
  windowEnd: string | null
  dataStatus: SnapshotDataStatus
  methodology: MarketSnapshotMethodology
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function normalizeForStableStringify(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeForStableStringify(entry))
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      out[key] = normalizeForStableStringify(value[key])
    }
    return out
  }
  return value
}

function stableStringify(value: unknown): string {
  return JSON.stringify(normalizeForStableStringify(value))
}

export function computeSnapshotArtifactSha256(snapshot: MarketSnapshotArtifact): string {
  return crypto.createHash('sha256').update(stableStringify(snapshot)).digest('hex')
}

export type MarketSnapshotArtifactWithSummary = MarketSnapshotArtifact & {
  pricePerRound: {
    median: number
    p25: number | null
    p75: number | null
    min: number
    max: number
  }
}

const SNAPSHOT_DIR = join(process.cwd(), 'public', 'market-snapshots', '30d')
const FALLBACK_MEASUREMENT_TECHNIQUE =
  'SQL PERCENTILE_CONT over daily-best per-product-per-day observed in-stock prices'
const FALLBACK_METHODOLOGY_NOTES = [
  'Daily-best is MIN(price_per_round) per (caliber, product, UTC day).',
  'Only in-stock observations included.',
  'Coverage varies by retailer and source.',
]

export function readSnapshotArtifactBySlug(caliberSlug: string): MarketSnapshotArtifact | null {
  const artifactPath = join(SNAPSHOT_DIR, `${caliberSlug}.json`)
  try {
    const raw = readFileSync(artifactPath, 'utf-8')
    return JSON.parse(raw) as MarketSnapshotArtifact
  } catch {
    return null
  }
}

export function hasKnownCaliberSlug(caliberSlug: string): boolean {
  return Object.prototype.hasOwnProperty.call(CALIBER_SLUG_MAP, caliberSlug)
}

export function getSnapshotArtifactUrl(caliberSlug: string): string {
  return `/market-snapshots/30d/${caliberSlug}.json`
}

export function isSummaryAvailable(
  snapshot: MarketSnapshotArtifact | null
): snapshot is MarketSnapshotArtifactWithSummary {
  return snapshot !== null
    && snapshot.counts.sampleCount >= 15
    && typeof snapshot.pricePerRound.median === 'number'
    && typeof snapshot.pricePerRound.min === 'number'
    && typeof snapshot.pricePerRound.max === 'number'
}

export function createUnavailableSnapshotArtifact(caliberSlug: string): MarketSnapshotArtifact {
  return {
    schemaVersion: 'market-snapshot/v1',
    caliberSlug: caliberSlug,
    windowDays: 30,
    statBasis: 'dailyBestObserved',
    statLabel: 'Observed daily-best price per round',
    pricePerRound: {
      median: null,
      p25: null,
      p75: null,
      min: null,
      max: null,
    },
    counts: {
      sampleCount: 0,
      daysWithData: 0,
      productCount: 0,
      retailerCount: 0,
    },
    computedAt: null,
    windowStart: null,
    windowEnd: null,
    dataStatus: 'UNAVAILABLE',
    methodology: {
      measurementTechnique: FALLBACK_MEASUREMENT_TECHNIQUE,
      notes: FALLBACK_METHODOLOGY_NOTES,
    },
  }
}

export function serializeJsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
}

export function createCaliberDatasetJsonLd(
  caliberLabel: string,
  caliberSlug: string,
  snapshot: MarketSnapshotArtifact | null,
  siteBaseUrl: string
): Record<string, unknown> {
  const baseDescription =
    'Observed price and availability data with historical context. Summaries appear once sufficient observations are available.'

  const summaryDescription = isSummaryAvailable(snapshot)
    ? `Observed ${snapshot.windowDays}-day price range (per round): median ${snapshot.pricePerRound.median.toFixed(3)}, lowest ${snapshot.pricePerRound.min.toFixed(3)}, highest ${snapshot.pricePerRound.max.toFixed(3)}, sample size ${snapshot.counts.sampleCount}.`
    : baseDescription

  const numericProperties = snapshot === null
    ? []
    : [
        { name: 'medianPricePerRound', value: snapshot.pricePerRound.median },
        { name: 'p25PricePerRound', value: snapshot.pricePerRound.p25 },
        { name: 'p75PricePerRound', value: snapshot.pricePerRound.p75 },
        { name: 'minPricePerRound', value: snapshot.pricePerRound.min },
        { name: 'maxPricePerRound', value: snapshot.pricePerRound.max },
        { name: 'sampleCount', value: snapshot.counts.sampleCount },
        { name: 'daysWithData', value: snapshot.counts.daysWithData },
        { name: 'productCount', value: snapshot.counts.productCount },
        { name: 'retailerCount', value: snapshot.counts.retailerCount },
      ]
        .filter((entry) => entry.value !== null)
        .map((entry) => ({
          '@type': 'PropertyValue',
          name: entry.name,
          value: entry.value,
        }))

  const metadata: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${caliberLabel} Ammo Observed Pricing`,
    description: summaryDescription,
    temporalCoverage: `P${snapshot?.windowDays ?? 30}D`,
    variableMeasured: ['price_per_round', 'availability_status'],
    measurementTechnique: snapshot?.methodology.measurementTechnique ?? FALLBACK_MEASUREMENT_TECHNIQUE,
    isAccessibleForFree: true,
    distribution: [
      {
        '@type': 'DataDownload',
        encodingFormat: 'application/json',
        contentUrl: `${siteBaseUrl.replace(/\/$/, '')}${getSnapshotArtifactUrl(caliberSlug)}`,
      },
    ],
  }

  if (numericProperties.length > 0) {
    metadata.additionalProperty = numericProperties
  }

  if (snapshot?.computedAt) {
    metadata.dateModified = snapshot.computedAt
  }

  return metadata
}
