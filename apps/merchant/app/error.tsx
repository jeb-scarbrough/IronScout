'use client';

import { useEffect } from 'react';
import Link from 'next/link';

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="text-xs font-mono uppercase tracking-[0.2em] text-gray-400">500</div>
        <h1 className="mt-3 text-2xl font-semibold text-gray-900">Something went wrong</h1>
        <p className="mt-2 text-sm text-gray-600">
          We couldn’t complete that request. The issue may be temporary.
        </p>
        <ul className="mt-5 space-y-2 text-sm text-gray-700">
          <li>Try the action again in a few seconds.</li>
          <li>If the problem persists, sign out and sign back in.</li>
          <li>Contact support and include the error ID below.</li>
        </ul>
        {error.digest ? (
          <div className="mt-4 rounded-lg bg-gray-100 px-3 py-2 text-xs text-gray-500">
            Error ID: {error.digest}
          </div>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
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
  );
}
