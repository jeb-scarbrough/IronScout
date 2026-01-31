/**
 * Debug endpoint for diagnosing authentication issues
 * Only enabled when ADMIN_DEBUG=true AND user is authenticated admin
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminSession } from '@/lib/auth';

const SESSION_COOKIE_NAME = process.env.NODE_ENV === 'production'
  ? '__Secure-authjs.session-token'
  : 'authjs.session-token';

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

export async function GET() {
  // Only allow in debug mode
  if (process.env.ADMIN_DEBUG !== 'true') {
    return NextResponse.json({ error: 'Debug mode not enabled' }, { status: 403 });
  }

  // SECURITY: Require admin authentication even with debug flag
  const adminSession = await getAdminSession();
  if (!adminSession) {
    return NextResponse.json({ error: 'Admin authentication required' }, { status: 401 });
  }

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  // SECURITY: Only expose non-sensitive diagnostic info
  return NextResponse.json({
    environment: {
      NODE_ENV: process.env.NODE_ENV,
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      // REMOVED: secretLength (security hint for attackers)
      adminEmailsConfigured: ADMIN_EMAILS.length > 0,
      adminEmailsCount: ADMIN_EMAILS.length,
      // REMOVED: adminEmails array (PII - targeted phishing risk)
    },
    cookies: {
      expectedCookieName: SESSION_COOKIE_NAME,
      availableCookieNames: allCookies.map(c => c.name),
      hasSessionCookie: !!sessionCookie,
      sessionCookieLength: sessionCookie?.value?.length || 0,
    },
    hints: [
      !sessionCookie && 'No session cookie found - user needs to log in at main site first',
      !process.env.NEXTAUTH_SECRET && 'NEXTAUTH_SECRET not configured',
      ADMIN_EMAILS.length === 0 && 'ADMIN_EMAILS not configured',
    ].filter(Boolean),
    authenticatedAs: adminSession.email,
  });
}
