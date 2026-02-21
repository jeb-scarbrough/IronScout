#!/usr/bin/env node
/**
 * IndexNow Submission Script
 *
 * Pings search engines (Bing, Yandex, Naver, Seznam) about updated URLs
 * via the IndexNow protocol. Run after deploying or updating market snapshots.
 *
 * Usage:
 *   node scripts/build/submit-indexnow.mjs                    # Submit all sitemap URLs
 *   node scripts/build/submit-indexnow.mjs --changed-only     # Submit only caliber pages with fresh snapshots
 *   node scripts/build/submit-indexnow.mjs --dry-run          # Preview without submitting
 *
 * Environment:
 *   INDEXNOW_KEY  - Override the default API key (optional)
 *   WWW_URL       - Override the base URL (default: https://www.ironscout.ai)
 */

import { readFileSync, existsSync, readdirSync } from 'fs'
import { resolve, dirname, basename } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, '../..')
const WWW_DIR = resolve(PROJECT_ROOT, 'apps/www')
const SNAPSHOT_DIR = resolve(WWW_DIR, 'public/market-snapshots/30d')

const DEFAULT_KEY = '0bc93fb8d0fdb68be43464ab170a68a9'
const DEFAULT_BASE_URL = 'https://www.ironscout.ai'
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow'

// How recently a snapshot must have been computed to count as "changed" (in hours)
const FRESHNESS_THRESHOLD_HOURS = 26

function parseArgs() {
  const args = process.argv.slice(2)
  return {
    changedOnly: args.includes('--changed-only'),
    dryRun: args.includes('--dry-run'),
  }
}

function log(msg) {
  console.log(`[IndexNow] ${msg}`)
}

function warn(msg) {
  console.warn(`[IndexNow] ⚠ ${msg}`)
}

function err(msg) {
  console.error(`[IndexNow] ✗ ${msg}`)
}

/**
 * Extract all <loc> URLs from a sitemap XML string.
 */
function extractSitemapUrls(xml) {
  const urls = []
  const regex = /<loc>([^<]+)<\/loc>/g
  let match
  while ((match = regex.exec(xml)) !== null) {
    urls.push(match[1].trim())
  }
  return urls
}

/**
 * Get caliber slugs whose snapshots were computed within the freshness threshold.
 */
function getRecentlyChangedCaliberSlugs() {
  if (!existsSync(SNAPSHOT_DIR)) return []

  const now = Date.now()
  const thresholdMs = FRESHNESS_THRESHOLD_HOURS * 60 * 60 * 1000
  const changed = []

  for (const file of readdirSync(SNAPSHOT_DIR)) {
    if (!file.endsWith('.json') || file === 'index.json') continue

    try {
      const raw = readFileSync(resolve(SNAPSHOT_DIR, file), 'utf-8')
      const snapshot = JSON.parse(raw)
      if (snapshot.computedAt) {
        const computedAt = new Date(snapshot.computedAt).getTime()
        if (now - computedAt < thresholdMs) {
          changed.push(basename(file, '.json'))
        }
      }
    } catch {
      // skip malformed files
    }
  }

  return changed
}

/**
 * Build the list of URLs to submit.
 */
function collectUrls(baseUrl, changedOnly) {
  if (changedOnly) {
    const slugs = getRecentlyChangedCaliberSlugs()
    if (slugs.length === 0) {
      log('No recently changed snapshots found.')
      return []
    }

    // Submit caliber pages + hub pages that aggregate data
    const urls = [
      `${baseUrl}`,
      `${baseUrl}/calibers`,
      `${baseUrl}/ammo/handgun`,
      `${baseUrl}/ammo/rifle`,
      `${baseUrl}/ammo/rimfire`,
      `${baseUrl}/ammo/shotgun`,
    ]

    for (const slug of slugs) {
      urls.push(`${baseUrl}/caliber/${slug}`)
    }

    return urls
  }

  // Full mode: read from built sitemap
  const sitemapPath = resolve(WWW_DIR, 'out/sitemap.xml')
  if (!existsSync(sitemapPath)) {
    warn('Built sitemap not found at out/sitemap.xml — run build first.')
    return []
  }

  const xml = readFileSync(sitemapPath, 'utf-8')
  return extractSitemapUrls(xml)
}

/**
 * Submit URLs to IndexNow API.
 * Batches into groups of 10,000 (API limit).
 */
async function submitToIndexNow(urls, key, baseUrl, dryRun) {
  const host = new URL(baseUrl).host
  const batchSize = 10000

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize)
    const payload = {
      host,
      key,
      keyLocation: `${baseUrl}/${key}.txt`,
      urlList: batch,
    }

    if (dryRun) {
      log(`[DRY RUN] Would submit ${batch.length} URLs to IndexNow:`)
      for (const url of batch.slice(0, 10)) {
        console.log(`  ${url}`)
      }
      if (batch.length > 10) {
        console.log(`  ... and ${batch.length - 10} more`)
      }
      continue
    }

    try {
      const response = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(payload),
      })

      if (response.ok || response.status === 202) {
        log(`✓ Submitted ${batch.length} URLs (status: ${response.status})`)
      } else {
        const body = await response.text().catch(() => '')
        err(`Failed to submit batch (status: ${response.status}): ${body}`)
      }
    } catch (error) {
      err(`Network error submitting to IndexNow: ${error.message}`)
    }
  }
}

async function main() {
  const { changedOnly, dryRun } = parseArgs()
  const key = process.env.INDEXNOW_KEY || DEFAULT_KEY
  const baseUrl = (process.env.WWW_URL || DEFAULT_BASE_URL).replace(/\/$/, '')

  log(`Base URL: ${baseUrl}`)
  log(`Mode: ${changedOnly ? 'changed-only' : 'full sitemap'}`)
  if (dryRun) log('DRY RUN — no submissions will be made')

  const urls = collectUrls(baseUrl, changedOnly)

  if (urls.length === 0) {
    log('No URLs to submit.')
    return
  }

  log(`Found ${urls.length} URLs to submit`)
  await submitToIndexNow(urls, key, baseUrl, dryRun)
  log('Done.')
}

main().catch((error) => {
  err(error.message)
  process.exit(1)
})
