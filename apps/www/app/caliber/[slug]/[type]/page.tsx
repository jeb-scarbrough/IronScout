import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MarketingMarkdownPage } from '@/components/MarketingMarkdownPage'
import { BreadcrumbJsonLd } from '@/components/JsonLd'
import { BRAND } from '@/lib/brand'
import { getNestedContentSlugs, readNestedMarkdownContent, readMarkdownContent } from '@/lib/content'
import {
  computeSnapshotArtifactSha256,
  createCaliberDatasetJsonLd,
  createUnavailableSnapshotArtifact,
  readSnapshotArtifactBySlug,
  serializeJsonForScript,
} from '@/lib/market-snapshots'

export const dynamicParams = false

export function generateStaticParams() {
  return getNestedContentSlugs('caliber-types').map(({ parent, child }) => ({
    slug: parent,
    type: child,
  }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; type: string }>
}): Promise<Metadata> {
  const { slug, type } = await params
  const content = readNestedMarkdownContent('caliber-types', slug, type)
  if (!content) {
    return { title: 'Not Found | IronScout' }
  }

  const title = content.frontmatter.title || 'Ammo Prices | IronScout'
  const description = content.frontmatter.description

  return {
    title,
    description,
    alternates: {
      canonical: `${BRAND.wwwUrl}/caliber/${slug}/${type}/`,
    },
    openGraph: {
      title,
      description,
      url: `${BRAND.wwwUrl}/caliber/${slug}/${type}/`,
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

export default async function CaliberTypePage({
  params,
}: {
  params: Promise<{ slug: string; type: string }>
}) {
  const { slug, type } = await params
  const content = readNestedMarkdownContent('caliber-types', slug, type)
  if (!content) {
    notFound()
  }

  const heading = content.frontmatter.heading || 'Ammo Prices'
  const subheading = content.frontmatter.subheading
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

  // Get parent caliber name for breadcrumb
  const parentContent = readMarkdownContent('calibers', slug)
  const parentName = parentContent?.frontmatter.heading || slug
  const typeName = content.frontmatter.heading || type
  const caliberLabel = `${parentName} ${typeName}`.trim()
  const snapshot = readSnapshotArtifactBySlug(slug)
  const embeddedSnapshot = snapshot ?? createUnavailableSnapshotArtifact(slug)
  const embeddedSnapshotSha256 = computeSnapshotArtifactSha256(embeddedSnapshot)
  const datasetJsonLd = createCaliberDatasetJsonLd(caliberLabel, slug, snapshot, BRAND.wwwUrl)

  return (
    <>
      <script
        type="application/json"
        id={`market-snapshot-${slug}`}
        data-artifact-sha256={embeddedSnapshotSha256}
        dangerouslySetInnerHTML={{
          __html: serializeJsonForScript(embeddedSnapshot),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonForScript(datasetJsonLd),
        }}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', href: '/' },
          { name: 'Calibers', href: '/calibers' },
          { name: parentName, href: `/caliber/${slug}` },
          { name: typeName, href: `/caliber/${slug}/${type}` },
        ]}
      />
      <MarketingMarkdownPage
        heading={heading}
        subheading={subheading}
        content={content.body}
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
        priceRange={priceRange}
        observedMarketContext={{
          caliberLabel,
          snapshot,
        }}
        breadcrumbs={[
          { label: 'Home', href: '/' },
          { label: 'Calibers', href: '/calibers' },
          { label: parentName, href: `/caliber/${slug}` },
          { label: typeName, href: `/caliber/${slug}/${type}` },
        ]}
      />
    </>
  )
}
