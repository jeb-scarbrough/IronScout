import { Header } from './components/Header';
import { BRAND } from '../lib/brand';

export default function NotFound() {
  return (
    <div className="relative">
      <Header currentPage="home" />
      <section className="pt-12 pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card border-iron-800/80 bg-iron-950/70">
            <div className="p-8">
              <div className="text-xs font-mono uppercase tracking-[0.3em] text-iron-500">404</div>
              <h1 className="mt-3 text-3xl font-display font-semibold">
                We can’t find that page
              </h1>
              <p className="mt-3 text-iron-400">
                The link may be outdated or the page was moved.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-iron-300">
                <li>Check the URL for typos.</li>
                <li>Return to the homepage and navigate from there.</li>
                <li>Search the app for products and pricing context.</li>
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={BRAND.wwwUrl} className="btn-primary">
                  Go to homepage
                </a>
                <a href={`${BRAND.appUrl}/search`} className="btn-secondary">
                  Go to search
                </a>
                <a href="/contact?source=www-not-found&code=404" className="btn-secondary">
                  Contact us
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
