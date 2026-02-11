import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/app/components/Header'
import { MarketingFooter } from '@/components/MarketingFooter'
import { BreadcrumbJsonLd } from '@/components/JsonLd'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: 'Ammo Prices by Caliber — Compare Deals | IronScout',
  description:
    'Compare ammunition prices across 14 calibers and 15+ retailers. Handgun, rifle, rimfire, and shotgun ammo deals updated daily.',
  alternates: {
    canonical: `${BRAND.wwwUrl}/calibers/`,
  },
  openGraph: {
    title: 'Ammo Prices by Caliber — Compare Deals | IronScout',
    description:
      'Compare ammunition prices across 14 calibers and 15+ retailers. Handgun, rifle, rimfire, and shotgun ammo deals updated daily.',
    url: `${BRAND.wwwUrl}/calibers/`,
    siteName: 'IronScout',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Ammo Prices by Caliber — Compare Deals | IronScout',
    description:
      'Compare ammunition prices across 14 calibers and 15+ retailers.',
  },
}

const categories = [
  {
    name: 'Handgun',
    href: '/ammo/handgun',
    calibers: [
      { name: '9mm', href: '/caliber/9mm', note: 'Most popular' },
      { name: '.45 ACP', href: '/caliber/45-acp', note: '' },
      { name: '.380 ACP', href: '/caliber/380-acp', note: 'Micro-compact carry' },
      { name: '.40 S&W', href: '/caliber/40-sw', note: '' },
      { name: '10mm Auto', href: '/caliber/10mm-auto', note: 'Woods carry' },
    ],
  },
  {
    name: 'Rifle',
    href: '/ammo/rifle',
    calibers: [
      { name: '5.56 NATO', href: '/caliber/556-nato', note: 'Most popular rifle' },
      { name: '.223 Remington', href: '/caliber/223-remington', note: '' },
      { name: '.308 Winchester', href: '/caliber/308-winchester', note: 'Full-power' },
      { name: '6.5 Creedmoor', href: '/caliber/65-creedmoor', note: 'Long-range' },
      { name: '7.62x39', href: '/caliber/762x39', note: 'AK/SKS' },
      { name: '.300 Blackout', href: '/caliber/300-blackout', note: 'Suppressed AR' },
      { name: '.30-06 Springfield', href: '/caliber/30-06-springfield', note: 'Classic hunting' },
    ],
  },
  {
    name: 'Rimfire',
    href: '/ammo/rimfire',
    calibers: [
      { name: '.22 LR', href: '/caliber/22-lr', note: 'Cheapest to shoot' },
    ],
  },
  {
    name: 'Shotgun',
    href: '/ammo/shotgun',
    calibers: [
      { name: '12 Gauge', href: '/caliber/12-gauge', note: 'Target, buck, slug' },
    ],
  },
]

export default function CalibersHubPage() {
  return (
    <div className="min-h-screen bg-background">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', href: '/' },
          { name: 'All Calibers', href: '/calibers' },
        ]}
      />
      <Header />

      <main className="max-w-5xl mx-auto px-6 py-12 pt-12">
        <header className="mb-10">
          <h1
            className="text-4xl md:text-5xl font-bold text-iron-100 mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Ammo prices by caliber
          </h1>
          <p className="text-lg text-iron-400 leading-relaxed max-w-3xl">
            Compare prices across retailers for every major caliber. Select a
            category or jump straight to a caliber.
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
          </div>
        </header>

        <div className="space-y-12">
          {categories.map((cat) => (
            <section key={cat.name}>
              <div className="flex items-baseline gap-3 mb-4">
                <h2 className="text-2xl font-semibold text-iron-200">
                  <Link
                    href={cat.href}
                    className="hover:text-primary transition-colors"
                  >
                    {cat.name}
                  </Link>
                </h2>
                <Link
                  href={cat.href}
                  className="text-sm text-iron-500 hover:text-iron-300 transition-colors"
                >
                  View all →
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cat.calibers.map((cal) => (
                  <Link
                    key={cal.href}
                    href={cal.href}
                    className="flex items-baseline justify-between rounded-lg border border-iron-800 px-4 py-3 hover:border-iron-600 hover:bg-iron-900/30 transition-all group"
                  >
                    <span className="text-iron-200 font-medium group-hover:text-primary transition-colors">
                      {cal.name}
                    </span>
                    {cal.note && (
                      <span className="text-xs text-iron-500">{cal.note}</span>
                    )}
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>

      <MarketingFooter />
    </div>
  )
}
