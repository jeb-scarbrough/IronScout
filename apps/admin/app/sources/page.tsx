import { prisma } from '@ironscout/db';
import Link from 'next/link';
import {
  Database,
  Clock,
  CheckCircle,
  XCircle,
  Plus,
  Bot,
  BotOff,
} from 'lucide-react';
import { SourceActions } from './source-actions';

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
    return `${Math.round(seconds / 60)}m`;
  }
  return `${Math.round(seconds / 3600)}h`;
}

export default async function SourcesPage() {
  const sources = await prisma.sources.findMany({
    orderBy: [
      { enabled: 'desc' },
      { name: 'asc' },
    ],
    include: {
      retailers: true,
      executions: {
        orderBy: { startedAt: 'desc' },
        take: 1,
      },
    },
  });

  const totalCount = sources.length;
  const enabledCount = sources.filter(s => s.enabled).length;
  const disabledCount = sources.filter(s => !s.enabled).length;
  const scrapeEnabledCount = sources.filter(s => s.scrapeEnabled).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sources</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage data sources for product and pricing ingestion
          </p>
        </div>
        <Link
          href="/sources/create"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Source
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Database className="h-6 w-6 text-gray-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Sources</dt>
                  <dd className="text-lg font-semibold text-gray-900">{totalCount}</dd>
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
                  <dt className="text-sm font-medium text-gray-500 truncate">Enabled</dt>
                  <dd className="text-lg font-semibold text-gray-900">{enabledCount}</dd>
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
                  <dt className="text-sm font-medium text-gray-500 truncate">Disabled</dt>
                  <dd className="text-lg font-semibold text-gray-900">{disabledCount}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Bot className="h-6 w-6 text-purple-400" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Scrape-Enabled</dt>
                  <dd className="text-lg font-semibold text-gray-900">{scrapeEnabledCount}</dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sources Table */}
      <div className="bg-white shadow rounded-lg overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Retailer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Scrape
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Adapter
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Interval
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Run
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sources.map((source) => {
              const typeInfo = typeConfig[source.type] || { label: source.type, color: 'bg-gray-100 text-gray-700' };
              const lastExecution = source.executions[0];
              const rowBgClass = !source.enabled ? 'bg-gray-50' : '';

              return (
                <tr key={source.id} className={rowBgClass}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={`/sources/${source.id}`} className="hover:underline">
                      <div className="text-sm font-medium text-gray-900">{source.name}</div>
                      <div className="text-xs text-gray-500 truncate max-w-xs" title={source.url}>
                        {source.url}
                      </div>
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={`/retailers/${source.retailerId}`} className="text-sm text-blue-600 hover:underline">
                      {source.retailers?.name || 'Unknown'}
                    </Link>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
                      {typeInfo.label}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {source.enabled ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        <CheckCircle className="h-3 w-3" />
                        Enabled
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        <XCircle className="h-3 w-3" />
                        Disabled
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {source.scrapeEnabled ? (
                      <span className="inline-flex items-center gap-1 text-sm text-purple-600" title="Scraping enabled">
                        <Bot className="h-4 w-4" />
                        On
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-sm text-gray-400" title="Scraping disabled">
                        <BotOff className="h-4 w-4" />
                        Off
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {source.adapterId ? (
                      <span className="text-sm font-mono text-gray-700">{source.adapterId}</span>
                    ) : (
                      <span className="text-sm text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-sm text-gray-700">
                      <Clock className="h-3.5 w-3.5" />
                      {formatInterval(source.interval)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {lastExecution ? (
                      <div>
                        <span className={`text-sm ${lastExecution.status === 'SUCCESS' ? 'text-green-600' : lastExecution.status === 'FAILED' ? 'text-red-600' : 'text-gray-600'}`}>
                          {lastExecution.status}
                        </span>
                        <div className="text-xs text-gray-500">
                          {new Date(lastExecution.startedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    ) : source.lastRunAt ? (
                      <div className="text-xs text-gray-500">
                        {new Date(source.lastRunAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Never</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <SourceActions
                      source={{
                        id: source.id,
                        name: source.name,
                        enabled: source.enabled,
                        scrapeEnabled: source.scrapeEnabled,
                      }}
                    />
                  </td>
                </tr>
              );
            })}

            {sources.length === 0 && (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-gray-500">
                  No sources configured yet.{' '}
                  <Link href="/sources/create" className="text-blue-600 hover:underline">
                    Add your first source
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
