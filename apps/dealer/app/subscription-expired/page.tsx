import { XCircle, CreditCard, Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { getSessionWithDealer } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { checkSubscriptionStatus } from '@/lib/subscription';

export default async function SubscriptionExpiredPage() {
  const result = await getSessionWithDealer();

  // If not logged in, redirect to login
  if (!result || result.session.type !== 'dealer' || !result.dealer) {
    redirect('/login');
  }

  const { session, dealer } = result;
  const isImpersonating = session.type === 'dealer' && session.isImpersonating;

  // Check if user should actually be here
  const subscriptionStatus = checkSubscriptionStatus(dealer, isImpersonating);
  if (subscriptionStatus.accessLevel !== 'blocked') {
    redirect('/dashboard');
  }

  const expiryDate = dealer.subscriptionExpiresAt
    ? new Date(dealer.subscriptionExpiresAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        {/* Icon */}
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
          <XCircle className="h-8 w-8 text-red-600" />
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Subscription Expired
        </h1>

        {/* Business name */}
        <p className="text-gray-600 mb-6">
          {dealer.businessName}
        </p>

        {/* Details */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="text-gray-500">Plan</span>
            <span className="font-medium text-gray-900">{dealer.tier}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-200">
            <span className="text-gray-500">Expired On</span>
            <span className="font-medium text-red-600">{expiryDate}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-gray-500">Days Overdue</span>
            <span className="font-medium text-red-600">
              {subscriptionStatus.daysOverdue} days
            </span>
          </div>
        </div>

        {/* Message */}
        <p className="text-gray-600 text-sm mb-6">
          Your subscription has expired and your grace period has ended.
          Renew now to restore access to your dealer portal and resume
          automatic feed processing.
        </p>

        {/* Actions */}
        <div className="space-y-3">
          <Link
            href="/settings"
            className="flex items-center justify-center gap-2 w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            <CreditCard className="h-5 w-5" />
            Renew Subscription
          </Link>

          <a
            href="mailto:support@ironscout.ai?subject=Subscription%20Renewal%20Inquiry"
            className="flex items-center justify-center gap-2 w-full border border-gray-300 text-gray-700 py-3 px-4 rounded-lg font-medium hover:bg-gray-50 transition-colors"
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
        Need help? Email us at{' '}
        <a href="mailto:support@ironscout.ai" className="text-blue-600 hover:underline">
          support@ironscout.ai
        </a>
      </p>
    </div>
  );
}
