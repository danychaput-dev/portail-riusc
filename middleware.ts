import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// --- Rate limiting en mémoire (par IP) ---
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanupRateLimitMap() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, val] of rateLimitMap) {
    if (now > val.resetTime) rateLimitMap.delete(key);
  }
}

const RATE_LIMITS: { pattern: string; maxRequests: number; windowSeconds: number }[] = [
  { pattern: '/login', maxRequests: 10, windowSeconds: 60 },
  { pattern: '/api/admin/', maxRequests: 60, windowSeconds: 60 },
  { pattern: '/api/impersonate', maxRequests: 5, windowSeconds: 60 },
  { pattern: '/api/webhooks/', maxRequests: 30, windowSeconds: 60 },
  { pattern: '/inscription', maxRequests: 10, windowSeconds: 60 },
];

function checkRateLimit(ip: string, pathname: string): boolean {
  const rule = RATE_LIMITS.find(r => pathname.startsWith(r.pattern));
  if (!rule) return true;

  const key = `${ip}:${rule.pattern}`;
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + rule.windowSeconds * 1000 });
    return true;
  }

  entry.count++;
  return entry.count <= rule.maxRequests;
}

// --- Middleware principal ---
const EXCLUDED = ['/_next', '/api', '/favicon', '/login', '/maintenance', '/inscription', '/logo.png', '/icons', '/manifest.json', '/dashboard'];

export async function middleware(request: NextRequest) {
  // Mode maintenance
  if (process.env.NEXT_PUBLIC_MAINTENANCE === 'true') {
    return NextResponse.rewrite(new URL('/maintenance', request.url));
  }

  cleanupRateLimitMap();

  // Rate limiting par IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('cf-connecting-ip')
    || 'unknown';
  const pathname = request.nextUrl.pathname;

  if (!checkRateLimit(ip, pathname)) {
    return NextResponse.json(
      { error: 'Trop de requetes. Veuillez reessayer dans quelques instants.' },
      { status: 429, headers: { 'Retry-After': '60' } }
    );
  }

  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    if (!EXCLUDED.some(e => pathname.startsWith(e))) {
      const benevole_id = request.cookies.get('benevole_id')?.value || null;

      fetch(`${request.nextUrl.origin}/api/audit/log-page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          benevole_id,
          page: pathname
        })
      }).catch(() => {});
    }
  }

  return res;
}

export const config = {
  matcher: ['/((?!maintenance|_next/static|_next/image|favicon.ico).*)'],
};
