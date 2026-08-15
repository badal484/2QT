import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const runtime = 'edge';

const BACKEND = process.env.BACKEND_URL || 'http://localhost:8000/api/v1';
const TTL = 30_000;
const BYPASS_COOKIE = 'prelaunch_bypass';
const BYPASS_SECRET = process.env.PRELAUNCH_BYPASS_SECRET;

let _cache: { on: boolean; t: number } | null = null;

async function gateEnabled(): Promise<boolean> {
  if (_cache && Date.now() - _cache.t < TTL) return _cache.on;
  try {
    const res = await fetch(`${BACKEND}/prelaunch/config`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return false;
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

  // Preview-link bypass: visiting once with ?preview_key=<secret> sets a cookie so the
  // site owner can see the real site while everyone else still sees /prelaunch.
  const previewKey = req.nextUrl.searchParams.get('preview_key');
  if (BYPASS_SECRET && previewKey === BYPASS_SECRET) {
    const url = new URL(req.url);
    url.searchParams.delete('preview_key');
    const res = NextResponse.redirect(url);
    res.cookies.set(BYPASS_COOKIE, BYPASS_SECRET, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 90,
      path: '/',
    });
    return res;
  }
  if (BYPASS_SECRET && req.cookies.get(BYPASS_COOKIE)?.value === BYPASS_SECRET) {
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
