import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CreateTargetForm } from './create-form'

export default function CreateTargetPage() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <Link
          href="/scrapers"
          className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Scrapers
        </Link>
      </div>

      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold text-gray-900">Add Scrape Target</h1>
        <p className="mt-2 text-sm text-gray-700">
          Configure a new URL for price scraping.
        </p>

        <div className="mt-8 bg-white shadow rounded-lg">
          <CreateTargetForm />
        </div>
      </div>
    </div>
  )
}
