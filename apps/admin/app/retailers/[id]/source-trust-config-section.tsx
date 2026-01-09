'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Database,
  Rss,
} from 'lucide-react';
import { updateSourceTrustConfig } from '@/app/affiliate-feeds/actions';

interface Source {
  id: string;
  name: string;
  sourceKind: string | null;
  source_trust_config: {
    upcTrusted: boolean;
    version: number;
  } | null;
}

interface SourceTrustConfigSectionProps {
  sources: Source[];
}

function SourceKindIcon({ kind }: { kind: string | null }) {
  switch (kind) {
    case 'AFFILIATE_FEED':
      return <Rss className="h-4 w-4 text-purple-500" />;
    case 'DIRECT':
    default:
      return <Database className="h-4 w-4 text-blue-500" />;
  }
}

function SourceTrustRow({ source }: { source: Source }) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upcTrusted = source.source_trust_config?.upcTrusted ?? false;
  const version = source.source_trust_config?.version ?? 0;

  const handleToggle = async () => {
    setIsUpdating(true);
    setError(null);

    try {
      const result = await updateSourceTrustConfig(source.id, !upcTrusted);

      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || 'Failed to update');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <tr className={error ? 'bg-red-50' : ''}>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <SourceKindIcon kind={source.sourceKind} />
          <span className="text-sm font-medium text-gray-900">{source.name}</span>
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-xs text-gray-500 capitalize">
          {(source.sourceKind || 'DIRECT').replace('_', ' ').toLowerCase()}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {upcTrusted ? (
          <span className="inline-flex items-center gap-1 text-sm text-green-600">
            <ShieldCheck className="h-4 w-4" />
            Trusted
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-sm text-gray-400">
            <ShieldAlert className="h-4 w-4" />
            Untrusted
          </span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400">
        v{version}
      </td>
      <td className="px-4 py-3 whitespace-nowrap text-right">
        <button
          onClick={handleToggle}
          disabled={isUpdating}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            upcTrusted ? 'bg-green-500' : 'bg-gray-300'
          }`}
        >
          <span className="sr-only">Toggle UPC trust</span>
          <span
            className={`pointer-events-none inline-flex h-4 w-4 transform items-center justify-center rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              upcTrusted ? 'translate-x-4' : 'translate-x-0'
            }`}
          >
            {isUpdating && (
              <Loader2 className="h-2.5 w-2.5 animate-spin text-gray-400" />
            )}
          </span>
        </button>
        {error && (
          <p className="mt-1 text-xs text-red-600">{error}</p>
        )}
      </td>
    </tr>
  );
}

export function SourceTrustConfigSection({ sources }: SourceTrustConfigSectionProps) {
  const trustedCount = sources.filter(s => s.source_trust_config?.upcTrusted).length;

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Shield className="h-5 w-5 text-gray-500" />
            UPC Trust Configuration
          </h2>
          <span className="text-sm text-gray-500">
            {trustedCount} of {sources.length} sources trusted
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Source
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                UPC Status
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Version
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                Toggle
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sources.map((source) => (
              <SourceTrustRow key={source.id} source={source} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          When UPCs are trusted, the resolver uses UPC codes to directly match products.
          Untrusted sources require fingerprint verification.
        </p>
      </div>
    </div>
  );
}
