import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MarketingMarkdownPage } from '@/components/MarketingMarkdownPage'
import { BRAND } from '@/lib/brand'
import { getContentSlugs, readMarkdownContent } from '@/lib/content'

export const dynamicParams = false

export function generateStaticParams() {
  return getContentSlugs('ammo').map((slug) => ({ slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const content = readMarkdownContent('ammo', params.slug)
  if (!content) {
    return { title: 'Product Not Found | IronScout' }
  }

  const title = content.frontmatter.title || 'Ammo Prices | IronScout'
  const description = content.frontmatter.description

  return {
    title,
    description,
    alternates: {
      canonical: `${BRAND.wwwUrl}/ammo/${params.slug}/`,
    },
    openGraph: {
      title,
      description,
      url: `${BRAND.wwwUrl}/ammo/${params.slug}/`,
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

export default function AmmoProductPage({ params }: { params: { slug: string } }) {
  const content = readMarkdownContent('ammo', params.slug)
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
