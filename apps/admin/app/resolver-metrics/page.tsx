import { prisma } from '@ironscout/db';
import {
  Activity,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Link as LinkIcon,
  Fingerprint,
  Barcode,
  HelpCircle,
  Hand,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const statusColors: Record<string, string> = {
  MATCHED: 'bg-green-100 text-green-700',
  CREATED: 'bg-blue-100 text-blue-700',
  NEEDS_REVIEW: 'bg-yellow-100 text-yellow-700',
  UNMATCHED: 'bg-yellow-100 text-yellow-700', // Deprecated, same as NEEDS_REVIEW
  SKIPPED: 'bg-gray-100 text-gray-700',
  ERROR: 'bg-red-100 text-red-700',
};

const matchTypeIcons: Record<string, typeof Barcode> = {
  UPC: Barcode,
  FINGERPRINT: Fingerprint,
  MANUAL: Hand,
  NONE: HelpCircle,
  ERROR: AlertTriangle,
};

const matchTypeColors: Record<string, string> = {
  UPC: 'bg-emerald-100 text-emerald-700',
  FINGERPRINT: 'bg-purple-100 text-purple-700',
  MANUAL: 'bg-orange-100 text-orange-700',
  NONE: 'bg-gray-100 text-gray-700',
  ERROR: 'bg-red-100 text-red-700',
};

export default async function ResolverMetricsPage() {
  // Get total link counts by status
  const statusCounts = await prisma.product_links.groupBy({
    by: ['status'],
    _count: { id: true },
  });

  // Get total link counts by matchType
  const matchTypeCounts = await prisma.product_links.groupBy({
    by: ['matchType'],
    _count: { id: true },
  });

  // Get needs review + error counts by reasonCode
  const reasonCodeCounts = await prisma.product_links.groupBy({
    by: ['reasonCode'],
    where: { status: { in: ['NEEDS_REVIEW', 'ERROR'] } },
    _count: { id: true },
  });

  // Get resolver version distribution
  const resolverVersionCounts = await prisma.product_links.groupBy({
    by: ['resolverVersion'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  });

  // Get recent links (last 24h)
  const recentLinks = await prisma.product_links.findMany({
    where: {
      resolvedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    orderBy: { resolvedAt: 'desc' },
    take: 20,
    include: {
      source_products: {
        select: { title: true },
      },
      products: {
        select: { name: true },
      },
    },
  });

  // Calculate totals
  const totalLinks = statusCounts.reduce((sum, s) => sum + s._count.id, 0);
  const matchedCount = statusCounts.find((s) => s.status === 'MATCHED')?._count.id ?? 0;
  const createdCount = statusCounts.find((s) => s.status === 'CREATED')?._count.id ?? 0;
  const errorCount = statusCounts.find((s) => s.status === 'ERROR')?._count.id ?? 0;

  const matchRate = totalLinks > 0 ? ((matchedCount + createdCount) / totalLinks) * 100 : 0;
  const errorRate = totalLinks > 0 ? (errorCount / totalLinks) * 100 : 0;

  // Links resolved in last 24h
  const last24hCount = await prisma.product_links.count({
    where: {
      resolvedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Resolver Metrics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Product resolver performance and identity matching statistics
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <LinkIcon className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Links</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {totalLinks.toLocaleString()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Match Rate</dt>
                  <dd className="text-lg font-semibold text-gray-900">{matchRate.toFixed(1)}%</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <XCircle className="h-6 w-6 text-red-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Error Rate</dt>
                  <dd className="text-lg font-semibold text-gray-900">{errorRate.toFixed(2)}%</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Activity className="h-6 w-6 text-blue-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Last 24h</dt>
                  <dd className="text-lg font-semibold text-gray-900">
                    {last24hCount.toLocaleString()}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Status & Match Type Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Status Distribution */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Status Distribution</h2>
          <div className="space-y-3">
            {(['MATCHED', 'CREATED', 'NEEDS_REVIEW', 'ERROR'] as const).map((status) => {
              const count = statusCounts.find((s) => s.status === status)?._count.id ?? 0;
              const percentage = totalLinks > 0 ? (count / totalLinks) * 100 : 0;
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[status]}`}>
                      {status}
                    </span>
                    <span className="text-sm text-gray-600">
                      {count.toLocaleString()} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${status === 'MATCHED' || status === 'CREATED' ? 'bg-green-500' : status === 'ERROR' ? 'bg-red-500' : 'bg-yellow-500'}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Match Type Distribution */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Match Type Distribution</h2>
          <div className="space-y-3">
            {(['UPC', 'FINGERPRINT', 'MANUAL', 'NONE', 'ERROR'] as const).map((matchType) => {
              const count = matchTypeCounts.find((m) => m.matchType === matchType)?._count.id ?? 0;
              const percentage = totalLinks > 0 ? (count / totalLinks) * 100 : 0;
              const Icon = matchTypeIcons[matchType];
              return (
                <div key={matchType}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${matchTypeColors[matchType]}`}>
                      <Icon className="h-3 w-3" />
                      {matchType}
                    </span>
                    <span className="text-sm text-gray-600">
                      {count.toLocaleString()} ({percentage.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-gray-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor:
                          matchType === 'UPC'
                            ? '#10b981'
                            : matchType === 'FINGERPRINT'
                              ? '#8b5cf6'
                              : matchType === 'MANUAL'
                                ? '#f97316'
                                : matchType === 'ERROR'
                                  ? '#ef4444'
                                  : '#6b7280',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Reason Codes & Resolver Versions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Reason Code Breakdown */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Failure Reasons</h2>
          {reasonCodeCounts.length > 0 ? (
            <div className="space-y-2">
              {reasonCodeCounts
                .filter((r) => r.reasonCode !== null)
                .sort((a, b) => b._count.id - a._count.id)
                .map((reason) => (
                  <div
                    key={reason.reasonCode}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-sm font-mono text-gray-700">{reason.reasonCode}</span>
                    <span className="text-sm text-gray-600">{reason._count.id.toLocaleString()}</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No needs review or error links</p>
          )}
        </div>

        {/* Resolver Version Distribution */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Resolver Versions</h2>
          {resolverVersionCounts.length > 0 ? (
            <div className="space-y-2">
              {resolverVersionCounts.map((version) => (
                <div
                  key={version.resolverVersion}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <span className="text-sm font-mono text-gray-700">{version.resolverVersion}</span>
                  <span className="text-sm text-gray-600">
                    {version._count.id.toLocaleString()} links
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No resolver versions recorded</p>
          )}
        </div>
      </div>

      {/* Recent Links */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Links (Last 24h)</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Canonical Product
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Match Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Confidence
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resolved
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {recentLinks.map((link) => {
                const MatchIcon = matchTypeIcons[link.matchType];
                return (
                  <tr key={link.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {link.source_products?.title || link.sourceProductId}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {link.products?.name || link.productId || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[link.status]}`}
                      >
                        {link.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${matchTypeColors[link.matchType]}`}
                      >
                        <MatchIcon className="h-3 w-3" />
                        {link.matchType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-600">
                        {(Number(link.confidence) * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {link.resolvedAt
                        ? new Date(link.resolvedAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </td>
                  </tr>
                );
              })}
              {recentLinks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No links resolved in the last 24 hours
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
