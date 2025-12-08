import { NextResponse } from 'next/server';
import { clearSessionCookie, getSession } from '@/lib/auth';
import { logger } from '@/lib/logger';

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
    
    return NextResponse.json({ success: true });
  } catch (error) {
    reqLogger.error('Logout failed', {}, error);
    return NextResponse.json(
      { error: 'Logout failed' },
      { status: 500 }
    );
  }
}
