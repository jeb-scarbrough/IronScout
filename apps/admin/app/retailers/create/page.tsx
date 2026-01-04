'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Store } from 'lucide-react';
import { createRetailer } from '../actions';

export default function CreateRetailerPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    website: '',
    logoUrl: '',
    tier: 'STANDARD' as 'STANDARD' | 'PREMIUM',
    visibilityStatus: 'ELIGIBLE' as 'ELIGIBLE' | 'INELIGIBLE' | 'SUSPENDED',
    visibilityReason: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createRetailer({
        name: formData.name,
        website: formData.website,
        logoUrl: formData.logoUrl || undefined,
        tier: formData.tier,
        visibilityStatus: formData.visibilityStatus,
        visibilityReason: formData.visibilityStatus !== 'ELIGIBLE' ? formData.visibilityReason : undefined,
      });

      if (result.success && result.data) {
        router.push(`/retailers/${result.data.id}`);
      } else {
        setError(result.error || 'Failed to create retailer');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/retailers"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Retailers
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
          <Store className="h-6 w-6 text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add New Retailer</h1>
          <p className="text-sm text-gray-500">Create a new retailer in the system</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white shadow rounded-lg p-6 max-w-2xl">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border px-3 py-2"
              placeholder="e.g., Bass Pro Shops"
              required
            />
          </div>

          {/* Website */}
          <div>
            <label htmlFor="website" className="block text-sm font-medium text-gray-700">
              Website <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="website"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border px-3 py-2"
              placeholder="https://www.example.com"
              required
            />
            <p className="mt-1 text-xs text-gray-500">Must be unique. Will be normalized to https://</p>
          </div>

          {/* Logo URL */}
          <div>
            <label htmlFor="logoUrl" className="block text-sm font-medium text-gray-700">
              Logo URL
            </label>
            <input
              type="url"
              id="logoUrl"
              value={formData.logoUrl}
              onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border px-3 py-2"
              placeholder="https://example.com/logo.png"
            />
            <p className="mt-1 text-xs text-gray-500">Optional. Direct URL to the retailer's logo image.</p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Tier */}
            <div>
              <label htmlFor="tier" className="block text-sm font-medium text-gray-700">
                Tier
              </label>
              <select
                id="tier"
                value={formData.tier}
                onChange={(e) => setFormData({ ...formData, tier: e.target.value as 'STANDARD' | 'PREMIUM' })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border px-3 py-2"
              >
                <option value="STANDARD">Standard</option>
                <option value="PREMIUM">Premium</option>
              </select>
            </div>

            {/* Visibility Status */}
            <div>
              <label htmlFor="visibilityStatus" className="block text-sm font-medium text-gray-700">
                Visibility Status
              </label>
              <select
                id="visibilityStatus"
                value={formData.visibilityStatus}
                onChange={(e) => setFormData({ ...formData, visibilityStatus: e.target.value as 'ELIGIBLE' | 'INELIGIBLE' | 'SUSPENDED' })}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border px-3 py-2"
              >
                <option value="ELIGIBLE">Eligible (visible to consumers)</option>
                <option value="INELIGIBLE">Ineligible (hidden)</option>
                <option value="SUSPENDED">Suspended (blocked)</option>
              </select>
            </div>
          </div>

          {/* Visibility Reason (if not ELIGIBLE) */}
          {formData.visibilityStatus !== 'ELIGIBLE' && (
            <div>
              <label htmlFor="visibilityReason" className="block text-sm font-medium text-gray-700">
                Visibility Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                id="visibilityReason"
                value={formData.visibilityReason}
                onChange={(e) => setFormData({ ...formData, visibilityReason: e.target.value })}
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border px-3 py-2"
                placeholder="Explain why this retailer is not eligible..."
                required
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Link
              href="/retailers"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Retailer'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
