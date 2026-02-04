'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Settings,
  Loader2,
  Play,
  Pause,
  Bot,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { updateSourceScrapeConfig } from '@/app/scrapers/actions';
import { KNOWN_ADAPTERS } from '@/lib/scraper-constants';

interface Source {
  id: string;
  name: string;
  scrapeEnabled: boolean;
  adapterId: string | null;
  robotsCompliant: boolean;
}

interface SourceScrapeConfigSectionProps {
  sources: Source[];
}

function SourceScrapeRow({ source }: { source: Source }) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleToggleScrapeEnabled = async () => {
    setIsUpdating('scrapeEnabled');
    setError(null);

    try {
      const result = await updateSourceScrapeConfig(source.id, {
        scrapeEnabled: !source.scrapeEnabled,
      });

      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || 'Failed to update');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleToggleRobotsCompliant = async () => {
    setIsUpdating('robotsCompliant');
    setError(null);

    try {
      const result = await updateSourceScrapeConfig(source.id, {
        robotsCompliant: !source.robotsCompliant,
      });

      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || 'Failed to update');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsUpdating(null);
    }
  };

  const handleAdapterChange = async (adapterId: string) => {
    setIsUpdating('adapterId');
    setError(null);

    try {
      const result = await updateSourceScrapeConfig(source.id, {
        adapterId: adapterId || null,
      });

      if (result.success) {
        router.refresh();
      } else {
        setError(result.error || 'Failed to update');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <tr className={error ? 'bg-red-50' : ''}>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm font-medium text-gray-900">{source.name}</span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {source.scrapeEnabled ? (
            <span className="inline-flex items-center gap-1 text-sm text-green-600">
              <Play className="h-4 w-4" />
              Enabled
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm text-gray-400">
              <Pause className="h-4 w-4" />
              Disabled
            </span>
          )}
          <button
            onClick={handleToggleScrapeEnabled}
            disabled={isUpdating !== null}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              source.scrapeEnabled ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span className="sr-only">Toggle scrape enabled</span>
            <span
              className={`pointer-events-none inline-flex h-4 w-4 transform items-center justify-center rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                source.scrapeEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            >
              {isUpdating === 'scrapeEnabled' && (
                <Loader2 className="h-2.5 w-2.5 animate-spin text-gray-400" />
              )}
            </span>
          </button>
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-gray-400" />
          <select
            value={source.adapterId || ''}
            onChange={(e) => handleAdapterChange(e.target.value)}
            disabled={isUpdating !== null}
            className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">No adapter</option>
            {KNOWN_ADAPTERS.map((adapter) => (
              <option key={adapter.id} value={adapter.id}>
                {adapter.name} ({adapter.domain})
              </option>
            ))}
          </select>
          {isUpdating === 'adapterId' && (
            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
          )}
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          {source.robotsCompliant ? (
            <span className="inline-flex items-center gap-1 text-sm text-green-600">
              <ShieldCheck className="h-4 w-4" />
              Compliant
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-sm text-red-500">
              <ShieldAlert className="h-4 w-4" />
              Blocked
            </span>
          )}
          <button
            onClick={handleToggleRobotsCompliant}
            disabled={isUpdating !== null}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
              source.robotsCompliant ? 'bg-green-500' : 'bg-red-400'
            }`}
          >
            <span className="sr-only">Toggle robots compliant</span>
            <span
              className={`pointer-events-none inline-flex h-4 w-4 transform items-center justify-center rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                source.robotsCompliant ? 'translate-x-4' : 'translate-x-0'
              }`}
            >
              {isUpdating === 'robotsCompliant' && (
                <Loader2 className="h-2.5 w-2.5 animate-spin text-gray-400" />
              )}
            </span>
          </button>
        </div>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        {error && <p className="text-xs text-red-600">{error}</p>}
      </td>
    </tr>
  );
}

export function SourceScrapeConfigSection({ sources }: SourceScrapeConfigSectionProps) {
  const enabledCount = sources.filter((s) => s.scrapeEnabled).length;
  const withAdapterCount = sources.filter((s) => s.adapterId).length;

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-500" />
            Scrape Configuration
          </h2>
          <span className="text-sm text-gray-500">
            {enabledCount} of {sources.length} enabled, {withAdapterCount} with adapters
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
                Scraping
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Adapter
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Robots.txt
              </th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sources.map((source) => (
              <SourceScrapeRow key={source.id} source={source} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Enable scraping and assign an adapter to allow the harvester to scrape prices from this source.
          Robots.txt compliance is auto-managed but can be overridden here.
        </p>
      </div>
    </div>
  );
}
