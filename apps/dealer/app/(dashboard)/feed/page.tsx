import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@ironscout/db';
import { 
  Rss, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  Clock,
  RefreshCw
} from 'lucide-react';
import { FeedConfigForm } from './feed-config-form';
import { FeedRunsTable } from './feed-runs-table';
import { RefreshFeedButton } from './refresh-feed-button';

export default async function FeedPage() {
  const session = await getSession();
  
  if (!session || session.type !== 'dealer') {
    redirect('/login');
  }
  
  const dealerId = session.dealerId;
  
  // Get feed and recent runs
  const [feed, recentRuns] = await Promise.all([
    prisma.dealerFeed.findFirst({
      where: { dealerId },
    }),
    prisma.dealerFeedRun.findMany({
      where: { dealerId },
      orderBy: { startedAt: 'desc' },
      take: 10,
    }),
  ]);

  const statusConfig = {
    PENDING: { icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Pending' },
    HEALTHY: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'Healthy' },
    WARNING: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Warning' },
    FAILED: { icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', label: 'Failed' },
  };

  const status = feed ? statusConfig[feed.status] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Feed Configuration</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure how IronScout imports your product catalog
          </p>
        </div>
        
        {feed && (
          <RefreshFeedButton feedId={feed.id} />
        )}
      </div>

      {/* Current Status */}
      {feed && status && (
        <div className="rounded-lg bg-white shadow">
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`rounded-full p-2 ${status.bg}`}>
                  <status.icon className={`h-5 w-5 ${status.color}`} />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Feed Status</h3>
                  <p className="text-sm text-gray-500">{status.label}</p>
                </div>
              </div>
              
              <div className="text-right">
                {feed.lastSuccessAt && (
                  <p className="text-sm text-gray-500">
                    Last success: {new Date(feed.lastSuccessAt).toLocaleString()}
                  </p>
                )}
                {feed.lastError && (
                  <p className="text-sm text-red-600 mt-1">
                    {feed.lastError}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configuration Form */}
      <div className="rounded-lg bg-white shadow">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-base font-semibold leading-6 text-gray-900 mb-4 flex items-center gap-2">
            <Rss className="h-5 w-5 text-gray-400" />
            {feed ? 'Update Feed Configuration' : 'Set Up Your Feed'}
          </h3>
          
          <FeedConfigForm
            initialData={feed ? {
              id: feed.id,
              feedType: feed.feedType,
              url: feed.url || '',
              username: feed.username || '',
              password: '', // Don't expose password
              scheduleMinutes: feed.scheduleMinutes,
            } : undefined}
          />
        </div>
      </div>

      {/* Recent Runs */}
      {recentRuns.length > 0 && (
        <div className="rounded-lg bg-white shadow">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-base font-semibold leading-6 text-gray-900 mb-4 flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-gray-400" />
              Recent Feed Runs
            </h3>
            
            <FeedRunsTable runs={recentRuns} />
          </div>
        </div>
      )}

      {/* Help */}
      <div className="rounded-lg bg-blue-50 p-4">
        <h4 className="text-sm font-medium text-blue-800">Feed Format Requirements</h4>
        <ul className="mt-2 text-sm text-blue-700 list-disc list-inside space-y-1">
          <li>CSV, XML, or JSON format supported</li>
          <li>Required fields: title, price, in_stock, url</li>
          <li>Recommended fields: upc, caliber, grain, pack_size, brand, image_url</li>
          <li>Prices should be in USD without currency symbols</li>
        </ul>
      </div>
    </div>
  );
}
