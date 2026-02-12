import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MarketingMarkdownPage } from '@/components/MarketingMarkdownPage'
import { BreadcrumbJsonLd } from '@/components/JsonLd'
import { BRAND } from '@/lib/brand'
import { getContentSlugs, readMarkdownContent } from '@/lib/content'

export const dynamicParams = false

export function generateStaticParams() {
  return getContentSlugs('calibers').map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const content = readMarkdownContent('calibers', slug)
  if (!content) {
    return { title: 'Caliber Not Found | IronScout' }
  }

  const title = content.frontmatter.title || 'Ammo Prices by Caliber | IronScout'
  const description = content.frontmatter.description

  return {
    title,
    description,
    alternates: {
      canonical: `${BRAND.wwwUrl}/caliber/${slug}/`,
    },
    openGraph: {
      title,
      description,
      url: `${BRAND.wwwUrl}/caliber/${slug}/`,
      siteName: 'IronScout',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

const CATEGORY_LABELS: Record<string, string> = {
  handgun: 'Handgun',
  rifle: 'Rifle',
  rimfire: 'Rimfire',
  shotgun: 'Shotgun',
}

export default async function CaliberPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const content = readMarkdownContent('calibers', slug)
  if (!content) {
    notFound()
  }

  const heading = content.frontmatter.heading || 'Ammo Prices by Caliber'
  const subheading = content.frontmatter.subheading
  const category = content.frontmatter.category
  const priceRange = content.frontmatter.priceRange
  const primaryCta = content.frontmatter.ctaPrimaryLabel && content.frontmatter.ctaPrimaryPath
    ? {
        label: content.frontmatter.ctaPrimaryLabel,
        href: `${BRAND.appUrl}${content.frontmatter.ctaPrimaryPath}`,
      }
    : undefined
  const secondaryCta = content.frontmatter.ctaSecondaryLabel && content.frontmatter.ctaSecondaryPath
    ? {
        label: content.frontmatter.ctaSecondaryLabel,
        href: `${BRAND.appUrl}${content.frontmatter.ctaSecondaryPath}`,
      }
    : undefined

  const displayName = content.frontmatter.heading || slug
  const caliberLabel = displayName
  const categoryLabel = CATEGORY_LABELS[category] || category

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Dataset',
            name: `${caliberLabel} Ammo Observed Pricing`,
            description: 'Observed price and availability data with historical context. Summaries appear once sufficient observations are available.',
            temporalCoverage: 'P30D',
            variableMeasured: ['price_per_round', 'availability_status'],
            measurementTechnique: 'Deterministic observation-based aggregation',
            isAccessibleForFree: true,
          }),
        }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', href: '/' },
          { name: 'Calibers', href: '/calibers' },
          { name: displayName, href: `/caliber/${slug}` },
        ]}
      />
      <MarketingMarkdownPage
        heading={heading}
        subheading={subheading}
        content={content.body}
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        category={categoryLabel}
        priceRange={priceRange}
        observedMarketContext={{
          caliberLabel,
          lastUpdated: null,
          sampleCount: null,
          median: null,
          min: null,
          max: null,
        }}
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Calibers', href: '/calibers' },
          { label: displayName, href: `/caliber/${slug}` },
        ]}
      />
    </>
  )
}
