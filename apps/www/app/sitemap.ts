import type { MetadataRoute } from 'next'
import { BRAND } from '@/lib/brand'
import { getContentSlugs } from '@/lib/content'

const baseUrl = BRAND.wwwUrl.replace(/\/$/, '')

function buildUrl(path: string): string {
  if (!path.startsWith('/')) {
    return `${baseUrl}/${path}`
  }
  return `${baseUrl}${path}`
}

function withDefaults(path: string, changeFrequency: MetadataRoute.Sitemap[0]['changeFrequency'], priority: number): MetadataRoute.Sitemap[0] {
  return {
    url: buildUrl(path),
    lastModified: new Date(),
    changeFrequency,
    priority,
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const caliberSlugs = getContentSlugs('calibers').sort()
  const brandSlugs = getContentSlugs('brands').sort()
  const retailerSlugs = getContentSlugs('retailers').sort()

  return [
    withDefaults('/', 'weekly', 1),
    withDefaults('/about', 'monthly', 0.7),
    withDefaults('/retailers', 'monthly', 0.8),
    withDefaults('/privacy', 'monthly', 0.3),
    withDefaults('/terms', 'monthly', 0.3),
    ...caliberSlugs.map((slug) => withDefaults(`/caliber/${slug}`, 'weekly', 0.6)),
    ...brandSlugs.map((slug) => withDefaults(`/brand/${slug}`, 'weekly', 0.5)),
    ...retailerSlugs.map((slug) => withDefaults(`/retailer/${slug}`, 'weekly', 0.5)),
  ]
}
