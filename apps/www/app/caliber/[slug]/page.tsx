import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MarketingMarkdownPage } from '@/components/MarketingMarkdownPage'
import { BreadcrumbJsonLd } from '@/components/JsonLd'
import { BRAND } from '@/lib/brand'
import { getCaliberAliasEntries, resolveCaliberSlug } from '@/lib/caliber-aliases'
import { getContentSlugs, readMarkdownContent } from '@/lib/content'
import {
  computeSnapshotArtifactSha256,
  createCaliberDatasetJsonLd,
  createUnavailableSnapshotArtifact,
  readSnapshotArtifactBySlug,
  serializeJsonForScript,
} from '@/lib/market-snapshots'

export const dynamicParams = false

export function generateStaticParams() {
  const canonicalSlugs = getContentSlugs('calibers')
  const canonicalSet = new Set(canonicalSlugs)
  const aliasSlugs = getCaliberAliasEntries()
    .filter(([, canonicalSlug]) => canonicalSet.has(canonicalSlug))
    .map(([aliasSlug]) => aliasSlug)

  return [...canonicalSlugs, ...aliasSlugs].map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug: rawSlug } = await params
  const slug = resolveCaliberSlug(rawSlug)
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
      canonical: `${BRAND.wwwUrl}/caliber/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${BRAND.wwwUrl}/caliber/${slug}`,
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
  const { slug: rawSlug } = await params
  const slug = resolveCaliberSlug(rawSlug)
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
          snapshot,
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
