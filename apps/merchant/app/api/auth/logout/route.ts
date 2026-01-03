import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { clearSessionCookie, getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

// Force dynamic rendering - this route uses cookies for auth
export const dynamic = 'force-dynamic';

const MERCHANT_SITE_URL = process.env.NEXT_PUBLIC_MERCHANT_URL || 'https://merchant.ironscout.ai';

// Clear both session and impersonation cookies
async function clearAllSessionCookies(): Promise<void> {
  const cookieStore = await cookies();

  // Clear merchant session cookies
  cookieStore.delete('merchant-session');

  // Clear impersonation indicator cookies
  cookieStore.delete('merchant-impersonation');
}

export async function POST() {
  const reqLogger = logger.child({ endpoint: '/api/auth/logout' });

  try {
    const session = await getSession();

    if (session) {
      reqLogger.info('Logout request', {
        type: session.type,
        ...(session.type === 'merchant'
          ? {
              merchantId: session.merchantId,
              isImpersonating: session.isImpersonating || false
            }
          : { email: session.email }
        )
      });
    } else {
      reqLogger.debug('Logout request with no active session');
    }

    await clearAllSessionCookies();

    reqLogger.info('Logout successful');

    return NextResponse.json({ success: true, redirectTo: MERCHANT_SITE_URL });
  } catch (error) {
    reqLogger.error('Logout failed', {}, error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  const reqLogger = logger.child({ endpoint: '/api/auth/logout' });

  try {
    const session = await getSession();

    if (session) {
      reqLogger.info('Logout request (GET)', {
        type: session.type,
        ...(session.type === 'merchant'
          ? {
              merchantId: session.merchantId,
              isImpersonating: session.isImpersonating || false
            }
          : { email: session.email }
        )
      });
    } else {
      reqLogger.debug('Logout request with no active session');
    }

    await clearAllSessionCookies();

    reqLogger.info('Logout successful, redirecting to merchant site');

    return NextResponse.redirect(MERCHANT_SITE_URL);
  } catch (error) {
    reqLogger.error('Logout failed', {}, error);
    return NextResponse.redirect(MERCHANT_SITE_URL);
  }
}
