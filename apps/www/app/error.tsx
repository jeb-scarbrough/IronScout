'use client';

import { useEffect } from 'react';
import { Header } from './components/Header';
import { BRAND } from '../lib/brand';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const contactHref = error.digest
    ? `/contact?source=www-global-error&code=500&errorId=${encodeURIComponent(error.digest)}`
    : '/contact?source=www-global-error&code=500'

  return (
    <div className="relative">
      <Header currentPage="home" />
      <section className="pt-12 pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card border-iron-800/80 bg-iron-950/70">
            <div className="p-8">
              <div className="text-xs font-mono uppercase tracking-[0.3em] text-iron-500">500</div>
              <h1 className="mt-3 text-3xl font-display font-semibold">
                Something went wrong
              </h1>
              <p className="mt-3 text-iron-400">
                We couldn’t complete that request. The issue may be temporary.
              </p>
              <ul className="mt-6 space-y-2 text-sm text-iron-300">
                <li>Try the action again in a few seconds.</li>
                <li>If the issue persists, return to the homepage.</li>
                <li>Contact support and include the error ID below.</li>
              </ul>
              {error.digest ? (
                <div className="mt-5 rounded-lg border border-iron-800 bg-iron-900/60 px-3 py-2 text-xs text-iron-400">
                  Error ID: {error.digest}
                </div>
              ) : null}
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={reset}
                  className="btn-primary"
                >
                  Try again
                </button>
                <a href={BRAND.wwwUrl} className="btn-secondary">
                  Go to homepage
                </a>
                <a href={contactHref} className="btn-secondary">
                  Contact support
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
