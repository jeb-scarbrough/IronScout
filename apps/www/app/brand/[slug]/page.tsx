import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MarketingMarkdownPage } from '@/components/MarketingMarkdownPage'
import { BreadcrumbJsonLd } from '@/components/JsonLd'
import { BRAND } from '@/lib/brand'
import { getContentSlugs, readMarkdownContent } from '@/lib/content'

export const dynamicParams = false

export function generateStaticParams() {
  return getContentSlugs('brands').map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const content = readMarkdownContent('brands', slug)
  if (!content) {
    return { title: 'Brand Not Found | IronScout' }
  }

  const title = content.frontmatter.title || 'Ammo Brand Prices | IronScout'
  const description = content.frontmatter.description

  return {
    title,
    description,
    alternates: {
      canonical: `${BRAND.wwwUrl}/brand/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${BRAND.wwwUrl}/brand/${slug}`,
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

export default async function BrandPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const content = readMarkdownContent('brands', slug)
  if (!content) {
    notFound()
  }

  const heading = content.frontmatter.heading || 'Ammo Brand Prices'
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

  const displayName = content.frontmatter.heading || slug

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', href: '/' },
          { name: displayName, href: `/brand/${slug}` },
        ]}
      />
      <MarketingMarkdownPage
        heading={heading}
        subheading={subheading}
        content={content.body}
        primaryCta={primaryCta}
        secondaryCta={secondaryCta}
      />
    </>
  )
}
