import { prisma } from '@ironscout/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  Globe,
  Bot,
  BotOff,
  ShieldCheck,
  ShieldAlert,
  Store,
  Calendar,
} from 'lucide-react';
import { EditSourceForm } from './edit-source-form';
import { SourceStatusActions } from './source-status-actions';

export const dynamic = 'force-dynamic';

const typeConfig: Record<string, { label: string; color: string }> = {
  HTML: { label: 'HTML', color: 'bg-blue-100 text-blue-700' },
  JS_RENDERED: { label: 'JS Rendered', color: 'bg-purple-100 text-purple-700' },
  RSS: { label: 'RSS', color: 'bg-orange-100 text-orange-700' },
  JSON: { label: 'JSON', color: 'bg-cyan-100 text-cyan-700' },
  FEED_CSV: { label: 'Feed CSV', color: 'bg-green-100 text-green-700' },
  FEED_XML: { label: 'Feed XML', color: 'bg-yellow-100 text-yellow-700' },
  FEED_JSON: { label: 'Feed JSON', color: 'bg-teal-100 text-teal-700' },
};

function formatInterval(seconds: number): string {
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)} minutes`;
  }
  const hours = Math.round(seconds / 3600);
  return `${hours} hour${hours !== 1 ? 's' : ''}`;
}

export default async function SourceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const isEditing = edit === 'true';

  const source = await prisma.sources.findUnique({
    where: { id },
    include: {
      retailers: true,
      executions: {
        orderBy: { startedAt: 'desc' },
        take: 10,
      },
      affiliate_feeds: {
        take: 1,
      },
    },
  });

  if (!source) {
    notFound();
  }

  const typeInfo = typeConfig[source.type] || { label: source.type, color: 'bg-gray-100 text-gray-700' };
  const hasAffiliateFeed = source.affiliate_feeds.length > 0;

  // Get retailers for edit form
  const retailers = await prisma.retailers.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true },
  });

  if (isEditing) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link
            href={`/sources/${id}`}
            className="p-2 rounded-md hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Source</h1>
            <p className="mt-1 text-sm text-gray-500">{source.name}</p>
          </div>
        </div>

        <EditSourceForm source={source} retailers={retailers} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/sources"
            className="p-2 rounded-md hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{source.name}</h1>
              {source.enabled ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-base font-medium bg-green-100 text-green-700">
                  <CheckCircle className="h-5 w-5" />
                  Enabled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-base font-medium bg-gray-100 text-gray-600">
                  <XCircle className="h-5 w-5" />
                  Disabled
                </span>
              )}
              <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-base font-medium ${typeInfo.color}`}>
                {typeInfo.label}
              </span>
              {source.scrapeEnabled && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-base font-medium bg-purple-100 text-purple-700">
                  <Bot className="h-5 w-5" />
                  Scraping
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {source.retailers?.name || 'No retailer'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/sources/${id}?edit=true`}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Edit
          </Link>
          <SourceStatusActions source={source} />
        </div>
      </div>

      {/* Affiliate Feed Alert */}
      {hasAffiliateFeed && (
        <div className="rounded-md bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-blue-800">
              This source has an affiliate feed configured.{' '}
              <Link href={`/affiliate-feeds/${source.affiliate_feeds[0].id}`} className="font-medium underline">
                View feed
              </Link>
            </span>
          </div>
        </div>
      )}

      {/* Basic Configuration */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Configuration</h2>
        </div>
        <div className="px-6 py-4">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="flex items-center gap-1 text-sm font-medium text-gray-500">
                <Globe className="h-4 w-4" />
                URL
              </dt>
              <dd className="mt-1 text-sm text-gray-900 break-all">
                <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  {source.url}
                </a>
              </dd>
            </div>

            <div>
              <dt className="flex items-center gap-1 text-sm font-medium text-gray-500">
                <Store className="h-4 w-4" />
                Retailer
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                <Link href={`/retailers/${source.retailerId}`} className="text-blue-600 hover:underline">
                  {source.retailers?.name || 'Unknown'}
                </Link>
              </dd>
            </div>

            <div>
              <dt className="flex items-center gap-1 text-sm font-medium text-gray-500">
                <Clock className="h-4 w-4" />
                Interval
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                Every {formatInterval(source.interval)}
              </dd>
            </div>

            <div>
              <dt className="flex items-center gap-1 text-sm font-medium text-gray-500">
                <Calendar className="h-4 w-4" />
                Last Run
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {source.lastRunAt
                  ? new Date(source.lastRunAt).toLocaleString()
                  : 'Never'}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(source.createdAt).toLocaleString()}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Updated</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(source.updatedAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Scraper Configuration */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Scraper Configuration</h2>
        </div>
        <div className="px-6 py-4">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-sm font-medium text-gray-500">Scrape Enabled</dt>
              <dd className="mt-1">
                {source.scrapeEnabled ? (
                  <span className="inline-flex items-center gap-1 text-sm text-purple-600">
                    <Bot className="h-4 w-4" />
                    Enabled
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm text-gray-400">
                    <BotOff className="h-4 w-4" />
                    Disabled
                  </span>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Adapter ID</dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">
                {source.adapterId || <span className="text-gray-400">—</span>}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">Robots Compliant</dt>
              <dd className="mt-1">
                {source.robotsCompliant ? (
                  <span className="inline-flex items-center gap-1 text-sm text-green-600">
                    <ShieldCheck className="h-4 w-4" />
                    Compliant
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm text-red-600">
                    <ShieldAlert className="h-4 w-4" />
                    Not Compliant
                  </span>
                )}
              </dd>
            </div>

            <div>
              <dt className="text-sm font-medium text-gray-500">ToS Reviewed</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {source.tosReviewedAt
                  ? new Date(source.tosReviewedAt).toLocaleDateString()
                  : <span className="text-gray-400">—</span>}
                {source.tosApprovedBy && (
                  <span className="text-gray-500"> by {source.tosApprovedBy}</span>
                )}
              </dd>
            </div>
          </dl>

          {source.scrapeConfig && (
            <div className="mt-6">
              <dt className="text-sm font-medium text-gray-500 mb-2">Scrape Config</dt>
              <dd className="text-sm text-gray-900 font-mono bg-gray-50 p-4 rounded-md overflow-auto">
                <pre>{JSON.stringify(source.scrapeConfig, null, 2)}</pre>
              </dd>
            </div>
          )}
        </div>
      </div>

      {/* Recent Executions */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Executions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Started
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Found
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Upserted
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {source.executions.map((execution) => (
                <tr key={execution.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(execution.startedAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      execution.status === 'SUCCESS'
                        ? 'bg-green-100 text-green-700'
                        : execution.status === 'FAILED'
                          ? 'bg-red-100 text-red-700'
                          : execution.status === 'RUNNING'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-700'
                    }`}>
                      {execution.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {execution.duration
                      ? `${(execution.duration / 1000).toFixed(1)}s`
                      : '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {execution.itemsFound?.toLocaleString() ?? '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {execution.itemsUpserted?.toLocaleString() ?? '—'}
                  </td>
                </tr>
              ))}

              {source.executions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                    No executions yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Metadata */}
      <div className="text-sm text-gray-500">
        <p>Source ID: {source.id}</p>
      </div>
    </div>
  );
}
