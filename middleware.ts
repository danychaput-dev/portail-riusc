import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_MAINTENANCE === 'true') {
    return NextResponse.rewrite(new URL('/maintenance', request.url))
  }
}

export const config = {
  matcher: ['/((?!maintenance|_next/static|_next/image|favicon.ico).*)'],
}