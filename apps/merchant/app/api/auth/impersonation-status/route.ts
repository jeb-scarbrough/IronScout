import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Returns impersonation status from the httpOnly session cookie.
 * Used by the client-side impersonation banner (#177).
 */
export async function GET() {
  const session = await getSession();

  if (!session || session.type !== 'merchant' || !session.isImpersonating) {
    return NextResponse.json({ active: false });
  }

  return NextResponse.json({
    active: true,
    merchantName: session.businessName ?? null,
  });
}
