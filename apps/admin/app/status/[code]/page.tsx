import Link from 'next/link'
import { notFound } from 'next/navigation'

const STATUS_MAP: Record<string, { title: string; description: string; steps: string[]; showSignOut?: boolean }> = {
  '401': {
    title: 'Sign-in required',
    description: 'You need an authorized admin account to access this page.',
    steps: [
      'Sign in with your admin account.',
      'If you signed in with the wrong account, use "Try different account" below.',
    ],
    showSignOut: true,
  },
  '403': {
    title: 'Access denied',
    description: "Your account doesn't have permission to view this content.",
    steps: [
      'Confirm you are using the correct account.',
      'If you need to use a different account, use "Try different account" below.',
    ],
    showSignOut: true,
  },
  '404': {
    title: 'Page not found',
    description: 'The link may be outdated or moved.',
    steps: [
      'Check the URL for typos.',
      'Return to the admin dashboard.',
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
    description: "We couldn't complete the request.",
    steps: [
      'Try again in a few seconds.',
      'If the issue persists, contact support.',
    ],
  },
  '501': {
    title: 'Not implemented',
    description: "That feature isn't available yet.",
    steps: [
      'Try a different action.',
      'Check back later.',
    ],
  },
  '503': {
    title: 'Service unavailable',
    description: 'The admin portal is temporarily unavailable.',
    steps: [
      'Wait a few minutes and try again.',
      'Contact support if the issue persists.',
    ],
  },
}

export default async function StatusPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params
  const config = STATUS_MAP[code]
  if (!config) {
    notFound()
  }

  const primaryHref = code === '401' ? '/auth/signin' : '/'
  const primaryLabel = code === '401' ? 'Sign in' : 'Go to dashboard'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-gray-400">
          {code}
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
          {config.showSignOut && (
            // eslint-disable-next-line @next/next/no-html-link-for-pages -- Intentional: logout requires full navigation
            <a
              href="/api/auth/logout"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Try different account
            </a>
          )}
          <a
            href="mailto:support@ironscout.ai"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Contact support
          </a>
        </div>
      </div>
    </div>
  )
}
