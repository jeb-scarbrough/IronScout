import Link from 'next/link'
import { Header } from '@/app/components/Header'
import { BreadcrumbJsonLd } from '@/components/JsonLd'
import { BRAND } from '@/lib/brand'

export interface CategoryCaliber {
  name: string
  slug: string
  fmjRange: string
  jhpRange: string
  types: Array<{ label: string; href: string }>
  popularSearches: Array<{ label: string; query: string }>
}

interface CategoryPageLayoutProps {
  title: string
  description: string
  calibers: CategoryCaliber[]
  breadcrumbName: string
  breadcrumbHref: string
}

export function CategoryPageLayout({
  title,
  description,
  calibers,
  breadcrumbName,
  breadcrumbHref,
}: CategoryPageLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', href: '/' },
          { name: 'Calibers', href: '/calibers' },
          { name: breadcrumbName, href: breadcrumbHref },
        ]}
      />
      <Header />

      <main className="max-w-5xl mx-auto px-6 py-12 pt-12">
        <header className="mb-10">
          <h1
            className="text-4xl md:text-5xl font-bold text-iron-100 mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {title}
          </h1>
          <p className="text-lg text-iron-400 leading-relaxed max-w-3xl">
            {description}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/calibers" className="btn-secondary inline-flex items-center">
              All Calibers
            </Link>
          </div>
        </header>

        {/* Caliber comparison table */}
        <div className="overflow-x-auto mb-10 -mx-2">
          <table className="w-full text-sm text-iron-300 border-collapse min-w-[500px]">
            <thead className="text-xs text-iron-400 uppercase bg-iron-900/50 border-b border-iron-700">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Caliber</th>
                <th className="px-4 py-3 text-left font-medium">FMJ Range</th>
                <th className="px-4 py-3 text-left font-medium">JHP/Defense</th>
                <th className="px-4 py-3 text-left font-medium">Browse Types</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-iron-800/50">
              {calibers.map((cal) => (
                <tr key={cal.slug} className="hover:bg-iron-900/30 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/caliber/${cal.slug}`}
                      className="text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      {cal.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{cal.fmjRange}</td>
                  <td className="px-4 py-3">{cal.jhpRange}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {cal.types.map((t) => (
                        <Link
                          key={t.href}
                          href={t.href}
                          className="text-xs px-2 py-0.5 rounded bg-iron-800 text-iron-400 hover:text-iron-200 hover:bg-iron-700 transition-colors"
                        >
                          {t.label}
                        </Link>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Popular searches */}
        <section className="mb-10">
          <h2 className="text-2xl font-semibold text-iron-200 mb-4">
            Popular searches
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {calibers.flatMap((cal) =>
              cal.popularSearches.map((s) => (
                <a
                  key={s.query}
                  href={`${BRAND.appUrl}/search?q=${encodeURIComponent(s.query)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center rounded-lg border border-iron-800 px-4 py-2.5 hover:border-iron-600 hover:bg-iron-900/30 transition-all text-sm text-iron-400 hover:text-iron-200"
                >
                  <span className="mr-auto">{s.label}</span>
                  <span className="text-iron-600 text-xs">→</span>
                </a>
              ))
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-iron-800 mt-12">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="mb-6 pb-6 border-b border-iron-800/50">
            <p className="text-xs text-iron-500 uppercase tracking-wider font-medium mb-3">
              Browse Ammo Prices
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-iron-500">
              <Link href="/calibers" className="hover:text-iron-300 transition-colors">
                All Calibers
              </Link>
              <Link href="/ammo/handgun" className="hover:text-iron-300 transition-colors">
                Handgun
              </Link>
              <Link href="/ammo/rifle" className="hover:text-iron-300 transition-colors">
                Rifle
              </Link>
              <Link href="/ammo/rimfire" className="hover:text-iron-300 transition-colors">
                Rimfire
              </Link>
              <Link href="/ammo/shotgun" className="hover:text-iron-300 transition-colors">
                Shotgun
              </Link>
              <span className="text-iron-700">|</span>
              <Link href="/caliber/9mm" className="hover:text-iron-300 transition-colors">
                9mm
              </Link>
              <Link href="/caliber/556-nato" className="hover:text-iron-300 transition-colors">
                5.56 NATO
              </Link>
              <Link href="/caliber/308-winchester" className="hover:text-iron-300 transition-colors">
                .308 Win
              </Link>
              <Link href="/caliber/22-lr" className="hover:text-iron-300 transition-colors">
                .22 LR
              </Link>
              <Link href="/caliber/45-acp" className="hover:text-iron-300 transition-colors">
                .45 ACP
              </Link>
              <Link href="/caliber/12-gauge" className="hover:text-iron-300 transition-colors">
                12 Gauge
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-6 text-sm text-iron-500">
            <Link href="/" className="hover:text-iron-300 transition-colors">
              Home
            </Link>
            <Link href="/about" className="hover:text-iron-300 transition-colors">
              About
            </Link>
            <Link href="/retailers" className="hover:text-iron-300 transition-colors">
              Retailers
            </Link>
            <Link href="/privacy" className="hover:text-iron-300 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-iron-300 transition-colors">
              Terms of Service
            </Link>
          </div>
          <p className="text-iron-600 text-sm mt-4">
            &copy; {new Date().getFullYear()} IronScout. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
