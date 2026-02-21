import type { Metadata } from 'next';
import Script from 'next/script';
import { Header } from './components/Header';
import { HeroSearch } from './components/HeroSearch';
import { FaqAccordion } from './components/FaqAccordion';
import { IronScoutLogo } from '@ironscout/ui/components';
import { BRAND } from '@/lib/brand';

const APP_URL = BRAND.appUrl;

export const metadata: Metadata = {
  title: 'Compare Ammo Prices Across Multiple Retailers | IronScout',
  description:
    'Compare ammunition prices for 9mm, 5.56, .308, .22 LR and 14 calibers across multiple online retailers. Track price history, set alerts, and find deals. Free to use.',
  alternates: {
    canonical: `${BRAND.wwwUrl}`,
  },
  openGraph: {
    title: 'Compare Ammo Prices Across Multiple Retailers | IronScout',
    description:
      'Compare ammunition prices for 9mm, 5.56, .308, .22 LR and more across multiple retailers. Track price history, set alerts, and find deals.',
    url: `${BRAND.wwwUrl}`,
    siteName: 'IronScout',
    locale: 'en_US',
    type: 'website',
    images: [{ url: `${BRAND.wwwUrl}/og/default.png`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Compare Ammo Prices Across Multiple Retailers | IronScout',
    description:
      'Compare ammunition prices for 9mm, 5.56, .308, .22 LR and more. Free ammo price tracker with alerts.',
    images: [`${BRAND.wwwUrl}/og/default.png`],
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

const faqItems = [
  {
    question: 'What is IronScout?',
    answer: 'IronScout is a free ammunition search engine that compares prices across multiple online retailers. It tracks real-time availability, price history, and price-per-round for 14 calibers — from 9mm and 5.56 NATO to .308 Winchester and 12 gauge. Think of it as a flight search engine, but for ammo.',
  },
  {
    question: 'How does IronScout find ammo prices?',
    answer: 'IronScout indexes product listings from major online ammunition retailers daily. Prices, availability, and product details are updated automatically so you see current information without visiting each store individually.',
  },
  {
    question: 'Is IronScout free to use?',
    answer: 'Yes. Searching and comparing ammo prices is completely free with no account required. Free accounts unlock saved calibers and basic price alerts. Premium tiers add features like AI-powered search, deeper price history, and advanced alert controls.',
  },
  {
    question: 'Does IronScout sell ammunition?',
    answer: "No. IronScout is a search and comparison tool, not a retailer. When you find what you're looking for, you click through to the retailer's site to purchase directly. We never handle payment, shipping, or inventory.",
  },
  {
    question: 'How is IronScout different from other ammo search sites?',
    answer: 'Most ammo search engines sort by price alone. IronScout uses AI-powered intent matching — it understands whether you need range ammo, defense loads, or match-grade precision and ranks results accordingly. It also tracks price history so you can see whether a deal is actually good, not just the cheapest listing today.',
  },
  {
    question: 'What calibers does IronScout track?',
    answer: 'IronScout currently tracks 14 calibers: 9mm, 5.56 NATO, .223 Remington, .308 Winchester, .22 LR, .45 ACP, .380 ACP, .40 S&W, 10mm Auto, .300 Blackout, 6.5 Creedmoor, 7.62x39, .30-06 Springfield, and 12 gauge. More calibers are added based on demand.',
  },
  {
    question: 'How do ammo price alerts work?',
    answer: 'Set a target price or choose to be notified on any price drop for products you care about. IronScout monitors prices daily and sends you a notification when conditions are met. You can also set back-in-stock alerts for items that are currently unavailable.',
  },
  {
    question: 'How often are ammo prices updated?',
    answer: 'Prices and availability are updated daily across all tracked retailers. High-demand calibers like 9mm and 5.56 NATO may be checked more frequently during periods of high market activity.',
  },
];

export default function Home() {
  return (
    <div className="relative">
      <Script
        src="https://classic.avantlink.com/affiliate_app_confirm.php?mode=js&authResponse=5423c26e1614d014410b8b21eb80807de155a8dd"
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
            <p className="text-xl md:text-2xl text-iron-400 font-display mb-6">
              AI-powered search. Results that make sense.
            </p>
            <p className="text-iron-400 text-base max-w-2xl mx-auto mb-10">
              Compare ammunition prices across major online retailers for 14 calibers — from
              9mm and 5.56 NATO to .308 Winchester and 12 gauge. IronScout understands whether
              you need range ammo, defense loads, or match-grade precision and shows you
              results that match how you actually buy.
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
              Most ammo search engines stop at price lists — sorted by cost per round and
              nothing else. That works when you already know exactly what you want. But
              choosing between range ammo for a weekend class, hollow points for carry, and
              match-grade loads for competition are fundamentally different decisions with
              different priorities. IronScout is an ammunition search engine built around
              that reality.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: 'Intent-Aware Search',
                description:
                  'Range ammo and carry ammo are different decisions. Search for \u201c9mm for home defense\u201d and IronScout prioritizes proven hollow point loads from Federal HST and Speer Gold Dot. Search for \u201ccheap 9mm for the range\u201d and it surfaces bulk FMJ deals instead. Results are ordered by what you\u2019re trying to do, not just the lowest sticker price.',
                iconPath:
                  'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
              },
              {
                title: 'Personal Caliber Context',
                description:
                  'Save the calibers you shoot \u2014 9mm, 5.56, .308, whatever you own \u2014 and IronScout focuses on what\u2019s relevant to you automatically. No more scrolling past calibers you don\u2019t shoot. Your saved calibers also power personalized price alerts, so you hear about the deals that actually matter.',
                iconPath:
                  'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10',
              },
              {
                title: 'Market Awareness',
                description:
                  "Ammo prices shift constantly. IronScout tracks price history for every product so you can see whether today's price is a genuine deal or just normal. Set price drop alerts and back-in-stock notifications to stay informed without manually checking retailer sites every day.",
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
              IronScout tracks ammunition prices daily across major online retailers. Every
              caliber page shows current price ranges, popular product lines, bulk deals, and
              price history context — so you know what a fair price looks like before you buy.
              Browse by category or jump straight to a specific caliber.
            </p>
            <p className="text-iron-500 text-base max-w-3xl mx-auto mt-3">
              Whether you&apos;re looking for the cheapest brass-cased 9mm FMJ for a range
              session, comparing .308 Winchester hunting loads for deer season, or tracking
              5.56 NATO bulk deals, each caliber page gives you the market context to make
              an informed decision.
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
                  'Describe what you need in plain language. Try \u201cbulk 9mm for the range,\u201d \u201csubsonic 300 blackout,\u201d or \u201cbest price 5.56 green tip.\u201d IronScout interprets caliber, use case, and quantity intent to rank results that match what you\u2019re actually looking for.',
              },
              {
                step: '02',
                title: 'Save',
                description:
                  'Found something worth watching? Save it to your watchlist. IronScout monitors prices and availability across retailers in the background and notifies you when something changes \u2014 a price drop, a restock, or a new deal on a product you care about.',
              },
              {
                step: '03',
                title: 'Buy',
                description:
                  'When conditions are right, click through directly to the retailer\u2019s product page. IronScout never handles checkout, payment, or shipping. You buy direct, and you keep whatever loyalty points or promotions the retailer offers.',
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

      {/* Frequently Asked Questions — real FAQs with schema */}
      <section className="pt-16 pb-24 border-t border-iron-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="section-heading mb-4">
              Frequently Asked <span className="text-gradient">Questions</span>
            </h2>
            <p className="text-iron-400 text-lg max-w-2xl mx-auto">
              Everything you need to know about searching and comparing ammo prices.
            </p>
          </div>

          <FaqAccordion items={faqItems} />
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

      {/* FAQPage JSON-LD — genuine user questions only */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: faqItems.map((item) => ({
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
              <a href="/brands" className="hover:text-white transition-colors">Brands</a>
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
