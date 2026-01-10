import { listAliases, getAliasStats, type AliasStatus } from './actions';
import Link from 'next/link';
import {
  Plus,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  Tags,
  ArrowRight,
} from 'lucide-react';
import { AliasesTable } from './aliases-table';

export const dynamic = 'force-dynamic';

const statusLabels: Record<AliasStatus, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  DISABLED: 'Disabled',
};

export default async function BrandAliasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const statusFilter = params.status as AliasStatus | undefined;

  const [aliasesResult, statsResult] = await Promise.all([
    listAliases({ status: statusFilter }),
    getAliasStats(),
  ]);

  if (!aliasesResult.success) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Failed to load aliases: {aliasesResult.error}</p>
        </div>
      </div>
    );
  }

  const stats = statsResult.stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brand Aliases</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage brand alias mappings for resolver normalization
          </p>
        </div>
        <Link
          href="/brand-aliases/create"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Alias
        </Link>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Draft</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.draftCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Active</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.activeCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <XCircle className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Disabled</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.disabledCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Tags className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Total Applications</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {stats.totalApplications.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Status:</span>
          </div>

          <Link
            href="/brand-aliases"
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              !statusFilter
                ? 'bg-gray-200 text-gray-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </Link>

          {(['DRAFT', 'ACTIVE', 'DISABLED'] as AliasStatus[]).map((status) => (
            <Link
              key={status}
              href={`/brand-aliases?status=${status}`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-gray-200 text-gray-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {statusLabels[status]}
            </Link>
          ))}
        </div>
      </div>

      {/* Aliases Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            {statusFilter ? `${statusLabels[statusFilter]} Aliases` : 'All Aliases'}
            <span className="ml-2 text-sm font-normal text-gray-500">
              ({aliasesResult.aliases.length})
            </span>
          </h2>
        </div>
        <AliasesTable aliases={aliasesResult.aliases} />
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-900 mb-2">How Brand Aliases Work</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li className="flex items-start gap-2">
            <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>Aliases map variant brand names to canonical brands for consistent search results</span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>Only ACTIVE aliases are applied during product resolution</span>
          </li>
          <li className="flex items-start gap-2">
            <ArrowRight className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>Changes affect future ingestion only; existing products are not reprocessed</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
