import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Debug: Log all cookies received by middleware
  const cookies = request.cookies.getAll();
  console.log('[admin] [MIDDLEWARE] Request URL:', request.url);
  console.log('[admin] [MIDDLEWARE] Cookies received:', cookies.map(c => c.name));
  
  const sessionCookie = request.cookies.get('__Secure-authjs.session-token');
  console.log('[admin] [MIDDLEWARE] Session cookie present:', !!sessionCookie);
  
  // Allow the request to continue - auth check happens in layout
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
