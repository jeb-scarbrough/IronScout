import {
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  BarChart3,
} from 'lucide-react';
interface BenchmarkData {
  minPrice: unknown;
  medianPrice: unknown;
  maxPrice: unknown;
}

interface CanonicalSkuData {
  id: string;
  name: string;
  caliber: string;
  grain: number;
  packSize: number;
  brand?: string | null;
  upc?: string | null;
  benchmark?: BenchmarkData | null;
}

interface MarketComparisonCardProps {
  canonicalSku: CanonicalSkuData;
  dealerPrice: number;
  dealerPackSize: number;
}

export function MarketComparisonCard({
  canonicalSku,
  dealerPrice,
  dealerPackSize,
}: MarketComparisonCardProps) {
  const benchmark = canonicalSku.benchmark;

  // Calculate price per round for comparison
  const dealerPpr = dealerPrice / dealerPackSize;

  // Benchmark prices are already per-round
  const marketLow = benchmark?.minPrice ? Number(benchmark.minPrice) : null;
  const marketMedian = benchmark?.medianPrice ? Number(benchmark.medianPrice) : null;
  const marketHigh = benchmark?.maxPrice ? Number(benchmark.maxPrice) : null;

  if (!benchmark || marketMedian === null) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-gray-400" />
            Market Comparison
          </h2>
        </div>
        <div className="px-6 py-8 text-center">
          <BarChart3 className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">
            No market data available yet
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Benchmarks are calculated periodically
          </p>
        </div>
      </div>
    );
  }

  // Calculate position relative to market
  const diffFromMedian = dealerPpr - marketMedian;
  const percentDiff = (diffFromMedian / marketMedian) * 100;

  // Determine position category
  let position: 'below' | 'at' | 'above';
  let positionLabel: string;
  let positionColor: string;
  let PositionIcon: typeof TrendingUp;

  if (percentDiff < -5) {
    position = 'below';
    positionLabel = 'Below Market';
    positionColor = 'text-green-600';
    PositionIcon = TrendingDown;
  } else if (percentDiff > 5) {
    position = 'above';
    positionLabel = 'Above Market';
    positionColor = 'text-red-600';
    PositionIcon = TrendingUp;
  } else {
    position = 'at';
    positionLabel = 'At Market';
    positionColor = 'text-blue-600';
    PositionIcon = Minus;
  }

  // Calculate position on the price range bar (0-100%)
  const rangeMin = marketLow || marketMedian * 0.8;
  const rangeMax = marketHigh || marketMedian * 1.2;
  const range = rangeMax - rangeMin;
  const dealerPosition = Math.min(100, Math.max(0, ((dealerPpr - rangeMin) / range) * 100));
  const medianPosition = ((marketMedian - rangeMin) / range) * 100;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-gray-400" />
          Market Comparison
        </h2>
      </div>

      <div className="px-6 py-4 space-y-6">
        {/* Position Summary */}
        <div className="text-center">
          <div className={`inline-flex items-center gap-2 text-2xl font-bold ${positionColor}`}>
            <PositionIcon className="h-6 w-6" />
            {positionLabel}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {Math.abs(percentDiff).toFixed(1)}% {percentDiff >= 0 ? 'above' : 'below'} median
          </p>
        </div>

        {/* Price Comparison */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 rounded-lg bg-gray-50">
            <p className="text-xs text-gray-500 uppercase">Your Price</p>
            <p className="text-lg font-bold text-gray-900">${dealerPpr.toFixed(3)}/rd</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-blue-50">
            <p className="text-xs text-blue-600 uppercase">Market Median</p>
            <p className="text-lg font-bold text-blue-700">${marketMedian.toFixed(3)}/rd</p>
          </div>
        </div>

        {/* Visual Range */}
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Low: ${(marketLow || rangeMin).toFixed(3)}</span>
            <span>High: ${(marketHigh || rangeMax).toFixed(3)}</span>
          </div>
          <div className="relative h-3 bg-gray-200 rounded-full">
            {/* Market range gradient */}
            <div
              className="absolute inset-y-0 bg-gradient-to-r from-green-400 via-blue-400 to-red-400 rounded-full"
              style={{ left: '0%', right: '0%' }}
            />

            {/* Median marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-blue-600"
              style={{ left: `${medianPosition}%` }}
            />

            {/* Dealer position marker */}
            <div
              className="absolute -top-1 -bottom-1 w-3 h-5 bg-gray-900 rounded border-2 border-white shadow"
              style={{ left: `calc(${dealerPosition}% - 6px)` }}
            />
          </div>
          <div className="flex justify-center mt-2">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <span className="w-3 h-3 bg-gray-900 rounded border border-white" /> Your price
              </span>
              <span className="flex items-center gap-1">
                <span className="w-0.5 h-3 bg-blue-600" /> Median
              </span>
            </div>
          </div>
        </div>

        {/* Market Stats */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="p-2 rounded bg-green-50">
            <p className="text-green-600">Market Low</p>
            <p className="font-medium text-green-700">${(marketLow || rangeMin).toFixed(3)}</p>
          </div>
          <div className="p-2 rounded bg-blue-50">
            <p className="text-blue-600">Median</p>
            <p className="font-medium text-blue-700">${marketMedian.toFixed(3)}</p>
          </div>
          <div className="p-2 rounded bg-red-50">
            <p className="text-red-600">Market High</p>
            <p className="font-medium text-red-700">${(marketHigh || rangeMax).toFixed(3)}</p>
          </div>
        </div>

        {/* Suggestion */}
        {position === 'above' && percentDiff > 15 && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-sm text-amber-800">
              <strong>Tip:</strong> Your price is significantly above market.
              Consider reviewing your pricing to stay competitive.
            </p>
          </div>
        )}

        {position === 'below' && percentDiff < -15 && (
          <div className="p-3 rounded-lg bg-green-50 border border-green-200">
            <p className="text-sm text-green-800">
              <strong>Great price!</strong> You're well below market on this product.
              This could be a strong seller.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
