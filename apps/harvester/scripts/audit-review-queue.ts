/**
 * Review Queue Extraction Audit
 *
 * Analyzes NEEDS_REVIEW / UNMATCHED product_links to identify extraction
 * gaps in brand, caliber, grain weight, and round count patterns.
 * Produces a structured report with failure clusters to guide pattern
 * improvements in ammo-utils.ts.
 *
 * Usage:
 *   pnpm tsx apps/harvester/scripts/audit-review-queue.ts
 *   pnpm tsx apps/harvester/scripts/audit-review-queue.ts --limit 50
 *   pnpm tsx apps/harvester/scripts/audit-review-queue.ts --source-id clxyz123
 *   pnpm tsx apps/harvester/scripts/audit-review-queue.ts --reason NORMALIZATION_FAILED
 *   pnpm tsx apps/harvester/scripts/audit-review-queue.ts --json
 */

import 'dotenv/config'
import { prisma } from '@ironscout/db'
import {
  extractBrand,
  extractCaliber,
  extractGrainWeight,
  extractRoundCount,
} from '../src/utils/ammo-utils'

// ============================================================================
// CLI ARGS
// ============================================================================

function getArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  if (index === -1) return undefined
  return process.argv[index + 1]
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag)
}

const LIMIT = Number(getArg('--limit')) || 500
const SOURCE_ID = getArg('--source-id')
const REASON_CODE = getArg('--reason') || 'INSUFFICIENT_DATA'
const JSON_OUTPUT = hasFlag('--json')

// ============================================================================
// NON-AMMO KEYWORDS
// ============================================================================

const NON_AMMO_KEYWORDS = [
  'magazine', 'holster', 'cleaning kit', 'bore snake',
  'optic mount', 'gun grip', 'gun stock', 'barrel',
  'trigger', 'sling', 'bipod', 'ear pro', 'eye pro',
  'laser sight', 'knife', 'tool kit', 'range bag', 'vest',
  'plate carrier', 'gun safe', 'gun lock',
  'reloading press', 'die set', 'empty brass',
  'projectile for handloading', 'for handloading',
  'bullet tips', 'component bullet',
]

// Common ammo terms to exclude from brand clustering
const AMMO_STOP_WORDS = new Set([
  'grain', 'gr', 'grn', 'fmj', 'jhp', 'jsp', 'sp', 'hp', 'bt', 'bthp',
  'round', 'rounds', 'rd', 'rds', 'box', 'case', 'pack', 'per', 'of',
  'ammo', 'ammunition', 'surplus', 'military', 'ball', 'tracer', 'ap',
  'corrosive', 'non-corrosive', 'noncorrosive', 'berdan', 'boxer',
  'brass', 'steel', 'lacquered', 'copper', 'plated', 'coated',
  'the', 'and', 'for', 'with', 'new', 'old', 'vintage', 'era',
  'cal', 'caliber', 'mm', 'nato', 'magnum', 'mag', 'special', 'spl',
  'win', 'winchester', 'rem', 'remington', 'auto', 'acp',
  'mauser', 'makarov', 'luger', 'tokarev', 'nagant', 'springfield',
  'in', 'by', 'from', 'made', 'mfg', 'lot', 'production',
])

// ============================================================================
// TYPES
// ============================================================================

interface AnalyzedItem {
  linkId: string
  sourceProductId: string
  title: string
  sourceId: string
  sourceName: string
  reasonCode: string | null
  // What's stored in DB
  storedBrand: string | null
  storedBrandNorm: string | null
  storedCaliber: string | null
  storedGrain: number | null
  storedRoundCount: number | null
  // What extraction produces today
  extractedBrand: string | null
  extractedCaliber: string | null
  extractedGrain: number | null
  extractedRoundCount: number | null
  // Classification
  category: 'already_extractable' | 'brand_only_fail' | 'caliber_only_fail' | 'both_fail' | 'has_stored_data'
  isNonAmmo: boolean
  nonAmmoKeyword: string | null
}

interface AuditReport {
  date: string
  totalItems: number
  reasonCode: string
  sourceFilter: string | null
  summary: {
    alreadyExtractable: number
    brandOnlyFail: number
    caliberOnlyFail: number
    bothFail: number
    hasStoredData: number
    nonAmmoCount: number
  }
  bySource: Record<string, { name: string; count: number }>
  brandClusters: Array<{ token: string; count: number; sampleTitles: string[] }>
  caliberClusters: Array<{ pattern: string; count: number; sampleTitles: string[] }>
  nonAmmoSamples: string[]
  bothFailSamples: string[]
  items: AnalyzedItem[]
}

// ============================================================================
// ANALYSIS
// ============================================================================

function checkNonAmmo(title: string): { isNonAmmo: boolean; keyword: string | null } {
  const lower = title.toLowerCase()
  for (const kw of NON_AMMO_KEYWORDS) {
    if (lower.includes(kw)) {
      return { isNonAmmo: true, keyword: kw.trim() }
    }
  }
  return { isNonAmmo: false, keyword: null }
}

function classifyItem(item: {
  extractedBrand: string | null
  extractedCaliber: string | null
  storedBrand: string | null
  storedCaliber: string | null
  storedBrandNorm: string | null
}): AnalyzedItem['category'] {
  // If stored data already has both brand and caliber, it's not really an extraction issue
  if (item.storedBrandNorm && item.storedCaliber) {
    return 'has_stored_data'
  }

  const hasBrand = !!(item.extractedBrand || item.storedBrand || item.storedBrandNorm)
  const hasCaliber = !!(item.extractedCaliber || item.storedCaliber)

  if (hasBrand && hasCaliber) return 'already_extractable'
  if (!hasBrand && hasCaliber) return 'brand_only_fail'
  if (hasBrand && !hasCaliber) return 'caliber_only_fail'
  return 'both_fail'
}

function clusterBrandFailures(items: AnalyzedItem[]): AuditReport['brandClusters'] {
  const brandFails = items.filter(
    i => (i.category === 'brand_only_fail' || i.category === 'both_fail') && !i.isNonAmmo
  )

  const tokenCounts = new Map<string, { count: number; titles: string[] }>()

  for (const item of brandFails) {
    const tokens = item.title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 2 && !AMMO_STOP_WORDS.has(t) && !/^\d+$/.test(t))

    const seen = new Set<string>()
    for (const token of tokens) {
      if (seen.has(token)) continue
      seen.add(token)
      const entry = tokenCounts.get(token) || { count: 0, titles: [] }
      entry.count++
      if (entry.titles.length < 3) entry.titles.push(item.title)
      tokenCounts.set(token, entry)
    }
  }

  return Array.from(tokenCounts.entries())
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([token, v]) => ({
      token,
      count: v.count,
      sampleTitles: v.titles,
    }))
}

function clusterCaliberFailures(items: AnalyzedItem[]): AuditReport['caliberClusters'] {
  const caliberFails = items.filter(
    i => (i.category === 'caliber_only_fail' || i.category === 'both_fail') && !i.isNonAmmo
  )

  // Look for numeric patterns that might be calibers
  const patternCounts = new Map<string, { count: number; titles: string[] }>()

  for (const item of caliberFails) {
    const title = item.title

    // Match common caliber-like patterns that aren't being extracted
    const patterns = [
      // Bare numbers that could be calibers: 223, 40, 410, 338
      ...Array.from(title.matchAll(/\b(\d{2,3})\b/g)).map(m => m[1]),
      // Metric dimensions: 7.5×55, 6.5x52
      ...Array.from(title.matchAll(/(\d+\.?\d*[x×]\d+)/g)).map(m => m[1]),
      // mm patterns: 7mm, 6.5mm
      ...Array.from(title.matchAll(/(\d+\.?\d*\s*mm)/gi)).map(m => m[1].replace(/\s/g, '')),
    ]

    const seen = new Set<string>()
    for (const p of patterns) {
      const norm = p.toLowerCase()
      if (seen.has(norm)) continue
      seen.add(norm)
      const entry = patternCounts.get(norm) || { count: 0, titles: [] }
      entry.count++
      if (entry.titles.length < 3) entry.titles.push(title)
      patternCounts.set(norm, entry)
    }
  }

  return Array.from(patternCounts.entries())
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 20)
    .map(([pattern, v]) => ({
      pattern,
      count: v.count,
      sampleTitles: v.titles,
    }))
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  // Build where clause
  const where: any = {
    status: { in: ['NEEDS_REVIEW', 'UNMATCHED'] },
  }
  if (REASON_CODE !== 'ALL') {
    where.reasonCode = REASON_CODE
  }
  if (SOURCE_ID) {
    where.source_products = { sourceId: SOURCE_ID }
  }

  // Count total
  const total = await prisma.product_links.count({ where })

  if (!JSON_OUTPUT) {
    console.log(`\n=== Review Queue Extraction Audit ===`)
    console.log(`Date: ${new Date().toISOString().slice(0, 10)}`)
    console.log(`Reason filter: ${REASON_CODE}`)
    if (SOURCE_ID) console.log(`Source filter: ${SOURCE_ID}`)
    console.log(`Total matching items: ${total}`)
    console.log(`Analyzing: ${Math.min(total, LIMIT)}`)
  }

  // Fetch items
  const links = await prisma.product_links.findMany({
    where,
    take: LIMIT,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      sourceProductId: true,
      reasonCode: true,
      source_products: {
        select: {
          title: true,
          sourceId: true,
          brand: true,
          brandNorm: true,
          caliber: true,
          grainWeight: true,
          roundCount: true,
          sources: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  })

  // Analyze each item
  const analyzed: AnalyzedItem[] = links.map(link => {
    const sp = link.source_products
    const title = sp.title || ''
    const { isNonAmmo, keyword: nonAmmoKeyword } = checkNonAmmo(title)

    const extractedBrand = extractBrand(title)
    const extractedCaliber = extractCaliber(title)
    const extractedGrain = extractGrainWeight(title)
    const extractedRoundCount = extractRoundCount(title)

    const base = {
      linkId: link.id,
      sourceProductId: link.sourceProductId,
      title,
      sourceId: sp.sourceId,
      sourceName: sp.sources?.name || 'unknown',
      reasonCode: link.reasonCode,
      storedBrand: sp.brand,
      storedBrandNorm: sp.brandNorm,
      storedCaliber: sp.caliber,
      storedGrain: sp.grainWeight,
      storedRoundCount: sp.roundCount,
      extractedBrand,
      extractedCaliber,
      extractedGrain,
      extractedRoundCount,
      isNonAmmo,
      nonAmmoKeyword,
    }

    return {
      ...base,
      category: classifyItem(base),
    }
  })

  // Build report
  const summary = {
    alreadyExtractable: analyzed.filter(i => i.category === 'already_extractable').length,
    brandOnlyFail: analyzed.filter(i => i.category === 'brand_only_fail').length,
    caliberOnlyFail: analyzed.filter(i => i.category === 'caliber_only_fail').length,
    bothFail: analyzed.filter(i => i.category === 'both_fail').length,
    hasStoredData: analyzed.filter(i => i.category === 'has_stored_data').length,
    nonAmmoCount: analyzed.filter(i => i.isNonAmmo).length,
  }

  // Group by source
  const bySource: Record<string, { name: string; count: number }> = {}
  for (const item of analyzed) {
    if (!bySource[item.sourceId]) {
      bySource[item.sourceId] = { name: item.sourceName, count: 0 }
    }
    bySource[item.sourceId].count++
  }

  const brandClusters = clusterBrandFailures(analyzed)
  const caliberClusters = clusterCaliberFailures(analyzed)
  const nonAmmoSamples = analyzed
    .filter(i => i.isNonAmmo)
    .slice(0, 10)
    .map(i => i.title)
  const bothFailSamples = analyzed
    .filter(i => i.category === 'both_fail' && !i.isNonAmmo)
    .slice(0, 10)
    .map(i => i.title)

  const report: AuditReport = {
    date: new Date().toISOString().slice(0, 10),
    totalItems: analyzed.length,
    reasonCode: REASON_CODE,
    sourceFilter: SOURCE_ID || null,
    summary,
    bySource,
    brandClusters,
    caliberClusters,
    nonAmmoSamples,
    bothFailSamples,
    items: analyzed,
  }

  // Output
  if (JSON_OUTPUT) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    printReport(report)
  }

  await prisma.$disconnect()
}

function pct(n: number, total: number): string {
  if (total === 0) return '0.0%'
  return `${((n / total) * 100).toFixed(1)}%`
}

function printReport(r: AuditReport) {
  const t = r.totalItems
  console.log(`\n--- Summary ---`)
  console.log(`  Already extractable (brand + caliber): ${r.summary.alreadyExtractable} (${pct(r.summary.alreadyExtractable, t)})`)
  console.log(`  Brand-only fail (caliber OK):          ${r.summary.brandOnlyFail} (${pct(r.summary.brandOnlyFail, t)})`)
  console.log(`  Caliber-only fail (brand OK):          ${r.summary.caliberOnlyFail} (${pct(r.summary.caliberOnlyFail, t)})`)
  console.log(`  Both fail:                             ${r.summary.bothFail} (${pct(r.summary.bothFail, t)})`)
  console.log(`  Has stored data (not extraction issue): ${r.summary.hasStoredData} (${pct(r.summary.hasStoredData, t)})`)
  console.log(`  Non-ammo candidates:                   ${r.summary.nonAmmoCount} (${pct(r.summary.nonAmmoCount, t)})`)

  console.log(`\n--- By Source ---`)
  for (const [id, info] of Object.entries(r.bySource).sort((a, b) => b[1].count - a[1].count)) {
    console.log(`  ${info.name} (${id.slice(0, 12)}...): ${info.count} items`)
  }

  if (r.brandClusters.length > 0) {
    console.log(`\n--- Brand Failure Clusters ---`)
    for (const c of r.brandClusters) {
      console.log(`  "${c.token}" appears in ${c.count} brand-fail titles`)
      for (const t of c.sampleTitles) {
        console.log(`    → ${t.slice(0, 100)}`)
      }
    }
  }

  if (r.caliberClusters.length > 0) {
    console.log(`\n--- Caliber Failure Clusters ---`)
    for (const c of r.caliberClusters) {
      console.log(`  "${c.pattern}" in ${c.count} caliber-fail titles`)
      for (const t of c.sampleTitles) {
        console.log(`    → ${t.slice(0, 100)}`)
      }
    }
  }

  if (r.bothFailSamples.length > 0) {
    console.log(`\n--- Sample Titles: Both Fail (non-ammo excluded) ---`)
    for (const t of r.bothFailSamples) {
      console.log(`  ${t.slice(0, 120)}`)
    }
  }

  if (r.nonAmmoSamples.length > 0) {
    console.log(`\n--- Non-Ammo Candidates ---`)
    for (const t of r.nonAmmoSamples) {
      console.log(`  ${t.slice(0, 120)}`)
    }
  }

  console.log('')
}

main().catch(console.error)
