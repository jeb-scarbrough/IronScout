import Markdown from 'react-markdown'
import Link from 'next/link'
import { Header } from '@/app/components/Header'
import { BRAND } from '@/lib/brand'

interface MarketingMarkdownPageProps {
  heading: string
  subheading?: string
  content: string
  primaryCta?: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
}

export function MarketingMarkdownPage({
  heading,
  subheading,
  content,
  primaryCta,
  secondaryCta,
}: MarketingMarkdownPageProps) {
  // Replace APP_URL placeholder with actual app URL for deep links
  const processedContent = content.replace(/APP_URL/g, BRAND.appUrl)

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-5xl mx-auto px-6 py-12 pt-28">
        <header className="mb-10">
          <h1
            className="text-4xl md:text-5xl font-bold text-iron-100 mb-4"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {heading}
          </h1>
          {subheading && (
            <p className="text-lg text-iron-400 leading-relaxed max-w-3xl">
              {subheading}
            </p>
          )}
          {(primaryCta || secondaryCta) && (
            <div className="mt-6 flex flex-wrap gap-3">
              {primaryCta && (
                <a
                  href={primaryCta.href}
                  className="btn-primary inline-flex items-center"
                >
                  {primaryCta.label}
                </a>
              )}
              {secondaryCta && (
                <a
                  href={secondaryCta.href}
                  className="btn-secondary inline-flex items-center"
                >
                  {secondaryCta.label}
                </a>
              )}
            </div>
          )}
        </header>

        <article className="prose prose-invert prose-iron max-w-none">
          <Markdown
            components={{
              h2: ({ children }) => (
                <h2 className="text-2xl md:text-3xl font-semibold text-iron-200 mt-10 mb-4">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-lg font-semibold text-iron-300 mt-6 mb-3">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="text-iron-400 leading-relaxed mb-4">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="list-disc list-inside text-iron-400 mb-4 space-y-1">
                  {children}
                </ul>
              ),
              li: ({ children }) => (
                <li className="text-iron-400">
                  {children}
                </li>
              ),
              strong: ({ children }) => (
                <strong className="text-iron-200 font-semibold">
                  {children}
                </strong>
              ),
              // Links: internal use Next.js Link, external open new tab
              a: ({ href, children }) => {
                const resolvedHref = href || '#'
                const isExternal = resolvedHref.startsWith('http')

                if (isExternal) {
                  return (
                    <a
                      href={resolvedHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 underline transition-colors"
                    >
                      {children}
                    </a>
                  )
                }

                return (
                  <Link
                    href={resolvedHref}
                    className="text-primary hover:text-primary/80 underline transition-colors"
                  >
                    {children}
                  </Link>
                )
              },
              // Table components for product-line tables
              table: ({ children }) => (
                <div className="overflow-x-auto mb-6 -mx-2">
                  <table className="w-full text-sm text-iron-300 border-collapse min-w-[600px]">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="text-xs text-iron-400 uppercase bg-iron-900/50 border-b border-iron-700">
                  {children}
                </thead>
              ),
              tbody: ({ children }) => (
                <tbody className="divide-y divide-iron-800/50">
                  {children}
                </tbody>
              ),
              tr: ({ children }) => (
                <tr className="hover:bg-iron-900/30 transition-colors">
                  {children}
                </tr>
              ),
              th: ({ children }) => (
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-4 py-3">
                  {children}
                </td>
              ),
            }}
          >
            {processedContent}
          </Markdown>
        </article>
      </main>

      <footer className="border-t border-iron-800 mt-12">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Browse by caliber — SEO internal links */}
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
