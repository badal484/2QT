import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: [
    // Match everything except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|icon-|apple-touch-icon|manifest.json|sw.js|workbox-).*)',
  ],
};

const BACKEND = (process.env.BACKEND_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');
const CACHE_SECONDS = 30;

// Paths that are ALWAYS accessible even when prelaunch gate is ON
const ALLOWED_PREFIXES = ['/prelaunch', '/admin', '/api'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow: admin panel, prelaunch page itself, API routes
  if (ALLOWED_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check cached gate status in cookie (avoid hitting backend on every request)
  const cached = req.cookies.get('__prelaunch_gate');
  let isPrelaunch: boolean;

  if (cached) {
    isPrelaunch = cached.value === '1';
  } else {
    // Fetch gate status from backend
    try {
      const res = await fetch(`${BACKEND.replace('/api/v1', '')}/api/v1/prelaunch/config`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        // Short timeout so a down backend doesn't block every page load
        signal: AbortSignal.timeout(3000),
      });
      const data = await res.json().catch(() => ({}));
      isPrelaunch = Boolean(data.isPrelaunch);
    } catch {
      // If backend is unreachable, don't block — fail open
      isPrelaunch = false;
    }

    // Cache the result in a cookie for CACHE_SECONDS
    const response = isPrelaunch
      ? NextResponse.redirect(new URL('/prelaunch', req.url))
      : NextResponse.next();

    response.cookies.set('__prelaunch_gate', isPrelaunch ? '1' : '0', {
      maxAge: CACHE_SECONDS,
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
    });
    return response;
  }

  if (isPrelaunch) {
    return NextResponse.redirect(new URL('/prelaunch', req.url));
  }

  return NextResponse.next();
}
