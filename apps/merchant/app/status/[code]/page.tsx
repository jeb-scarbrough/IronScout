import Link from 'next/link';
import { notFound } from 'next/navigation';

const STATUS_MAP: Record<string, { title: string; description: string; steps: string[] }> = {
  '401': {
    title: 'Sign-in required',
    description: 'You need a merchant account to access this page.',
    steps: [
      'Sign in with your merchant account.',
      'If you’re already signed in, refresh the page.',
    ],
  },
  '403': {
    title: 'Access denied',
    description: 'Your account doesn’t have permission to view this content.',
    steps: [
      'Confirm you are using the correct account.',
      'Contact support if this seems wrong.',
    ],
  },
  '404': {
    title: 'Page not found',
    description: 'The link may be outdated or moved.',
    steps: [
      'Check the URL for typos.',
      'Return to the dashboard.',
    ],
  },
  '429': {
    title: 'Too many requests',
    description: 'Please wait a moment before trying again.',
    steps: [
      'Pause for a minute and retry.',
      'Avoid rapid refreshes.',
    ],
  },
  '500': {
    title: 'Server error',
    description: 'We couldn’t complete the request.',
    steps: [
      'Try again in a few seconds.',
      'Contact support if the issue persists.',
    ],
  },
  '501': {
    title: 'Not implemented',
    description: 'That feature isn’t available yet.',
    steps: [
      'Try a different action.',
      'Check back later.',
    ],
  },
  '503': {
    title: 'Service unavailable',
    description: 'The portal is temporarily unavailable.',
    steps: [
      'Wait a few minutes and try again.',
      'Contact support if the issue persists.',
    ],
  },
};

export default function StatusPage({ params }: { params: { code: string } }) {
  const config = STATUS_MAP[params.code];
  if (!config) {
    notFound();
  }

  const primaryHref = params.code === '401' ? '/login' : '/dashboard';
  const primaryLabel = params.code === '401' ? 'Sign in' : 'Go to dashboard';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-gray-400">
          {params.code}
        </div>
        <h1 className="mt-3 text-2xl font-semibold text-gray-900">{config.title}</h1>
        <p className="mt-2 text-sm text-gray-600">{config.description}</p>
        <ul className="mt-5 space-y-2 text-sm text-gray-700">
          {config.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href={primaryHref}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            {primaryLabel}
          </Link>
          <a
            href="mailto:support@ironscout.ai"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Contact support
          </a>
        </div>
      </div>
    </div>
  );
}
