import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { CALIBER_SLUG_MAP } from '../../../packages/db/calibers.js'
import { printGateResult, toRelativePath } from './lib/snapshot-parity-utils.mjs'

const GATE = 'S'

function extractLocUrls(xml) {
  const urls = []
  const regex = /<loc>([^<]+)<\/loc>/g
  let match
  while ((match = regex.exec(xml)) !== null) {
    urls.push(match[1].trim())
  }
  return urls
}

function toSnapshotUrl(baseUrl, slug) {
  return `${baseUrl}/market-snapshots/30d/${slug}.json`
}

async function main() {
  const rootDir = process.cwd()
  const sitemapPath = path.join(rootDir, 'out', 'sitemap.xml')
  const errors = []
  const warnings = []
  let checked = 0

  let rawSitemap = ''
  try {
    rawSitemap = await fs.readFile(sitemapPath, 'utf8')
  } catch (error) {
    errors.push({
      gate: GATE,
      reason: 'Sitemap file missing or unreadable',
      sitemapPath: toRelativePath(rootDir, sitemapPath),
      message: error instanceof Error ? error.message : String(error),
    })
    printGateResult(GATE, checked, errors, warnings)
    return
  }

  const allUrls = extractLocUrls(rawSitemap)
  const indexPath = '/market-snapshots/30d/index.json'
  const snapshotIndexUrl = allUrls.find((url) => url.endsWith(indexPath)) ?? null
  if (snapshotIndexUrl === null) {
    errors.push({
      gate: GATE,
      reason: 'Snapshot index URL missing from sitemap',
      expectedPath: indexPath,
    })
    printGateResult(GATE, checked, errors, warnings)
    return
  }

  const baseUrl = snapshotIndexUrl.slice(0, -indexPath.length)
  const expectedSlugs = Object.keys(CALIBER_SLUG_MAP).sort()
  const expectedUrls = new Set([
    `${baseUrl}${indexPath}`,
    ...expectedSlugs.map((slug) => toSnapshotUrl(baseUrl, slug)),
  ])

  const actualSnapshotUrls = allUrls.filter((url) => url.includes('/market-snapshots/30d/'))
  const actualUrlSet = new Set(actualSnapshotUrls)

  for (const expectedUrl of expectedUrls) {
    checked += 1
    if (!actualUrlSet.has(expectedUrl)) {
      errors.push({
        gate: GATE,
        reason: 'Expected snapshot URL missing from sitemap',
        url: expectedUrl,
      })
    }
  }

  const expectedUrlSet = new Set(expectedUrls)
  for (const actualUrl of actualUrlSet) {
    if (!expectedUrlSet.has(actualUrl)) {
      errors.push({
        gate: GATE,
        reason: 'Unexpected snapshot URL present in sitemap',
        url: actualUrl,
      })
    }
  }

  printGateResult(GATE, checked, errors, warnings)
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        ok: false,
        gate: GATE,
        fatal: error instanceof Error ? error.message : String(error),
      },
      null,
      2
    )
  )
  process.exit(1)
})
