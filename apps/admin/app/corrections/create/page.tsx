import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CreateCorrectionForm } from './create-form';

export const dynamic = 'force-dynamic';

export default function CreateCorrectionPage() {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/corrections"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Corrections
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create Price Correction</h1>
        <p className="mt-1 text-sm text-gray-500">
          Create a new correction overlay to adjust how price data is displayed to consumers
        </p>
      </div>

      {/* Form */}
      <div className="bg-white shadow rounded-lg">
        <CreateCorrectionForm />
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">About Price Corrections</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>
            <strong>IGNORE:</strong> Prices matching the scope and time range will be hidden from consumers
          </li>
          <li>
            <strong>MULTIPLIER:</strong> Prices will be adjusted by the specified factor (e.g., 0.9 = 10% discount)
          </li>
          <li>
            <strong>Scope Precedence:</strong> More specific scopes override less specific ones:
            PRODUCT &gt; RETAILER &gt; MERCHANT &gt; SOURCE &gt; AFFILIATE &gt; FEED_RUN
          </li>
          <li>
            <strong>Time Range:</strong> Corrections only apply to prices with observedAt within the range
          </li>
          <li>
            Corrections are never deleted - they can only be revoked (soft-delete)
          </li>
        </ul>
      </div>
    </div>
  );
}
