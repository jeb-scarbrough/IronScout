import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-gray-400">404</div>
        <h1 className="mt-3 text-2xl font-semibold text-gray-900">Page not found</h1>
        <p className="mt-2 text-sm text-gray-600">
          The page may have moved or the link is outdated.
        </p>
        <ul className="mt-5 space-y-2 text-sm text-gray-700">
          <li>Check the URL for typos.</li>
          <li>Use the navigation to find the section you need.</li>
          <li>Return to the admin dashboard.</li>
        </ul>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/"
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Go to dashboard
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
