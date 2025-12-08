import { BarChart3 } from 'lucide-react';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-500">
          Platform-wide analytics and reporting
        </p>
      </div>

      <div className="bg-white shadow rounded-lg p-12 text-center">
        <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Coming Soon</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          Platform analytics including total clicks, revenue attribution, 
          dealer performance metrics, and more.
        </p>
      </div>
    </div>
  );
}
