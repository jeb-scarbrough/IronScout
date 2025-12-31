'use client';

import { useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ThumbsUp,
  Download,
} from 'lucide-react';
import { approveActivation, generateRunReport } from '../actions';

interface RunError {
  id: string;
  code: string;
  message: string;
  rowNumber: number | null;
  sample: unknown;
}

interface Run {
  id: string;
  trigger: string;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  rowsRead: number | null;
  rowsParsed: number | null;
  productsUpserted: number | null;
  pricesWritten: number | null;
  productsPromoted: number | null;
  productsRejected: number | null;
  duplicateKeyCount: number | null;
  urlHashFallbackCount: number | null;
  errorCount: number | null;
  skippedReason: string | null;
  expiryBlocked: boolean;
  expiryBlockedReason: string | null;
  expiryApprovedAt: Date | null;
  expiryApprovedBy: string | null;
  // Failure details
  failureKind: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  correlationId: string | null;
  _count: { errors: number };
  errors: RunError[];
}

interface RunsTableProps {
  runs: Run[];
  feedId: string;
}

const statusConfig = {
  RUNNING: { label: 'Running', color: 'text-blue-600 bg-blue-100', icon: Clock },
  SUCCEEDED: { label: 'Success', color: 'text-green-600 bg-green-100', icon: CheckCircle },
  FAILED: { label: 'Failed', color: 'text-red-600 bg-red-100', icon: XCircle },
  SKIPPED: { label: 'Skipped', color: 'text-gray-600 bg-gray-100', icon: AlertTriangle },
};

const triggerLabels: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  MANUAL: 'Manual',
  MANUAL_PENDING: 'Manual (Pending)',
  ADMIN_TEST: 'Admin Test',
  RETRY: 'Retry',
};

export function RunsTable({ runs, feedId }: RunsTableProps) {
  const router = useRouter();
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const handleDownloadReport = async (runId: string) => {
    setIsDownloading(runId);
    try {
      const result = await generateRunReport(runId);
      if (!result.success || !result.report) {
        alert(result.error || 'Failed to generate report');
        return;
      }

      // Create and download the JSON file
      const blob = new Blob([JSON.stringify(result.report, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `run-report-${runId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('An unexpected error occurred');
    } finally {
      setIsDownloading(null);
    }
  };

  const handleApprove = async (runId: string) => {
    if (!confirm('Approve this run and promote products? This will update lastSeenSuccessAt for all products seen in this run.')) {
      return;
    }
    setIsApproving(runId);
    try {
      const result = await approveActivation(runId);
      if (!result.success) {
        alert(result.error || 'Failed to approve');
      } else {
        alert(result.message);
      }
      router.refresh();
    } catch {
      alert('An unexpected error occurred');
    } finally {
      setIsApproving(null);
    }
  };

  if (runs.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-gray-500">
        No runs yet. Enable the feed to start processing.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="w-8 px-3 py-3"></th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Started
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Trigger
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Duration
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rows
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Products
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Errors
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {runs.map((run) => {
            const status = statusConfig[run.status as keyof typeof statusConfig] || statusConfig.FAILED;
            const StatusIcon = status.icon;
            const isExpanded = expandedRun === run.id;

            return (
              <Fragment key={run.id}>
                <tr className={run.status === 'FAILED' ? 'bg-red-50' : ''}>
                  <td className="px-3 py-4">
                    <button
                      onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                      className="p-1 rounded hover:bg-gray-100"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                    {new Date(run.startedAt).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.color}`}>
                      <StatusIcon className="h-3 w-3" />
                      {status.label}
                    </span>
                    {run.skippedReason && (
                      <span className="ml-1 text-xs text-gray-500">
                        ({run.skippedReason})
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {triggerLabels[run.trigger] || run.trigger}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {run.durationMs ? `${(run.durationMs / 1000).toFixed(1)}s` : '—'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {run.rowsParsed !== null ? run.rowsParsed.toLocaleString() : '—'}
                    {run.rowsRead !== null && run.rowsRead !== run.rowsParsed && (
                      <span className="text-gray-400"> / {run.rowsRead.toLocaleString()}</span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                    {run.productsUpserted !== null ? run.productsUpserted.toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    {run._count.errors > 0 ? (
                      <span className="text-sm text-red-600 font-medium">
                        {run._count.errors}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {/* Download Report button - always shown */}
                      <button
                        onClick={() => handleDownloadReport(run.id)}
                        disabled={isDownloading === run.id}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                        title="Download full run report (JSON)"
                      >
                        <Download className="h-3 w-3" />
                        {isDownloading === run.id ? '...' : 'Report'}
                      </button>

                      {/* Approve button - only for expiry blocked runs */}
                      {run.expiryBlocked && !run.expiryApprovedAt && (
                        <button
                          onClick={() => handleApprove(run.id)}
                          disabled={isApproving === run.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-50"
                        >
                          <ThumbsUp className="h-3 w-3" />
                          Approve
                        </button>
                      )}
                      {run.expiryApprovedAt && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3" />
                          Approved
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${run.id}-details`}>
                    <td colSpan={9} className="px-6 py-4 bg-gray-50">
                      {/* Run Metrics */}
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm">
                        <div>
                          <dt className="font-medium text-gray-500">Run ID</dt>
                          <dd className="mt-1 font-mono text-xs text-gray-700">{run.id}</dd>
                        </div>
                        <div>
                          <dt className="font-medium text-gray-500">Finished At</dt>
                          <dd className="mt-1 text-gray-700">
                            {run.finishedAt ? new Date(run.finishedAt).toLocaleString() : '—'}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-medium text-gray-500">Prices Written</dt>
                          <dd className="mt-1 text-gray-700">
                            {run.pricesWritten?.toLocaleString() ?? '0'}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-medium text-gray-500">Products Promoted</dt>
                          <dd className="mt-1 text-gray-700">
                            {run.productsPromoted?.toLocaleString() ?? '0'}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-medium text-gray-500">Products Rejected</dt>
                          <dd className={`mt-1 ${(run.productsRejected ?? 0) > 0 ? 'text-amber-600 font-medium' : 'text-gray-700'}`}>
                            {run.productsRejected?.toLocaleString() ?? '0'}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-medium text-gray-500">Error Count</dt>
                          <dd className={`mt-1 ${(run.errorCount ?? 0) > 0 ? 'text-red-600 font-medium' : 'text-gray-700'}`}>
                            {run.errorCount ?? '0'}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-medium text-gray-500">Duplicate Keys</dt>
                          <dd className="mt-1 text-gray-700">
                            {run.duplicateKeyCount?.toLocaleString() ?? '0'}
                          </dd>
                        </div>
                        <div>
                          <dt className="font-medium text-gray-500">URL Hash Fallback</dt>
                          <dd className={`mt-1 ${(run.urlHashFallbackCount ?? 0) > 0 ? 'text-amber-600' : 'text-gray-700'}`}>
                            {run.urlHashFallbackCount?.toLocaleString() ?? '0'}
                          </dd>
                        </div>
                        {run.expiryBlocked && (
                          <>
                            <div>
                              <dt className="font-medium text-gray-500">Expiry Blocked</dt>
                              <dd className="mt-1 text-amber-700">{run.expiryBlockedReason}</dd>
                            </div>
                            {run.expiryApprovedAt && (
                              <div>
                                <dt className="font-medium text-gray-500">Approved By</dt>
                                <dd className="mt-1 text-gray-700">{run.expiryApprovedBy}</dd>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Parse/Processing Errors */}
                      {run.errors.length > 0 && (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                          <h4 className="text-sm font-medium text-amber-800 mb-2">
                            Parse/Processing Errors ({run._count.errors} total{run._count.errors > 10 ? ', showing first 10' : ''})
                          </h4>
                          <div className="space-y-2 max-h-64 overflow-y-auto">
                            {run.errors.map((error) => (
                              <div key={error.id} className="text-sm bg-white p-2 rounded border border-amber-100">
                                <div className="flex items-start gap-2">
                                  <span className="font-mono text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                                    {error.code}
                                  </span>
                                  {error.rowNumber !== null && (
                                    <span className="text-xs text-gray-500">Row {error.rowNumber}</span>
                                  )}
                                </div>
                                <p className="mt-1 text-gray-700">{error.message}</p>
                                {error.sample != null && (
                                  <details className="mt-1">
                                    <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                                      Show sample data
                                    </summary>
                                    <pre className="mt-1 text-xs bg-gray-100 p-2 rounded overflow-x-auto max-h-32">
                                      {JSON.stringify(error.sample, null, 2)}
                                    </pre>
                                  </details>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Failure details for failed runs */}
                      {run.status === 'FAILED' && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                          <h4 className="text-sm font-medium text-red-800 mb-2">Failure Details</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            {run.correlationId && (
                              <div className="md:col-span-2">
                                <dt className="font-medium text-red-700">Correlation ID</dt>
                                <dd className="mt-1 flex items-center gap-2">
                                  <code className="font-mono text-xs bg-red-100 px-2 py-1 rounded text-red-800 select-all">
                                    {run.correlationId}
                                  </code>
                                  <button
                                    onClick={() => navigator.clipboard.writeText(run.correlationId!)}
                                    className="text-xs text-red-600 hover:text-red-800 underline"
                                  >
                                    Copy
                                  </button>
                                </dd>
                              </div>
                            )}
                            {run.failureCode && (
                              <div>
                                <dt className="font-medium text-red-700">Error Code</dt>
                                <dd className="mt-1 font-mono text-xs text-red-800">{run.failureCode}</dd>
                              </div>
                            )}
                            {run.failureKind && (
                              <div>
                                <dt className="font-medium text-red-700">Failure Type</dt>
                                <dd className="mt-1 text-red-800">{run.failureKind}</dd>
                              </div>
                            )}
                          </div>
                          {run.failureMessage && (
                            <div className="mt-2">
                              <dt className="font-medium text-red-700">Error Message</dt>
                              <dd className="mt-1 text-sm text-red-800 font-mono bg-red-100 p-2 rounded overflow-x-auto">
                                {run.failureMessage}
                              </dd>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
