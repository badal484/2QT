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

  try {
    // Check if prelaunch mode is active from the backend
    const apiUrl = process.env.BACKEND_URL || 'http://localhost:8000/api/v1';
    const response = await fetch(`${apiUrl}/prelaunch/config`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      // Use next.revalidate to cache this edge config heavily if needed, but for now we fetch it fresh
      next: { revalidate: 60 } 
    });

    if (response.ok) {
      const data = await response.json();
      if (data.isPrelaunch) {
        // Redirect everyone else to the prelaunch landing page
        return NextResponse.redirect(new URL('/prelaunch', request.url));
      }
    }
  } catch (error) {
    // If backend is down or unreachable, just continue so we don't break the whole app
    console.error('Middleware prelaunch check failed:', error);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
