import { AlertTriangle } from 'lucide-react';
import type {
  AffiliatePipelineMetrics,
  ScrapePipelineMetrics,
  RecomputeMetrics,
} from './actions';

interface PipelineStatusProps {
  affiliate: AffiliatePipelineMetrics | null;
  scrape: ScrapePipelineMetrics | null;
  recompute: RecomputeMetrics | null;
}

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}

function StuckBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
      <AlertTriangle className="h-3 w-3" />
      {count} stuck
    </span>
  );
}

function ErrorState({ section }: { section: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <h3 className="text-sm font-medium text-gray-900 mb-3">{section}</h3>
      <p className="text-sm text-red-600">Failed to load metrics</p>
    </div>
  );
}

function formatRate(numerator: number, denominator: number): string {
  if (denominator === 0) return '—';
  return `${Math.round((numerator / denominator) * 100)}%`;
}

function timeAgo(date: Date | null): string {
  if (!date) return 'Never';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function PipelineStatus({ affiliate, scrape, recompute }: PipelineStatusProps) {
  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 mb-3">Pipeline Status (24h)</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Affiliate Feeds */}
        {affiliate === null ? (
          <ErrorState section="Affiliate Feeds" />
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">Affiliate Feeds</h4>
              <StuckBadge count={affiliate.stuckCount} />
            </div>
            <div className="space-y-2">
              <MetricRow label="Total Runs" value={affiliate.totalRuns.toLocaleString()} />
              <MetricRow
                label="Success Rate"
                value={formatRate(affiliate.succeeded, affiliate.totalRuns)}
              />
              <MetricRow
                label="Avg Prices Written"
                value={affiliate.avgPricesWritten.toLocaleString()}
              />
              <div className="flex gap-2 pt-1">
                <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                  {affiliate.succeeded} succeeded
                </span>
                {affiliate.failed > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                    {affiliate.failed} failed
                  </span>
                )}
                {affiliate.running > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                    {affiliate.running} running
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Scrape Runs */}
        {scrape === null ? (
          <ErrorState section="Scrape Runs" />
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900">Scrape Runs</h4>
              <StuckBadge count={scrape.stuckCount} />
            </div>
            <div className="space-y-2">
              <MetricRow label="Total Runs" value={scrape.totalRuns.toLocaleString()} />
              <MetricRow
                label="Success Rate"
                value={formatRate(scrape.success, scrape.totalRuns)}
              />
              <MetricRow label="URLs Processed" value={scrape.urlsProcessed.toLocaleString()} />
              <MetricRow label="Offers Valid" value={scrape.offersValid.toLocaleString()} />
              <div className="flex gap-2 pt-1 flex-wrap">
                <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                  {scrape.success} success
                </span>
                {scrape.failed > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                    {scrape.failed} failed
                  </span>
                )}
                {scrape.quarantined > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                    {scrape.quarantined} quarantined
                  </span>
                )}
                {scrape.running > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                    {scrape.running} running
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recompute */}
        {recompute === null ? (
          <ErrorState section="Recompute" />
        ) : (
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Recompute</h4>
            <div className="space-y-2">
              <MetricRow
                label="Last Recompute"
                value={timeAgo(recompute.lastRecomputeTime)}
              />
              <MetricRow label="CVP Total Rows" value={recompute.cvpTotalRows.toLocaleString()} />
              <MetricRow
                label="Stale Rows"
                value={`${recompute.staleRowCount.toLocaleString()} (${recompute.stalePercentage}%)`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
