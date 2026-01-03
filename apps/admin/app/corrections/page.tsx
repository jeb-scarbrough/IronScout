import { listCorrections } from './actions';
import Link from 'next/link';
import {
  Plus,
  Filter,
  EyeOff,
  Calculator,
  Clock,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { CorrectionsTable } from './corrections-table';

export const dynamic = 'force-dynamic';

const scopeTypeLabels: Record<string, string> = {
  PRODUCT: 'Product',
  RETAILER: 'Retailer',
  MERCHANT: 'Merchant',
  SOURCE: 'Source',
  AFFILIATE: 'Affiliate Feed',
  FEED_RUN: 'Feed Run',
};

export default async function CorrectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ showRevoked?: string; scopeType?: string }>;
}) {
  const params = await searchParams;
  const showRevoked = params.showRevoked === 'true';
  const scopeTypeFilter = params.scopeType as string | undefined;

  const { success, corrections, error } = await listCorrections({
    includeRevoked: showRevoked,
    scopeType: scopeTypeFilter as any,
  });

  if (!success) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Failed to load corrections: {error}</p>
        </div>
      </div>
    );
  }

  const activeCount = corrections.filter(c => !c.revokedAt).length;
  const revokedCount = corrections.filter(c => c.revokedAt).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Price Corrections</h1>
          <p className="mt-1 text-sm text-gray-500">
            ADR-015: Manage price correction overlays for data quality issues
          </p>
        </div>
        <Link
          href="/corrections/create"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Correction
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Active Corrections</p>
              <p className="text-2xl font-semibold text-gray-900">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gray-100 rounded-lg">
              <XCircle className="h-5 w-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Revoked</p>
              <p className="text-2xl font-semibold text-gray-900">{revokedCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Filter className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Total</p>
              <p className="text-2xl font-semibold text-gray-900">{corrections.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>

          {/* Show Revoked Toggle */}
          <Link
            href={showRevoked ? '/corrections' : '/corrections?showRevoked=true'}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              showRevoked
                ? 'bg-gray-200 text-gray-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <XCircle className="h-3.5 w-3.5" />
            {showRevoked ? 'Showing Revoked' : 'Show Revoked'}
          </Link>

          {/* Scope Type Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Scope:</span>
            <select
              defaultValue={scopeTypeFilter || ''}
              onChange={(e) => {
                const url = new URL(window.location.href);
                if (e.target.value) {
                  url.searchParams.set('scopeType', e.target.value);
                } else {
                  url.searchParams.delete('scopeType');
                }
                window.location.href = url.toString();
              }}
              className="text-sm border border-gray-300 rounded-md px-2 py-1"
            >
              <option value="">All Scopes</option>
              {Object.entries(scopeTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Corrections Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            {showRevoked ? 'All Corrections' : 'Active Corrections'}
          </h2>
        </div>
        <CorrectionsTable corrections={corrections} />
      </div>

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3">Action Types</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
              <EyeOff className="h-3 w-3" />
              IGNORE
            </span>
            <span className="text-sm text-gray-600">Prices are hidden from consumers</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
              <Calculator className="h-3 w-3" />
              MULTIPLIER
            </span>
            <span className="text-sm text-gray-600">Prices are adjusted by a factor</span>
          </div>
        </div>
        <div className="mt-3 text-xs text-gray-500">
          <strong>Precedence:</strong> PRODUCT &gt; RETAILER &gt; MERCHANT &gt; SOURCE &gt; AFFILIATE &gt; FEED_RUN
        </div>
      </div>
    </div>
  );
}
