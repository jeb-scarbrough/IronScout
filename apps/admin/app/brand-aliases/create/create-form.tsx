'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createAlias, previewNormalization, type AliasSourceType } from '../actions';
import { Loader2, ArrowRight, AlertCircle } from 'lucide-react';

const sourceTypeOptions: { value: AliasSourceType; label: string; description: string }[] = [
  { value: 'AFFILIATE_FEED', label: 'Affiliate Feed', description: 'Discovered in affiliate feed data' },
  { value: 'RETAILER_FEED', label: 'Retailer Feed', description: 'Discovered in retailer feed data' },
  { value: 'MANUAL', label: 'Manual', description: 'Manually identified by admin' },
];

export function CreateAliasForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [aliasName, setAliasName] = useState('');
  const [canonicalName, setCanonicalName] = useState('');
  const [sourceType, setSourceType] = useState<AliasSourceType>('MANUAL');
  const [sourceRef, setSourceRef] = useState('');
  const [notes, setNotes] = useState('');

  // Preview state
  const [aliasPreview, setAliasPreview] = useState<string | null>(null);
  const [canonicalPreview, setCanonicalPreview] = useState<string | null>(null);

  // Preview normalization when input changes
  const handleAliasBlur = async () => {
    if (aliasName.trim()) {
      const result = await previewNormalization(aliasName);
      if (result.success) {
        setAliasPreview(result.normalized ?? null);
      }
    }
  };

  const handleCanonicalBlur = async () => {
    if (canonicalName.trim()) {
      const result = await previewNormalization(canonicalName);
      if (result.success) {
        setCanonicalPreview(result.normalized ?? null);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createAlias({
        aliasName: aliasName.trim(),
        canonicalName: canonicalName.trim(),
        sourceType,
        sourceRef: sourceRef.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      if (result.success) {
        router.push('/brand-aliases');
      } else {
        setError(result.error ?? 'Failed to create alias');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Alias Name */}
      <div>
        <label htmlFor="aliasName" className="block text-sm font-medium text-gray-700">
          Alias Name <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500 mt-0.5 mb-1">
          The variant brand name to map (e.g., "Federal Ammunition", "CCI Ammunition")
        </p>
        <input
          type="text"
          id="aliasName"
          value={aliasName}
          onChange={(e) => setAliasName(e.target.value)}
          onBlur={handleAliasBlur}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Enter brand variant..."
          required
        />
        {aliasPreview && (
          <p className="mt-1 text-xs text-gray-500">
            Normalized: <span className="font-mono bg-gray-100 px-1 rounded">{aliasPreview}</span>
          </p>
        )}
      </div>

      {/* Arrow indicator */}
      <div className="flex justify-center">
        <ArrowRight className="h-6 w-6 text-gray-400" />
      </div>

      {/* Canonical Name */}
      <div>
        <label htmlFor="canonicalName" className="block text-sm font-medium text-gray-700">
          Canonical Name <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500 mt-0.5 mb-1">
          The standard brand name to map to (e.g., "Federal Premium", "CCI")
        </p>
        <input
          type="text"
          id="canonicalName"
          value={canonicalName}
          onChange={(e) => setCanonicalName(e.target.value)}
          onBlur={handleCanonicalBlur}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Enter canonical brand..."
          required
        />
        {canonicalPreview && (
          <p className="mt-1 text-xs text-gray-500">
            Normalized: <span className="font-mono bg-gray-100 px-1 rounded">{canonicalPreview}</span>
          </p>
        )}
      </div>

      {/* Preview Mapping */}
      {aliasPreview && canonicalPreview && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Mapping Preview</p>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-mono bg-white px-2 py-1 rounded border">{aliasPreview}</span>
            <ArrowRight className="h-4 w-4 text-gray-400" />
            <span className="font-mono bg-white px-2 py-1 rounded border">{canonicalPreview}</span>
          </div>
          {aliasPreview === canonicalPreview && (
            <p className="mt-2 text-xs text-orange-600">
              Warning: Alias and canonical normalize to the same value. This alias will have no effect.
            </p>
          )}
        </div>
      )}

      {/* Source Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Source Type <span className="text-red-500">*</span>
        </label>
        <div className="space-y-2">
          {sourceTypeOptions.map((option) => (
            <label
              key={option.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                sourceType === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name="sourceType"
                value={option.value}
                checked={sourceType === option.value}
                onChange={(e) => setSourceType(e.target.value as AliasSourceType)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">{option.label}</p>
                <p className="text-xs text-gray-500">{option.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Source Reference */}
      <div>
        <label htmlFor="sourceRef" className="block text-sm font-medium text-gray-700">
          Source Reference
        </label>
        <p className="text-xs text-gray-500 mt-0.5 mb-1">
          Feed name, partner ID, or other reference (optional)
        </p>
        <input
          type="text"
          id="sourceRef"
          value={sourceRef}
          onChange={(e) => setSourceRef(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="e.g., impact-lucky-gunner, retailer-feed-abc"
        />
      </div>

      {/* Notes */}
      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
          Notes
        </label>
        <p className="text-xs text-gray-500 mt-0.5 mb-1">
          Additional context or reasoning (optional)
        </p>
        <textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          placeholder="Why is this alias needed? Any special considerations?"
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          disabled={isPending}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || !aliasName.trim() || !canonicalName.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Create Alias (as Draft)
        </button>
      </div>
    </form>
  );
}
