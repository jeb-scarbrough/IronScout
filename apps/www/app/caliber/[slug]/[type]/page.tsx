import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MarketingMarkdownPage } from '@/components/MarketingMarkdownPage'
import { BRAND } from '@/lib/brand'
import { getNestedContentSlugs, readNestedMarkdownContent } from '@/lib/content'

export const dynamicParams = false

export function generateStaticParams() {
  return getNestedContentSlugs('caliber-types').map(({ parent, child }) => ({
    slug: parent,
    type: child,
  }))
}

export function generateMetadata({
  params,
}: {
  params: { slug: string; type: string }
}): Metadata {
  const content = readNestedMarkdownContent('caliber-types', params.slug, params.type)
  if (!content) {
    return { title: 'Not Found | IronScout' }
  }

  const title = content.frontmatter.title || 'Ammo Prices | IronScout'
  const description = content.frontmatter.description

  return {
    title,
    description,
    alternates: {
      canonical: `${BRAND.wwwUrl}/caliber/${params.slug}/${params.type}/`,
    },
    openGraph: {
      title,
      description,
      url: `${BRAND.wwwUrl}/caliber/${params.slug}/${params.type}/`,
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

export default function CaliberTypePage({
  params,
}: {
  params: { slug: string; type: string }
}) {
  const content = readNestedMarkdownContent('caliber-types', params.slug, params.type)
  if (!content) {
    notFound()
  }

  const heading = content.frontmatter.heading || 'Ammo Prices'
  const subheading = content.frontmatter.subheading
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

  return (
    <MarketingMarkdownPage
      heading={heading}
      subheading={subheading}
      content={content.body}
      primaryCta={primaryCta}
      secondaryCta={secondaryCta}
    />
  )
}
