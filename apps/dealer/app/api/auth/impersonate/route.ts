import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@ironscout/db';

const DEALER_JWT_SECRET = new TextEncoder().encode(
  process.env.DEALER_JWT_SECRET || process.env.NEXTAUTH_SECRET || 'dealer-secret-change-me'
);

// This endpoint receives a one-time impersonation token from admin
// and exchanges it for a dealer session cookie
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=missing_token', request.url));
  }

  try {
    // Verify the impersonation token
    const { payload } = await jwtVerify(token, DEALER_JWT_SECRET);

    // Check if this is an impersonation token
    if (!payload.isImpersonating) {
      return NextResponse.redirect(new URL('/login?error=invalid_token', request.url));
    }

    // Verify the dealer still exists and is valid
    const dealerUser = await prisma.dealerUser.findUnique({
      where: { id: payload.dealerUserId as string },
      include: { dealer: true },
    });

    if (!dealerUser) {
      return NextResponse.redirect(new URL('/login?error=dealer_not_found', request.url));
    }

    // Create a fresh session token
    const sessionToken = await new SignJWT({
      dealerUserId: dealerUser.id,
      dealerId: dealerUser.dealerId,
      email: dealerUser.email,
      name: dealerUser.name,
      role: dealerUser.role,
      businessName: dealerUser.dealer.businessName,
      status: dealerUser.dealer.status,
      tier: dealerUser.dealer.tier,
      // Keep impersonation metadata
      isImpersonating: true,
      impersonatedBy: payload.impersonatedBy,
      impersonatedAt: payload.impersonatedAt,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('4h')
      .sign(DEALER_JWT_SECRET);

    // Set the session cookie
    const cookieStore = await cookies();
    cookieStore.set('dealer-session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 4, // 4 hours
      path: '/',
    });

    // Set impersonation indicator cookie (readable by client)
    cookieStore.set('dealer-impersonation', JSON.stringify({
      adminEmail: payload.impersonatedBy,
      dealerName: dealerUser.dealer.businessName,
      startedAt: payload.impersonatedAt,
    }), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 4,
      path: '/',
    });

    // Redirect to dashboard
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('Impersonation error:', error);
    return NextResponse.redirect(new URL('/login?error=invalid_token', request.url));
  }
}
