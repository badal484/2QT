import { NextRequest, NextResponse } from 'next/server';

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icon-|apple-touch-icon|manifest.json|sw.js|workbox-).*)',
  ],
};

const BACKEND_BASE = (process.env.BACKEND_URL || 'http://localhost:8000/api/v1')
  .replace(/\/api\/v1\/?$/, '')
  .replace(/\/$/, '');

const CACHE_SECONDS = 30;

const ALLOWED_PREFIXES = ['/prelaunch', '/admin', '/api'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (ALLOWED_PREFIXES.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Use cached cookie to avoid hitting backend on every request
  const cached = req.cookies.get('__prelaunch_gate');
  let isPrelaunch: boolean;

  if (cached) {
    isPrelaunch = cached.value === '1';
  } else {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${BACKEND_BASE}/api/v1/prelaunch/config`, {
        signal: controller.signal,
        cache: 'no-store',
      });
      clearTimeout(timer);
      const data: { isPrelaunch?: boolean } = await res.json().catch(() => ({}));
      isPrelaunch = Boolean(data.isPrelaunch);
    } catch {
      isPrelaunch = false; // fail open — don't block if backend is down
    }

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
