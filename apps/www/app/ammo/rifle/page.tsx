import type { Metadata } from 'next'
import { BRAND } from '@/lib/brand'
import { CategoryPageLayout, type CategoryCaliber } from '@/components/CategoryPageLayout'

export const metadata: Metadata = {
  title: 'Rifle Ammo Prices — Compare Deals | IronScout',
  description:
    'Compare rifle ammo prices for 5.56 NATO, .223, .308 Win, 6.5 Creedmoor, 7.62x39, .300 BLK, and .30-06 across retailers.',
  alternates: { canonical: `${BRAND.wwwUrl}/ammo/rifle/` },
  openGraph: {
    title: 'Rifle Ammo Prices — Compare Deals | IronScout',
    description: 'Compare rifle ammo prices for 5.56, .308, 6.5CM, 7.62x39, .300 BLK, and .30-06 across retailers.',
    url: `${BRAND.wwwUrl}/ammo/rifle/`,
    siteName: 'IronScout',
    type: 'website',
  },
}

const calibers: CategoryCaliber[] = [
  {
    name: '5.56 NATO',
    slug: '556-nato',
    fmjRange: '$0.28–0.42/rd',
    jhpRange: '$0.80–1.20/rd',
    types: [
      { label: 'FMJ/M193', href: '/caliber/556-nato/fmj' },
      { label: 'Green Tip', href: '/caliber/556-nato/green-tip' },
      { label: 'Match', href: '/caliber/556-nato/match-grade' },
      { label: 'Bulk', href: '/caliber/556-nato/bulk' },
    ],
    popularSearches: [
      { label: 'Cheap 5.56 brass case', query: '5.56 nato fmj brass cheap' },
      { label: 'M855 green tip 1000 rounds', query: 'm855 green tip 1000' },
      { label: 'Bulk 5.56 case deal', query: 'bulk 5.56 1000 rounds case' },
    ],
  },
  {
    name: '.223 Remington',
    slug: '223-remington',
    fmjRange: '$0.28–0.40/rd',
    jhpRange: '$0.55–1.00/rd',
    types: [
      { label: 'FMJ', href: '/caliber/223-remington/fmj' },
      { label: 'Match', href: '/caliber/223-remington/match-grade' },
      { label: 'Varmint', href: '/caliber/223-remington/varmint' },
    ],
    popularSearches: [
      { label: 'Wolf Gold .223 case', query: 'wolf gold 223 1000' },
    ],
  },
  {
    name: '.308 Winchester',
    slug: '308-winchester',
    fmjRange: '$0.55–0.75/rd',
    jhpRange: '$0.80–1.30/rd',
    types: [
      { label: 'FMJ', href: '/caliber/308-winchester/fmj' },
      { label: 'Match', href: '/caliber/308-winchester/match-grade' },
      { label: 'Hunting', href: '/caliber/308-winchester/hunting' },
      { label: 'Bulk', href: '/caliber/308-winchester/bulk' },
    ],
    popularSearches: [
      { label: 'Federal Gold Medal Match .308', query: 'federal gold medal match 308' },
      { label: '.308 hunting soft point', query: '308 hunting soft point' },
    ],
  },
  {
    name: '6.5 Creedmoor',
    slug: '65-creedmoor',
    fmjRange: '$0.70–0.95/rd',
    jhpRange: '$0.85–1.30/rd',
    types: [
      { label: 'Match', href: '/caliber/65-creedmoor/match-grade' },
      { label: 'Hunting', href: '/caliber/65-creedmoor/hunting' },
    ],
    popularSearches: [
      { label: 'Hornady ELD Match 6.5CM', query: 'hornady eld match 6.5 creedmoor' },
    ],
  },
  {
    name: '7.62x39',
    slug: '762x39',
    fmjRange: '$0.22–0.50/rd',
    jhpRange: '$0.60–0.90/rd',
    types: [
      { label: 'FMJ', href: '/caliber/762x39/fmj' },
      { label: 'HP', href: '/caliber/762x39/hollow-point' },
      { label: 'Bulk', href: '/caliber/762x39/bulk' },
    ],
    popularSearches: [
      { label: 'Steel case 7.62x39 bulk', query: 'steel case 7.62x39 1000' },
      { label: 'Brass case 7.62x39', query: 'brass case 7.62x39' },
    ],
  },
  {
    name: '.300 Blackout',
    slug: '300-blackout',
    fmjRange: '$0.50–0.75/rd',
    jhpRange: '$0.60–1.40/rd',
    types: [
      { label: 'Subsonic', href: '/caliber/300-blackout/subsonic' },
      { label: 'Supersonic', href: '/caliber/300-blackout/supersonic' },
      { label: 'HP', href: '/caliber/300-blackout/hollow-point' },
    ],
    popularSearches: [
      { label: '.300 BLK subsonic suppressor', query: '300 blackout subsonic suppressor' },
    ],
  },
  {
    name: '.30-06 Springfield',
    slug: '30-06-springfield',
    fmjRange: '$0.60–0.85/rd',
    jhpRange: '$0.80–1.50/rd',
    types: [
      { label: 'FMJ', href: '/caliber/30-06-springfield/fmj' },
      { label: 'Hunting', href: '/caliber/30-06-springfield/hunting' },
      { label: 'Match', href: '/caliber/30-06-springfield/match-grade' },
    ],
    popularSearches: [
      { label: '.30-06 deer hunting ammo', query: '30-06 deer hunting soft point' },
    ],
  },
]

export default function RifleCategoryPage() {
  return (
    <CategoryPageLayout
      title="Rifle ammo prices"
      description="Compare prices across retailers for every major rifle caliber — from budget 5.56 range ammo to precision 6.5 Creedmoor match loads."
      calibers={calibers}
    />
  )
}
