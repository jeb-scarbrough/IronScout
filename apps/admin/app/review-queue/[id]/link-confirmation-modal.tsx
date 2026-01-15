'use client';

import { useState, useEffect } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle,
  XCircle,
  LinkIcon,
  ArrowRight,
} from 'lucide-react';

interface MatchDetails {
  brandMatch: boolean;
  caliberMatch: boolean;
  packMatch: boolean;
  grainMatch: boolean;
  titleSimilarity: number;
}

interface SourceFields {
  brandNorm?: string | null;
  caliberNorm?: string | null;
  packCount?: number | null;
  grain?: number | null;
  caseMaterial?: string | null;
  muzzleVelocityFps?: number | null;
  bulletType?: string | null;
}

interface CandidateFields {
  productId: string;
  canonicalKey: string;
  name?: string | null;
  brandNorm?: string | null;
  caliberNorm?: string | null;
  packCount?: number | null;
  grain?: number | null;
  caseMaterial?: string | null;
  muzzleVelocityFps?: number | null;
  bulletType?: string | null;
  score: number;
  matchDetails?: MatchDetails;
}

interface LinkConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sourceFields: SourceFields;
  candidate: CandidateFields;
  isSubmitting?: boolean;
}

type FieldDelta = {
  label: string;
  source: string | number | null | undefined;
  candidate: string | number | null | undefined;
  status: 'match' | 'mismatch' | 'missing' | 'na';
};

/**
 * Compare fields and generate deltas
 */
function computeDeltas(
  source: SourceFields,
  candidate: CandidateFields
): FieldDelta[] {
  const fields = [
    { label: 'Brand', source: source.brandNorm, candidate: candidate.brandNorm },
    { label: 'Caliber', source: source.caliberNorm, candidate: candidate.caliberNorm },
    { label: 'Grain', source: source.grain, candidate: candidate.grain },
    { label: 'Pack', source: source.packCount, candidate: candidate.packCount },
    { label: 'Casing', source: source.caseMaterial, candidate: candidate.caseMaterial },
    { label: 'Velocity', source: source.muzzleVelocityFps, candidate: candidate.muzzleVelocityFps },
    { label: 'Bullet', source: source.bulletType, candidate: candidate.bulletType },
  ];

  return fields.map((f) => {
    let status: FieldDelta['status'] = 'na';
    if (!f.source && !f.candidate) {
      status = 'na';
    } else if (f.source && !f.candidate) {
      status = 'missing';
    } else if (!f.source && f.candidate) {
      status = 'na';
    } else if (String(f.source).toLowerCase().trim() === String(f.candidate).toLowerCase().trim()) {
      status = 'match';
    } else {
      status = 'mismatch';
    }
    return { ...f, status };
  });
}

/**
 * Delta display row
 */
function DeltaRow({ delta }: { delta: FieldDelta }) {
  return (
    <tr className="border-b border-gray-100 last:border-b-0">
      <td className="py-2 pr-3 text-sm text-gray-500 font-medium">{delta.label}</td>
      <td className="py-2 px-2 text-sm font-mono">
        {delta.source != null ? (
          <span className={delta.status === 'mismatch' ? 'text-red-700 font-semibold bg-red-50 px-1 rounded' : 'text-gray-900'}>
            {String(delta.source)}
          </span>
        ) : (
          <span className="text-gray-400 italic">—</span>
        )}
      </td>
      <td className="py-2 px-2 text-center text-gray-400">
        <ArrowRight className="h-4 w-4 inline" />
      </td>
      <td className="py-2 px-2 text-sm font-mono">
        {delta.candidate != null ? (
          <span className={delta.status === 'mismatch' ? 'text-red-700 font-semibold bg-red-50 px-1 rounded' : 'text-gray-900'}>
            {String(delta.candidate)}
          </span>
        ) : (
          <span className="text-gray-400 italic">—</span>
        )}
      </td>
      <td className="py-2 pl-2">
        {delta.status === 'match' && <CheckCircle className="h-4 w-4 text-green-600" />}
        {delta.status === 'mismatch' && <XCircle className="h-4 w-4 text-red-600" />}
        {delta.status === 'missing' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
        {delta.status === 'na' && <span className="text-xs text-gray-400">n/a</span>}
      </td>
    </tr>
  );
}

export function LinkConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  sourceFields,
  candidate,
  isSubmitting = false,
}: LinkConfirmationModalProps) {
  const [acknowledged, setAcknowledged] = useState(false);

  // Reset acknowledgment when modal opens/closes or candidate changes
  useEffect(() => {
    setAcknowledged(false);
  }, [isOpen, candidate.productId]);

  // Compute field deltas
  const deltas = computeDeltas(sourceFields, candidate);
  const mismatches = deltas.filter((d) => d.status === 'mismatch');
  const hasMismatches = mismatches.length > 0;

  // Can confirm if no mismatches OR if acknowledged
  const canConfirm = !hasMismatches || acknowledged;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-lg transform rounded-lg bg-white shadow-xl transition-all"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-full ${
                  hasMismatches ? 'bg-amber-100' : 'bg-green-100'
                }`}
              >
                <LinkIcon
                  className={`h-5 w-5 ${
                    hasMismatches ? 'text-amber-600' : 'text-green-600'
                  }`}
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Confirm Product Link
                </h3>
                <p className="text-sm text-gray-500">
                  Score: {(candidate.score * 100).toFixed(0)}%
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isSubmitting}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 space-y-4">
            {/* Target product info */}
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">
                Target Product
              </div>
              <div className="font-semibold text-gray-900">
                {candidate.name || candidate.canonicalKey || candidate.productId}
              </div>
              {candidate.name && candidate.canonicalKey && (
                <div className="text-xs text-gray-500 font-mono mt-0.5">
                  {candidate.canonicalKey}
                </div>
              )}
            </div>

            {/* Field comparison table */}
            <div>
              <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                Field Comparison
              </h4>
              <div className="bg-gray-50 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-100">
                      <th className="py-2 pr-3 text-left text-xs font-medium text-gray-500 pl-3">
                        Field
                      </th>
                      <th className="py-2 px-2 text-left text-xs font-medium text-gray-500">
                        Source
                      </th>
                      <th className="py-2 px-2 text-xs font-medium text-gray-500"></th>
                      <th className="py-2 px-2 text-left text-xs font-medium text-gray-500">
                        Product
                      </th>
                      <th className="py-2 pl-2 pr-3 text-xs font-medium text-gray-500"></th>
                    </tr>
                  </thead>
                  <tbody className="px-3">
                    {deltas.map((delta) => (
                      <DeltaRow key={delta.label} delta={delta} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mismatch warning */}
            {hasMismatches && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-amber-800">
                      {mismatches.length} field{mismatches.length > 1 ? 's' : ''} differ
                    </div>
                    <p className="text-sm text-amber-700 mt-1">
                      The following fields do not match:{' '}
                      <span className="font-medium">
                        {mismatches.map((m) => m.label).join(', ')}
                      </span>
                    </p>
                    <label className="flex items-center gap-2 mt-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={acknowledged}
                        onChange={(e) => setAcknowledged(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-sm text-amber-800">
                        I confirm this link despite the field differences
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* No mismatches confirmation */}
            {!hasMismatches && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-center gap-2 text-green-800">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium">All comparable fields match</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4 bg-gray-50">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={!canConfirm || isSubmitting}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                canConfirm
                  ? hasMismatches
                    ? 'bg-amber-600 hover:bg-amber-700 text-white'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Linking...
                </>
              ) : (
                <>
                  <LinkIcon className="h-4 w-4" />
                  Confirm Link
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
