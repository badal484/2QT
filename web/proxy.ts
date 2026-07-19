import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:8000/api/v1';
const TTL = 30_000;

let _cache: { on: boolean; t: number } | null = null;

async function gateEnabled(): Promise<boolean> {
  if (_cache && Date.now() - _cache.t < TTL) return _cache.on;
  try {
    const res = await fetch(`${BACKEND}/prelaunch/config`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2000),
    });
    const data = await res.json();
    const on = data.isPrelaunch === true || data.isPrelaunch === 'true';
    _cache = { on, t: Date.now() };
    return on;
  } catch {
    return _cache?.on ?? false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (
    pathname.startsWith('/prelaunch') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/kitchen-portal') ||
    pathname.startsWith('/finance') ||
    pathname === '/favicon.ico' ||
    /\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|woff2?|ttf|otf|mp3|mp4|txt|xml)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (await gateEnabled()) {
    return NextResponse.redirect(new URL('/prelaunch', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
