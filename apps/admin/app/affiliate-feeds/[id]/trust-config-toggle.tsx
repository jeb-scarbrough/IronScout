'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { updateSourceTrustConfig } from '../actions';

interface TrustConfigToggleProps {
  sourceId: string;
  sourceName: string;
  upcTrusted: boolean;
  version: number;
}

export function TrustConfigToggle({
  sourceId,
  sourceName,
  upcTrusted,
  version,
}: TrustConfigToggleProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    setIsUpdating(true);
    setError(null);

    try {
      const result = await updateSourceTrustConfig(sourceId, !upcTrusted);

      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || 'Failed to update trust config');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
          <Shield className="h-5 w-5 text-gray-500" />
          UPC Trust Configuration
        </h2>
      </div>
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              {upcTrusted ? (
                <ShieldCheck className="h-6 w-6 text-green-500" />
              ) : (
                <ShieldAlert className="h-6 w-6 text-amber-500" />
              )}
              <div>
                <p className="font-medium text-gray-900">
                  UPC codes are {upcTrusted ? 'trusted' : 'not trusted'}
                </p>
                <p className="text-sm text-gray-500">
                  {upcTrusted
                    ? 'Products with matching UPCs will be automatically linked to canonical products'
                    : 'UPC codes from this source require fingerprint matching for product resolution'}
                </p>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Config version: {version} &middot; Source: {sourceName}
            </p>
          </div>

          <div className="ml-6">
            <button
              onClick={handleToggle}
              disabled={isUpdating}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                upcTrusted ? 'bg-green-500' : 'bg-gray-300'
              }`}
            >
              <span className="sr-only">Toggle UPC trust</span>
              <span
                className={`pointer-events-none inline-flex h-5 w-5 transform items-center justify-center rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  upcTrusted ? 'translate-x-5' : 'translate-x-0'
                }`}
              >
                {isUpdating && (
                  <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                )}
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-md">
          <p className="text-sm text-blue-800">
            <strong>What does this mean?</strong> When UPCs are trusted, the resolver uses UPC codes
            to directly match products from this feed to canonical products in the database. This is
            faster and more accurate, but requires confidence that this source provides correct UPCs.
          </p>
        </div>
      </div>
    </div>
  );
}
