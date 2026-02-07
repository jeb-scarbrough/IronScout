import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'
import { CategoryPageLayout, type CategoryCaliber } from '@/components/CategoryPageLayout'

export const metadata: Metadata = {
  title: 'Shotgun Ammo Prices — Compare Deals | IronScout',
  description:
    'Compare 12 gauge shotshell prices across 15+ retailers. Target loads from $0.25/rd, buckshot from $0.60/rd. Updated daily.',
  alternates: { canonical: `${BRAND.wwwUrl}/ammo/shotgun/` },
  openGraph: {
    title: 'Shotgun Ammo Prices — Compare Deals | IronScout',
    description: 'Compare 12 gauge shotshell prices across 15+ retailers. Target loads from $0.25/rd.',
    url: `${BRAND.wwwUrl}/ammo/shotgun/`,
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
      calibers={calibers}
    />
  )
}
