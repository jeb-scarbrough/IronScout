import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CreateSourceForm } from './create-source-form';

export const dynamic = 'force-dynamic';

export default function CreateSourcePage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/sources"
          className="p-2 rounded-md hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Source</h1>
          <p className="mt-1 text-sm text-gray-500">
            Configure a new data source for product ingestion
          </p>
        </div>
      </div>

      <CreateSourceForm />
    </div>
  );
}
