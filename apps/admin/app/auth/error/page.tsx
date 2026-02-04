import Link from 'next/link'

const ERROR_COPY: Record<string, { title: string; description: string; steps: string[] }> = {
  AccessDenied: {
    title: 'Access denied',
    description: 'This account is not authorized for admin access.',
    steps: [
      'Try a different account.',
      'If you believe this is a mistake, contact support.',
    ],
  },
  OAuthAccountNotLinked: {
    title: 'Account already exists',
    description: 'This email is linked to a different sign-in method.',
    steps: [
      'Use the sign-in method you originally used.',
      'Contact support if you no longer have access.',
    ],
  },
  Configuration: {
    title: 'Sign-in unavailable',
    description: 'A configuration issue is blocking sign-in.',
    steps: [
      'Try again in a few minutes.',
      'Contact support if the issue persists.',
    ],
  },
  Verification: {
    title: 'Verification failed',
    description: 'We couldn’t complete the verification step.',
    steps: [
      'Try signing in again.',
      'Ensure cookies are enabled in your browser.',
    ],
  },
}

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: { error?: string }
}) {
  const errorKey = searchParams.error || 'AccessDenied'
  const config = ERROR_COPY[errorKey] ?? {
    title: 'Sign-in error',
    description: 'We couldn’t complete the sign-in request.',
    steps: [
      'Try again using the sign-in page.',
      'Contact support if the issue continues.',
    ],
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-gray-400">AUTH</div>
        <h1 className="mt-3 text-2xl font-semibold text-gray-900">{config.title}</h1>
        <p className="mt-2 text-sm text-gray-600">{config.description}</p>
        <ul className="mt-5 space-y-2 text-sm text-gray-700">
          {config.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/auth/signin"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Back to sign in
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
  )
}
