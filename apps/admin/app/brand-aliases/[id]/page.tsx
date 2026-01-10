import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getAlias } from '../actions';
import { ArrowLeft, ArrowRight, CheckCircle, Clock, XCircle, Zap, AlertTriangle } from 'lucide-react';
import { AliasActions } from './alias-actions';

export const dynamic = 'force-dynamic';

export default async function AliasDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getAlias(id);

  if (!result.success || !result.alias) {
    notFound();
  }

  const alias = result.alias;

  const statusConfig = {
    DRAFT: { label: 'Draft', icon: Clock, color: 'bg-yellow-100 text-yellow-700' },
    ACTIVE: { label: 'Active', icon: CheckCircle, color: 'bg-green-100 text-green-700' },
    DISABLED: { label: 'Disabled', icon: XCircle, color: 'bg-gray-100 text-gray-700' },
  };

  const status = statusConfig[alias.status];
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/brand-aliases"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Brand Aliases
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{alias.aliasName}</h1>
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium ${status.color}`}
            >
              <StatusIcon className="h-4 w-4" />
              {status.label}
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-gray-600">
            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-sm">{alias.aliasNorm}</span>
            <ArrowRight className="h-4 w-4" />
            <span className="font-mono bg-gray-100 px-2 py-0.5 rounded text-sm">{alias.canonicalNorm}</span>
          </div>
        </div>
        <AliasActions alias={alias} />
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Mapping Details */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Mapping Details</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Alias Name</dt>
              <dd className="text-sm text-gray-900">{alias.aliasName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Alias (Normalized)</dt>
              <dd className="text-sm font-mono text-gray-900">{alias.aliasNorm}</dd>
            </div>
            <div className="pt-2 border-t">
              <dt className="text-sm font-medium text-gray-500">Canonical Name</dt>
              <dd className="text-sm text-gray-900">{alias.canonicalName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Canonical (Normalized)</dt>
              <dd className="text-sm font-mono text-gray-900">{alias.canonicalNorm}</dd>
            </div>
          </dl>
        </div>

        {/* Metadata */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Metadata</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Source Type</dt>
              <dd className="text-sm text-gray-900">{alias.sourceType.replace('_', ' ')}</dd>
            </div>
            {alias.sourceRef && (
              <div>
                <dt className="text-sm font-medium text-gray-500">Source Reference</dt>
                <dd className="text-sm text-gray-900">{alias.sourceRef}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="text-sm text-gray-900">
                {new Date(alias.createdAt).toLocaleString()} by {alias.createdBy}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Updated</dt>
              <dd className="text-sm text-gray-900">
                {new Date(alias.updatedAt).toLocaleString()} by {alias.updatedBy}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Impact & Auto-activation */}
      {alias.status === 'DRAFT' && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Activation Analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Estimated Daily Impact</h3>
              <p
                className={`text-2xl font-bold ${
                  (alias.estimatedDailyImpact ?? 0) >= 500
                    ? 'text-orange-600'
                    : (alias.estimatedDailyImpact ?? 0) >= 100
                    ? 'text-yellow-600'
                    : 'text-green-600'
                }`}
              >
                ~{alias.estimatedDailyImpact ?? 0}/day
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Based on matching brands in recent feed data
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Auto-activation</h3>
              {alias.canAutoActivate ? (
                <div className="flex items-center gap-2 text-green-600">
                  <Zap className="h-5 w-5" />
                  <span className="font-medium">Eligible for auto-activation</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-orange-600">
                  <AlertTriangle className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <span className="font-medium">Requires manual review</span>
                    <p className="text-xs text-gray-500 mt-0.5">{alias.autoActivateReason}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Disabled Info */}
      {alias.status === 'DISABLED' && alias.disabledAt && (
        <div className="bg-gray-50 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Disabled Information</h2>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Disabled At</dt>
              <dd className="text-sm text-gray-900">{new Date(alias.disabledAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Disabled By</dt>
              <dd className="text-sm text-gray-900">{alias.disabledBy}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Reason</dt>
              <dd className="text-sm text-gray-900">{alias.disableReason}</dd>
            </div>
            {alias.disableReason?.startsWith('REJECTED:') && (
              <div className="mt-4 p-3 bg-red-50 rounded-lg">
                <p className="text-sm text-red-800">
                  This alias was rejected and cannot be re-activated. Create a new alias if needed.
                </p>
              </div>
            )}
          </dl>
        </div>
      )}

      {/* Notes */}
      {alias.notes && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{alias.notes}</p>
        </div>
      )}

      {/* Usage Stats */}
      {'totalApplications30d' in alias && (
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Usage Statistics</h2>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Applications (Last 30 Days)</h3>
            <p className="text-2xl font-bold text-gray-900">
              {(alias as any).totalApplications30d.toLocaleString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
