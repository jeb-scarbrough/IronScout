import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

const ADMIN_SITE_URL = process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.ironscout.ai';

// Cookie names vary by environment
const isProduction = process.env.NODE_ENV === 'production';
const cookieDomain = isProduction ? '.ironscout.ai' : undefined;

// All admin auth-related cookies that need to be cleared
// These use the 'admin-' prefix to avoid conflicts with the web app
const AUTH_COOKIES = isProduction
  ? [
      '__Secure-authjs.admin-session-token',
      '__Secure-authjs.admin-callback-url',
      '__Host-authjs.admin-csrf-token',
      '__Secure-authjs.admin-pkce.code_verifier',
      '__Secure-authjs.admin-state',
      '__Secure-authjs.admin-nonce',
    ]
  : [
      'authjs.admin-session-token',
      'authjs.admin-callback-url',
      'authjs.admin-csrf-token',
      'authjs.admin-pkce.code_verifier',
      'authjs.admin-state',
      'authjs.admin-nonce',
    ];

export async function GET() {
  const reqLogger = logger.child('logout');

  try {
    reqLogger.info('Admin logout request');

    const cookieStore = await cookies();

    // Clear all auth-related cookies
    for (const cookieName of AUTH_COOKIES) {
      // __Host- prefixed cookies cannot have a domain set
      const isHostPrefixed = cookieName.startsWith('__Host-');
      cookieStore.delete({
        name: cookieName,
        path: '/',
        domain: isHostPrefixed ? undefined : cookieDomain,
      });
    }

    reqLogger.info('Admin logout successful, redirecting to sign-in page');

    // Redirect to sign-in page so user can choose a different account
    return NextResponse.redirect(`${ADMIN_SITE_URL}/auth/signin`);
  } catch (error) {
    reqLogger.error('Admin logout failed', {}, error);
    // Still redirect to sign-in even on error
    return NextResponse.redirect(`${ADMIN_SITE_URL}/auth/signin`);
  }
}

export async function POST() {
  // Support POST as well for form submissions
  return GET();
}
