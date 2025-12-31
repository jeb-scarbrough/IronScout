'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  LinkIcon,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  Search,
  Loader2,
  X,
  Plus,
  Clock,
} from 'lucide-react';
type MappingConfidence = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';

interface PendingSuggestion {
  id: string;
  status: string;
  suggestedName: string;
  caliber: string;
  createdAt: string;
  rejectionNote?: string | null;
}

interface CanonicalSkuResult {
  id: string;
  name: string;
  caliber: string;
  grain: number;
  packSize: number;
  brand?: string | null;
  upc?: string | null;
}

interface SkuMappingCardProps {
  skuId: string;
  canonicalSku: CanonicalSkuResult | null;
  mappingConfidence: MappingConfidence;
  needsReview: boolean;
  parsedAttributes: {
    caliber: string | null;
    grain: number | null;
    packSize: number | null;
    brand: string | null;
  };
}

const confidenceConfig = {
  HIGH: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100', label: 'High' },
  MEDIUM: { icon: AlertTriangle, color: 'text-yellow-600', bg: 'bg-yellow-100', label: 'Medium' },
  LOW: { icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-100', label: 'Low' },
  NONE: { icon: HelpCircle, color: 'text-gray-400', bg: 'bg-gray-100', label: 'None' },
};

export function SkuMappingCard({
  skuId,
  canonicalSku,
  mappingConfidence,
  needsReview,
  parsedAttributes,
}: SkuMappingCardProps) {
  const router = useRouter();
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CanonicalSkuResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Suggestion state
  const [showSuggestionForm, setShowSuggestionForm] = useState(false);
  const [pendingSuggestion, setPendingSuggestion] = useState<PendingSuggestion | null>(null);
  const [suggestionForm, setSuggestionForm] = useState({
    suggestedName: '',
    caliber: parsedAttributes.caliber || '',
    grain: parsedAttributes.grain?.toString() || '',
    packSize: parsedAttributes.packSize?.toString() || '',
    brand: parsedAttributes.brand || '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);

  const confidence = confidenceConfig[mappingConfidence];
  const ConfidenceIcon = confidence.icon;

  // Check for existing pending suggestion
  useEffect(() => {
    const checkSuggestion = async () => {
      try {
        const res = await fetch(`/api/skus/${skuId}/suggest`);
        if (res.ok) {
          const data = await res.json();
          setPendingSuggestion(data.suggestion);
        }
      } catch {
        // Silent fail
      }
    };
    if (!canonicalSku) {
      checkSuggestion();
    }
  }, [skuId, canonicalSku]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch(`/api/skus/search-canonical?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch {
      // Silent fail
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectMapping = async (canonicalSkuId: string) => {
    setIsApproving(true);
    try {
      const res = await fetch(`/api/skus/${skuId}/map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canonicalSkuId }),
      });

      if (res.ok) {
        router.refresh();
        setIsSearching(false);
        setSearchResults([]);
        setSearchQuery('');
      } else {
        alert('Failed to update mapping');
      }
    } catch {
      alert('An error occurred');
    } finally {
      setIsApproving(false);
    }
  };

  const handleApproveMapping = async () => {
    if (!canonicalSku) return;

    setIsApproving(true);
    try {
      const res = await fetch(`/api/skus/${skuId}/approve`, {
        method: 'POST',
      });

      if (res.ok) {
        router.refresh();
      } else {
        alert('Failed to approve mapping');
      }
    } catch {
      alert('An error occurred');
    } finally {
      setIsApproving(false);
    }
  };

  const handleClearMapping = async () => {
    if (!confirm('Remove the current mapping? The SKU will be marked as unmapped.')) return;

    setIsApproving(true);
    try {
      const res = await fetch(`/api/skus/${skuId}/map`, {
        method: 'DELETE',
      });

      if (res.ok) {
        router.refresh();
      } else {
        alert('Failed to clear mapping');
      }
    } catch {
      alert('An error occurred');
    } finally {
      setIsApproving(false);
    }
  };

  const handleSubmitSuggestion = async () => {
    if (!suggestionForm.suggestedName.trim() || !suggestionForm.caliber.trim()) {
      setSuggestionError('Product name and caliber are required');
      return;
    }

    setIsSubmitting(true);
    setSuggestionError(null);
    try {
      const res = await fetch(`/api/skus/${skuId}/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestedName: suggestionForm.suggestedName,
          caliber: suggestionForm.caliber,
          grain: suggestionForm.grain ? parseInt(suggestionForm.grain) : undefined,
          packSize: suggestionForm.packSize ? parseInt(suggestionForm.packSize) : undefined,
          brand: suggestionForm.brand || undefined,
        }),
      });

      if (res.ok) {
        setShowSuggestionForm(false);
        setIsSearching(false);
        // Refresh to show pending status
        const data = await res.json();
        setPendingSuggestion({
          id: data.suggestionId,
          status: 'PENDING',
          suggestedName: suggestionForm.suggestedName,
          caliber: suggestionForm.caliber,
          createdAt: new Date().toISOString(),
        });
        router.refresh();
      } else {
        const data = await res.json();
        setSuggestionError(data.error || 'Failed to submit suggestion');
      }
    } catch {
      setSuggestionError('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
          <LinkIcon className="h-5 w-5 text-gray-400" />
          Product Mapping
        </h2>
      </div>

      <div className="px-6 py-4 space-y-4">
        {canonicalSku ? (
          <>
            {/* Current Mapping */}
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900">{canonicalSku.name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    {canonicalSku.caliber} · {canonicalSku.grain}gr · {canonicalSku.packSize}rd
                  </p>
                  {canonicalSku.brand && (
                    <p className="text-sm text-gray-500">{canonicalSku.brand}</p>
                  )}
                  {canonicalSku.upc && (
                    <p className="text-xs text-gray-400 font-mono mt-1">UPC: {canonicalSku.upc}</p>
                  )}
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${confidence.bg} ${confidence.color}`}>
                  <ConfidenceIcon className="h-3 w-3" />
                  {confidence.label}
                </span>
              </div>
            </div>

            {/* Review Actions */}
            {needsReview && (
              <div className="flex gap-2">
                <button
                  onClick={handleApproveMapping}
                  disabled={isApproving}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                  Approve Mapping
                </button>
                <button
                  onClick={() => setIsSearching(true)}
                  disabled={isApproving}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                >
                  <Search className="h-4 w-4" />
                  Change Mapping
                </button>
              </div>
            )}

            {!needsReview && (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsSearching(true)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  <Search className="h-4 w-4" />
                  Change Mapping
                </button>
                <button
                  onClick={handleClearMapping}
                  disabled={isApproving}
                  className="inline-flex items-center justify-center gap-2 rounded-md bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  <X className="h-4 w-4" />
                  Clear
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            {/* Pending Suggestion Notice */}
            {pendingSuggestion?.status === 'PENDING' && (
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-start gap-3">
                  <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900">Suggestion Pending Review</p>
                    <p className="text-sm text-blue-700 mt-1">
                      "{pendingSuggestion.suggestedName}" is awaiting admin approval.
                    </p>
                    <p className="text-xs text-blue-500 mt-1">
                      Submitted {new Date(pendingSuggestion.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Rejected Suggestion Notice */}
            {pendingSuggestion?.status === 'REJECTED' && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-start gap-3">
                  <X className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-900">Suggestion Rejected</p>
                    <p className="text-sm text-red-700 mt-1">
                      "{pendingSuggestion.suggestedName}" was not approved.
                    </p>
                    {pendingSuggestion.rejectionNote && (
                      <p className="text-xs text-red-600 mt-1">
                        Reason: {pendingSuggestion.rejectionNote}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Not Mapped */}
            {!pendingSuggestion || pendingSuggestion.status === 'REJECTED' ? (
              <>
                <div className="text-center py-4">
                  <HelpCircle className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm text-gray-500">
                    This product is not mapped to a canonical SKU
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Map it to enable market comparison and insights
                  </p>
                </div>

                <button
                  onClick={() => setIsSearching(true)}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <Search className="h-4 w-4" />
                  Find Matching Product
                </button>
              </>
            ) : null}
          </>
        )}

        {/* Search Modal */}
        {isSearching && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            <div
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => !isLoading && setIsSearching(false)}
            />
            <div className="flex min-h-full items-center justify-center p-4">
              <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Search Canonical Products</h3>
                </div>

                <div className="px-6 py-4 space-y-4">
                  {/* Search Suggestions */}
                  {parsedAttributes.caliber && (
                    <div className="text-xs text-gray-500">
                      Suggested search: {parsedAttributes.caliber}
                      {parsedAttributes.grain && ` ${parsedAttributes.grain}gr`}
                      {parsedAttributes.brand && ` ${parsedAttributes.brand}`}
                    </div>
                  )}

                  {/* Search Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Search by name, caliber, brand..."
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                    <button
                      onClick={handleSearch}
                      disabled={isLoading}
                      className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      Search
                    </button>
                  </div>

                  {/* Results */}
                  {searchResults.length > 0 && (
                    <div className="max-h-64 overflow-y-auto divide-y divide-gray-200 border border-gray-200 rounded-md">
                      {searchResults.map((result) => (
                        <button
                          key={result.id}
                          onClick={() => handleSelectMapping(result.id)}
                          disabled={isApproving}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 disabled:opacity-50"
                        >
                          <p className="font-medium text-gray-900">{result.name}</p>
                          <p className="text-sm text-gray-500">
                            {result.caliber} · {result.grain}gr · {result.packSize}rd
                            {result.brand && ` · ${result.brand}`}
                          </p>
                          {result.upc && (
                            <p className="text-xs text-gray-400 font-mono">UPC: {result.upc}</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* No results - show suggestion option */}
                  {searchQuery && searchResults.length === 0 && !isLoading && !showSuggestionForm && (
                    <div className="text-center py-4 space-y-3">
                      <p className="text-sm text-gray-500">
                        No matching products found
                      </p>
                      <button
                        onClick={() => {
                          setShowSuggestionForm(true);
                          setSuggestionForm(prev => ({
                            ...prev,
                            suggestedName: searchQuery,
                          }));
                        }}
                        className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                      >
                        <Plus className="h-4 w-4" />
                        Suggest as new product
                      </button>
                    </div>
                  )}

                  {/* Suggestion Form */}
                  {showSuggestionForm && (
                    <div className="border border-gray-200 rounded-md p-4 space-y-4">
                      <h4 className="font-medium text-gray-900">Suggest New Product</h4>
                      <p className="text-xs text-gray-500">
                        Submit this product for admin review. Once approved, it will be added to the catalog.
                      </p>

                      {suggestionError && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                          {suggestionError}
                        </div>
                      )}

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Product Name *
                          </label>
                          <input
                            type="text"
                            value={suggestionForm.suggestedName}
                            onChange={(e) => setSuggestionForm(prev => ({ ...prev, suggestedName: e.target.value }))}
                            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., Federal 9mm 115gr FMJ"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Caliber *
                            </label>
                            <input
                              type="text"
                              value={suggestionForm.caliber}
                              onChange={(e) => setSuggestionForm(prev => ({ ...prev, caliber: e.target.value }))}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g., 9mm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Grain Weight
                            </label>
                            <input
                              type="number"
                              value={suggestionForm.grain}
                              onChange={(e) => setSuggestionForm(prev => ({ ...prev, grain: e.target.value }))}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g., 115"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Pack Size
                            </label>
                            <input
                              type="number"
                              value={suggestionForm.packSize}
                              onChange={(e) => setSuggestionForm(prev => ({ ...prev, packSize: e.target.value }))}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g., 50"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Brand
                            </label>
                            <input
                              type="text"
                              value={suggestionForm.brand}
                              onChange={(e) => setSuggestionForm(prev => ({ ...prev, brand: e.target.value }))}
                              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="e.g., Federal"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={handleSubmitSuggestion}
                          disabled={isSubmitting}
                          className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                          Submit Suggestion
                        </button>
                        <button
                          onClick={() => {
                            setShowSuggestionForm(false);
                            setSuggestionError(null);
                          }}
                          disabled={isSubmitting}
                          className="px-3 py-2 rounded-md bg-gray-100 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
                  <button
                    onClick={() => {
                      setIsSearching(false);
                      setSearchResults([]);
                      setSearchQuery('');
                      setShowSuggestionForm(false);
                      setSuggestionError(null);
                    }}
                    className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
