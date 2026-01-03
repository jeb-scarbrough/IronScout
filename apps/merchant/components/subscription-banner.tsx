'use client';

import { AlertTriangle, XCircle, CreditCard } from 'lucide-react';
import Link from 'next/link';

interface SubscriptionBannerProps {
  message: string;
  type: 'warning' | 'error';
}

export function SubscriptionBanner({ message, type }: SubscriptionBannerProps) {
  const isError = type === 'error';

  return (
    <div
      className={`${
        isError
          ? 'bg-red-600 text-white'
          : 'bg-amber-500 text-white'
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {isError ? (
              <XCircle className="h-5 w-5 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            )}
            <p className="text-sm font-medium">{message}</p>
          </div>
          <Link
            href="/settings"
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors ${
              isError
                ? 'bg-white text-red-600 hover:bg-red-50'
                : 'bg-white text-amber-600 hover:bg-amber-50'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            Renew Now
          </Link>
        </div>
      </div>
    </div>
  );
}
