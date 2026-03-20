import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const EXCLUDED = ['/_next', '/api', '/favicon', '/login', '/maintenance', '/inscription'];

export async function middleware(request: NextRequest) {
  // Mode maintenance — priorité absolue
  if (process.env.NEXT_PUBLIC_MAINTENANCE === 'true') {
    return NextResponse.rewrite(new URL('/maintenance', request.url));
  }

  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req: request, res });
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    const pathname = request.nextUrl.pathname;

    if (!EXCLUDED.some(e => pathname.startsWith(e))) {
      const benevole_id = request.cookies.get('benevole_id')?.value || null;

      fetch(`${request.nextUrl.origin}/api/audit/page`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: session.user.id,
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