import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CreateAliasForm } from './create-form';

export const dynamic = 'force-dynamic';

export default function CreateAliasPage() {
  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/brand-aliases"
        className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Brand Aliases
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create Brand Alias</h1>
        <p className="mt-1 text-sm text-gray-500">
          Map a brand variant to its canonical name for consistent search results
        </p>
      </div>

      {/* Form */}
      <div className="bg-white shadow rounded-lg">
        <CreateAliasForm />
      </div>

      {/* Help Text */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">About Brand Aliases</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>
            <strong>Alias:</strong> The variant brand name found in feeds (e.g., "Federal Ammunition")
          </li>
          <li>
            <strong>Canonical:</strong> The standard brand name to map to (e.g., "Federal Premium")
          </li>
          <li>
            <strong>Normalization:</strong> Both names are automatically normalized (lowercase, stripped suffixes, etc.)
          </li>
          <li>
            <strong>Draft Status:</strong> New aliases start as DRAFT and must be activated to take effect
          </li>
          <li>
            <strong>Auto-activation:</strong> Low-impact aliases from feeds may be auto-activated
          </li>
        </ul>
      </div>
    </div>
  );
}
