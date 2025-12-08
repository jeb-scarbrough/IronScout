import { NextResponse } from 'next/server';
import { authenticateDealer, setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const result = await authenticateDealer(email, password);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }

    // Set session cookie
    await setSessionCookie(result.token!);

    return NextResponse.json({
      success: true,
      dealer: {
        id: result.dealer!.id,
        email: result.dealer!.email,
        businessName: result.dealer!.businessName,
        status: result.dealer!.status,
        tier: result.dealer!.tier,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
