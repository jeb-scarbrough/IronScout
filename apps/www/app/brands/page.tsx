import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/app/components/Header'
import { MarketingFooter } from '@/components/MarketingFooter'
import { BreadcrumbJsonLd } from '@/components/JsonLd'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: 'Ammo Brands — Compare Prices by Manufacturer | IronScout',
  description:
    'Browse ammunition by brand. Compare prices from Federal, Hornady, Winchester, CCI, Speer, Remington, Magtech, and more across multiple retailers.',
  alternates: {
    canonical: `${BRAND.wwwUrl}/brands`,
  },
  openGraph: {
    title: 'Ammo Brands — Compare Prices by Manufacturer | IronScout',
    description:
      'Browse ammunition by brand. Compare prices from Federal, Hornady, Winchester, CCI, Speer, Remington, and more.',
    url: `${BRAND.wwwUrl}/brands`,
    siteName: 'IronScout',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Ammo Brands — Compare Prices by Manufacturer | IronScout',
    description:
      'Browse ammunition by brand. Compare prices from Federal, Hornady, Winchester, and more.',
  },
}

const brands = [
  {
    name: 'Federal',
    slug: 'federal',
    country: 'USA',
    note: 'HST, American Eagle, Gold Medal Match',
    calibers: ['9mm', '5.56 NATO', '.308 Win', '.45 ACP', '.22 LR', '12 Gauge'],
  },
  {
    name: 'Hornady',
    slug: 'hornady',
    country: 'USA',
    note: 'Critical Defense, ELD Match, Frontier',
    calibers: ['9mm', '5.56 NATO', '.308 Win', '6.5 CM', '.300 BLK'],
  },
  {
    name: 'Winchester',
    slug: 'winchester',
    country: 'USA',
    note: 'White Box, PDX1, Super-X',
    calibers: ['9mm', '5.56 NATO', '.308 Win', '.45 ACP', '12 Gauge'],
  },
  {
    name: 'CCI / Blazer',
    slug: 'cci',
    country: 'USA',
    note: 'Blazer Brass, Mini-Mag, Stinger',
    calibers: ['9mm', '.22 LR', '.45 ACP', '.380 ACP', '5.56 NATO'],
  },
  {
    name: 'Speer',
    slug: 'speer',
    country: 'USA',
    note: 'Gold Dot — #1 LE duty round',
    calibers: ['9mm', '.45 ACP', '.40 S&W', '.380 ACP'],
  },
  {
    name: 'Remington',
    slug: 'remington',
    country: 'USA',
    note: 'UMC, Core-Lokt, Golden Saber',
    calibers: ['9mm', '5.56 NATO', '.308 Win', '.30-06', '12 Gauge'],
  },
  {
    name: 'Magtech',
    slug: 'magtech',
    country: 'Brazil',
    note: 'Budget brass-cased FMJ',
    calibers: ['9mm', '.380 ACP', '.45 ACP', '7.62x39'],
  },
  {
    name: 'Sellier & Bellot',
    slug: 'sellier-bellot',
    country: 'Czech Republic',
    note: 'Budget European brass-cased ammo',
    calibers: ['.308 Win', '6.5 CM', '10mm Auto', '7.62x39', '.300 BLK'],
  },
  {
    name: 'Fiocchi',
    slug: 'fiocchi',
    country: 'Italy',
    note: 'Range ammo and target shotshells',
    calibers: ['9mm', '5.56 NATO', '12 Gauge'],
  },
  {
    name: 'Prvi Partizan (PPU)',
    slug: 'prvi-partizan',
    country: 'Serbia',
    note: 'Budget mil-spec and match loads',
    calibers: ['.308 Win', '5.56 NATO', '6.5 CM', '.30-06'],
  },
]

export default function BrandsHubPage() {
  return (
    <div className="min-h-screen bg-background">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', href: '/' },
          { name: 'Brands', href: '/brands' },
        ]}
      />
      <Header />

      <main className="max-w-5xl mx-auto px-6 py-12 pt-12">
        <header className="mb-10">
          <h1
            className="text-4xl md:text-5xl font-bold text-iron-100 mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Ammo prices by brand
          </h1>
          <p className="text-lg text-iron-400 leading-relaxed max-w-3xl">
            Browse ammunition from every major manufacturer. Each brand page
            shows popular calibers, product lines, and links to compare prices
            across retailers.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={`${BRAND.appUrl}/search`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary inline-flex items-center"
            >
              Search All Ammo
            </a>
            <Link href="/calibers" className="btn-secondary inline-flex items-center">
              Browse by Caliber
            </Link>
          </div>
        </header>

        <div className="space-y-4">
          {brands.map((brand) => (
            <Link
              key={brand.slug}
              href={`/brand/${brand.slug}`}
              className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-iron-800 px-5 py-4 hover:border-iron-600 hover:bg-iron-900/30 transition-all group gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-iron-200 font-semibold text-lg group-hover:text-primary transition-colors">
                    {brand.name}
                  </span>
                  <span className="text-xs text-iron-600">{brand.country}</span>
                </div>
                <p className="text-sm text-iron-500">{brand.note}</p>
              </div>
              <div className="flex flex-wrap gap-1.5 sm:justify-end">
                {brand.calibers.map((cal) => (
                  <span
                    key={cal}
                    className="text-xs text-iron-500 bg-iron-900 px-2 py-0.5 rounded"
                  >
                    {cal}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>

        {/* Cross-links */}
        <div className="mt-12 pt-8 border-t border-iron-800/50 space-y-4">
          <p className="text-sm text-iron-500">
            Looking for a specific caliber instead?{' '}
            <Link href="/calibers" className="text-iron-300 hover:text-primary transition-colors">
              Browse all calibers →
            </Link>
          </p>
          <p className="text-sm text-iron-500">
            Want to compare across stores?{' '}
            See where to buy from{' '}
            <Link href="/retailer/lucky-gunner" className="text-iron-300 hover:text-primary transition-colors">Lucky Gunner</Link>,{' '}
            <Link href="/retailer/midwayusa" className="text-iron-300 hover:text-primary transition-colors">MidwayUSA</Link>,{' '}
            <Link href="/retailer/palmetto-state-armory" className="text-iron-300 hover:text-primary transition-colors">Palmetto State Armory</Link>,{' '}
            <Link href="/retailer/target-sports-usa" className="text-iron-300 hover:text-primary transition-colors">Target Sports USA</Link>, and{' '}
            <Link href="/retailer/sportsmans-warehouse" className="text-iron-300 hover:text-primary transition-colors">Sportsman&apos;s Warehouse</Link>.
          </p>
        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}
