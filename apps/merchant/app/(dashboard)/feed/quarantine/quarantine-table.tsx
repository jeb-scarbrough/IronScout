'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Correction {
  id: string;
  field: string;
  oldValue: string | null;
  newValue: string;
  createdAt: string | Date;
}

interface QuarantinedRecord {
  id: string;
  matchKey: string;
  rawData: Record<string, unknown> | null;
  parsedFields: Record<string, unknown> | null;
  blockingErrors: Array<{
    field: string;
    code: string;
    message: string;
    rawValue?: unknown;
  }> | null;
  status: 'QUARANTINED' | 'RESOLVED' | 'DISMISSED';
  createdAt: string | Date;
  updatedAt: string | Date;
  corrections: Correction[];
}

interface QuarantineTableProps {
  initialRecords: QuarantinedRecord[];
  initialTotal: number;
  counts: {
    QUARANTINED: number;
    RESOLVED: number;
    DISMISSED: number;
  };
}

export function QuarantineTable({ initialRecords, initialTotal, counts }: QuarantineTableProps) {
  const router = useRouter();
  const [records, setRecords] = useState<QuarantinedRecord[]>(initialRecords);
  const [total, setTotal] = useState(initialTotal);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const handleDismiss = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/feed/quarantine/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DISMISSED' }),
      });

      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
        setTotal((prev) => prev - 1);
      }
    } finally {
      setActionLoading(null);
    }
  };

  const handleReprocess = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/feed/quarantine/${id}/reprocess`, {
        method: 'POST',
      });

      const data = await res.json();

      if (res.ok) {
        setRecords((prev) => prev.filter((r) => r.id !== id));
        setTotal((prev) => prev - 1);
        router.refresh();
      } else {
        alert(data.error || 'Failed to reprocess record');
      }
    } finally {
      setActionLoading(null);
    }
  };

  if (records.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <div className="mx-auto h-12 w-12 text-gray-400">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="mt-4 text-lg font-medium text-gray-900">No Quarantined Records</h3>
        <p className="mt-2 text-gray-600">
          All your feed records have been successfully indexed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">
        Showing {records.length} of {total} quarantined records
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Product
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Blocking Issue
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Corrections
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {records.map((record) => {
              const isExpanded = expandedId === record.id;
              const parsedFields = record.parsedFields || {};
              const title = parsedFields.title as string || 'Unknown Product';
              const blockingErrors = record.blockingErrors || [];
              const primaryError = blockingErrors[0];
              const hasCorrections = record.corrections.length > 0;

              return (
                <>
                  <tr
                    key={record.id}
                    className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? 'bg-gray-50' : ''}`}
                    onClick={() => setExpandedId(isExpanded ? null : record.id)}
                  >
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                        {title}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(record.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                        {primaryError?.code || 'Unknown'}
                      </span>
                      <div className="mt-1 text-xs text-gray-500">
                        {primaryError?.message || 'Unknown error'}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {hasCorrections ? (
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
                          {record.corrections.length} correction{record.corrections.length > 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleReprocess(record.id);
                          }}
                          disabled={actionLoading === record.id}
                          className="inline-flex items-center rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                        >
                          {actionLoading === record.id ? 'Processing...' : 'Reprocess'}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDismiss(record.id);
                          }}
                          disabled={actionLoading === record.id}
                          className="inline-flex items-center rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                        >
                          Dismiss
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${record.id}-expanded`}>
                      <td colSpan={4} className="px-4 py-4 bg-gray-50 border-t">
                        <RecordDetails
                          record={record}
                          onCorrectionAdded={() => router.refresh()}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RecordDetails({
  record,
  onCorrectionAdded,
}: {
  record: QuarantinedRecord;
  onCorrectionAdded?: () => void;
}) {
  const parsedFields = record.parsedFields || {};
  const rawData = record.rawData || {};

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Add Correction Form */}
      <div className="col-span-2">
        <CorrectionForm recordId={record.id} onSuccess={onCorrectionAdded} />
      </div>

      {/* Parsed Fields */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-2">Parsed Fields</h4>
        <div className="bg-white rounded border p-3 space-y-2 text-xs">
          {Object.entries(parsedFields).map(([key, value]) => (
            <div key={key} className="flex justify-between">
              <span className="text-gray-500">{key}:</span>
              <span className="text-gray-900 font-mono truncate max-w-[200px]">
                {String(value ?? 'null')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Blocking Errors */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-2">Blocking Errors</h4>
        <div className="space-y-2">
          {(record.blockingErrors || []).map((error, idx) => (
            <div key={idx} className="bg-red-50 rounded border border-red-100 p-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-red-700">{error.code}</span>
                <span className="text-red-600">on {error.field}</span>
              </div>
              <p className="mt-1 text-red-600">{error.message}</p>
              {error.rawValue !== undefined && (
                <p className="mt-1 text-red-500 font-mono">
                  Raw: {JSON.stringify(error.rawValue)}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Corrections */}
      {record.corrections.length > 0 && (
        <div className="col-span-2">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Applied Corrections</h4>
          <div className="bg-blue-50 rounded border border-blue-100 p-3">
            <div className="space-y-2 text-xs">
              {record.corrections.map((correction) => (
                <div key={correction.id} className="flex items-center gap-2">
                  <span className="font-medium text-blue-700">{correction.field}:</span>
                  <span className="text-gray-500 line-through">{correction.oldValue || 'null'}</span>
                  <span className="text-gray-400">&rarr;</span>
                  <span className="text-blue-600 font-mono">{correction.newValue}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Raw Data Preview */}
      <div className="col-span-2">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Raw Feed Data</h4>
        <pre className="bg-gray-900 text-gray-100 rounded p-3 text-xs overflow-x-auto">
          {JSON.stringify(rawData, null, 2)}
        </pre>
      </div>
    </div>
  );
}

function CorrectionForm({
  recordId,
  onSuccess,
}: {
  recordId: string;
  onSuccess?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [field, setField] = useState('upc');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) {
      setError('Value is required');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/feed/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quarantinedRecordId: recordId,
          field,
          newValue: value.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to add correction');
        return;
      }

      setValue('');
      setIsOpen(false);
      onSuccess?.();
    } catch {
      setError('Failed to add correction');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Add Correction
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-blue-50 rounded border border-blue-200 p-4">
      <h4 className="text-sm font-medium text-blue-900 mb-3">Add Correction</h4>

      {error && (
        <div className="mb-3 text-sm text-red-600">{error}</div>
      )}

      <div className="flex gap-3">
        <div className="flex-shrink-0">
          <label className="block text-xs text-blue-700 mb-1">Field</label>
          <select
            value={field}
            onChange={(e) => setField(e.target.value)}
            className="rounded border border-blue-300 px-2 py-1.5 text-sm"
          >
            <option value="upc">UPC</option>
            <option value="sku">SKU</option>
            <option value="title">Title</option>
            <option value="brand">Brand</option>
            <option value="caliber">Caliber</option>
            <option value="price">Price</option>
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-xs text-blue-700 mb-1">New Value</label>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={field === 'upc' ? '012345678901' : `Enter ${field}`}
            className="w-full rounded border border-blue-300 px-2 py-1.5 text-sm"
          />
        </div>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={isLoading}
            className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Adding...' : 'Add'}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="rounded border border-blue-300 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
