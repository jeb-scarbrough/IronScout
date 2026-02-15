import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Link from 'next/link'
import { Header } from '@/app/components/Header'
import { MarketingFooter } from '@/components/MarketingFooter'
import {
  ObservedMarketContextBlock,
  type ObservedMarketContextBlockProps,
} from '@/components/ObservedMarketContextBlock'
import { BRAND } from '@/lib/brand'

interface BreadcrumbItem {
  label: string
  href: string
}

interface MarketingMarkdownPageProps {
  heading: string
  subheading?: string
  content: string
  primaryCta?: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  breadcrumbs?: BreadcrumbItem[]
  /** Price range to show in hero, e.g. "$0.17–$1.00" */
  priceRange?: string
  /** Category label, e.g. "Handgun" or "Rifle" */
  category?: string
  observedMarketContext?: ObservedMarketContextBlockProps
}

export function MarketingMarkdownPage({
  heading,
  subheading,
  content,
  primaryCta,
  secondaryCta,
  breadcrumbs,
  priceRange,
  category,
  observedMarketContext,
}: MarketingMarkdownPageProps) {
  // Replace APP_URL placeholder with actual app URL for deep links
  const processedContent = content.replace(/APP_URL/g, BRAND.appUrl)

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 pt-8 sm:pt-12">
        {/* Breadcrumbs */}
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav
            aria-label="Breadcrumb"
            className="mb-6 flex items-center gap-2 text-sm text-iron-500"
          >
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.href} className="flex items-center gap-2">
                {i > 0 && (
                  <svg className="w-3.5 h-3.5 text-iron-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
                {i === breadcrumbs.length - 1 ? (
                  <span className="text-iron-400 font-medium">{crumb.label}</span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="hover:text-iron-300 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </span>
            ))}
          </nav>
        )}

        {/* Hero header with optional stats */}
        <header className="mb-10">
          <div className="flex flex-wrap items-start gap-3 mb-3">
            {category && (
              <span className="inline-flex items-center px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-primary bg-primary/10 rounded">
                {category}
              </span>
            )}
          </div>
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-iron-100 mb-4 leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {heading}
          </h1>
          {subheading && (
            <p className="text-lg text-iron-400 leading-relaxed max-w-3xl">
              {subheading}
            </p>
          )}

          {/* Price summary + CTA row */}
          <div className="mt-6 flex flex-col sm:flex-row sm:flex-wrap sm:items-start gap-3 sm:gap-4">
            {priceRange && (
              <div className="flex items-baseline gap-2 px-4 py-2 rounded-lg bg-iron-900/60 border border-iron-800 w-full sm:w-auto">
                <span className="text-xs text-iron-500 uppercase tracking-wider font-medium">Price range</span>
                <span className="text-lg font-semibold text-iron-100 font-mono">{priceRange}</span>
                <span className="text-xs text-iron-500">/rd</span>
              </div>
            )}
            {primaryCta && (
              <a
                href={primaryCta.href}
                className="btn-primary inline-flex items-center justify-center w-full sm:w-auto"
              >
                {primaryCta.label}
                <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </a>
            )}
            {secondaryCta && (
              <div className="flex flex-col items-start gap-1 w-full sm:w-auto">
                <a
                  href={secondaryCta.href}
                  className="btn-secondary inline-flex items-center justify-center w-full sm:w-auto"
                >
                  {secondaryCta.label}
                  <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </a>
                <span className="text-xs text-iron-500 ml-1">Free account required</span>
              </div>
            )}
          </div>
        </header>

        {observedMarketContext && (
          <div className="mb-8">
            <ObservedMarketContextBlock {...observedMarketContext} />
          </div>
        )}

        {/* Article body */}
        <article className="prose prose-invert prose-iron max-w-none">
          <Markdown
            remarkPlugins={[remarkGfm]}
            components={{
              h2: ({ children }) => (
                <h2 className="text-2xl md:text-3xl font-semibold text-iron-100 mt-12 mb-5 pb-2 border-b border-iron-800/60">
                  {children}
                </h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-lg font-semibold text-iron-200 mt-8 mb-3">
                  {children}
                </h3>
              ),
              p: ({ children }) => (
                <p className="text-iron-300 leading-relaxed mb-5 text-base">
                  {children}
                </p>
              ),
              ul: ({ children }) => (
                <ul className="mb-6 space-y-2">
                  {children}
                </ul>
              ),
              li: ({ children }) => (
                <li className="flex items-start gap-3 text-iron-300 text-base leading-relaxed">
                  <span className="mt-2 block w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  <span>{children}</span>
                </li>
              ),
              strong: ({ children }) => (
                <strong className="text-iron-100 font-semibold">
                  {children}
                </strong>
              ),
              em: ({ children }) => (
                <em className="text-iron-200 italic">
                  {children}
                </em>
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
                      className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
                    >
                      {children}
                    </a>
                  )
                }

                return (
                  <Link
                    href={resolvedHref}
                    className="text-primary hover:text-primary/80 underline underline-offset-2 transition-colors"
                  >
                    {children}
                  </Link>
                )
              },
              // Table components — professional comparison table
              table: ({ children }) => (
                <div className="overflow-x-auto mb-8 rounded-lg border border-iron-800 bg-iron-900/30 -mx-4 sm:mx-0">
                  <table className="w-full text-sm text-iron-300 min-w-[480px]">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="text-xs text-iron-400 uppercase tracking-wider bg-iron-900/60 border-b border-iron-700">
                  {children}
                </thead>
              ),
              tbody: ({ children }) => (
                <tbody className="divide-y divide-iron-800/40">
                  {children}
                </tbody>
              ),
              tr: ({ children }) => (
                <tr className="hover:bg-iron-800/20 transition-colors">
                  {children}
                </tr>
              ),
              th: ({ children }) => (
                <th className="px-3 sm:px-4 py-3 text-left font-semibold whitespace-nowrap">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-3 sm:px-4 py-3 whitespace-nowrap">
                  {children}
                </td>
              ),
              // Blockquotes as callout boxes
              blockquote: ({ children }) => (
                <blockquote className="my-6 px-5 py-4 rounded-lg border-l-4 border-primary bg-primary/5 text-iron-300 [&>p]:mb-0 [&>p]:text-iron-300">
                  {children}
                </blockquote>
              ),
              // Horizontal rules as section dividers
              hr: () => (
                <hr className="my-10 border-iron-800/50" />
              ),
            }}
          >
            {processedContent}
          </Markdown>
        </article>
      </main>

      <MarketingFooter />
    </div>
  )
}
