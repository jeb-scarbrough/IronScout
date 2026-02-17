import type { MetadataRoute } from 'next'
import { BRAND } from '@/lib/brand'
import { getContentSlugs, getNestedContentSlugs } from '@/lib/content'
import { CALIBER_SLUG_MAP } from '@ironscout/db/calibers.js'

export const dynamic = 'force-static'

const baseUrl = BRAND.wwwUrl.replace(/\/$/, '')

function buildUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`

  if (normalizedPath === '/') {
    return `${baseUrl}/`
  }

  // Do not force trailing slash for file-style resources (e.g. .json artifacts).
  if (/\.[a-z0-9]+$/i.test(normalizedPath)) {
    return `${baseUrl}${normalizedPath}`
  }

  const canonicalPath = normalizedPath.endsWith('/') ? normalizedPath : `${normalizedPath}/`
  return `${baseUrl}${canonicalPath}`
}

function withDefaults(
  path: string,
  changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency'],
  priority: number
): MetadataRoute.Sitemap[0] {
  return {
    url: buildUrl(path),
    lastModified: new Date(),
    changeFrequency,
    priority,
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const caliberSlugs = getContentSlugs('calibers').sort()
  const snapshotArtifactSlugs = Object.keys(CALIBER_SLUG_MAP).sort()
  const brandSlugs = getContentSlugs('brands').sort()
  const retailerSlugs = getContentSlugs('retailers').sort()
  const ammoSlugs = getContentSlugs('ammo').sort()
  const caliberTypes = getNestedContentSlugs('caliber-types')

  return [
    // Core pages
    withDefaults('/', 'weekly', 1),
    withDefaults('/about', 'monthly', 0.7),
    withDefaults('/retailers', 'monthly', 0.8),
    withDefaults('/privacy', 'monthly', 0.3),
    withDefaults('/terms', 'monthly', 0.3),

    // Hub & category pages
    withDefaults('/calibers', 'weekly', 0.9),
    withDefaults('/ammo/handgun', 'weekly', 0.8),
    withDefaults('/ammo/rifle', 'weekly', 0.8),
    withDefaults('/ammo/rimfire', 'weekly', 0.8),
    withDefaults('/ammo/shotgun', 'weekly', 0.8),

    // Caliber pages
    ...caliberSlugs.map((slug) => withDefaults(`/caliber/${slug}`, 'weekly', 0.8)),

    // Caliber × type intersection pages
    ...caliberTypes.map(({ parent, child }) =>
      withDefaults(`/caliber/${parent}/${child}`, 'weekly', 0.7)
    ),

    // Product-line pages
    ...ammoSlugs.map((slug) => withDefaults(`/ammo/${slug}`, 'weekly', 0.7)),

    // Brand pages
    ...brandSlugs.map((slug) => withDefaults(`/brand/${slug}`, 'weekly', 0.5)),

    // Retailer pages
    ...retailerSlugs.map((slug) => withDefaults(`/retailer/${slug}`, 'weekly', 0.5)),

    // Public snapshot artifacts (Option A for crawler-visible market snapshot data)
    withDefaults('/market-snapshots/30d/index.json', 'daily', 0.7),
    ...snapshotArtifactSlugs.map((slug) =>
      withDefaults(`/market-snapshots/30d/${slug}.json`, 'daily', 0.6)
    ),
  ]
}
