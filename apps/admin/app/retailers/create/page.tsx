'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Loader2, Store, Link as LinkIcon } from 'lucide-react';
import { createRetailerAndLink } from '../actions';

/** Normalize a URL: add https:// if missing, lowercase, remove trailing slash */
function normalizeUrl(url: string): string {
  let normalized = url.trim().toLowerCase();
  if (!normalized) return normalized;
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }
  return normalized.replace(/\/+$/, '');
}

export default function CreateRetailerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const merchantId = searchParams.get('merchantId');
  const merchantName = searchParams.get('merchantName');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkToMerchant, setLinkToMerchant] = useState(!!merchantId);
  const [listImmediately, setListImmediately] = useState(true);

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
      const result = await createRetailerAndLink({
        name: formData.name,
        website: formData.website,
        logoUrl: formData.logoUrl || undefined,
        tier: formData.tier,
        visibilityStatus: formData.visibilityStatus,
        visibilityReason: formData.visibilityStatus !== 'ELIGIBLE' ? formData.visibilityReason : undefined,
        merchantId: linkToMerchant ? merchantId || undefined : undefined,
        listImmediately: linkToMerchant ? listImmediately : undefined,
      });

      if (!result.success || !result.data) {
        setError(result.error || 'Failed to create retailer');
        return;
      }

      // Redirect based on whether we linked to a merchant
      if (linkToMerchant && merchantId) {
        router.push(`/merchants/${merchantId}`);
      } else {
        router.push(`/retailers/${result.data.id}`);
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const backUrl = merchantId ? `/merchants/${merchantId}` : '/retailers';
  const backLabel = merchantName ? `Back to ${merchantName}` : merchantId ? 'Back to Merchant' : 'Back to Retailers';

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href={backUrl}
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        {backLabel}
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

        {/* Merchant Link Option */}
        {merchantId && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-start gap-3">
              <LinkIcon className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-blue-900">
                  Link to Merchant
                </h3>
                <p className="text-sm text-blue-700 mt-1">
                  This retailer will be automatically linked to the merchant after creation.
                </p>
                <div className="mt-3 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={linkToMerchant}
                      onChange={(e) => setLinkToMerchant(e.target.checked)}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-blue-800">
                      Link retailer to merchant
                    </span>
                  </label>
                  {linkToMerchant && (
                    <label className="flex items-center gap-2 cursor-pointer ml-6">
                      <input
                        type="checkbox"
                        checked={listImmediately}
                        onChange={(e) => setListImmediately(e.target.checked)}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-blue-700">
                        List immediately (make visible to consumers)
                      </span>
                    </label>
                  )}
                </div>
              </div>
            </div>
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
              onBlur={(e) => setFormData({ ...formData, website: normalizeUrl(e.target.value) })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border px-3 py-2"
              placeholder="e.g., example.com"
              required
            />
            <p className="mt-1 text-xs text-gray-500">https:// will be added automatically if not provided</p>
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
              href={backUrl}
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
                  {linkToMerchant ? 'Creating & Linking...' : 'Creating...'}
                </>
              ) : (
                linkToMerchant ? 'Create & Link Retailer' : 'Create Retailer'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
