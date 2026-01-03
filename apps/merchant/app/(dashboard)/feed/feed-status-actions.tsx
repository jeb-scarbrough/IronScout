'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Play,
  Pause,
  RefreshCw,
  Trash2,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import type { FeedStatus } from '@ironscout/db/generated/prisma';

interface FeedStatusActionsProps {
  feedId: string;
  enabled: boolean;
  status: FeedStatus;
}

export function FeedStatusActions({ feedId, enabled, status }: FeedStatusActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: () => Promise<Response>) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await action();
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Action failed');
        return;
      }
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = () => handleAction(() =>
    fetch('/api/feed/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled }),
    })
  );

  const handleRunNow = () => handleAction(() =>
    fetch('/api/feed/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feedId }),
    })
  );

  const handleDelete = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/feed', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to delete feed');
        setShowDeleteConfirm(false);
        return;
      }
      router.refresh();
    } catch {
      setError('An unexpected error occurred');
      setShowDeleteConfirm(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Enabled: show Pause and Run Now */}
        {enabled && (
          <>
            <button
              onClick={handleToggle}
              disabled={isLoading}
              className="inline-flex items-center gap-1 rounded-md bg-yellow-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-yellow-700 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
              Pause
            </button>
            <button
              onClick={handleRunNow}
              disabled={isLoading}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Run Now
            </button>
          </>
        )}

        {/* Paused: show Enable */}
        {!enabled && (
          <button
            onClick={handleToggle}
            disabled={isLoading}
            className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Enable
          </button>
        )}

        {/* Delete button */}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isLoading}
          className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-red-50 border border-red-200 p-4 shadow-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <span className="text-sm text-red-800">{error}</span>
            <button
              onClick={() => setError(null)}
              className="ml-2 text-red-600 hover:text-red-800"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={() => !isLoading && setShowDeleteConfirm(false)}
          />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 rounded-full bg-red-100 p-2">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">Delete Feed</h3>
              </div>

              <p className="text-sm text-gray-500 mb-6">
                Are you sure you want to delete this feed? This will permanently remove:
              </p>
              <ul className="text-sm text-gray-500 list-disc list-inside mb-6 space-y-1">
                <li>All feed configuration and credentials</li>
                <li>All SKU mappings and price history</li>
                <li>All quarantined records</li>
              </ul>
              <p className="text-sm font-medium text-red-600 mb-6">
                This action cannot be undone.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Delete Feed
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
