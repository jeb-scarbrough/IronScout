import { NextResponse } from 'next/server';
import { clearSessionCookie, getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

const DEALER_SITE_URL = process.env.NEXT_PUBLIC_DEALER_URL || 'https://dealer.ironscout.ai';

export async function POST() {
  const reqLogger = logger.child({ endpoint: '/api/auth/logout' });

  try {
    const session = await getSession();

    if (session) {
      reqLogger.info('Logout request', {
        type: session.type,
        ...(session.type === 'dealer' ? { dealerId: session.dealerId } : { email: session.email })
      });
    } else {
      reqLogger.debug('Logout request with no active session');
    }

    await clearSessionCookie();

    reqLogger.info('Logout successful');

    return NextResponse.json({ success: true, redirectTo: DEALER_SITE_URL });
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
        ...(session.type === 'dealer' ? { dealerId: session.dealerId } : { email: session.email })
      });
    } else {
      reqLogger.debug('Logout request with no active session');
    }

    await clearSessionCookie();

    reqLogger.info('Logout successful, redirecting to dealer site');

    return NextResponse.redirect(DEALER_SITE_URL);
  } catch (error) {
    reqLogger.error('Logout failed', {}, error);
    return NextResponse.redirect(DEALER_SITE_URL);
  }
}
