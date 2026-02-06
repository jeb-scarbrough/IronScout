'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { updateSource, type SourceType } from '../actions';

const SOURCE_TYPES: { value: SourceType; label: string; description: string }[] = [
  { value: 'HTML', label: 'HTML', description: 'Standard HTML page' },
  { value: 'JS_RENDERED', label: 'JS Rendered', description: 'JavaScript-rendered page' },
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

interface Source {
  id: string;
  name: string;
  url: string;
  type: string;
  retailerId: string;
  enabled: boolean;
  interval: number;
  scrapeEnabled: boolean;
  adapterId: string | null;
  scrapeConfig: unknown;
}

interface Retailer {
  id: string;
  name: string;
}

interface EditSourceFormProps {
  source: Source;
  retailers: Retailer[];
}

export function EditSourceForm({ source, retailers }: EditSourceFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScraperConfig, setShowScraperConfig] = useState(
    source.scrapeEnabled || !!source.adapterId || !!source.scrapeConfig
  );

  const [formData, setFormData] = useState({
    name: source.name,
    url: source.url,
    type: source.type as SourceType,
    retailerId: source.retailerId,
    enabled: source.enabled,
    interval: source.interval,
    scrapeEnabled: source.scrapeEnabled,
    adapterId: source.adapterId || '',
    scrapeConfig: source.scrapeConfig ? JSON.stringify(source.scrapeConfig, null, 2) : '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

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
      const result = await updateSource(source.id, {
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
        router.push(`/sources/${source.id}`);
        router.refresh();
      } else {
        setError(result.error || 'Failed to update source');
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
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Type *
            </label>
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Retailer *
            </label>
            <select
              value={formData.retailerId}
              onChange={(e) => updateField('retailerId', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              {retailers.map((retailer) => (
                <option key={retailer.id} value={retailer.id}>
                  {retailer.name}
                </option>
              ))}
            </select>
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
          </div>
        </div>
      </div>

      {/* Scraper Configuration */}
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
                <input
                  type="text"
                  value={formData.adapterId}
                  onChange={(e) => updateField('adapterId', e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm font-mono"
                  placeholder="e.g., sgammo, primaryarms"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Scrape Config (JSON)
                </label>
                <textarea
                  value={formData.scrapeConfig}
                  onChange={(e) => updateField('scrapeConfig', e.target.value)}
                  rows={6}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm font-mono"
                  placeholder='{"rateLimit": {"requestsPerMinute": 60}}'
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Link
          href={`/sources/${source.id}`}
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
          Save Changes
        </button>
      </div>
    </form>
  );
}
