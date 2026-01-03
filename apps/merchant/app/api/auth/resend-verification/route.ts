import { NextResponse } from 'next/server';
import { prisma } from '@ironscout/db';
import { logger } from '@/lib/logger';
import { sendVerificationEmail } from '@/lib/email';

export async function POST(request: Request) {
  const requestId = crypto.randomUUID().slice(0, 8);
  const reqLogger = logger.child({ requestId, endpoint: '/api/auth/resend-verification' });
  
  reqLogger.info('Resend verification request received');
  
  try {
    let body: { email?: string };
    
    try {
      body = await request.json();
    } catch {
      reqLogger.warn('Failed to parse request body');
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { email } = body;

    if (!email) {
      reqLogger.warn('No email provided');
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    reqLogger.debug('Looking up merchant user by email', { email });

    // Find merchant user (include merchant for business name)
    const merchantUser = await prisma.merchant_users.findFirst({
      where: { email: email.toLowerCase() },
      include: { merchants: true },
    });

    // Always return success to prevent email enumeration
    if (!merchantUser) {
      reqLogger.warn('Merchant user not found for resend', { email });
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a verification email has been sent.',
      });
    }

    if (merchantUser.emailVerified) {
      reqLogger.info('Email already verified', { merchantUserId: merchantUser.id });
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a verification email has been sent.',
      });
    }

    // Generate new token if needed
    let verifyToken = merchantUser.verifyToken;
    if (!verifyToken) {
      verifyToken = crypto.randomUUID();
      await prisma.merchant_users.update({
        where: { id: merchantUser.id },
        data: { verifyToken },
      });
      reqLogger.debug('Generated new verification token', { merchantUserId: merchantUser.id });
    }

    // Send verification email
    reqLogger.debug('Sending verification email', { merchantUserId: merchantUser.id });
    const emailResult = await sendVerificationEmail(
      merchantUser.email,
      merchantUser.merchants.businessName,
      verifyToken
    );

    if (!emailResult.success) {
      reqLogger.error('Failed to send verification email', {
        merchantUserId: merchantUser.id,
        error: emailResult.error
      });
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again later.' },
        { status: 500 }
      );
    }

    reqLogger.info('Verification email resent', {
      merchantUserId: merchantUser.id,
      messageId: emailResult.messageId
    });

    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a verification email has been sent.',
    });
  } catch (error) {
    reqLogger.error('Resend verification failed', {}, error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
