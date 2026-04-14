import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/api/login',
  '/api/logout',
  '/api/chatapi', // Uses Basic Auth instead of session
  '/api/cron/',   // Cron endpoints use Bearer token auth
  '/login',
  '/_next',
  '/favicon',
  '/api/upload', // adjust as needed
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get('auth_token')?.value;

  // Allow internal cron pipeline calls authenticated via Bearer token
  if (!token) {
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      return NextResponse.next();
    }
  }

  if (!token) {
    if (pathname === '/' || pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
      const url = req.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }
    return new NextResponse('Unauthorized', { status: 401 });
  }
  // No strict validation (stateless) – for stricter check, an in-memory session map would need sharing.
  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*', '/admin', '/dashboard', '/login'],
};
