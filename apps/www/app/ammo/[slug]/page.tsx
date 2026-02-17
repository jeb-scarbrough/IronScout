import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MarketingMarkdownPage } from '@/components/MarketingMarkdownPage'
import { BreadcrumbJsonLd } from '@/components/JsonLd'
import { BRAND } from '@/lib/brand'
import { getContentSlugs, readMarkdownContent } from '@/lib/content'

export const dynamicParams = false

export function generateStaticParams() {
  return getContentSlugs('ammo').map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const content = readMarkdownContent('ammo', slug)
  if (!content) {
    return { title: 'Product Not Found | IronScout' }
  }

  const title = content.frontmatter.title || 'Ammo Prices | IronScout'
  const description = content.frontmatter.description

  return {
    title,
    description,
    alternates: {
      canonical: `${BRAND.wwwUrl}/ammo/${slug}`,
    },
    openGraph: {
      title,
      description,
      url: `${BRAND.wwwUrl}/ammo/${slug}`,
      siteName: 'IronScout',
      type: 'website',
      images: [{ url: `${BRAND.wwwUrl}/og/default.png`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${BRAND.wwwUrl}/og/default.png`],
    },
  }
}

export default async function AmmoProductPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const content = readMarkdownContent('ammo', slug)
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

  const displayName = content.frontmatter.heading || slug
  const caliberSlug = content.frontmatter.caliber
  const breadcrumbs = [
    { name: 'Home', href: '/' },
    { name: 'Calibers', href: '/calibers' },
  ]
  if (caliberSlug) {
    const caliberContent = readMarkdownContent('calibers', caliberSlug)
    breadcrumbs.push({
      name: caliberContent?.frontmatter.heading || caliberSlug,
      href: `/caliber/${caliberSlug}`,
    })
  }
  breadcrumbs.push({ name: displayName, href: `/ammo/${slug}` })

  return (
    <>
      <BreadcrumbJsonLd items={breadcrumbs} />
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
