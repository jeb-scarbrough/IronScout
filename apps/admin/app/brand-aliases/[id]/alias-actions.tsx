'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { activateAlias, disableAlias, type BrandAliasDTO } from '../actions';
import { Loader2, CheckCircle, XCircle, Ban } from 'lucide-react';

interface AliasActionsProps {
  alias: BrandAliasDTO;
}

export function AliasActions({ alias }: AliasActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disableReason, setDisableReason] = useState('');
  const [isRejection, setIsRejection] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleActivate = () => {
    setError(null);
    startTransition(async () => {
      const result = await activateAlias(alias.id);
      if (result.success) {
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to activate alias');
      }
    });
  };

  const handleDisable = () => {
    if (!disableReason.trim()) {
      setError('Please provide a reason for disabling');
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await disableAlias(alias.id, disableReason, isRejection);
      if (result.success) {
        setShowDisableModal(false);
        setDisableReason('');
        setIsRejection(false);
        router.refresh();
      } else {
        setError(result.error ?? 'Failed to disable alias');
      }
    });
  };

  const canActivate = alias.status === 'DRAFT' ||
    (alias.status === 'DISABLED' && !alias.disableReason?.startsWith('REJECTED:'));
  const canDisable = alias.status === 'DRAFT' || alias.status === 'ACTIVE';

  return (
    <>
      <div className="flex items-center gap-2">
        {error && (
          <span className="text-sm text-red-600 mr-2">{error}</span>
        )}

        {canActivate && (
          <button
            onClick={handleActivate}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Activate
          </button>
        )}

        {canDisable && (
          <button
            onClick={() => setShowDisableModal(true)}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            <XCircle className="h-4 w-4" />
            Disable
          </button>
        )}
      </div>

      {/* Disable Modal */}
      {showDisableModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Disable Alias</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={disableReason}
                  onChange={(e) => setDisableReason(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  rows={3}
                  placeholder="Why is this alias being disabled?"
                />
              </div>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={isRejection}
                  onChange={(e) => setIsRejection(e.target.checked)}
                  className="mt-0.5"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <Ban className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium text-gray-900">Mark as Rejected</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Rejected aliases cannot be re-activated. Use this for aliases that should never be used.
                  </p>
                </div>
              </label>

              {error && (
                <p className="text-sm text-red-600">{error}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowDisableModal(false);
                  setDisableReason('');
                  setIsRejection(false);
                  setError(null);
                }}
                disabled={isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDisable}
                disabled={isPending || !disableReason.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {isRejection ? 'Reject Alias' : 'Disable Alias'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
