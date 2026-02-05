'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ImpersonationData {
  active: boolean;
  merchantName?: string;
}

export function ImpersonationBanner() {
  const [impersonation, setImpersonation] = useState<ImpersonationData | null>(null);

  useEffect(() => {
    // Fetch impersonation status from httpOnly session cookie via API (#177)
    fetch('/api/auth/impersonation-status')
      .then(res => res.json())
      .then((data: ImpersonationData) => {
        if (data.active) {
          setImpersonation(data);
        }
      })
      .catch(() => {
        // Ignore errors — banner just won't show
      });
  }, []);

  const handleEndImpersonation = async () => {
    // Call logout API to clear httpOnly cookies server-side
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    window.location.href = '/login';
  };

  if (!impersonation) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-orange-500 text-white px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5" />
          <span className="text-sm font-medium">
            Admin Impersonation Mode{impersonation.merchantName && (
              <>: You are viewing as <strong>{impersonation.merchantName}</strong></>
            )}
          </span>
        </div>
        <button
          onClick={handleEndImpersonation}
          className="flex items-center gap-1 px-3 py-1 text-sm font-medium bg-orange-600 hover:bg-orange-700 rounded"
        >
          <X className="h-4 w-4" />
          End Session
        </button>
      </div>
    </div>
  );
}
