import { notFound } from 'next/navigation';
import { Header } from '../../components/Header';
import { BRAND } from '../../../lib/brand';

const STATUS_MAP: Record<string, { title: string; description: string; steps: string[] }> = {
  '401': {
    title: 'Sign-in required',
    description: 'You need an account to access that page.',
    steps: [
      'Sign in and try again.',
      'If you don’t have an account, create one first.',
    ],
  },
  '403': {
    title: 'Access denied',
    description: 'You don’t have permission to view that content.',
    steps: [
      'Verify you are signed in with the right account.',
      'Contact support if you think this is a mistake.',
    ],
  },
  '404': {
    title: 'We can’t find that page',
    description: 'The link may be outdated or the page was moved.',
    steps: [
      'Check the URL for typos.',
      'Return to the homepage and navigate from there.',
    ],
  },
  '429': {
    title: 'Too many requests',
    description: 'We received too many requests from this browser.',
    steps: [
      'Wait a minute and try again.',
      'Avoid rapid refreshes.',
    ],
  },
  '500': {
    title: 'Something went wrong',
    description: 'We couldn’t complete that request.',
    steps: [
      'Try again in a few seconds.',
      'Return to the homepage if the issue persists.',
    ],
  },
  '501': {
    title: 'Not implemented',
    description: 'That feature isn’t available yet.',
    steps: [
      'Try a different route or action.',
      'Check back later for updates.',
    ],
  },
  '502': {
    title: 'Temporary upstream error',
    description: 'A dependent service is not responding.',
    steps: [
      'Wait a moment and try again.',
      'Return to the homepage if the issue persists.',
    ],
  },
  '503': {
    title: 'Service unavailable',
    description: 'The service is temporarily unavailable.',
    steps: [
      'Wait a few minutes and try again.',
      'Return to the homepage if the issue persists.',
    ],
  },
};

// Generate static pages for all known status codes
export function generateStaticParams() {
  return Object.keys(STATUS_MAP).map((code) => ({ code }));
}

export default async function StatusPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const config = STATUS_MAP[code];
  if (!config) {
    notFound();
  }

  return (
    <div className="relative">
      <Header currentPage="home" />
      <section className="pt-12 pb-24">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="card border-iron-800/80 bg-iron-950/70">
            <div className="p-8">
              <div className="text-xs font-mono uppercase tracking-[0.3em] text-iron-500">
                {code}
              </div>
              <h1 className="mt-3 text-3xl font-display font-semibold">
                {config.title}
              </h1>
              <p className="mt-3 text-iron-400">{config.description}</p>
              <ul className="mt-6 space-y-2 text-sm text-iron-300">
                {config.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href={BRAND.wwwUrl} className="btn-primary">
                  Go to homepage
                </a>
                <a href={`${BRAND.appUrl}/search`} className="btn-secondary">
                  Go to search
                </a>
                <a href={`/contact?source=www-status-page&code=${encodeURIComponent(code)}`} className="btn-secondary">
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
