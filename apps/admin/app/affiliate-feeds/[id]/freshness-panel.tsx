'use client';

import { useEffect, useState } from 'react';
import { Activity, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { getFeedFreshness, type FeedFreshnessStatus } from './actions';

interface FreshnessPanelProps {
  feedId: string;
}

export function FreshnessPanel({ feedId }: FreshnessPanelProps) {
  const [status, setStatus] = useState<FeedFreshnessStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFreshness() {
      try {
        const result = await getFeedFreshness(feedId);
        if (result.success && result.data) {
          setStatus(result.data);
        } else {
          setError(result.error || 'Failed to load freshness');
        }
      } catch (e) {
        setError('Failed to load freshness');
      } finally {
        setLoading(false);
      }
    }
    loadFreshness();
  }, [feedId]);

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Freshness Status
          </h2>
        </div>
        <div className="px-6 py-8 text-center text-gray-500">
          Loading...
        </div>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Freshness Status
          </h2>
        </div>
        <div className="px-6 py-8 text-center text-red-500">
          {error || 'No data available'}
        </div>
      </div>
    );
  }

  const total = status.activeCount + status.expiredCount;
  const activePercent = total > 0 ? ((status.activeCount / total) * 100).toFixed(1) : '0';
  const expiredPercent = total > 0 ? ((status.expiredCount / total) * 100).toFixed(1) : '0';

  // Freshness indicator
  const freshnessHealth =
    status.expiredCount === 0 ? 'healthy' :
    status.expiredCount < status.activeCount ? 'warning' :
    'critical';

  const healthConfig = {
    healthy: { color: 'text-green-600 bg-green-50', label: 'Healthy' },
    warning: { color: 'text-yellow-600 bg-yellow-50', label: 'Degraded' },
    critical: { color: 'text-red-600 bg-red-50', label: 'Critical' },
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Freshness Status
        </h2>
        <span className={`px-3 py-1 rounded-full text-sm font-medium ${healthConfig[freshnessHealth].color}`}>
          {healthConfig[freshnessHealth].label}
        </span>
      </div>
      <div className="px-6 py-4">
        <div className="grid grid-cols-3 gap-6">
          {/* Active */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Active</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {status.activeCount.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">{activePercent}%</div>
          </div>

          {/* Pending */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-blue-600 mb-2">
              <Clock className="h-5 w-5" />
              <span className="text-sm font-medium">Pending</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {status.pendingCount.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">awaiting promotion</div>
          </div>

          {/* Expired */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-red-600 mb-2">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-medium">Expired</span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {status.expiredCount.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500">{expiredPercent}%</div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-6">
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex">
            <div
              className="bg-green-500 transition-all duration-300"
              style={{ width: `${activePercent}%` }}
            />
            <div
              className="bg-red-400 transition-all duration-300"
              style={{ width: `${expiredPercent}%` }}
            />
          </div>
        </div>

        {/* Expiry info */}
        <div className="mt-4 text-sm text-gray-500 text-center">
          Products expire after {status.expiryHours} hours without being seen
        </div>
      </div>
    </div>
  );
}
