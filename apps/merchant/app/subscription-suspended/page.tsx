import { Ban, Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getSessionWithMerchant } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { checkSubscriptionStatus } from '@/lib/subscription';

export default async function SubscriptionSuspendedPage() {
  const result = await getSessionWithMerchant();

  // If not logged in, redirect to login
  if (!result || result.session.type !== 'merchant' || !result.merchant) {
    redirect('/login');
  }

  const { session, merchant } = result;
  const isImpersonating = session.type === 'merchant' && session.isImpersonating;

  // Check if user should actually be here
  const subscriptionStatus = checkSubscriptionStatus(merchant, isImpersonating);
  if (subscriptionStatus.redirectTo !== '/subscription-suspended') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-6">
          <Ban className="h-8 w-8 text-orange-600" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Account Suspended
        </h1>

        {/* Business name */}
        <p className="text-gray-600 mb-6">
          {merchant.businessName}
        </p>

        {/* Message */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
          <p className="text-orange-800 text-sm">
            Your merchant account has been suspended. This may be due to a payment
            issue, policy violation, or administrative action.
          </p>
        </div>

        {/* What to do */}
        <div className="text-left mb-6">
          <h2 className="font-semibold text-gray-900 mb-2">What to do next:</h2>
          <ul className="text-sm text-gray-600 space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-orange-500 font-bold">1.</span>
              Check your email for any communications from IronScout
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500 font-bold">2.</span>
              Contact our support team to understand the suspension reason
            </li>
            <li className="flex items-start gap-2">
              <span className="text-orange-500 font-bold">3.</span>
              Resolve any outstanding issues to restore access
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <a
            href={`mailto:support@ironscout.ai?subject=Account%20Suspension%20Inquiry%20-%20${encodeURIComponent(merchant.businessName)}`}
            className="flex items-center justify-center gap-2 w-full bg-orange-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-orange-700 transition-colors"
          >
            <Mail className="h-5 w-5" />
            Contact Support
          </a>
        </div>

        {/* Logout link */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <Link
            href="/api/auth/logout"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Sign out
          </Link>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-sm text-gray-500">
        Need immediate assistance? Call us at{' '}
        <a href="tel:+1-555-IRONSCOUT" className="text-blue-600 hover:underline">
          1-555-IRONSCOUT
        </a>
      </p>
    </div>
  );
}
