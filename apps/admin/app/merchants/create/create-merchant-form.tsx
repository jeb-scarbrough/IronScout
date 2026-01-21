'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Save, Loader2 } from 'lucide-react';
import { createMerchant, type CreateMerchantInput } from './actions';

/** Normalize a URL: add https:// if missing, lowercase, remove trailing slash */
function normalizeUrl(url: string): string {
  let normalized = url.trim().toLowerCase();
  if (!normalized) return normalized;
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = 'https://' + normalized;
  }
  return normalized.replace(/\/+$/, '');
}

const STORE_TYPES = [
  { value: 'ONLINE_ONLY', label: 'Online Only' },
  { value: 'BRICK_AND_MORTAR', label: 'Brick & Mortar' },
  { value: 'BOTH', label: 'Both' },
] as const;

const MERCHANT_TIERS = [
  { value: 'FOUNDING', label: 'Founding' },
  { value: 'STANDARD', label: 'Standard' },
  { value: 'PRO', label: 'Pro' },
  { value: 'ENTERPRISE', label: 'Enterprise' },
] as const;

const MERCHANT_STATUSES = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
] as const;

export function CreateMerchantForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateMerchantInput>({
    businessName: '',
    websiteUrl: '',
    contactFirstName: '',
    contactLastName: '',
    phone: '',
    storeType: 'ONLINE_ONLY',
    tier: 'FOUNDING',
    status: 'ACTIVE',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createMerchant({
        businessName: formData.businessName,
        websiteUrl: formData.websiteUrl,
        contactFirstName: formData.contactFirstName,
        contactLastName: formData.contactLastName,
        phone: formData.phone || undefined,
        storeType: formData.storeType,
        tier: formData.tier,
        status: formData.status,
      });

      if (result.success) {
        router.push(`/merchants/${result.merchant?.id}`);
      } else {
        setError(result.error || 'Failed to create merchant');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateField = <K extends keyof CreateMerchantInput>(field: K, value: CreateMerchantInput[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Business Information */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Business Information</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Business Name *
            </label>
            <input
              type="text"
              required
              value={formData.businessName}
              onChange={(e) => updateField('businessName', e.target.value)}
              data-testid="merchant-create-business-name"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="e.g., Palmetto State Armory"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              Website URL *
            </label>
            <input
              type="text"
              required
              value={formData.websiteUrl}
              onChange={(e) => updateField('websiteUrl', e.target.value)}
              onBlur={(e) => updateField('websiteUrl', normalizeUrl(e.target.value))}
              data-testid="merchant-create-website-url"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="e.g., palmettostatearmory.com"
            />
            <p className="mt-1 text-xs text-gray-500">
              https:// will be added automatically if not provided
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Store Type *
            </label>
            <select
              value={formData.storeType}
              onChange={(e) => updateField('storeType', e.target.value as CreateMerchantInput['storeType'])}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              {STORE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Primary Contact */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Primary Contact</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              First Name *
            </label>
            <input
              type="text"
              required
              value={formData.contactFirstName}
              onChange={(e) => updateField('contactFirstName', e.target.value)}
              data-testid="merchant-create-contact-first-name"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Last Name *
            </label>
            <input
              type="text"
              required
              value={formData.contactLastName}
              onChange={(e) => updateField('contactLastName', e.target.value)}
              data-testid="merchant-create-contact-last-name"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Account Settings */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Account Settings</h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Tier
            </label>
            <select
              value={formData.tier}
              onChange={(e) => updateField('tier', e.target.value as CreateMerchantInput['tier'])}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              {MERCHANT_TIERS.map((tier) => (
                <option key={tier.value} value={tier.value}>
                  {tier.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => updateField('status', e.target.value as CreateMerchantInput['status'])}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              {MERCHANT_STATUSES.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Link
          href="/merchants"
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          data-testid="merchant-create-submit"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          Create Merchant
        </button>
      </div>
    </form>
  );
}
