import { BRAND } from '@/lib/brand'

const baseUrl = BRAND.wwwUrl.replace(/\/$/, '')

interface BreadcrumbItem {
  name: string
  href: string
}

function toCanonicalAbsoluteUrl(href: string): string {
  const normalizedHref = href.trim()

  if (/^https?:\/\//i.test(normalizedHref)) {
    const absoluteUrl = new URL(normalizedHref)
    const normalizedPath = absoluteUrl.pathname === '/'
      ? ''
      : absoluteUrl.pathname.replace(/\/+$/, '')
    return `${absoluteUrl.origin}${normalizedPath}${absoluteUrl.search}${absoluteUrl.hash}`
  }

  const normalizedPath = normalizedHref.startsWith('/') ? normalizedHref : `/${normalizedHref}`
  if (normalizedPath === '/') {
    return baseUrl
  }
  return `${baseUrl}${normalizedPath.replace(/\/+$/, '')}`
}

/**
 * Renders a BreadcrumbList JSON-LD script tag for SEO.
 */
export function BreadcrumbJsonLd({ items }: { items: BreadcrumbItem[] }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: toCanonicalAbsoluteUrl(item.href),
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

/**
 * Renders a WebSite JSON-LD script tag with SearchAction for sitelinks search box.
 */
export function WebSiteJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'IronScout',
    url: baseUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${BRAND.appUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

/**
 * Renders an Organization JSON-LD script tag.
 */
export function OrganizationJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'IronScout',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    sameAs: [],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

/**
 * Renders a FAQPage JSON-LD script tag.
 */
export function FaqJsonLd({
  questions,
}: {
  questions: Array<{ question: string; answer: string }>
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}

/**
 * Renders a raw JSON-LD schema object as a script tag.
 * Used for pre-built schema objects like caliber FAQ schemas.
 */
export function RawJsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

/**
 * Renders a Product + AggregateOffer JSON-LD script tag for caliber pages.
 * Uses market snapshot data for price range and offer count.
 */
export function CaliberProductJsonLd({
  caliberName,
  slug,
  description,
  lowPrice,
  highPrice,
  offerCount,
}: {
  caliberName: string
  slug: string
  description: string
  lowPrice: number
  highPrice: number
  offerCount: number
}) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${caliberName} Ammo`,
    description,
    category: `Ammunition > ${caliberName}`,
    url: `${baseUrl}/caliber/${slug}`,
    offers: {
      '@type': 'AggregateOffer',
      lowPrice: lowPrice.toFixed(2),
      highPrice: highPrice.toFixed(2),
      priceCurrency: 'USD',
      offerCount: String(offerCount),
      availability: 'https://schema.org/InStock',
      url: `${baseUrl}/caliber/${slug}`,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
