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

    reqLogger.debug('Looking up dealer user by email', { email });

    // Find dealer user (include dealer for business name)
    const dealerUser = await prisma.dealerUser.findFirst({
      where: { email: email.toLowerCase() },
      include: { dealer: true },
    });

    // Always return success to prevent email enumeration
    if (!dealerUser) {
      reqLogger.warn('Dealer user not found for resend', { email });
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a verification email has been sent.',
      });
    }

    if (dealerUser.emailVerified) {
      reqLogger.info('Email already verified', { dealerUserId: dealerUser.id });
      return NextResponse.json({
        success: true,
        message: 'If an account with that email exists, a verification email has been sent.',
      });
    }

    // Generate new token if needed
    let verifyToken = dealerUser.verifyToken;
    if (!verifyToken) {
      verifyToken = crypto.randomUUID();
      await prisma.dealerUser.update({
        where: { id: dealerUser.id },
        data: { verifyToken },
      });
      reqLogger.debug('Generated new verification token', { dealerUserId: dealerUser.id });
    }

    // Send verification email
    reqLogger.debug('Sending verification email', { dealerUserId: dealerUser.id });
    const emailResult = await sendVerificationEmail(
      dealerUser.email,
      dealerUser.dealer.businessName,
      verifyToken
    );

    if (!emailResult.success) {
      reqLogger.error('Failed to send verification email', { 
        dealerUserId: dealerUser.id,
        error: emailResult.error 
      });
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again later.' },
        { status: 500 }
      );
    }

    reqLogger.info('Verification email resent', { 
      dealerUserId: dealerUser.id,
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
