'use client';

import { useState } from 'react';
import { ExternalLink, CreditCard, Key, RefreshCw, AlertCircle, Pencil, Save, X } from 'lucide-react';
import { updatePaymentDetails } from './actions';

interface PaymentSectionProps {
  dealerId: string;
  paymentMethod: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  autoRenew: boolean;
}

export function PaymentSection({
  dealerId,
  paymentMethod,
  stripeCustomerId,
  stripeSubscriptionId,
  autoRenew,
}: PaymentSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    paymentMethod: paymentMethod || '',
    stripeCustomerId: stripeCustomerId || '',
    stripeSubscriptionId: stripeSubscriptionId || '',
    autoRenew,
  });

  const stripeBaseUrl = process.env.NODE_ENV === 'production'
    ? 'https://dashboard.stripe.com'
    : 'https://dashboard.stripe.com/test';

  const customerUrl = stripeCustomerId
    ? `${stripeBaseUrl}/customers/${stripeCustomerId}`
    : null;

  const subscriptionUrl = stripeSubscriptionId
    ? `${stripeBaseUrl}/subscriptions/${stripeSubscriptionId}`
    : null;

  // Determine payment status
  const hasStripeSetup = paymentMethod === 'STRIPE' && stripeCustomerId;

  const handleEdit = () => {
    setIsEditing(true);
    setError(null);
    setSuccessMessage(null);
    // Reset form to current values
    setFormData({
      paymentMethod: paymentMethod || '',
      stripeCustomerId: stripeCustomerId || '',
      stripeSubscriptionId: stripeSubscriptionId || '',
      autoRenew,
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setError(null);
    setSuccessMessage(null);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const result = await updatePaymentDetails(dealerId, {
        paymentMethod: formData.paymentMethod === '' ? null : formData.paymentMethod as 'STRIPE' | 'PURCHASE_ORDER',
        stripeCustomerId: formData.stripeCustomerId || null,
        stripeSubscriptionId: formData.stripeSubscriptionId || null,
        autoRenew: formData.autoRenew,
      });

      if (result.success) {
        setSuccessMessage(result.message || 'Payment details updated successfully');
        setIsEditing(false);
        // The page will revalidate automatically
      } else {
        setError(result.error || 'Failed to update payment details');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Error updating payment details:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-medium text-gray-900">Payment Details</h2>
        </div>
        {!isEditing && (
          <button
            onClick={handleEdit}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            <Pencil className="h-4 w-4" />
            Edit
          </button>
        )}
      </div>

      {/* Success message */}
      {successMessage && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {isEditing ? (
        // Edit mode - show form inputs
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* Payment Method */}
            <div>
              <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-700 mb-1">
                Payment Method
              </label>
              <select
                id="paymentMethod"
                value={formData.paymentMethod}
                onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value })}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Not set</option>
                <option value="STRIPE">Stripe</option>
                <option value="PURCHASE_ORDER">Purchase Order</option>
              </select>
            </div>

            {/* Auto Renew */}
            <div>
              <label htmlFor="autoRenew" className="block text-sm font-medium text-gray-700 mb-1">
                Auto Renew
              </label>
              <div className="flex items-center h-10">
                <input
                  type="checkbox"
                  id="autoRenew"
                  checked={formData.autoRenew}
                  onChange={(e) => setFormData({ ...formData, autoRenew: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="autoRenew" className="ml-2 text-sm text-gray-700">
                  Enable auto-renewal
                </label>
              </div>
            </div>

            {/* Stripe Customer ID */}
            <div>
              <label htmlFor="stripeCustomerId" className="block text-sm font-medium text-gray-700 mb-1">
                Stripe Customer ID
              </label>
              <input
                type="text"
                id="stripeCustomerId"
                value={formData.stripeCustomerId}
                onChange={(e) => setFormData({ ...formData, stripeCustomerId: e.target.value })}
                placeholder="cus_..."
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Stripe Subscription ID */}
            <div>
              <label htmlFor="stripeSubscriptionId" className="block text-sm font-medium text-gray-700 mb-1">
                Stripe Subscription ID
              </label>
              <input
                type="text"
                id="stripeSubscriptionId"
                value={formData.stripeSubscriptionId}
                onChange={(e) => setFormData({ ...formData, stripeSubscriptionId: e.target.value })}
                placeholder="sub_..."
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        // View mode - show current values
        <>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Payment Method */}
            <div>
              <dt className="text-sm font-medium text-gray-500">Payment Method</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {paymentMethod === 'STRIPE' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                    <CreditCard className="h-3 w-3" />
                    Stripe
                  </span>
                ) : paymentMethod === 'PURCHASE_ORDER' ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    Purchase Order
                  </span>
                ) : (
                  <span className="text-gray-500">Not set</span>
                )}
              </dd>
            </div>

            {/* Auto Renew */}
            <div>
              <dt className="text-sm font-medium text-gray-500">Auto Renew</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  autoRenew
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  <RefreshCw className="h-3 w-3" />
                  {autoRenew ? 'Enabled' : 'Disabled'}
                </span>
              </dd>
            </div>

            {/* Stripe Customer ID */}
            <div>
              <dt className="text-sm font-medium text-gray-500 flex items-center gap-1">
                <Key className="h-3 w-3" />
                Stripe Customer ID
              </dt>
              <dd className="mt-1 text-sm">
                {stripeCustomerId ? (
                  <a
                    href={customerUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-mono text-xs"
                  >
                    {stripeCustomerId}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </dd>
            </div>

            {/* Stripe Subscription ID */}
            <div>
              <dt className="text-sm font-medium text-gray-500 flex items-center gap-1">
                <Key className="h-3 w-3" />
                Stripe Subscription ID
              </dt>
              <dd className="mt-1 text-sm">
                {stripeSubscriptionId ? (
                  <a
                    href={subscriptionUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline font-mono text-xs"
                  >
                    {stripeSubscriptionId}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-gray-500">—</span>
                )}
              </dd>
            </div>
          </dl>

          {/* Info banner for non-Stripe payment */}
          {paymentMethod === 'PURCHASE_ORDER' && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium">Purchase Order Billing</p>
                <p className="mt-1">
                  This dealer is billed via purchase order. Subscription status must be updated manually.
                </p>
              </div>
            </div>
          )}

          {/* Info banner for no payment method */}
          {!paymentMethod && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">No Payment Method</p>
                <p className="mt-1">
                  This dealer has not set up a payment method. They may be a founding member or need to complete billing setup.
                </p>
              </div>
            </div>
          )}

          {/* Quick access to Stripe */}
          {hasStripeSetup && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-wrap gap-3">
                {customerUrl && (
                  <a
                    href={customerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Customer in Stripe
                  </a>
                )}
                {subscriptionUrl && (
                  <a
                    href={subscriptionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Subscription in Stripe
                  </a>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
