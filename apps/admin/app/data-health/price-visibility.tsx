import type { CvpSummary, CvpByRetailer, CvpByIngestionType } from './actions';

interface PriceVisibilityProps {
  cvpSummary: CvpSummary | null;
  cvpByRetailer: CvpByRetailer[] | null;
  cvpByIngestionType: CvpByIngestionType[] | null;
}

function timeAgo(date: Date | null): string {
  if (!date) return 'Never';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function SummaryCard({
  label,
  value,
  detail,
  variant = 'default',
}: {
  label: string;
  value: string | number;
  detail?: string;
  variant?: 'default' | 'warning' | 'error';
}) {
  const borderColor =
    variant === 'error'
      ? 'border-red-200'
      : variant === 'warning'
        ? 'border-amber-200'
        : 'border-gray-200';

  return (
    <div className={`bg-white border ${borderColor} rounded-lg p-4`}>
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-2xl font-bold text-gray-900">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {detail && <p className="text-xs text-gray-500 mt-1">{detail}</p>}
    </div>
  );
}

export function PriceVisibility({
  cvpSummary,
  cvpByRetailer,
  cvpByIngestionType,
}: PriceVisibilityProps) {
  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 mb-3">Price Visibility</h3>

      {/* Summary Row */}
      {cvpSummary === null ? (
        <p className="text-sm text-red-600 mb-4">Failed to load CVP summary</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <SummaryCard
            label="Total CVP Rows"
            value={cvpSummary.total}
            detail={`Last refreshed ${timeAgo(cvpSummary.maxRecomputedAt)}`}
          />
          <SummaryCard
            label="Stale Rows"
            value={cvpSummary.staleCount}
            detail={`${cvpSummary.stalePercentage}% of total`}
            variant={cvpSummary.stalePercentage > 10 ? 'warning' : 'default'}
          />
          <SummaryCard label="In-Stock" value={cvpSummary.inStockCount} />
          <SummaryCard label="Out of Stock" value={cvpSummary.oosCount} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* By Retailer Table */}
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h4 className="text-sm font-medium text-gray-900">By Retailer</h4>
          </div>
          {cvpByRetailer === null ? (
            <p className="p-4 text-sm text-red-600">Failed to load retailer data</p>
          ) : cvpByRetailer.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No visible prices</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Retailer</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">Total</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">In-Stock</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-600">In-Stock %</th>
                  </tr>
                </thead>
                <tbody>
                  {cvpByRetailer.map((row) => (
                    <tr key={row.retailerName} className="border-b border-gray-50">
                      <td className="px-4 py-2 text-gray-900">{row.retailerName}</td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {row.total.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {row.inStockCount.toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {row.inStockPercentage}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* By Ingestion Type */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-4 py-3 border-b border-gray-100">
            <h4 className="text-sm font-medium text-gray-900">By Ingestion Type</h4>
          </div>
          {cvpByIngestionType === null ? (
            <p className="p-4 text-sm text-red-600">Failed to load</p>
          ) : cvpByIngestionType.length === 0 ? (
            <p className="p-4 text-sm text-gray-500">No data</p>
          ) : (
            <div className="p-4 space-y-2">
              {cvpByIngestionType.map((row) => (
                <div
                  key={row.ingestionRunType}
                  className="flex items-center justify-between"
                >
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">
                    {row.ingestionRunType}
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {row.count.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
