'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, GitMerge, Loader2, Search } from 'lucide-react';
import { approveSuggestion, rejectSuggestion, mergeSuggestion } from './actions';

interface SuggestionActionsProps {
  suggestion: {
    id: string;
    suggestedName: string;
    caliber: string;
    grain: number | null;
    packSize: number | null;
    brand: string | null;
  };
}

interface CanonicalSkuResult {
  id: string;
  name: string;
  caliber: string;
  grain: number;
  packSize: number;
  brand: string;
}

export function SuggestionActions({ suggestion }: SuggestionActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CanonicalSkuResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleApprove = async () => {
    if (!confirm(`Create new product "${suggestion.suggestedName}"?`)) return;

    setIsLoading(true);
    try {
      const result = await approveSuggestion(suggestion.id);
      if (result.success) {
        router.refresh();
      } else {
        alert(result.error || 'Failed to approve');
      }
    } catch {
      alert('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }

    setIsLoading(true);
    try {
      const result = await rejectSuggestion(suggestion.id, rejectionReason);
      if (result.success) {
        setShowRejectModal(false);
        router.refresh();
      } else {
        alert(result.error || 'Failed to reject');
      }
    } catch {
      alert('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(`/api/canonical-skus/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results || []);
      }
    } catch {
      // Silent fail
    } finally {
      setIsSearching(false);
    }
  };

  const handleMerge = async (canonicalSkuId: string) => {
    setIsLoading(true);
    try {
      const result = await mergeSuggestion(suggestion.id, canonicalSkuId);
      if (result.success) {
        setShowMergeModal(false);
        router.refresh();
      } else {
        alert(result.error || 'Failed to merge');
      }
    } catch {
      alert('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 justify-end">
        <button
          onClick={handleApprove}
          disabled={isLoading}
          className="inline-flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
          title="Approve and create new product"
        >
          {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
          Approve
        </button>
        <button
          onClick={() => {
            setShowMergeModal(true);
            setSearchQuery(`${suggestion.caliber} ${suggestion.grain || ''} ${suggestion.brand || ''}`);
          }}
          disabled={isLoading}
          className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          title="Merge with existing product"
        >
          <GitMerge className="h-3 w-3" />
          Merge
        </button>
        <button
          onClick={() => setShowRejectModal(true)}
          disabled={isLoading}
          className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          title="Reject suggestion"
        >
          <XCircle className="h-3 w-3" />
          Reject
        </button>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => !isLoading && setShowRejectModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Reject Suggestion</h3>
              <p className="text-sm text-gray-500 mb-4">
                Rejecting "{suggestion.suggestedName}"
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason for rejection (will be shown to merchant)..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm mb-4 h-24"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowRejectModal(false)}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Merge Modal */}
      {showMergeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => !isLoading && setShowMergeModal(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Merge with Existing Product</h3>
              <p className="text-sm text-gray-500 mb-4">
                Search for an existing product to merge "{suggestion.suggestedName}" with.
              </p>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Search by name, caliber..."
                  className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                  autoFocus
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="max-h-64 overflow-y-auto divide-y divide-gray-200 border border-gray-200 rounded-md mb-4">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleMerge(result.id)}
                      disabled={isLoading}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 disabled:opacity-50"
                    >
                      <p className="font-medium text-gray-900">{result.name}</p>
                      <p className="text-sm text-gray-500">
                        {result.caliber} · {result.grain}gr · {result.packSize}rd · {result.brand}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {searchQuery && searchResults.length === 0 && !isSearching && (
                <p className="text-sm text-gray-500 text-center py-4">
                  No matching products found
                </p>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setShowMergeModal(false);
                    setSearchResults([]);
                    setSearchQuery('');
                  }}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
