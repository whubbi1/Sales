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
// on Amplify Hosting the latter reflects an internal/origin hostname, not the actual
// custom domain the browser requested, so a hostname.startsWith('portal.') check
// against it was always false and every rewrite silently never fired (confirmed via a
// temporary x-middleware-ran response header: present on every request, proving
// middleware itself runs — only the host comparison was wrong).
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function requestHostname(request: NextRequest): string {
  const raw = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.hostname
  return raw.split(':')[0] // strip a port if present (e.g. localhost:3000)
}

function isPortalHost(hostname: string): boolean {
  return hostname === 'portal.wcomply.com' || hostname.startsWith('portal.')
}

function withDiagnostics(res: NextResponse, request: NextRequest): NextResponse {
  // TEMP — remove once the host-detection fix is confirmed in production.
  res.headers.set('x-diag-nexturl-host', request.nextUrl.hostname)
  res.headers.set('x-diag-host-header', request.headers.get('host') || '')
  res.headers.set('x-diag-xfh-header', request.headers.get('x-forwarded-host') || '')
  return res
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hostname = requestHostname(request)

  if (isPortalHost(hostname)) {
    if (pathname === '/portal' || pathname.startsWith('/portal/')) {
      return withDiagnostics(NextResponse.next(), request)
    }
    const url = request.nextUrl.clone()
    url.pathname = `/portal${pathname === '/' ? '' : pathname}`
    return withDiagnostics(NextResponse.rewrite(url), request)
  }

  // Main WHUBBI domain — the portal route tree is only ever reached via
  // portal.wcomply.com above.
  if (pathname.startsWith('/portal')) {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    return NextResponse.redirect(url)
  }

  return withDiagnostics(NextResponse.next(), request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif|css|js|map)$).*)',
  ],
}
