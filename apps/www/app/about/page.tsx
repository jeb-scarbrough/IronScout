import { Metadata } from 'next';
import { Header } from '../components/Header';
import { BRAND } from '../../lib/brand';

export const metadata: Metadata = {
  title: 'About - IronScout',
  description: 'IronScout is an ammunition intelligence platform built around how shooters actually buy. Intent-aware search, personal caliber context, and continuous market monitoring.',
};

const APP_URL = BRAND.appUrl;

export default function About() {
  return (
    <div className="relative">
      <Header currentPage="about" />

      {/* Hero Section */}
      <section className="relative pt-32 pb-16">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 -right-64 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-display text-4xl sm:text-5xl font-bold mb-4">
            About IronScout
          </h1>
          <p className="text-xl sm:text-2xl text-primary font-medium mb-8">
            Built for How Shooters Actually Buy
          </p>
          <p className="text-lg text-iron-300 leading-relaxed max-w-3xl">
            Ammo search has not kept pace with how shooters make real buying decisions.
            Most tools stop at price lists. They treat every search the same, ignore use case,
            and force people to constantly recheck listings just to know whether anything
            meaningful has changed.
          </p>
          <p className="text-lg text-iron-100 font-medium mt-6">
            IronScout exists to change that.
          </p>
        </div>
      </section>

      {/* What IronScout Is */}
      <section className="py-16 border-t border-iron-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-iron-100 mb-6">
            What IronScout Is
          </h2>
          <div className="space-y-6 text-iron-300">
            <p className="text-lg leading-relaxed">
              IronScout is an <span className="text-iron-100 font-medium">ammunition intelligence platform</span>.
            </p>
            <p className="leading-relaxed">
              It combines intent-aware search, optional personal caliber context, and continuous
              market monitoring to help shooters move from searching to buying with confidence.
            </p>
            <div className="bg-iron-900/50 border border-iron-800 rounded-lg p-6 mt-8">
              <p className="text-iron-200 leading-relaxed">
                <span className="block">Different situations call for different priorities.</span>
                <span className="text-primary">Range ammo, carry ammo, and match ammo</span> should
                not be surfaced or ordered the same way.
              </p>
              <p className="text-iron-100 font-medium mt-4">
                IronScout is built around that reality.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How IronScout Thinks */}
      <section className="py-16 border-t border-iron-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-iron-100 mb-6">
            How IronScout Thinks
          </h2>
          <div className="space-y-6 text-iron-300">
            <p className="text-lg leading-relaxed">
              IronScout starts by understanding <span className="text-iron-100">why you are searching</span>.
            </p>
            <p className="leading-relaxed">
              When you search, results are ordered based on intent and use case, not just price.
              Practice, defense, and precision are treated differently because they are different decisions.
            </p>
            <p className="leading-relaxed">
              If you choose to add the calibers you shoot, IronScout uses that context to remove
              noise and focus results on what actually matters to you. This is optional, lightweight,
              and designed to improve relevance without tracking ownership or inventory.
            </p>
            <p className="text-iron-200 font-medium">
              The result is a search experience that feels familiar to shooters and easier to act on.
            </p>
          </div>
        </div>
      </section>

      {/* From Search to Action */}
      <section className="py-16 border-t border-iron-800/50 bg-iron-900/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-iron-100 mb-6">
            From Search to Confident Action
          </h2>
          <div className="space-y-6 text-iron-300">
            <p className="leading-relaxed">
              Ammo prices and availability change constantly.
            </p>
            <p className="leading-relaxed">
              When you save an item, IronScout monitors it in the background and alerts you
              when something meaningful changes—such as a price drop or a restock.
              This turns searching into <span className="text-primary">readiness</span>.
            </p>
            <p className="leading-relaxed">
              Instead of repeatedly checking listings, you get notified when conditions are
              favorable and can buy with real context, not guesswork.
            </p>
            <div className="border-l-2 border-primary pl-6 mt-8">
              <p className="text-iron-200 italic">
                <span className="block">IronScout does not push urgency or tell you what to buy.</span>
                <span className="block">It exists to make informed action easier.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Personalization */}
      <section className="py-16 border-t border-iron-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-iron-100 mb-6">
            What Personalization Means (and What It Doesn't)
          </h2>
          <div className="space-y-6 text-iron-300">
            <p className="leading-relaxed">
              Personalization in IronScout is <span className="text-iron-100">optional</span> and
              <span className="text-iron-100"> intentionally limited</span>.
            </p>
            <p className="leading-relaxed">
              If you add caliber information, it is used only to:
            </p>
            <ul className="space-y-3 ml-4">
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Improve search relevance</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Focus alerts on ammo you actually care about</span>
              </li>
              <li className="flex items-start gap-3">
                <svg className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Personalize dashboards and market views</span>
              </li>
            </ul>
            <div className="bg-iron-900/50 border border-iron-800 rounded-lg p-6 mt-6">
              <p className="text-iron-300 leading-relaxed">
                <span className="block">IronScout does not track firearms, serial numbers, quantities, or usage.</span>
                <span className="text-iron-400">There is no inventory system and no registry.</span>
              </p>
            </div>
            <p className="text-iron-200 mt-6">
              <span className="block">If you never add personal context, IronScout still works.</span>
              <span className="block">If you do, it works better.</span>
            </p>
          </div>
        </div>
      </section>

      {/* What IronScout Does Not Do */}
      <section className="py-16 border-t border-iron-800/50 bg-iron-900/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-iron-100 mb-6">
            What IronScout Does Not Do
          </h2>
          <p className="text-iron-300 mb-6">To be clear, IronScout does not:</p>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              'Recommend what you should buy',
              'Predict future prices',
              'Create artificial urgency',
              'Disguise promotion as relevance',
              'Track firearms or ownership',
            ].map((item) => (
              <div key={item} className="flex items-start gap-3 text-iron-400">
                <svg className="w-5 h-5 text-iron-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>{item}</span>
              </div>
            ))}
          </div>
          <p className="text-iron-200 font-medium mt-8">
            IronScout provides context. The decision remains yours.
          </p>
        </div>
      </section>

      {/* Transparency */}
      <section className="py-16 border-t border-iron-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-iron-100 mb-6">
            Transparency and Sustainability
          </h2>
          <div className="space-y-6 text-iron-300">
            <p className="leading-relaxed">
              IronScout is built to be sustainable over time.
            </p>
            <p className="leading-relaxed">
              As the platform evolves, additional features or partnerships may be introduced.
              When something is promoted or paid, it will be clearly labeled and separated
              from organic results.
            </p>
            <p className="text-iron-200 font-medium">
              Clear ordering and transparency matter more than short-term clicks.
            </p>
          </div>
        </div>
      </section>

      {/* Who IronScout Is For */}
      <section className="py-16 border-t border-iron-800/50 bg-iron-900/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="font-display text-2xl sm:text-3xl font-semibold text-iron-100 mb-6">
            Who IronScout Is For
          </h2>
          <div className="space-y-6 text-iron-300">
            <p className="text-lg leading-relaxed">
              IronScout is built for shooters who value <span className="text-primary">clarity over noise</span>,
              <span className="text-primary"> understanding over impulse</span>, and
              <span className="text-primary"> confidence over constant searching</span>.
            </p>
            <div className="border-l-2 border-iron-700 pl-6">
              <p className="text-iron-400">
                If you want to glance at prices, plenty of tools already exist.
              </p>
            </div>
            <p className="text-iron-100 font-medium text-lg">
              If you want to understand the market you are buying in and act when it makes sense,
              IronScout was built for you.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 border-t border-iron-800/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <a href={APP_URL} className="btn-primary">
              Try IronScout
              <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </a>
            <a href="/" className="btn-secondary">
              Back to Home
            </a>
          </div>
          <p className="text-iron-500 text-sm mt-8">
            Questions or feedback?{' '}
            <a href="mailto:hello@ironscout.ai" className="text-primary hover:text-primary/80">
              hello@ironscout.ai
            </a>
          </p>
        </div>
      </section>

      {/* Footer spacing */}
      <div className="h-8" />
    </div>
  );
}
