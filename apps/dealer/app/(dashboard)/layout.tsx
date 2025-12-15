import { getSessionWithDealer } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { ImpersonationBanner } from '@/components/impersonation-banner';
import { SubscriptionBanner } from '@/components/subscription-banner';
import { checkSubscriptionStatus } from '@/lib/subscription';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const result = await getSessionWithDealer();

  if (!result) {
    redirect('/login');
  }

  const { session, dealer } = result;

  // Check subscription status for dealer sessions
  let subscriptionStatus = null;
  if (session.type === 'dealer' && dealer) {
    const isImpersonating = session.isImpersonating ?? false;
    subscriptionStatus = checkSubscriptionStatus(dealer, isImpersonating);

    // Redirect if blocked (past grace period)
    if (subscriptionStatus.accessLevel === 'blocked' && subscriptionStatus.redirectTo) {
      redirect(subscriptionStatus.redirectTo);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Impersonation Banner */}
      <ImpersonationBanner />

      {/* Subscription Warning/Error Banner */}
      {subscriptionStatus?.bannerMessage && (
        <SubscriptionBanner
          message={subscriptionStatus.bannerMessage}
          type={subscriptionStatus.bannerType || 'warning'}
        />
      )}

      {/* Sidebar */}
      <Sidebar session={session} />

      {/* Main content */}
      <div className="lg:pl-64">
        <Header session={session} />

        <main className="py-6">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
