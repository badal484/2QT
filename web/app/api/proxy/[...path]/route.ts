import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = (process.env.BACKEND_URL || 'https://twoqt-1.onrender.com/api/v1').replace(/\/$/, '');
const TARGET_BASE = BACKEND_URL.endsWith('/api/v1') ? BACKEND_URL : `${BACKEND_URL}/api/v1`;

async function handleProxy(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  const pathStr = (resolvedParams.path || []).join('/');
  const searchParams = req.nextUrl.search;
  const targetUrl = `${TARGET_BASE}/${pathStr}${searchParams}`;

  const headers = new Headers(req.headers);
  headers.delete('host');
  headers.delete('connection');

  try {
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.blob();

    const backendRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
    });

    const resHeaders = new Headers(backendRes.headers);
    resHeaders.delete('transfer-encoding');

    const data = await backendRes.arrayBuffer();
    return new NextResponse(data, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: resHeaders,
    });
  } catch (err: any) {
    console.error('[API Proxy Error]', err);
    return NextResponse.json(
      { error: 'PROXY_ERROR', message: err.message || 'Failed to connect to backend server' },
      { status: 502 }
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const OPTIONS = handleProxy;
