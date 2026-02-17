import type { Metadata } from 'next'
import { Suspense } from 'react'
import { Header } from '../components/Header'
import { ContactSupportForm } from '../components/ContactSupportForm'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: 'Contact Support | IronScout',
  description: 'Contact IronScout support for account, site, and pricing platform issues.',
  alternates: {
    canonical: `${BRAND.wwwUrl}/contact`,
  },
  openGraph: {
    title: 'Contact Support | IronScout',
    description: 'Contact IronScout support for account, site, and pricing platform issues.',
    url: `${BRAND.wwwUrl}/contact`,
    siteName: 'IronScout',
    type: 'website',
  },
}

export default function ContactPage() {
  return (
    <div className="relative">
      <Header currentPage="home" />
      <section className="pt-12 pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card border-iron-800/80 bg-iron-950/70">
            <div className="p-8">
              <div className="text-xs font-mono uppercase tracking-[0.3em] text-iron-500">Support</div>
              <h1 className="mt-3 text-3xl font-display font-semibold">
                Contact IronScout support
              </h1>
              <p className="mt-3 text-iron-400">
                Send a message and our team will follow up by email. Include as much detail as possible so we can resolve your issue quickly.
              </p>
              <div className="mt-8">
                <Suspense fallback={<p className="text-sm text-iron-400">Loading contact form…</p>}>
                  <ContactSupportForm />
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
