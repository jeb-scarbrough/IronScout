'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

interface RefreshFeedButtonProps {
  feedId: string;
}

export function RefreshFeedButton({ feedId }: RefreshFeedButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleRefresh = async () => {
    if (!confirm('Start a manual feed refresh? This will fetch and process your product feed.')) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/feed/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedId }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Failed to start refresh');
        return;
      }

      alert('Feed refresh started! Check back in a few minutes.');
      router.refresh();
    } catch {
      alert('Failed to start refresh');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isLoading}
      className="inline-flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 disabled:opacity-50"
    >
      <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      {isLoading ? 'Starting...' : 'Refresh Now'}
    </button>
  );
}
