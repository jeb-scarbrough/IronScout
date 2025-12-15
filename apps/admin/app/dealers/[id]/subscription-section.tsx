'use client';

import { useState } from 'react';
import { CreditCard, Calendar, AlertTriangle, CheckCircle, XCircle, Ban } from 'lucide-react';
import { updateSubscription } from './actions';

interface SubscriptionSectionProps {
  dealerId: string;
  businessName: string;
  tier: string;
  subscriptionStatus: string;
  subscriptionExpiresAt: Date | null;
  subscriptionGraceDays: number;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  ACTIVE: { label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  EXPIRED: { label: 'Expired', color: 'bg-red-100 text-red-700', icon: XCircle },
  SUSPENDED: { label: 'Suspended', color: 'bg-orange-100 text-orange-700', icon: Ban },
  CANCELLED: { label: 'Cancelled', color: 'bg-gray-100 text-gray-700', icon: XCircle },
};

export function SubscriptionSection({
  dealerId,
  businessName,
  tier,
  subscriptionStatus,
  subscriptionExpiresAt,
  subscriptionGraceDays,
}: SubscriptionSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form state
  const [status, setStatus] = useState(subscriptionStatus);
  const [expiresAt, setExpiresAt] = useState(
    subscriptionExpiresAt ? new Date(subscriptionExpiresAt).toISOString().split('T')[0] : ''
  );
  const [graceDays, setGraceDays] = useState(subscriptionGraceDays.toString());

  const statusInfo = statusConfig[subscriptionStatus] || statusConfig.ACTIVE;
  const StatusIcon = statusInfo.icon;

  // Calculate subscription status details
  const now = new Date();
  const expiryDate = subscriptionExpiresAt ? new Date(subscriptionExpiresAt) : null;
  const isExpired = expiryDate && now > expiryDate;
  const daysUntilExpiry = expiryDate
    ? Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  async function handleSave() {
    setIsSaving(true);
    setMessage(null);

    try {
      const result = await updateSubscription(dealerId, {
        status: status as 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'CANCELLED',
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        graceDays: parseInt(graceDays, 10),
      });

      if (result.success) {
        setMessage({ type: 'success', text: result.message || 'Subscription updated successfully.' });
        setIsEditing(false);
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to update subscription.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    setStatus(subscriptionStatus);
    setExpiresAt(subscriptionExpiresAt ? new Date(subscriptionExpiresAt).toISOString().split('T')[0] : '');
    setGraceDays(subscriptionGraceDays.toString());
    setIsEditing(false);
    setMessage(null);
  }

  // Quick action: Extend by 1 year
  async function handleExtendOneYear() {
    setIsSaving(true);
    setMessage(null);

    const newExpiry = new Date();
    newExpiry.setFullYear(newExpiry.getFullYear() + 1);

    try {
      const result = await updateSubscription(dealerId, {
        status: 'ACTIVE',
        expiresAt: newExpiry,
        graceDays: parseInt(graceDays, 10),
      });

      if (result.success) {
        setMessage({ type: 'success', text: 'Extended subscription by 1 year.' });
        setExpiresAt(newExpiry.toISOString().split('T')[0]);
        setStatus('ACTIVE');
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to extend subscription.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-medium text-gray-900">Subscription</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${statusInfo.color}`}>
            <StatusIcon className="h-4 w-4" />
            {statusInfo.label}
          </span>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {!isEditing ? (
        // View mode
        <div className="space-y-4">
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Plan</dt>
              <dd className="mt-1 text-sm text-gray-900">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                  {tier}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Expires</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {expiryDate ? (
                  <span className={isExpired ? 'text-red-600 font-medium' : ''}>
                    {expiryDate.toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                    {daysUntilExpiry !== null && (
                      <span className={`ml-2 text-xs ${daysUntilExpiry < 0 ? 'text-red-500' : daysUntilExpiry <= 30 ? 'text-amber-500' : 'text-gray-500'}`}>
                        ({daysUntilExpiry < 0 ? `${Math.abs(daysUntilExpiry)} days ago` : `${daysUntilExpiry} days left`})
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-gray-500">No expiration set</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Grace Period</dt>
              <dd className="mt-1 text-sm text-gray-900">{subscriptionGraceDays} days</dd>
            </div>
          </dl>

          {/* Warning for expiring soon */}
          {daysUntilExpiry !== null && daysUntilExpiry > 0 && daysUntilExpiry <= 30 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                Subscription expires in {daysUntilExpiry} day{daysUntilExpiry === 1 ? '' : 's'}.
                Consider extending.
              </p>
              <button
                onClick={handleExtendOneYear}
                disabled={isSaving}
                className="ml-auto text-sm font-medium text-amber-700 hover:text-amber-900"
              >
                Extend 1 Year
              </button>
            </div>
          )}

          {/* Warning for expired */}
          {isExpired && subscriptionStatus !== 'SUSPENDED' && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-800">
                Subscription expired {Math.abs(daysUntilExpiry || 0)} day{Math.abs(daysUntilExpiry || 0) === 1 ? '' : 's'} ago.
                Dealer may be in grace period or blocked.
              </p>
              <button
                onClick={handleExtendOneYear}
                disabled={isSaving}
                className="ml-auto text-sm font-medium text-red-700 hover:text-red-900"
              >
                Extend 1 Year
              </button>
            </div>
          )}
        </div>
      ) : (
        // Edit mode
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="EXPIRED">Expired</option>
                <option value="SUSPENDED">Suspended</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <div className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  Expiration Date
                </div>
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grace Period (days)</label>
              <input
                type="number"
                min="0"
                max="90"
                value={graceDays}
                onChange={(e) => setGraceDays(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleCancel}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
