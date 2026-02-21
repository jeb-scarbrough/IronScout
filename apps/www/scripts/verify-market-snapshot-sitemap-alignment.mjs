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
  const allUrlSet = new Set(allUrls)

  // Detect base URL from the homepage entry
  const homepageUrl = allUrls.find((url) => {
    try {
      const parsed = new URL(url)
      return parsed.pathname === '' || parsed.pathname === '/'
    } catch {
      return false
    }
  })

  if (!homepageUrl) {
    errors.push({
      gate: GATE,
      reason: 'Could not detect base URL from sitemap (no homepage entry found)',
    })
    printGateResult(GATE, checked, errors, warnings)
    return
  }

  const baseUrl = homepageUrl.replace(/\/$/, '')

  // Verify every known caliber slug has a /caliber/{slug} entry in sitemap
  const expectedSlugs = Object.keys(CALIBER_SLUG_MAP).sort()
  for (const slug of expectedSlugs) {
    checked += 1
    const expectedUrl = `${baseUrl}/caliber/${slug}`
    if (!allUrlSet.has(expectedUrl)) {
      errors.push({
        gate: GATE,
        reason: 'Expected caliber page URL missing from sitemap',
        url: expectedUrl,
      })
    }
  }

  // Warn if raw JSON snapshot URLs are still in the sitemap (they shouldn't be)
  const snapshotUrls = allUrls.filter((url) => url.includes('/market-snapshots/'))
  for (const url of snapshotUrls) {
    warnings.push({
      gate: GATE,
      reason: 'Raw JSON snapshot URL found in sitemap (should be removed to conserve crawl budget)',
      url,
    })
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
