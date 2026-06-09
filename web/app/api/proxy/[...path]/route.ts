import { NextRequest, NextResponse } from 'next/server';

// Server-side env var — NOT NEXT_PUBLIC — read at request time on Vercel.
// Change BACKEND_URL in the Vercel dashboard; no code push or rebuild needed.
const BACKEND = (process.env.BACKEND_URL || 'http://localhost:8000/api/v1').replace(/\/$/, '');

async function handler(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  const { path } = await context.params;
  const targetUrl = `${BACKEND}/${path.join('/')}${req.nextUrl.search}`;

  const headers = new Headers();
  const auth = req.headers.get('authorization');
  const ct = req.headers.get('content-type');
  if (auth) headers.set('authorization', auth);
  if (ct) headers.set('content-type', ct);

  let body: ArrayBuffer | undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await req.arrayBuffer();
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: body?.byteLength ? body : undefined,
    });

    const resHeaders = new Headers();
    upstream.headers.forEach((v, k) => {
      if (!['transfer-encoding', 'connection'].includes(k.toLowerCase())) {
        resHeaders.set(k, v);
      }
    });

    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    });
  } catch {
    return NextResponse.json({ error: 'BACKEND_UNREACHABLE' }, { status: 503 });
  }
}

export const GET     = handler;
export const POST    = handler;
export const PATCH   = handler;
export const PUT     = handler;
export const DELETE  = handler;
export const OPTIONS = handler;
# proxy-route
