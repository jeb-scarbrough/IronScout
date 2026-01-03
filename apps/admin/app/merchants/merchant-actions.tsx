'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface MerchantActionsProps {
  merchant: {
    id: string;
    businessName: string;
    status: string;
  };
}

export function MerchantActions({ merchant }: MerchantActionsProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleAction = async (action: 'approve' | 'suspend' | 'reactivate') => {
    const messages = {
      approve: `Approve ${merchant.businessName}? They will receive an email notification.`,
      suspend: `Suspend ${merchant.businessName}? They will lose access immediately.`,
      reactivate: `Reactivate ${merchant.businessName}? They will receive an email notification.`,
    };

    if (!confirm(messages[action])) {
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/merchants/${merchant.id}/${action}`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.error || `Failed to ${action} merchant`);
        return;
      }

      router.refresh();
    } catch {
      alert(`Failed to ${action} merchant`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-end gap-2">
      {merchant.status === 'PENDING' && (
        <button
          onClick={() => handleAction('approve')}
          disabled={isLoading}
          className="inline-flex items-center rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Approve
        </button>
      )}

      {merchant.status === 'ACTIVE' && (
        <button
          onClick={() => handleAction('suspend')}
          disabled={isLoading}
          className="inline-flex items-center rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          Suspend
        </button>
      )}

      {merchant.status === 'SUSPENDED' && (
        <button
          onClick={() => handleAction('reactivate')}
          disabled={isLoading}
          className="inline-flex items-center rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Reactivate
        </button>
      )}

      <a
        href={`/merchants/${merchant.id}`}
        className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
      >
        View
      </a>
    </div>
  );
}
