import Markdown from 'react-markdown'
import Link from 'next/link'
import { Header } from '@/app/components/Header'

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
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="text-primary hover:text-primary/80 underline transition-colors"
                >
                  {children}
                </a>
              ),
            }}
          >
            {content}
          </Markdown>
        </article>
      </main>

      <footer className="border-t border-iron-800 mt-12">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="flex flex-wrap gap-6 text-sm text-iron-500">
            <Link href="/privacy" className="hover:text-iron-300 transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-iron-300 transition-colors">
              Terms of Service
            </Link>
            <Link href="/about" className="hover:text-iron-300 transition-colors">
              About
            </Link>
            <Link href="/" className="hover:text-iron-300 transition-colors">
              Home
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
