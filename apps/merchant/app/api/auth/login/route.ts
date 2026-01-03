import { NextResponse } from 'next/server';
import { authenticateMerchant, setSessionCookie } from '@/lib/auth';
import { logger } from '@/lib/logger';

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const reqLogger = logger.child({ requestId, endpoint: '/api/auth/login' });

  reqLogger.info('Login request received');

  try {
    let body: { email?: string; password?: string };

    try {
      body = await request.json();
      reqLogger.debug('Request body parsed successfully');
    } catch (parseError) {
      reqLogger.warn('Failed to parse request body', {}, parseError);
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { email, password } = body;

    if (!email || !password) {
      reqLogger.warn('Login failed - missing credentials', {
        hasEmail: !!email,
        hasPassword: !!password
      });
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    reqLogger.debug('Authenticating merchant', { email });
    const result = await authenticateMerchant(email, password);

    if (!result.success) {
      reqLogger.warn('Login failed', { email, reason: result.error });
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }

    // Set session cookie
    reqLogger.debug('Setting session cookie', {
      merchantId: result.merchant!.id,
      merchantUserId: result.merchantUser!.id
    });
    await setSessionCookie(result.token!);

    reqLogger.info('Login successful', {
      merchantId: result.merchant!.id,
      merchantUserId: result.merchantUser!.id,
      email: result.merchantUser!.email,
      role: result.merchantUser!.role,
      status: result.merchant!.status
    });

    return NextResponse.json({
      success: true,
      merchant: {
        id: result.merchant!.id,
        businessName: result.merchant!.businessName,
        status: result.merchant!.status,
        tier: result.merchant!.tier,
      },
      user: {
        id: result.merchantUser!.id,
        email: result.merchantUser!.email,
        name: result.merchantUser!.name,
        role: result.merchantUser!.role,
      },
    });
  } catch (error) {
    reqLogger.error('Login failed - unexpected error', {}, error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
