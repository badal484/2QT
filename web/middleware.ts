import { NextRequest, NextResponse } from 'next/server';

// Paths always accessible — staff portals, legal pages, static assets, API routes
const ALWAYS_ALLOW = [
  '/prelaunch',
  '/terms',
  '/privacy',
  '/refund',
  '/become-a-rider',
  '/admin',
  '/kitchen',
  '/kitchen-portal',
  '/rider',
  '/finance',
  '/partner',
  '/restaurant',
  '/support',
  '/live-kitchen',
  '/offline',
  '/_next',
  '/api',
  '/favicon',
  '/icon',
  '/apple-touch',
  '/manifest.json',
  '/og-image',
  '/sw.js',
  '/robots.txt',
  '/sitemap.xml',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static file extensions
  if (/\.(ico|png|jpg|jpeg|svg|webp|avif|woff2|woff|json|txt|xml|js|css|map)$/.test(pathname)) {
    return NextResponse.next();
  }

  // Always allow staff portals, legal pages, prelaunch itself, and Next.js internals
  if (ALWAYS_ALLOW.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  // Check prelaunch gate — set IS_PRELAUNCH_MODE=true in Vercel env vars to lock the site
  const isPrelaunch = process.env.IS_PRELAUNCH_MODE === 'true';
  if (isPrelaunch) {
    const url = request.nextUrl.clone();
    url.pathname = '/prelaunch';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all routes except static Next.js build output
  matcher: ['/((?!_next/static|_next/image).*)'],
};
