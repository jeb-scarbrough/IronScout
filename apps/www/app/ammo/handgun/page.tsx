import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'
import { CategoryPageLayout, type CategoryCaliber } from '@/components/CategoryPageLayout'

export const metadata: Metadata = {
  title: 'Handgun Ammo Prices — Compare Deals | IronScout',
  description:
    'Compare handgun ammo prices for 9mm, .45 ACP, .380 ACP, .40 S&W, and 10mm Auto across multiple retailers. Updated daily.',
  alternates: { canonical: `${BRAND.wwwUrl}/ammo/handgun` },
  openGraph: {
    title: 'Handgun Ammo Prices — Compare Deals | IronScout',
    description: 'Compare handgun ammo prices for 9mm, .45 ACP, .380 ACP, .40 S&W, and 10mm Auto across multiple retailers.',
    url: `${BRAND.wwwUrl}/ammo/handgun`,
    siteName: 'IronScout',
    type: 'website',
  },
}

const calibers: CategoryCaliber[] = [
  {
    name: '9mm',
    slug: '9mm',
    fmjRange: '$0.17–0.25/rd',
    jhpRange: '$0.50–1.00/rd',
    types: [
      { label: 'FMJ', href: '/caliber/9mm/fmj' },
      { label: 'Hollow Point', href: '/caliber/9mm/hollow-point' },
      { label: '+P', href: '/caliber/9mm/plus-p' },
      { label: 'Bulk', href: '/caliber/9mm/bulk' },
    ],
    popularSearches: [
      { label: 'Cheap 9mm FMJ range ammo', query: '9mm fmj range cheap' },
      { label: 'Federal HST 9mm 50-round', query: 'federal hst 9mm 50' },
      { label: 'Bulk 9mm 1000 rounds', query: 'bulk 9mm 1000 rounds' },
    ],
  },
  {
    name: '.45 ACP',
    slug: '45-acp',
    fmjRange: '$0.28–0.40/rd',
    jhpRange: '$0.60–1.10/rd',
    types: [
      { label: 'FMJ', href: '/caliber/45-acp/fmj' },
      { label: 'Hollow Point', href: '/caliber/45-acp/hollow-point' },
      { label: 'Bulk', href: '/caliber/45-acp/bulk' },
    ],
    popularSearches: [
      { label: 'Cheap .45 ACP range ammo', query: '45 acp fmj cheap' },
      { label: 'Federal HST .45 ACP', query: 'federal hst 45 acp' },
    ],
  },
  {
    name: '.380 ACP',
    slug: '380-acp',
    fmjRange: '$0.22–0.35/rd',
    jhpRange: '$0.50–0.90/rd',
    types: [
      { label: 'FMJ', href: '/caliber/380-acp/fmj' },
      { label: 'Hollow Point', href: '/caliber/380-acp/hollow-point' },
    ],
    popularSearches: [
      { label: '.380 ACP self-defense ammo', query: '380 acp hollow point defense' },
    ],
  },
  {
    name: '.40 S&W',
    slug: '40-sw',
    fmjRange: '$0.25–0.38/rd',
    jhpRange: '$0.55–0.90/rd',
    types: [
      { label: 'FMJ', href: '/caliber/40-sw/fmj' },
      { label: 'Hollow Point', href: '/caliber/40-sw/hollow-point' },
    ],
    popularSearches: [
      { label: '.40 S&W clearance deals', query: '40 sw ammo deal' },
    ],
  },
  {
    name: '10mm Auto',
    slug: '10mm-auto',
    fmjRange: '$0.35–0.55/rd',
    jhpRange: '$0.60–1.50/rd',
    types: [
      { label: 'FMJ', href: '/caliber/10mm-auto/fmj' },
      { label: 'Hollow Point', href: '/caliber/10mm-auto/hollow-point' },
    ],
    popularSearches: [
      { label: '10mm bear defense ammo', query: '10mm auto hard cast bear' },
      { label: 'Full-power 10mm', query: '10mm auto full power' },
    ],
  },
]

export default function HandgunCategoryPage() {
  return (
    <CategoryPageLayout
      title="Handgun ammo prices"
      description="Compare prices across retailers for every major handgun caliber — from budget 9mm range ammo to premium 10mm woods carry loads."
      categoryIntro={
        <>
          <p>
            The handgun ammunition market splits into two distinct buying patterns:
            high-volume range ammo purchased by the case, and premium defensive ammo
            purchased by the box. Understanding which category you&apos;re shopping in
            determines where the real value is.
          </p>
          <p>
            For range and training use, 9mm dominates on price and availability. Full
            metal jacket loads from Blazer Brass, Magtech, and Federal American Eagle are
            the workhorses of the handgun range — and buying in bulk case quantities
            consistently beats box pricing by 10–15%. The .45 ACP and .40 S&amp;W cost
            meaningfully more per round for equivalent FMJ, which is why most high-volume
            handgun shooters gravitate toward 9mm for practice regardless of what they carry.
          </p>
          <p>
            For self-defense and concealed carry, bullet design matters more than price.
            Federal HST, Speer Gold Dot, and Hornady Critical Defense are the three most
            widely recommended hollow point lines across all handgun calibers, with extensive
            law enforcement track records. At the margins, the 10mm Auto stands apart — it&apos;s
            the only mainstream semi-auto handgun caliber with enough energy for serious woods
            carry and handgun hunting, with hard-cast loads from Buffalo Bore and Underwood
            designed specifically for large-animal defense.
          </p>
          <p>
            Price ranges in the table below are updated daily and reflect current retail availability.
          </p>
        </>
      }
      calibers={calibers}
      breadcrumbName="Handgun"
      breadcrumbHref="/ammo/handgun"
    />
  )
}
