'use client';

import { useState, useTransition } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { fetchDashboardData } from './actions';
import type { DashboardData } from './actions';
import { StatusBanner } from './status-banner';
import { PipelineStatus } from './pipeline-status';
import { PriceVisibility } from './price-visibility';
import { GuardrailAudit } from './guardrail-audit';
import { ProductCoverage } from './product-coverage';
import { IntegrityChecks } from './integrity-checks';

interface DashboardContentProps {
  initialData: DashboardData;
}

export function DashboardContent({ initialData }: DashboardContentProps) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = () => {
    startTransition(async () => {
      setError(null);
      const result = await fetchDashboardData();
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error ?? 'Failed to refresh dashboard');
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Data Health</h1>
        <button
          onClick={handleRefresh}
          disabled={isPending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Section 1: Status Banner */}
      <StatusBanner status={data.overallStatus} fetchedAt={data.fetchedAt} />

      {/* Section 2: Pipeline Status */}
      <PipelineStatus
        affiliate={data.affiliate}
        scrape={data.scrape}
        recompute={data.recompute}
      />

      {/* Section 3: Price Visibility */}
      <PriceVisibility
        cvpSummary={data.cvpSummary}
        cvpByRetailer={data.cvpByRetailer}
        cvpByIngestionType={data.cvpByIngestionType}
      />

      {/* Section 4: Guardrail Audit */}
      <GuardrailAudit guardrailAudit={data.guardrailAudit} />

      {/* Section 5: Product Coverage */}
      <ProductCoverage productCoverage={data.productCoverage} />

      {/* Divider */}
      <hr className="border-gray-200" />

      {/* Section 6: Integrity Checks (Manual Trigger) */}
      <IntegrityChecks />
    </div>
  );
}
