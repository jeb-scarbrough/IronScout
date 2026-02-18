import type { Metadata } from 'next';
import Script from 'next/script';
import { Header } from './components/Header';
import { HeroSearch } from './components/HeroSearch';
import { FaqAccordion } from './components/FaqAccordion';
import { IronScoutLogo } from '@ironscout/ui/components';
import { BRAND } from '@/lib/brand';

const APP_URL = BRAND.appUrl;

export const metadata: Metadata = {
  title: 'Compare Ammo Prices Across 15+ Retailers | IronScout',
  description:
    'Compare ammunition prices for 9mm, 5.56, .308, .22 LR and 14 calibers across 15+ online retailers. Track price history, set alerts, and find deals. Free to use.',
  alternates: {
    canonical: `${BRAND.wwwUrl}`,
  },
  openGraph: {
    title: 'Compare Ammo Prices Across 15+ Retailers | IronScout',
    description:
      'Compare ammunition prices for 9mm, 5.56, .308, .22 LR and more across 15+ retailers. Track price history, set alerts, and find deals.',
    url: `${BRAND.wwwUrl}`,
    siteName: 'IronScout',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Compare Ammo Prices Across 15+ Retailers | IronScout',
    description:
      'Compare ammunition prices for 9mm, 5.56, .308, .22 LR and more. Free ammo price tracker with alerts.',
  },
};

const whyIronScoutItems = [
  {
    question: "We're not a marketplace",
    answer: "IronScout is an indexing and intelligence layer. We don't sell ammo, intermediate checkout, or compete with retailers. We help you understand what's available and where.",
  },
  {
    question: 'We show real price history',
    answer: "See how prices have changed over time for any product. Historical context helps you understand whether today's price is actually good or just normal.",
  },
  {
    question: 'Results are ordered by intent, not just price',
    answer: "Looking for range ammo? Defense rounds? Match-grade precision? IronScout surfaces results based on what you're actually trying to do, not just the lowest sticker price.",
  },
  {
    question: "We don't tell you what to buy",
    answer: 'No recommendations, no "best deals," no urgency tactics. IronScout provides information and context. The decision is always yours.',
  },
  {
    question: 'Your calibers save you time',
    answer: "Add what you shoot and IronScout focuses on relevant results automatically. No more filtering through calibers you don't own.",
  },
  {
    question: 'Alerts that respect your attention',
    answer: "Get notified when prices drop or items come back in stock. No spam, no manufactured urgency—just the changes that actually matter to you.",
  },
  {
    question: 'Transparent about how we work',
    answer: 'When something is promoted or paid, it\'s clearly labeled. Relevance and accuracy come before monetization.',
  },
  {
    question: 'Built by shooters who got tired of bad search',
    answer: 'IronScout exists because we wanted something better for ourselves. We understand the frustration of endless tabs and price-checking because we lived it.',
  },
];

export default function Home() {
  return (
    <div className="relative">
      <Script
        src="http://classic.avantlink.com/affiliate_app_confirm.php?mode=js&authResponse=5423c26e1614d014410b8b21eb80807de155a8dd"
        strategy="afterInteractive"
      />
      <Header currentPage="home" />

      {/* Hero Section */}
      <section className="relative pt-16 pb-16">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -right-64 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -left-64 w-[500px] h-[500px] bg-gunmetal-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-4">
              Search ammo prices<br />
              <span className="text-gradient">like a shooter</span>
            </h1>
            <p className="text-xl md:text-2xl text-iron-400 font-display mb-10">
              AI-powered search. Results that make sense.
            </p>

            {/* Interactive search — client component */}
            <HeroSearch />

            {/* Account Prompt */}
            <div className="bg-iron-900/50 border border-iron-800 rounded-xl p-6 max-w-xl mx-auto">
              <p className="text-iron-300 mb-4">
                Tell us what you shoot. We&apos;ll alert you to price drops and back-in-stock items.
              </p>
              <a
                href={`${APP_URL}/auth/signup`}
                className="btn-primary inline-flex items-center"
              >
                Create Free Account Today
                <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="pt-14 pb-24 border-t border-iron-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="section-heading mb-4">
              Not Your Average<br />
              <span className="text-gradient">Ammo Search</span>
            </h2>
            <p className="text-iron-400 text-lg max-w-2xl mx-auto">
              Most ammo search stops at price lists. We built something that actually understands
              how shooters buy.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Intent-Aware Search',
                description:
                  'Range ammo and carry ammo are different decisions. IronScout understands your use case and orders results accordingly.',
                iconPath:
                  'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
              },
              {
                title: 'Personal Caliber Context',
                description:
                  'Save what you shoot and stop filtering through irrelevant results. Your calibers shape your experience automatically.',
                iconPath:
                  'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
              },
              {
                title: 'Market Awareness',
                description:
                  "See price history and get alerts for changes that matter. Understand whether today's price is actually good.",
                iconPath:
                  'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
              },
            ].map((feature, i) => (
              <div key={i} className="card group hover:border-iron-600 transition-colors">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-4 group-hover:bg-primary/20 transition-colors">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.iconPath} />
                  </svg>
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-iron-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Browse Ammo Prices Section — SEO internal links */}
      <section className="pt-16 pb-24 border-t border-iron-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="section-heading mb-4">
              Browse <span className="text-gradient">Ammo Prices</span>
            </h2>
            <p className="text-iron-400 text-lg max-w-2xl mx-auto mb-4">
              Compare prices across retailers by caliber and category.
            </p>
            <p className="text-iron-500 text-base max-w-3xl mx-auto">
              IronScout tracks ammunition prices daily across major online retailers.
              Browse by category — handgun, rifle, rimfire, or shotgun — or jump to a
              specific caliber to see current price ranges, popular product lines, and
              bulk deals.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Handgun Ammo', href: '/ammo/handgun' },
              { label: 'Rifle Ammo', href: '/ammo/rifle' },
              { label: 'Rimfire Ammo', href: '/ammo/rimfire' },
              { label: 'Shotgun Ammo', href: '/ammo/shotgun' },
            ].map((cat) => (
              <a
                key={cat.href}
                href={cat.href}
                className="card text-center group hover:border-iron-600 transition-colors py-6"
              >
                <span className="font-display text-lg font-semibold text-iron-200 group-hover:text-primary transition-colors">
                  {cat.label}
                </span>
              </a>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            {[
              { label: '9mm', href: '/caliber/9mm' },
              { label: '5.56 NATO', href: '/caliber/556-nato' },
              { label: '.308 Win', href: '/caliber/308-winchester' },
              { label: '.22 LR', href: '/caliber/22-lr' },
              { label: '.45 ACP', href: '/caliber/45-acp' },
              { label: '12 Gauge', href: '/caliber/12-gauge' },
              { label: '.300 BLK', href: '/caliber/300-blackout' },
              { label: '6.5 Creedmoor', href: '/caliber/65-creedmoor' },
              { label: '7.62x39', href: '/caliber/762x39' },
              { label: '.223 Rem', href: '/caliber/223-remington' },
              { label: '.380 ACP', href: '/caliber/380-acp' },
              { label: '.40 S&W', href: '/caliber/40-sw' },
              { label: '10mm Auto', href: '/caliber/10mm-auto' },
              { label: '.30-06', href: '/caliber/30-06-springfield' },
            ].map((cal) => (
              <a
                key={cal.href}
                href={cal.href}
                className="flex items-center justify-center rounded-lg border border-iron-800 px-3 py-2.5
                         hover:border-iron-600 hover:bg-iron-900/30 transition-all
                         text-sm text-iron-400 hover:text-iron-200 font-medium"
              >
                {cal.label}
              </a>
            ))}
          </div>

          <div className="text-center mt-6">
            <a href="/calibers" className="text-sm text-iron-500 hover:text-primary transition-colors">
              View all calibers →
            </a>
          </div>
        </div>
      </section>

      {/* Why IronScout Section — FAQ Accordion */}
      <section className="pt-16 pb-24 bg-iron-900/30 border-y border-iron-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="section-heading mb-4">
              Why <span className="text-gradient">IronScout</span>?
            </h2>
            <p className="text-iron-400 text-lg max-w-2xl mx-auto">
              We built what we wished existed.
            </p>
          </div>

          {/* Interactive accordion — client component, answers always in DOM */}
          <FaqAccordion items={whyIronScoutItems} />
        </div>
      </section>

      {/* How It Works */}
      <section className="pt-16 pb-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="section-heading mb-4">How It Works</h2>
            <p className="text-iron-400 text-lg max-w-2xl mx-auto">
              From searching to buying with confidence
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Search',
                description:
                  'Describe what you need in natural language. IronScout understands calibers, use cases, and intent.',
              },
              {
                step: '02',
                title: 'Save',
                description:
                  "Add items to your watchlist. We monitor prices and availability in the background so you don't have to.",
              },
              {
                step: '03',
                title: 'Buy',
                description:
                  'When conditions are right, click through to the retailer. No middleman, no markup.',
              },
            ].map((item, i) => (
              <div key={i} className="relative">
                <div className="absolute -top-6 left-0 font-display text-6xl font-bold text-iron-800/50">
                  {item.step}
                </div>
                <div className="relative pt-8">
                  <h3 className="font-display text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-iron-400 leading-relaxed">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 border-t border-iron-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="section-heading mb-4">
            Search once.<br />
            Stay informed.<br />
            <span className="text-gradient">Buy with confidence.</span>
          </h2>
          <p className="text-iron-400 text-lg mb-8 max-w-2xl mx-auto">
            Free to use, no account required to search.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href={`${APP_URL}/search`} className="btn-primary text-lg px-8 py-4">
              Try IronScout
              <svg className="w-5 h-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            <a href={`${APP_URL}/auth/signup`} className="btn-secondary text-lg px-8 py-4">
              Create Free Account
            </a>
          </div>
        </div>
      </section>

      {/* FAQ JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: whyIronScoutItems.map((item) => ({
              '@type': 'Question',
              name: item.question,
              acceptedAnswer: {
                '@type': 'Answer',
                text: item.answer,
              },
            })),
          }),
        }}
      />

      {/* Footer */}
      <footer className="py-12 border-t border-iron-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <IronScoutLogo className="w-8 h-8" />
              <span className="font-display text-xl font-semibold tracking-tight">
                Iron<span className="text-primary">Scout</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-sm text-iron-400">
              <a href="/calibers" className="hover:text-white transition-colors">All Calibers</a>
              <a href="/ammo/handgun" className="hover:text-white transition-colors">Handgun</a>
              <a href="/ammo/rifle" className="hover:text-white transition-colors">Rifle</a>
              <a href="/ammo/rimfire" className="hover:text-white transition-colors">Rimfire</a>
              <a href="/ammo/shotgun" className="hover:text-white transition-colors">Shotgun</a>
              <span className="text-iron-700">|</span>
              <a href="/about" className="hover:text-white transition-colors">About</a>
              <a href="/retailers" className="hover:text-white transition-colors">For Retailers</a>
              <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-white transition-colors">Terms</a>
              <a href="/contact?source=www-home-footer" className="hover:text-white transition-colors">Contact</a>
            </div>

            <div className="text-sm text-iron-500">
              © {new Date().getFullYear()} IronScout
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
