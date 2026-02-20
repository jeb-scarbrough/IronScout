import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'
import { CategoryPageLayout, type CategoryCaliber } from '@/components/CategoryPageLayout'

export const metadata: Metadata = {
  title: 'Shotgun Ammo Prices — Compare Deals | IronScout',
  description:
    'Compare 12 gauge shotshell prices across multiple retailers. Target loads from $0.25/rd, buckshot from $0.60/rd. Updated daily.',
  alternates: { canonical: `${BRAND.wwwUrl}/ammo/shotgun` },
  openGraph: {
    title: 'Shotgun Ammo Prices — Compare Deals | IronScout',
    description: 'Compare 12 gauge shotshell prices across multiple retailers. Target loads from $0.25/rd.',
    url: `${BRAND.wwwUrl}/ammo/shotgun`,
    siteName: 'IronScout',
    type: 'website',
  },
}

const calibers: CategoryCaliber[] = [
  {
    name: '12 Gauge',
    slug: '12-gauge',
    fmjRange: '$0.25–0.40/rd',
    jhpRange: '$0.60–1.30/rd',
    types: [
      { label: 'Birdshot', href: '/caliber/12-gauge/birdshot' },
      { label: 'Buckshot', href: '/caliber/12-gauge/buckshot' },
      { label: 'Slug', href: '/caliber/12-gauge/slug' },
      { label: 'Target', href: '/caliber/12-gauge/target-load' },
    ],
    popularSearches: [
      { label: '12 gauge 00 buckshot', query: '12 gauge 00 buckshot' },
      { label: 'Federal Top Gun target loads', query: 'federal top gun 12 gauge' },
      { label: '12 gauge slugs for deer', query: '12 gauge slug deer hunting' },
      { label: 'Cheap 12 gauge target ammo', query: 'cheap 12 gauge target load' },
      { label: 'Federal FliteControl buckshot', query: 'federal flitecontrol 00 buckshot' },
      { label: '12 gauge case deal (250 shells)', query: '12 gauge case 250' },
    ],
  },
]

export default function ShotgunCategoryPage() {
  return (
    <CategoryPageLayout
      title="Shotgun ammo prices"
      description="Compare 12 gauge prices across retailers — target loads for clay shooting, buckshot for defense, and slugs for deer hunting."
      categoryIntro={
        <>
          <p>
            The 12 gauge is the most versatile firearms caliber in existence — a single
            shotgun can run light target loads at the trap range on Saturday, load buckshot
            for home defense, and take a deer with slugs during rifle season. That versatility
            means the shotgun ammo market is really three separate markets with very different
            price dynamics.
          </p>
          <p>
            Target and trap loads are the volume segment. Federal Top Gun and Winchester AA
            are the standard choices for clay shooting. Competitive shooters burn through
            200–500 shells per session, so price per shell is the primary purchasing factor.
            Buying by the flat (10 boxes, 250 shells) cuts per-shell cost meaningfully.
          </p>
          <p>
            For home defense, 00 buckshot is the standard recommendation. Federal FliteControl
            is widely considered the best-patterning buckshot available — its wad design keeps
            pellets significantly tighter than standard buckshot at indoor distances. Equipping
            a home defense shotgun with a full tube of premium buckshot costs remarkably little
            compared to other defensive ammunition categories.
          </p>
          <p>
            Slugs cover deer hunting in shotgun-only zones, ranging from basic Foster-style
            rifled slugs for smoothbore barrels to precision sabot slugs for rifled barrels
            with dramatically better accuracy at distance.
          </p>
          <p>
            Price ranges in the table below are updated daily across multiple online retailers.
          </p>
        </>
      }
      calibers={calibers}
      breadcrumbName="Shotgun"
      breadcrumbHref="/ammo/shotgun"
    />
  )
}
