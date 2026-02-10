'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { createSource, detectSourceType, getRetailersForSelect, type SourceType } from '../actions';
import { KNOWN_ADAPTERS } from '@ironscout/scraper-registry';

const SOURCE_TYPES: { value: SourceType; label: string; description: string }[] = [
  { value: 'HTML', label: 'HTML', description: 'Standard HTML page' },
  { value: 'JS_RENDERED', label: 'JS Rendered', description: 'JavaScript-rendered page (requires headless browser)' },
  { value: 'RSS', label: 'RSS', description: 'RSS or Atom feed' },
  { value: 'JSON', label: 'JSON', description: 'JSON API endpoint' },
  { value: 'FEED_CSV', label: 'Feed CSV', description: 'CSV product feed' },
  { value: 'FEED_XML', label: 'Feed XML', description: 'XML product feed' },
  { value: 'FEED_JSON', label: 'Feed JSON', description: 'JSON product feed' },
];

const INTERVAL_PRESETS = [
  { value: 3600, label: '1 hour' },
  { value: 21600, label: '6 hours' },
  { value: 43200, label: '12 hours' },
  { value: 86400, label: '24 hours' },
];

interface Retailer {
  id: string;
  name: string;
  website: string | null;
}

export function CreateSourceForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [loadingRetailers, setLoadingRetailers] = useState(true);
  const [showScraperConfig, setShowScraperConfig] = useState(false);
  const [isDetectingType, setIsDetectingType] = useState(false);
  const [detectMessage, setDetectMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    url: '',
    type: 'HTML' as SourceType,
    retailerId: '',
    enabled: true,
    interval: 3600,
    // Scraper config
    scrapeEnabled: false,
    adapterId: '',
    scrapeConfig: '',
  });

  // Load retailers on mount
  useEffect(() => {
    async function loadRetailers() {
      try {
        const result = await getRetailersForSelect();
        if (result.success && result.retailers) {
          setRetailers(result.retailers);
        }
      } catch (err) {
        console.error('Failed to load retailers:', err);
      } finally {
        setLoadingRetailers(false);
      }
    }
    loadRetailers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    if (!formData.retailerId) {
      setError('Please select a retailer');
      setIsSubmitting(false);
      return;
    }

    // Parse scrapeConfig JSON if provided
    let scrapeConfig: Record<string, unknown> | undefined;
    if (formData.scrapeConfig.trim()) {
      try {
        scrapeConfig = JSON.parse(formData.scrapeConfig);
      } catch {
        setError('Invalid JSON in scrape config');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      const result = await createSource({
        name: formData.name,
        url: formData.url,
        type: formData.type,
        retailerId: formData.retailerId,
        enabled: formData.enabled,
        interval: formData.interval,
        scrapeEnabled: formData.scrapeEnabled,
        adapterId: formData.adapterId || undefined,
        scrapeConfig,
      });

      if (result.success) {
        router.push('/sources');
      } else {
        setError(result.error || 'Failed to create source');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = (field: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDetectType = async () => {
    if (!formData.url.trim()) {
      setDetectMessage('Enter a URL to detect type.');
      return;
    }

    setIsDetectingType(true);
    setDetectMessage(null);

    try {
      const result = await detectSourceType(formData.url);
      if (!result.success || !result.type) {
        setDetectMessage(result.error || 'Unable to detect type.');
        return;
      }

      updateField('type', result.type);

      const confidence = result.confidence ? `${result.confidence} confidence` : 'confidence unknown';
      const method = result.method ? ` via ${result.method.toUpperCase()}` : '';
      setDetectMessage(`Detected ${result.type} (${confidence}${method}).`);
    } catch {
      setDetectMessage('Failed to detect type. Try again.');
    } finally {
      setIsDetectingType(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Basic Information */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Source Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="e.g., SGAmmo Main Feed"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              URL *
            </label>
            <input
              type="url"
              required
              value={formData.url}
              onChange={(e) => updateField('url', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="https://example.com/products"
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Type *
              </label>
              <button
                type="button"
                onClick={handleDetectType}
                disabled={isDetectingType}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
              >
                {isDetectingType ? 'Detecting...' : 'Detect type'}
              </button>
            </div>
            <select
              value={formData.type}
              onChange={(e) => updateField('type', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              {SOURCE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label} - {type.description}
                </option>
              ))}
            </select>
            {detectMessage && (
              <p className="mt-1 text-xs text-gray-500">{detectMessage}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Retailer *
            </label>
            {loadingRetailers ? (
              <div className="mt-1 flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading retailers...
              </div>
            ) : (
              <select
                value={formData.retailerId}
                onChange={(e) => updateField('retailerId', e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="">Select a retailer...</option>
                {retailers.map((retailer) => (
                  <option key={retailer.id} value={retailer.id}>
                    {retailer.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Schedule */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Schedule</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => updateField('enabled', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">Enabled</span>
            </label>
            <p className="mt-1 text-xs text-gray-500">
              Disabled sources won't be processed by the harvester
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Interval
            </label>
            <div className="mt-1 flex gap-2">
              {INTERVAL_PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => updateField('interval', preset.value)}
                  className={`px-3 py-1.5 text-sm rounded-md border ${
                    formData.interval === preset.value
                      ? 'bg-blue-50 border-blue-500 text-blue-700'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              How often this source should be processed
            </p>
          </div>
        </div>
      </div>

      {/* Scraper Configuration (Collapsible) */}
      <div className="bg-white shadow rounded-lg">
        <button
          type="button"
          onClick={() => setShowScraperConfig(!showScraperConfig)}
          className="w-full px-6 py-4 flex items-center justify-between text-left"
        >
          <h2 className="text-lg font-medium text-gray-900">Scraper Configuration</h2>
          {showScraperConfig ? (
            <ChevronUp className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {showScraperConfig && (
          <div className="px-6 pb-6 border-t border-gray-200 pt-4">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.scrapeEnabled}
                    onChange={(e) => updateField('scrapeEnabled', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Enable Scraping</span>
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  Master gate for scraping. Must be enabled for any scraping to occur.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Adapter ID
                </label>
                <select
                  value={formData.adapterId}
                  onChange={(e) => updateField('adapterId', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">None</option>
                  {KNOWN_ADAPTERS.map((adapter) => (
                    <option key={adapter.id} value={adapter.id}>
                      {adapter.id} — {adapter.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Which scraper adapter to use for this source
                </p>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Scrape Config (JSON)
                </label>
                <textarea
                  value={formData.scrapeConfig}
                  onChange={(e) => updateField('scrapeConfig', e.target.value)}
                  rows={4}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm font-mono"
                  placeholder='{"rateLimit": {"requestsPerMinute": 60}, "customHeaders": {}}'
                />
                <p className="mt-1 text-xs text-gray-500">
                  Optional JSON configuration for rate limits, headers, and other scraper options
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Link
          href="/sources"
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Create Source
        </button>
      </div>
    </form>
  );
}
