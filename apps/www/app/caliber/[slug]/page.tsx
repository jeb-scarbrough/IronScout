import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MarketingMarkdownPage } from '@/components/MarketingMarkdownPage'
import { BRAND } from '@/lib/brand'
import { getContentSlugs, readMarkdownContent } from '@/lib/content'

export const dynamicParams = false

export function generateStaticParams() {
  return getContentSlugs('calibers').map((slug) => ({ slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const content = readMarkdownContent('calibers', params.slug)
  if (!content) {
    return { title: 'Caliber Not Found | IronScout' }
  }

  const title = content.frontmatter.title || 'Ammo Prices by Caliber | IronScout'
  const description = content.frontmatter.description

  return {
    title,
    description,
  }
}

export default function CaliberPage({ params }: { params: { slug: string } }) {
  const content = readMarkdownContent('calibers', params.slug)
  if (!content) {
    notFound()
  }

  const heading = content.frontmatter.heading || 'Ammo Prices by Caliber'
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
