'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  EyeOff,
  Calculator,
  Search,
  Loader2,
} from 'lucide-react';
import {
  createCorrection,
  searchScopeEntities,
  CorrectionScopeType,
  CorrectionAction,
} from '../actions';

const scopeTypes: Array<{ value: CorrectionScopeType; label: string; description: string }> = [
  { value: 'FEED_RUN', label: 'Feed Run', description: 'A specific affiliate feed run' },
  { value: 'AFFILIATE', label: 'Affiliate Feed', description: 'All runs from an affiliate feed' },
  { value: 'SOURCE', label: 'Source', description: 'All prices from a source' },
  { value: 'MERCHANT', label: 'Merchant', description: 'All prices from a merchant' },
  { value: 'RETAILER', label: 'Retailer', description: 'All prices from a retailer' },
  { value: 'PRODUCT', label: 'Product', description: 'A specific product across all retailers' },
];

export function CreateCorrectionForm() {
  const router = useRouter();

  // Form state
  const [scopeType, setScopeType] = useState<CorrectionScopeType>('FEED_RUN');
  const [scopeId, setScopeId] = useState('');
  const [scopeName, setScopeName] = useState('');
  const [action, setAction] = useState<CorrectionAction>('IGNORE');
  const [multiplierValue, setMultiplierValue] = useState('1.0');
  const [startTs, setStartTs] = useState('');
  const [endTs, setEndTs] = useState('');
  const [reason, setReason] = useState('');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle scope search
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setScopeName(query);
    setScopeId(''); // Clear selection when typing

    if (query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const result = await searchScopeEntities(scopeType, query);
      if (result.success) {
        setSearchResults(result.results);
        setShowResults(true);
      }
    } catch {
      // Ignore search errors
    } finally {
      setIsSearching(false);
    }
  };

  // Handle selecting a search result
  const handleSelectResult = (id: string, name: string) => {
    setScopeId(id);
    setScopeName(name);
    setSearchQuery(name);
    setShowResults(false);
  };

  // Handle direct ID input
  const handleDirectIdInput = (id: string) => {
    setScopeId(id);
    setScopeName(id);
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await createCorrection({
        scopeType,
        scopeId: scopeId.trim(),
        startTs: new Date(startTs),
        endTs: new Date(endTs),
        action,
        value: action === 'MULTIPLIER' ? parseFloat(multiplierValue) : null,
        reason: reason.trim(),
      });

      if (!result.success) {
        setError(result.error || 'Failed to create correction');
      } else {
        router.push('/corrections');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Set default time range (last 24 hours)
  const setDefaultTimeRange = () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    setStartTs(yesterday.toISOString().slice(0, 16));
    setEndTs(now.toISOString().slice(0, 16));
  };

  // Set time range for last 7 days
  const setLastWeekRange = () => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    setStartTs(weekAgo.toISOString().slice(0, 16));
    setEndTs(now.toISOString().slice(0, 16));
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-6">
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Scope Type Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Scope Type <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {scopeTypes.map((st) => (
            <button
              key={st.value}
              type="button"
              onClick={() => {
                setScopeType(st.value);
                setScopeId('');
                setScopeName('');
                setSearchQuery('');
                setSearchResults([]);
              }}
              className={`p-3 rounded-lg border-2 text-left transition-colors ${
                scopeType === st.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-gray-900">{st.label}</div>
              <div className="text-xs text-gray-500 mt-1">{st.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Scope Entity Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {scopeTypes.find(s => s.value === scopeType)?.label} <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              placeholder={`Search for a ${scopeTypes.find(s => s.value === scopeType)?.label.toLowerCase()}...`}
              className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {isSearching ? (
                <Loader2 className="h-4 w-4 text-gray-400 animate-spin" />
              ) : (
                <Search className="h-4 w-4 text-gray-400" />
              )}
            </div>
          </div>

          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md border border-gray-200 max-h-60 overflow-auto">
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => handleSelectResult(result.id, result.name)}
                  className="w-full px-4 py-2 text-left hover:bg-gray-50 border-b border-gray-100 last:border-0"
                >
                  <div className="text-sm text-gray-900">{result.name}</div>
                  <div className="text-xs text-gray-500 font-mono">{result.id.slice(0, 20)}...</div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Or enter ID directly */}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowResults(false)}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Or enter ID directly
          </button>
          {!showResults && (
            <input
              type="text"
              value={scopeId}
              onChange={(e) => handleDirectIdInput(e.target.value)}
              placeholder="Paste entity ID here..."
              className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            />
          )}
        </div>

        {scopeId && (
          <div className="mt-2 p-2 bg-green-50 rounded-md">
            <div className="text-sm text-green-800">
              <strong>Selected:</strong> {scopeName || scopeId}
            </div>
            <div className="text-xs text-green-600 font-mono">{scopeId}</div>
          </div>
        )}
      </div>

      {/* Time Range */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Time Range <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={setDefaultTimeRange}
            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Last 24 hours
          </button>
          <button
            type="button"
            onClick={setLastWeekRange}
            className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Last 7 days
          </button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start (observedAt &gt;=)</label>
            <input
              type="datetime-local"
              value={startTs}
              onChange={(e) => setStartTs(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End (observedAt &lt;)</label>
            <input
              type="datetime-local"
              value={endTs}
              onChange={(e) => setEndTs(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>
        </div>
      </div>

      {/* Action Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Action <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={() => setAction('IGNORE')}
            className={`p-4 rounded-lg border-2 text-left transition-colors ${
              action === 'IGNORE'
                ? 'border-gray-500 bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <EyeOff className={`h-5 w-5 ${action === 'IGNORE' ? 'text-gray-700' : 'text-gray-400'}`} />
              <span className="font-medium text-gray-900">IGNORE</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Hide matching prices from consumer queries
            </p>
          </button>
          <button
            type="button"
            onClick={() => setAction('MULTIPLIER')}
            className={`p-4 rounded-lg border-2 text-left transition-colors ${
              action === 'MULTIPLIER'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calculator className={`h-5 w-5 ${action === 'MULTIPLIER' ? 'text-blue-700' : 'text-gray-400'}`} />
              <span className="font-medium text-gray-900">MULTIPLIER</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Adjust prices by a factor (e.g., 0.9 = 10% off)
            </p>
          </button>
        </div>

        {/* Multiplier Value */}
        {action === 'MULTIPLIER' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Multiplier Value <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max="10"
              value={multiplierValue}
              onChange={(e) => setMultiplierValue(e.target.value)}
              className="w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="1.0"
            />
            <p className="text-xs text-gray-500 mt-1">
              1.0 = no change, 0.9 = 10% discount, 1.1 = 10% markup
            </p>
          </div>
        )}
      </div>

      {/* Reason */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Reason <span className="text-red-500">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          placeholder="Explain why this correction is needed (e.g., feed data quality issue, incorrect pricing from partner, test data cleanup)"
          required
        />
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={() => router.push('/corrections')}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting || !scopeId || !startTs || !endTs || !reason.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Creating...' : 'Create Correction'}
        </button>
      </div>
    </form>
  );
}
