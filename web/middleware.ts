import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files, api routes, and admin routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/prelaunch') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|webp|avif|woff2|woff|css|js)$/)
  ) {
    return NextResponse.next();
  }

  // Temporary: If we are on Vercel and BACKEND_URL is not set, don't try to fetch localhost.
  // We'll just redirect root to /prelaunch.
  const apiUrl = process.env.BACKEND_URL || 'http://localhost:8000/api/v1';
  
  if (pathname === '/' && apiUrl.includes('localhost')) {
    return NextResponse.redirect(new URL('/prelaunch', request.url));
  } else if (!apiUrl.includes('localhost')) {
    try {
      const response = await fetch(`${apiUrl}/prelaunch/config`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.isPrelaunch) {
          return NextResponse.redirect(new URL('/prelaunch', request.url));
        }
      }
    } catch (error) {
      console.error('Middleware prelaunch check failed:', error);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
