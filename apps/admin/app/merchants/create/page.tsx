import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { CreateMerchantForm } from './create-merchant-form';

export default function CreateMerchantPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/merchants"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Merchant</h1>
          <p className="mt-1 text-sm text-gray-500">
            Create a new merchant account
          </p>
        </div>
      </div>

      <CreateMerchantForm />
    </div>
  );
}
