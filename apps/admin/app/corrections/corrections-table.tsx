'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  EyeOff,
  Calculator,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { revokeCorrection, CorrectionDTO } from './actions';

interface CorrectionsTableProps {
  corrections: CorrectionDTO[];
}

const scopeTypeLabels: Record<string, string> = {
  PRODUCT: 'Product',
  RETAILER: 'Retailer',
  MERCHANT: 'Merchant',
  SOURCE: 'Source',
  AFFILIATE: 'Affiliate',
  FEED_RUN: 'Feed Run',
};

const scopeTypeColors: Record<string, string> = {
  PRODUCT: 'bg-purple-100 text-purple-700',
  RETAILER: 'bg-green-100 text-green-700',
  MERCHANT: 'bg-blue-100 text-blue-700',
  SOURCE: 'bg-amber-100 text-amber-700',
  AFFILIATE: 'bg-pink-100 text-pink-700',
  FEED_RUN: 'bg-gray-100 text-gray-700',
};

export function CorrectionsTable({ corrections }: CorrectionsTableProps) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revokeDialogId, setRevokeDialogId] = useState<string | null>(null);
  const [revokeReason, setRevokeReason] = useState('');
  const [isRevoking, setIsRevoking] = useState(false);

  const handleRevoke = async () => {
    if (!revokeDialogId || !revokeReason.trim()) return;

    setIsRevoking(true);
    try {
      const result = await revokeCorrection(revokeDialogId, revokeReason);
      if (!result.success) {
        alert(result.error || 'Failed to revoke correction');
      } else {
        alert(result.message);
        setRevokeDialogId(null);
        setRevokeReason('');
        router.refresh();
      }
    } catch {
      alert('An unexpected error occurred');
    } finally {
      setIsRevoking(false);
    }
  };

  if (corrections.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-gray-500">
        No corrections found. Create one to manage price data quality.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-3 py-3"></th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Scope
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Entity
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Time Range
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {corrections.map((correction) => {
              const isExpanded = expandedId === correction.id;
              const isRevoked = !!correction.revokedAt;

              return (
                <>
                  <tr
                    key={correction.id}
                    className={isRevoked ? 'bg-gray-50 opacity-60' : ''}
                  >
                    <td className="px-3 py-4">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : correction.id)}
                        className="p-1 rounded hover:bg-gray-100"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${scopeTypeColors[correction.scopeType]}`}>
                        {scopeTypeLabels[correction.scopeType]}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate" title={correction.scopeName}>
                        {correction.scopeName}
                      </div>
                      <div className="text-xs text-gray-500 font-mono">
                        {correction.scopeId.slice(0, 12)}...
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {correction.action === 'IGNORE' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                          <EyeOff className="h-3 w-3" />
                          IGNORE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          <Calculator className="h-3 w-3" />
                          {correction.value}x
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {new Date(correction.startTs).toLocaleDateString()} -{' '}
                          {new Date(correction.endTs).toLocaleDateString()}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {isRevoked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          <XCircle className="h-3 w-3" />
                          Revoked
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      {!isRevoked && (
                        <button
                          onClick={() => setRevokeDialogId(correction.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200"
                        >
                          <XCircle className="h-3 w-3" />
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${correction.id}-details`}>
                      <td colSpan={7} className="px-6 py-4 bg-gray-50">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <dt className="font-medium text-gray-500">ID</dt>
                            <dd className="mt-1 font-mono text-xs text-gray-700">{correction.id}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-gray-500">Created At</dt>
                            <dd className="mt-1 text-gray-700">
                              {new Date(correction.createdAt).toLocaleString()}
                            </dd>
                          </div>
                          <div>
                            <dt className="font-medium text-gray-500">Created By</dt>
                            <dd className="mt-1 text-gray-700">{correction.createdBy}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-gray-500">Full Scope ID</dt>
                            <dd className="mt-1 font-mono text-xs text-gray-700 break-all">
                              {correction.scopeId}
                            </dd>
                          </div>
                          <div className="md:col-span-2">
                            <dt className="font-medium text-gray-500">Reason</dt>
                            <dd className="mt-1 text-gray-700">{correction.reason}</dd>
                          </div>
                          <div>
                            <dt className="font-medium text-gray-500">Start Time</dt>
                            <dd className="mt-1 text-gray-700">
                              {new Date(correction.startTs).toLocaleString()}
                            </dd>
                          </div>
                          <div>
                            <dt className="font-medium text-gray-500">End Time</dt>
                            <dd className="mt-1 text-gray-700">
                              {new Date(correction.endTs).toLocaleString()}
                            </dd>
                          </div>
                          {isRevoked && (
                            <>
                              <div>
                                <dt className="font-medium text-gray-500">Revoked At</dt>
                                <dd className="mt-1 text-red-700">
                                  {new Date(correction.revokedAt!).toLocaleString()}
                                </dd>
                              </div>
                              <div>
                                <dt className="font-medium text-gray-500">Revoked By</dt>
                                <dd className="mt-1 text-red-700">{correction.revokedBy}</dd>
                              </div>
                              <div className="md:col-span-2">
                                <dt className="font-medium text-gray-500">Revoke Reason</dt>
                                <dd className="mt-1 text-red-700">{correction.revokeReason}</dd>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Revoke Dialog */}
      {revokeDialogId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Revoke Correction</h3>
            <p className="text-sm text-gray-600 mb-4">
              Revoking this correction will make the affected prices visible again (if action was IGNORE)
              or remove the price adjustment (if action was MULTIPLIER).
            </p>
            <div className="mb-4">
              <label htmlFor="revokeReason" className="block text-sm font-medium text-gray-700 mb-1">
                Reason for revoking <span className="text-red-500">*</span>
              </label>
              <textarea
                id="revokeReason"
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500 text-sm"
                rows={3}
                placeholder="e.g., Data issue resolved, Applied in error, Superseded by new correction"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setRevokeDialogId(null);
                  setRevokeReason('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={isRevoking || !revokeReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRevoking ? 'Revoking...' : 'Revoke Correction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
