import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'
import { CategoryPageLayout, type CategoryCaliber } from '@/components/CategoryPageLayout'

export const metadata: Metadata = {
  title: 'Rimfire Ammo Prices — Compare Deals | IronScout',
  description:
    'Compare .22 LR rimfire ammo prices across 15+ retailers. Bulk plinking from $0.04/rd, match-grade from $0.10/rd. Updated daily.',
  alternates: { canonical: `${BRAND.wwwUrl}/ammo/rimfire/` },
  openGraph: {
    title: 'Rimfire Ammo Prices — Compare Deals | IronScout',
    description: 'Compare .22 LR rimfire ammo prices across 15+ retailers. Bulk plinking from $0.04/rd.',
    url: `${BRAND.wwwUrl}/ammo/rimfire/`,
    siteName: 'IronScout',
    type: 'website',
  },
}

const calibers: CategoryCaliber[] = [
  {
    name: '.22 LR',
    slug: '22-lr',
    fmjRange: '$0.04–0.08/rd',
    jhpRange: '$0.07–0.15/rd',
    types: [
      { label: 'Standard', href: '/caliber/22-lr/standard' },
      { label: 'Hollow Point', href: '/caliber/22-lr/hollow-point' },
      { label: 'Subsonic', href: '/caliber/22-lr/subsonic' },
      { label: 'Bulk', href: '/caliber/22-lr/bulk' },
    ],
    popularSearches: [
      { label: 'CCI Mini-Mag .22 LR', query: 'cci mini mag 22 lr' },
      { label: 'Bulk .22 LR 500 brick', query: 'bulk 22 lr 500 brick' },
      { label: '.22 LR 5000 round case', query: '22 lr 5000 round case' },
      { label: 'CCI Blazer .22 LR bulk', query: 'cci blazer 22 lr bulk' },
      { label: '.22 LR subsonic suppressor', query: '22 lr subsonic suppressor' },
      { label: 'Cheap .22 LR plinking ammo', query: 'cheap 22 lr plinking' },
    ],
  },
]

export default function RimfireCategoryPage() {
  return (
    <CategoryPageLayout
      title="Rimfire ammo prices"
      description="Compare .22 LR prices across retailers — from bulk plinking bricks to match-grade target ammo and suppressor-friendly subsonic loads."
      calibers={calibers}
    />
  )
}
