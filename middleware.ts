import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const EXCLUDED = ['/_next', '/api', '/favicon', '/login', '/maintenance', '/inscription', '/logo.png', '/icons', '/manifest.json'];

export async function middleware(request: NextRequest) {
  // Mode maintenance — priorité absolue
  if (process.env.NEXT_PUBLIC_MAINTENANCE === 'true') {
    return NextResponse.rewrite(new URL('/maintenance', request.url));
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
    const pathname = request.nextUrl.pathname;

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