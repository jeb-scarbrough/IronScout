'use client';

import { useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { runIntegrityChecksAction } from './actions';
import type { DataIntegrityResults, IntegrityCheckResult } from './actions';

function StatusIcon({ status }: { status: 'ok' | 'warning' | 'error' }) {
  switch (status) {
    case 'ok':
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    case 'warning':
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-red-600" />;
  }
}

function statusColor(status: 'ok' | 'warning' | 'error') {
  switch (status) {
    case 'ok':
      return 'bg-green-50 border-green-200';
    case 'warning':
      return 'bg-amber-50 border-amber-200';
    case 'error':
      return 'bg-red-50 border-red-200';
  }
}

function CheckCard({ check }: { check: IntegrityCheckResult }) {
  return (
    <div className={`p-4 border rounded-lg ${statusColor(check.status)}`}>
      <div className="flex items-start gap-3">
        <StatusIcon status={check.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-gray-900">{check.name}</h4>
            {check.count > 0 && (
              <span
                className={`text-sm font-medium ${
                  check.status === 'error'
                    ? 'text-red-700'
                    : check.status === 'warning'
                      ? 'text-amber-700'
                      : 'text-gray-600'
                }`}
              >
                {check.count.toLocaleString()} issue{check.count !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mt-0.5">{check.description}</p>
          <p
            className={`text-sm mt-1 ${
              check.status === 'error'
                ? 'text-red-700'
                : check.status === 'warning'
                  ? 'text-amber-700'
                  : 'text-green-700'
            }`}
          >
            {check.message}
          </p>
        </div>
      </div>
    </div>
  );
}

export function IntegrityChecks() {
  const [results, setResults] = useState<DataIntegrityResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRunChecks = async () => {
    setLoading(true);
    setError(null);

    const response = await runIntegrityChecksAction();

    setLoading(false);

    if (response.success && response.results) {
      setResults(response.results);
    } else {
      setError(response.error ?? 'Failed to run integrity checks');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Data Integrity Checks</h3>
          <p className="text-xs text-gray-500">
            Heavy SQL queries — run manually, not included in dashboard refresh.
          </p>
        </div>
        <button
          onClick={handleRunChecks}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Run Integrity Checks
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 mb-3">
          {error}
        </div>
      )}

      {results && (
        <div className="space-y-3">
          {/* Overall Status */}
          <div className={`p-4 rounded-lg border ${statusColor(results.overallStatus)}`}>
            <div className="flex items-center gap-3">
              <StatusIcon status={results.overallStatus} />
              <div>
                <h4 className="font-medium text-gray-900">
                  {results.overallStatus === 'ok' && 'All Checks Passed'}
                  {results.overallStatus === 'warning' && 'Warnings Detected'}
                  {results.overallStatus === 'error' && 'Issues Detected'}
                </h4>
                <p className="text-sm text-gray-600">
                  {results.checks.length} checks completed —{' '}
                  {results.lastChecked.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          {/* Individual Checks */}
          {results.checks.map((check, index) => (
            <CheckCard key={index} check={check} />
          ))}
        </div>
      )}

      {!results && !loading && (
        <div className="p-8 text-center bg-gray-50 rounded-lg border border-gray-200">
          <RefreshCw className="h-8 w-8 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">
            Click &quot;Run Integrity Checks&quot; to validate data consistency
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Runs 21 checks including provenance, corrections, visibility, and FK integrity
          </p>
        </div>
      )}
    </div>
  );
}
