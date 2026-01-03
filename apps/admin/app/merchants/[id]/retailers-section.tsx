'use client';

import { useState, useEffect } from 'react';
import {
  Store,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ExternalLink,
  Eye,
  EyeOff,
  Clock,
  Info,
} from 'lucide-react';
import { getMerchantRetailers, listRetailer, unlistRetailer, MerchantRetailerInfo } from './actions';

interface RetailersSectionProps {
  merchantId: string;
  subscriptionStatus: string;
}

const listingStatusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  LISTED: { label: 'Listed', color: 'bg-green-100 text-green-700', icon: Eye },
  UNLISTED: { label: 'Unlisted', color: 'bg-gray-100 text-gray-600', icon: EyeOff },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  ACTIVE: { label: 'Active', color: 'text-green-600' },
  PENDING: { label: 'Pending', color: 'text-yellow-600' },
  SUSPENDED: { label: 'Suspended', color: 'text-red-600' },
  INACTIVE: { label: 'Inactive', color: 'text-gray-500' },
};

const visibilityConfig: Record<string, { label: string; color: string }> = {
  ELIGIBLE: { label: 'Eligible', color: 'text-green-600' },
  INELIGIBLE: { label: 'Ineligible', color: 'text-red-600' },
  PENDING_REVIEW: { label: 'Pending Review', color: 'text-yellow-600' },
};

function formatDate(date: Date | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function RetailersSection({ merchantId, subscriptionStatus }: RetailersSectionProps) {
  const [retailers, setRetailers] = useState<MerchantRetailerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'warning'; text: string } | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [unlistReason, setUnlistReason] = useState('');
  const [showUnlistDialog, setShowUnlistDialog] = useState<string | null>(null);

  // Load retailers on mount
  useEffect(() => {
    loadRetailers();
  }, [merchantId]);

  async function loadRetailers() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getMerchantRetailers(merchantId);
      if (result.success) {
        setRetailers(result.retailers);
      } else {
        setError(result.error || 'Failed to load retailers');
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleList(retailer: MerchantRetailerInfo) {
    setActionInProgress(retailer.id);
    setActionMessage(null);

    try {
      const result = await listRetailer(merchantId, retailer.id);
      if (result.success) {
        setActionMessage({
          type: result.warning ? 'warning' : 'success',
          text: result.warning || result.message || 'Retailer listed successfully',
        });
        await loadRetailers();
      } else {
        setActionMessage({ type: 'error', text: result.error || 'Failed to list retailer' });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleUnlist(retailer: MerchantRetailerInfo) {
    if (!unlistReason.trim()) {
      setActionMessage({ type: 'error', text: 'Please provide a reason for unlisting' });
      return;
    }

    setActionInProgress(retailer.id);
    setActionMessage(null);

    try {
      const result = await unlistRetailer(merchantId, retailer.id, unlistReason.trim());
      if (result.success) {
        setActionMessage({ type: 'success', text: result.message || 'Retailer unlisted successfully' });
        setShowUnlistDialog(null);
        setUnlistReason('');
        await loadRetailers();
      } else {
        setActionMessage({ type: 'error', text: result.error || 'Failed to unlist retailer' });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'An unexpected error occurred' });
    } finally {
      setActionInProgress(null);
    }
  }

  function getVisibilityStatus(retailer: MerchantRetailerInfo): { visible: boolean; reason: string } {
    if (retailer.visibilityStatus !== 'ELIGIBLE') {
      return { visible: false, reason: `Retailer is ${retailer.visibilityStatus}` };
    }
    if (retailer.status !== 'ACTIVE') {
      return { visible: false, reason: `Relationship status is ${retailer.status}` };
    }
    if (retailer.listingStatus !== 'LISTED') {
      return { visible: false, reason: 'Retailer is unlisted' };
    }
    return { visible: true, reason: 'Visible to consumers' };
  }

  const isDelinquent = ['EXPIRED', 'SUSPENDED', 'CANCELLED'].includes(subscriptionStatus);

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-gray-400" />
          <h2 className="text-lg font-medium text-gray-900">Retailers</h2>
          <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            {retailers.length}
          </span>
        </div>
      </div>

      {/* Delinquency Warning */}
      {isDelinquent && (
        <div className="mb-4 rounded-md bg-yellow-50 p-4">
          <div className="flex">
            <AlertTriangle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Merchant subscription is {subscriptionStatus}
              </h3>
              <p className="mt-1 text-sm text-yellow-700">
                All retailers have been or will be auto-unlisted. Relisting requires the merchant to resolve billing issues first.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Message */}
      {actionMessage && (
        <div
          className={`mb-4 rounded-md p-4 ${
            actionMessage.type === 'success'
              ? 'bg-green-50 text-green-700'
              : actionMessage.type === 'warning'
              ? 'bg-yellow-50 text-yellow-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          <div className="flex">
            {actionMessage.type === 'success' ? (
              <CheckCircle className="h-5 w-5" />
            ) : actionMessage.type === 'warning' ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
            <p className="ml-3 text-sm">{actionMessage.text}</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="py-8 text-center text-gray-500">
          <Clock className="h-6 w-6 animate-spin mx-auto mb-2" />
          Loading retailers...
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="py-8 text-center text-red-500">
          <XCircle className="h-6 w-6 mx-auto mb-2" />
          {error}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && retailers.length === 0 && (
        <div className="py-8 text-center text-gray-500">
          <Store className="h-8 w-8 mx-auto mb-2 text-gray-300" />
          <p>No retailers linked to this merchant</p>
          <p className="text-sm mt-1">Retailers are created and linked during onboarding</p>
        </div>
      )}

      {/* Retailers Table */}
      {!isLoading && !error && retailers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Retailer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Listing
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Consumer Visibility
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {retailers.map((retailer) => {
                const listingInfo = listingStatusConfig[retailer.listingStatus] || listingStatusConfig.UNLISTED;
                const ListingIcon = listingInfo.icon;
                const statusInfo = statusConfig[retailer.status] || statusConfig.ACTIVE;
                const visibilityInfo = visibilityConfig[retailer.visibilityStatus] || visibilityConfig.INELIGIBLE;
                const visibility = getVisibilityStatus(retailer);

                return (
                  <tr key={retailer.id} className={retailer.listingStatus === 'UNLISTED' ? 'bg-gray-50' : ''}>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{retailer.retailerName}</div>
                        {retailer.retailerUrl && (
                          <a
                            href={retailer.retailerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                          >
                            {retailer.retailerUrl.replace(/^https?:\/\//, '').slice(0, 30)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={`text-sm font-medium ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                        <span className={`text-xs ${visibilityInfo.color}`}>
                          {visibilityInfo.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${listingInfo.color}`}
                      >
                        <ListingIcon className="h-3 w-3" />
                        {listingInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {visibility.visible ? (
                          <span className="inline-flex items-center gap-1 text-sm text-green-600">
                            <Eye className="h-4 w-4" />
                            Visible
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-sm text-gray-500" title={visibility.reason}>
                            <EyeOff className="h-4 w-4" />
                            Hidden
                            <Info className="h-3 w-3 cursor-help" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-500">
                      {retailer.listingStatus === 'LISTED' ? (
                        <div>
                          <div>Listed {formatDate(retailer.listedAt)}</div>
                          {retailer.listedBy && (
                            <div className="text-xs text-gray-400">by {retailer.listedBy}</div>
                          )}
                        </div>
                      ) : (
                        <div>
                          <div>Unlisted {formatDate(retailer.unlistedAt)}</div>
                          {retailer.unlistedReason && (
                            <div className="text-xs text-gray-400" title={retailer.unlistedReason}>
                              {retailer.unlistedReason.length > 25
                                ? `${retailer.unlistedReason.slice(0, 25)}...`
                                : retailer.unlistedReason}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      {retailer.listingStatus === 'LISTED' ? (
                        <button
                          onClick={() => {
                            setShowUnlistDialog(retailer.id);
                            setUnlistReason('');
                            setActionMessage(null);
                          }}
                          disabled={actionInProgress === retailer.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                          Unlist
                        </button>
                      ) : (
                        <button
                          onClick={() => handleList(retailer)}
                          disabled={
                            actionInProgress === retailer.id ||
                            retailer.status !== 'ACTIVE' ||
                            retailer.visibilityStatus !== 'ELIGIBLE'
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                          title={
                            retailer.status !== 'ACTIVE'
                              ? 'Status must be ACTIVE to list'
                              : retailer.visibilityStatus !== 'ELIGIBLE'
                              ? 'Retailer must be ELIGIBLE to list'
                              : 'Make visible to consumers'
                          }
                        >
                          <Eye className="h-3.5 w-3.5" />
                          {actionInProgress === retailer.id ? 'Listing...' : 'List'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Unlist Dialog */}
      {showUnlistDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Unlist Retailer</h3>
            <p className="text-sm text-gray-500 mb-4">
              This will hide the retailer from consumer search results. Please provide a reason for the audit trail.
            </p>
            <div className="mb-4">
              <label htmlFor="unlistReason" className="block text-sm font-medium text-gray-700 mb-1">
                Reason for unlisting
              </label>
              <input
                type="text"
                id="unlistReason"
                value={unlistReason}
                onChange={(e) => setUnlistReason(e.target.value)}
                placeholder="e.g., Policy violation, Merchant request, Data quality"
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowUnlistDialog(null);
                  setUnlistReason('');
                  setActionMessage(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const retailer = retailers.find((r) => r.id === showUnlistDialog);
                  if (retailer) {
                    handleUnlist(retailer);
                  }
                }}
                disabled={!unlistReason.trim() || actionInProgress !== null}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionInProgress ? 'Unlisting...' : 'Unlist Retailer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Footer */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-start gap-2 text-xs text-gray-500">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Consumer Visibility = ELIGIBLE + LISTED + ACTIVE</p>
            <p className="mt-1">
              Retailers must have <span className="font-medium">visibilityStatus=ELIGIBLE</span>,{' '}
              <span className="font-medium">listingStatus=LISTED</span>, and{' '}
              <span className="font-medium">status=ACTIVE</span> to appear in consumer search results.
              Delinquent merchants have all retailers auto-unlisted.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
