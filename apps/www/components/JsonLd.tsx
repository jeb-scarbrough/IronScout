import { BRAND } from '@/lib/brand'

const baseUrl = BRAND.wwwUrl.replace(/\/$/, '')

interface BreadcrumbItem {
  name: string
  href: string
}

function toCanonicalAbsoluteUrl(href: string): string {
  const normalizedPath = href.startsWith('/') ? href : `/${href}`
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
