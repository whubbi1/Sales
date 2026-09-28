// frontend/middleware.ts
// Host-based routing for the Portal (customer and partner contacts). portal.wcomply.com
// serves the same Next.js app/deploy as the internal WHUBBI app, but every request on
// that host is confined to the /portal route tree — it never sees (and can never
// rewrite/redirect into) any internal module. The reverse also holds: the internal
// app's own domain can't reach /portal/* directly.
//
// Deliberately named middleware.ts, not Next.js 16's newer proxy.ts — same mechanism
// ("functionality remains the same" per Next's own docs, just deprecated naming), but
// AWS Amplify Hosting's SSR build/runtime does not yet recognize proxy.ts as the edge
// function entry point.
//
// Uses the raw Host/X-Forwarded-Host request headers, not request.nextUrl.hostname —
// on Amplify Hosting the latter is a placeholder ("0.0.0.0"), not the actual custom
// domain the browser requested, confirmed via a temporary diagnostic header dump in
// production. A hostname.startsWith('portal.') check against nextUrl.hostname was
// therefore always false, so no rewrite ever fired.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function requestHostname(request: NextRequest): string {
  const raw = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.hostname
  return raw.split(':')[0] // strip a port if present (e.g. localhost:3000)
}

function isPortalHost(hostname: string): boolean {
  return hostname === 'portal.wcomply.com' || hostname.startsWith('portal.')
}

// Exact path-segment match — a plain pathname.startsWith('/portal') also matches
// unrelated pages like /portal-management (a Sales admin page, not part of the portal
// route tree), incorrectly redirecting them away on the main domain.
function isPortalPath(pathname: string): boolean {
  return pathname === '/portal' || pathname.startsWith('/portal/')
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = requestHostname(request)

  if (isPortalHost(hostname)) {
    if (isPortalPath(pathname)) {
      return NextResponse.next()
    }
    const url = request.nextUrl.clone()
    url.pathname = `/portal${pathname === '/' ? '' : pathname}`
    return NextResponse.rewrite(url)
  }

  // Main WHUBBI domain — the portal route tree is only ever reached via
  // portal.wcomply.com above.
  if (isPortalPath(pathname)) {
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
