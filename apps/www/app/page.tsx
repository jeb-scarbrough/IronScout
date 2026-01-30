'use client';

import { useState } from 'react';

const APP_URL = 'https://app.ironscout.ai';

const exampleQueries = [
  '9mm hollow point',
  'bulk .223 brass case',
  '.308 match grade',
  '5.56 green tip',
  '300 blackout subsonic',
];

const whyIronScoutItems = [
  {
    question: "We're not a marketplace",
    answer: "IronScout is an indexing and intelligence layer. We don't sell ammo, intermediate checkout, or compete with retailers. We help you understand what's available and where.",
  },
  {
    question: "We show real price history",
    answer: "See how prices have changed over time for any product. Historical context helps you understand whether today's price is actually good or just normal.",
  },
  {
    question: "Results are ordered by intent, not just price",
    answer: "Looking for range ammo? Defense rounds? Match-grade precision? IronScout surfaces results based on what you're actually trying to do, not just the lowest sticker price.",
  },
  {
    question: "We don't tell you what to buy",
    answer: "No recommendations, no \"best deals,\" no urgency tactics. IronScout provides information and context. The decision is always yours.",
  },
  {
    question: "Your calibers save you time",
    answer: "Add what you shoot and IronScout focuses on relevant results automatically. No more filtering through calibers you don't own.",
  },
  {
    question: "Alerts that respect your attention",
    answer: "Get notified when prices drop or items come back in stock. No spam, no manufactured urgency—just the changes that actually matter to you.",
  },
  {
    question: "Transparent about how we work",
    answer: "When something is promoted or paid, it's clearly labeled. Relevance and accuracy come before monetization.",
  },
  {
    question: "Built by shooters who got tired of bad search",
    answer: "IronScout exists because we wanted something better for ourselves. We understand the frustration of endless tabs and price-checking because we lived it.",
  },
];

export default function Home() {
  const [query, setQuery] = useState('');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      window.location.href = `${APP_URL}/search?q=${encodeURIComponent(query)}`;
    }
  };

  const handleExampleClick = (example: string) => {
    window.location.href = `${APP_URL}/search?q=${encodeURIComponent(example)}`;
  };

  const toggleAccordion = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="relative">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-iron-950/80 backdrop-blur-md border-b border-iron-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                <svg className="w-5 h-5 text-iron-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <span className="font-display text-xl font-semibold tracking-tight">
                Iron<span className="text-primary">Scout</span>
              </span>
            </div>

            <div className="flex items-center gap-6">
              <a
                href="/about"
                className="text-iron-400 hover:text-white text-sm font-medium transition-colors hidden sm:block"
              >
                About
              </a>
              <a
                href="/retailers"
                className="text-iron-400 hover:text-white text-sm font-medium transition-colors hidden sm:block"
              >
                For Retailers
              </a>
              <a
                href={`${APP_URL}/auth/signin`}
                className="text-iron-300 hover:text-white text-sm font-medium transition-colors"
              >
                Sign In
              </a>
              <a
                href={`${APP_URL}/auth/signup`}
                className="btn-primary text-sm py-2"
              >
                Get Started
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-24 sm:pt-32 pb-16">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -right-64 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -left-64 w-[500px] h-[500px] bg-gunmetal-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            {/* Headline */}
            <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-4">
              Ammo search that thinks<br />
              <span className="text-gradient">like a shooter</span>
            </h1>
            <p className="text-xl md:text-2xl text-iron-400 font-display mb-10">
              Range day or carry day. We search differently.
            </p>

            {/* Search Box */}
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto mb-6">
              <div className="relative flex items-center">
                <div className="absolute left-4 flex items-center">
                  <svg className="w-5 h-5 text-iron-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by caliber, use case, or intent..."
                  className="w-full pl-12 pr-32 py-4 text-lg bg-iron-900 border-2 border-iron-700 rounded-2xl
                           focus:border-primary focus:ring-4 focus:ring-primary/20
                           transition-all text-iron-100 placeholder:text-iron-500"
                />
                <button
                  type="submit"
                  className="absolute right-2 px-6 py-2.5 bg-primary hover:bg-primary/80
                           text-iron-950 font-semibold rounded-xl transition-all
                           flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search
                </button>
              </div>
            </form>

            {/* Example Queries */}
            <div className="mb-12">
              <p className="text-sm text-iron-500 mb-3">Try:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {exampleQueries.map((example, i) => (
                  <button
                    key={i}
                    onClick={() => handleExampleClick(example)}
                    className="text-sm px-3 py-1.5 rounded-full border border-iron-700
                             hover:border-primary hover:bg-primary/10
                             transition-colors text-iron-400 hover:text-primary"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            {/* Account Prompt */}
            <div className="bg-iron-900/50 border border-iron-800 rounded-xl p-6 max-w-xl mx-auto">
              <p className="text-iron-300 mb-4">
                Tell us what you shoot. We'll alert you to price drops and back-in-stock items.
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
      <section id="features" className="py-24 border-t border-iron-800/50">
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
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                ),
                title: 'Intent-Aware Search',
                description: 'Range ammo and carry ammo are different decisions. IronScout understands your use case and orders results accordingly.',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                ),
                title: 'Personal Caliber Context',
                description: 'Save what you shoot and stop filtering through irrelevant results. Your calibers shape your experience automatically.',
              },
              {
                icon: (
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                ),
                title: 'Market Awareness',
                description: "See price history and get alerts for changes that matter. Understand whether today's price is actually good.",
              },
            ].map((feature, i) => (
              <div key={i} className="card group hover:border-iron-600 transition-colors">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center text-primary mb-4 group-hover:bg-primary/20 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">{feature.title}</h3>
                <p className="text-iron-400 leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why IronScout Section - Accordion */}
      <section className="py-24 bg-iron-900/30 border-y border-iron-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="section-heading mb-4">
              Why <span className="text-gradient">IronScout</span>?
            </h2>
            <p className="text-iron-400 text-lg max-w-2xl mx-auto">
              We built what we wished existed.
            </p>
          </div>

          <div className="space-y-3">
            {whyIronScoutItems.map((item, i) => (
              <div
                key={i}
                className="border border-iron-800 rounded-lg overflow-hidden bg-iron-950/50"
              >
                <button
                  onClick={() => toggleAccordion(i)}
                  className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-iron-900/50 transition-colors"
                >
                  <span className="font-medium text-iron-100">{item.question}</span>
                  <svg
                    className={`w-5 h-5 text-iron-500 transition-transform ${
                      openIndex === i ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openIndex === i && (
                  <div className="px-6 pb-4">
                    <p className="text-iron-400 leading-relaxed">{item.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24">
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
                description: 'Describe what you need in natural language. IronScout understands calibers, use cases, and intent.',
              },
              {
                step: '02',
                title: 'Save',
                description: "Add items to your watchlist. We monitor prices and availability in the background so you don't have to.",
              },
              {
                step: '03',
                title: 'Buy',
                description: 'When conditions are right, click through to the retailer. No middleman, no markup.',
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

      {/* Footer */}
      <footer className="py-12 border-t border-iron-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
                <svg className="w-5 h-5 text-iron-950" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <span className="font-display text-xl font-semibold tracking-tight">
                Iron<span className="text-primary">Scout</span>
              </span>
            </div>

            <div className="flex items-center gap-8 text-sm text-iron-400">
              <a href="/about" className="hover:text-white transition-colors">About</a>
              <a href="/retailers" className="hover:text-white transition-colors">For Retailers</a>
              <a href="/privacy" className="hover:text-white transition-colors">Privacy</a>
              <a href="/terms" className="hover:text-white transition-colors">Terms</a>
              <a href="mailto:hello@ironscout.ai" className="hover:text-white transition-colors">Contact</a>
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
