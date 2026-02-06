'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Power,
  PowerOff,
  Bot,
  BotOff,
  Trash2,
  Loader2,
} from 'lucide-react';
import {
  toggleSourceEnabled,
  toggleScrapeEnabled,
  deleteSource,
} from '../actions';

interface Source {
  id: string;
  name: string;
  enabled: boolean;
  scrapeEnabled: boolean;
}

interface SourceStatusActionsProps {
  source: Source;
}

export function SourceStatusActions({ source }: SourceStatusActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const handleToggleEnabled = async () => {
    setIsLoading('enable');
    try {
      const result = await toggleSourceEnabled(source.id);
      if (result.success) {
        toast.success(result.enabled ? 'Source enabled' : 'Source disabled');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to toggle source');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(null);
    }
  };

  const handleToggleScrape = async () => {
    setIsLoading('scrape');
    try {
      const result = await toggleScrapeEnabled(source.id);
      if (result.success) {
        toast.success(result.scrapeEnabled ? 'Scraping enabled' : 'Scraping disabled');
        router.refresh();
      } else {
        toast.error(result.error || 'Failed to toggle scraping');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${source.name}"? This action cannot be undone.`)) {
      return;
    }

    setIsLoading('delete');
    try {
      const result = await deleteSource(source.id);
      if (result.success) {
        toast.success('Source deleted');
        router.push('/sources');
      } else {
        toast.error(result.error || 'Failed to delete source');
      }
    } catch {
      toast.error('An unexpected error occurred');
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleToggleEnabled}
        disabled={isLoading !== null}
        className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border ${
          source.enabled
            ? 'text-orange-700 bg-orange-50 border-orange-200 hover:bg-orange-100'
            : 'text-green-700 bg-green-50 border-green-200 hover:bg-green-100'
        } disabled:opacity-50`}
        title={source.enabled ? 'Disable source' : 'Enable source'}
      >
        {isLoading === 'enable' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : source.enabled ? (
          <PowerOff className="h-4 w-4" />
        ) : (
          <Power className="h-4 w-4" />
        )}
        {source.enabled ? 'Disable' : 'Enable'}
      </button>

      <button
        onClick={handleToggleScrape}
        disabled={isLoading !== null}
        className={`inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border ${
          source.scrapeEnabled
            ? 'text-gray-700 bg-gray-50 border-gray-200 hover:bg-gray-100'
            : 'text-purple-700 bg-purple-50 border-purple-200 hover:bg-purple-100'
        } disabled:opacity-50`}
        title={source.scrapeEnabled ? 'Disable scraping' : 'Enable scraping'}
      >
        {isLoading === 'scrape' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : source.scrapeEnabled ? (
          <BotOff className="h-4 w-4" />
        ) : (
          <Bot className="h-4 w-4" />
        )}
        {source.scrapeEnabled ? 'Stop Scraping' : 'Enable Scraping'}
      </button>

      <button
        onClick={handleDelete}
        disabled={isLoading !== null}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 disabled:opacity-50"
        title="Delete source"
      >
        {isLoading === 'delete' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
        Delete
      </button>
    </div>
  );
}
