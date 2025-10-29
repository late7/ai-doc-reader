import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/api/login',
  '/api/logout',
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
