import type { MetadataRoute } from 'next'
import { BRAND } from '@/lib/brand'
import { getContentSlugs, getNestedContentSlugs } from '@/lib/content'
import { readSnapshotArtifactBySlug } from '@/lib/market-snapshots'

export const dynamic = 'force-static'

const baseUrl = BRAND.wwwUrl.replace(/\/$/, '')

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (normalizedPath === '/') {
    return baseUrl
  }

  const canonicalPath = normalizedPath.replace(/\/+$/, '')
  return `${baseUrl}${canonicalPath}`
}

function entry(
  path: string,
  changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency'],
  priority: number,
  lastModified?: Date
): MetadataRoute.Sitemap[0] {
  return {
    url: buildUrl(path),
    lastModified: lastModified ?? new Date(),
    changeFrequency,
    priority,
  }
}

/**
 * Returns the most recent snapshot computedAt date across all calibers,
 * useful as a lastModified proxy for hub/category pages that aggregate
 * snapshot data.
 */
function getLatestSnapshotDate(caliberSlugs: string[]): Date {
  let latest: Date | null = null
  for (const slug of caliberSlugs) {
    const snapshot = readSnapshotArtifactBySlug(slug)
    if (snapshot?.computedAt) {
      const d = new Date(snapshot.computedAt)
      if (!latest || d > latest) latest = d
    }
  }
  return latest ?? new Date()
}

/**
 * Returns the snapshot computedAt date for a single caliber slug,
 * falling back to build time if no snapshot exists.
 */
function getSnapshotDate(slug: string): Date {
  const snapshot = readSnapshotArtifactBySlug(slug)
  return snapshot?.computedAt ? new Date(snapshot.computedAt) : new Date()
}

export default function sitemap(): MetadataRoute.Sitemap {
  const caliberSlugs = getContentSlugs('calibers').sort()
  const brandSlugs = getContentSlugs('brands').sort()
  const retailerSlugs = getContentSlugs('retailers').sort()
  const ammoSlugs = getContentSlugs('ammo').sort()
  const caliberTypes = getNestedContentSlugs('caliber-types')

  const latestSnapshot = getLatestSnapshotDate(caliberSlugs)

  return [
    // Core pages
    entry('/', 'weekly', 1, latestSnapshot),
    entry('/about', 'monthly', 0.7),
    entry('/contact', 'monthly', 0.6),
    entry('/retailers', 'monthly', 0.8),
    entry('/privacy', 'monthly', 0.3),
    entry('/terms', 'monthly', 0.3),

    // Hub & category pages — use latest snapshot date since they show aggregated data
    entry('/calibers', 'weekly', 0.9, latestSnapshot),
    entry('/brands', 'monthly', 0.8),
    entry('/ammo/handgun', 'weekly', 0.8, latestSnapshot),
    entry('/ammo/rifle', 'weekly', 0.8, latestSnapshot),
    entry('/ammo/rimfire', 'weekly', 0.8, latestSnapshot),
    entry('/ammo/shotgun', 'weekly', 0.8, latestSnapshot),

    // Caliber pages — use per-caliber snapshot date
    ...caliberSlugs.map((slug) =>
      entry(`/caliber/${slug}`, 'weekly', 0.8, getSnapshotDate(slug))
    ),

    // Caliber × type intersection pages — use parent caliber snapshot date
    ...caliberTypes.map(({ parent, child }) =>
      entry(`/caliber/${parent}/${child}`, 'weekly', 0.7, getSnapshotDate(parent))
    ),

    // Product-line pages
    ...ammoSlugs.map((slug) => entry(`/ammo/${slug}`, 'weekly', 0.7)),

    // Brand pages
    ...brandSlugs.map((slug) => entry(`/brand/${slug}`, 'weekly', 0.5)),

    // Retailer pages
    ...retailerSlugs.map((slug) => entry(`/retailer/${slug}`, 'weekly', 0.5)),
  ]
}
