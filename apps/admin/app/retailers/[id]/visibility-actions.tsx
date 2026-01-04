'use client';

import { useState } from 'react';
import { Eye, EyeOff, XCircle, Loader2, X } from 'lucide-react';
import { updateRetailerVisibility } from '../actions';
import { RetailerVisibility } from '@ironscout/db';

interface VisibilityActionsProps {
  retailerId: string;
  currentStatus: RetailerVisibility;
}

export function VisibilityActions({ retailerId, currentStatus }: VisibilityActionsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<RetailerVisibility | null>(null);
  const [reason, setReason] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openModal = (status: RetailerVisibility) => {
    setSelectedStatus(status);
    setReason('');
    setError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedStatus(null);
    setReason('');
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStatus) return;

    setIsUpdating(true);
    setError(null);

    try {
      const result = await updateRetailerVisibility(
        retailerId,
        selectedStatus,
        selectedStatus !== 'ELIGIBLE' ? reason : undefined
      );

      if (result.success) {
        closeModal();
      } else {
        setError(result.error || 'Failed to update visibility');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsUpdating(false);
    }
  };

  const statusLabels: Record<RetailerVisibility, string> = {
    ELIGIBLE: 'Eligible',
    INELIGIBLE: 'Ineligible',
    SUSPENDED: 'Suspended',
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {currentStatus !== 'ELIGIBLE' && (
          <button
            onClick={() => openModal('ELIGIBLE')}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200"
          >
            <Eye className="h-3 w-3" />
            Make Eligible
          </button>
        )}
        {currentStatus !== 'INELIGIBLE' && (
          <button
            onClick={() => openModal('INELIGIBLE')}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-yellow-700 bg-yellow-100 rounded-md hover:bg-yellow-200"
          >
            <EyeOff className="h-3 w-3" />
            Mark Ineligible
          </button>
        )}
        {currentStatus !== 'SUSPENDED' && (
          <button
            onClick={() => openModal('SUSPENDED')}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200"
          >
            <XCircle className="h-3 w-3" />
            Suspend
          </button>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && selectedStatus && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
            onClick={closeModal}
          />

          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">
                  Change Visibility to {statusLabels[selectedStatus]}
                </h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-500">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {selectedStatus === 'ELIGIBLE' ? (
                  <p className="text-sm text-gray-600">
                    This will make the retailer visible in consumer search, alerts, and watchlists.
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-gray-600">
                      {selectedStatus === 'INELIGIBLE'
                        ? 'This will hide the retailer from consumers due to policy or data quality issues.'
                        : 'This will suspend the retailer and hide it from all consumer-facing features.'}
                    </p>
                    <div>
                      <label htmlFor="reason" className="block text-sm font-medium text-gray-700">
                        Reason <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        id="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm border px-3 py-2"
                        placeholder="Explain why this retailer is being marked as ineligible or suspended..."
                        required
                      />
                    </div>
                  </>
                )}

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    disabled={isUpdating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating || (selectedStatus !== 'ELIGIBLE' && !reason.trim())}
                    className={`inline-flex items-center px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md disabled:opacity-50 ${
                      selectedStatus === 'ELIGIBLE'
                        ? 'bg-green-600 hover:bg-green-700'
                        : selectedStatus === 'INELIGIBLE'
                        ? 'bg-yellow-600 hover:bg-yellow-700'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {isUpdating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      `Set to ${statusLabels[selectedStatus]}`
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
