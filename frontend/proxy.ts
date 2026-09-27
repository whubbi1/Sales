// frontend/proxy.ts
// Host-based routing for the Partner Portal. partner.wcomply.com serves the same
// Next.js app/deploy as the internal WHUBBI app, but every request on that host is
// confined to the /portal route tree — it never sees (and can never rewrite/redirect
// into) any internal module. The reverse also holds: the internal app's own domain
// can't reach /portal/* directly.
//
// Next.js 16 renamed "middleware" to "proxy" (same file convention, same
// NextRequest/NextResponse API) — see node_modules/next/dist/docs/.../proxy.md.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function isPartnerHost(hostname: string): boolean {
  return hostname === 'partner.wcomply.com' || hostname.startsWith('partner.')
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPartnerHost(request.nextUrl.hostname)) {
    if (pathname === '/portal' || pathname.startsWith('/portal/')) {
      return NextResponse.next()
    }
    const url = request.nextUrl.clone()
    url.pathname = `/portal${pathname === '/' ? '' : pathname}`
    return NextResponse.rewrite(url)
  }

  // Main WHUBBI domain — the portal route tree is only ever reached via
  // partner.wcomply.com above.
  if (pathname.startsWith('/portal')) {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif|css|js|map)$).*)',
  ],
}
