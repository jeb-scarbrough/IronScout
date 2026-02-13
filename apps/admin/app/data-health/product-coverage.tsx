import type { ProductCoverage as ProductCoverageData } from './actions';

interface ProductCoverageProps {
  productCoverage: ProductCoverageData | null;
}

const STATUS_COLORS: Record<string, string> = {
  MATCHED: 'bg-green-100 text-green-700',
  CREATED: 'bg-blue-100 text-blue-700',
  NEEDS_REVIEW: 'bg-amber-100 text-amber-700',
  SKIPPED: 'bg-gray-100 text-gray-600',
  ERROR: 'bg-red-100 text-red-700',
};

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
    </div>
  );
}

export function ProductCoverage({ productCoverage }: ProductCoverageProps) {
  return (
    <div>
      <h3 className="text-base font-semibold text-gray-900 mb-3">Product Coverage</h3>

      {productCoverage === null ? (
        <p className="text-sm text-red-600">Failed to load product coverage</p>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <SummaryCard label="Total Products" value={productCoverage.totalProducts} />
            <SummaryCard
              label="Products with Links"
              value={productCoverage.productsWithLinks}
            />
            <SummaryCard label="Orphan Products" value={productCoverage.orphanProducts} />
          </div>

          {/* Status Distribution */}
          {productCoverage.statusDistribution.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Link Status Distribution
              </h4>
              <div className="flex flex-wrap gap-3">
                {productCoverage.statusDistribution.map((item) => (
                  <div
                    key={item.status}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                      STATUS_COLORS[item.status] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    <span>{item.status}</span>
                    <span className="font-bold">{item.count.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
