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
// function entry point, so a proxy.ts here silently never runs in production (root "/"
// looked like it worked only because a page happens to already exist at that literal
// path — every other rewritten path 404'd). Keep this filename until Amplify supports
// the new convention.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

function isPortalHost(hostname: string): boolean {
  return hostname === 'portal.wcomply.com' || hostname.startsWith('portal.')
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPortalHost(request.nextUrl.hostname)) {
    if (pathname === '/portal' || pathname.startsWith('/portal/')) {
      const res = NextResponse.next()
      res.headers.set('x-middleware-ran', 'true') // TEMP diagnostic — remove once confirmed
      return res
    }
    const url = request.nextUrl.clone()
    url.pathname = `/portal${pathname === '/' ? '' : pathname}`
    const res = NextResponse.rewrite(url)
    res.headers.set('x-middleware-ran', 'true') // TEMP diagnostic — remove once confirmed
    return res
  }

  // Main WHUBBI domain — the portal route tree is only ever reached via
  // portal.wcomply.com above.
  if (pathname.startsWith('/portal')) {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    return NextResponse.redirect(url)
  }

  const res = NextResponse.next()
  res.headers.set('x-middleware-ran', 'true') // TEMP diagnostic — remove once confirmed
  return res
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp|gif|css|js|map)$).*)',
  ],
}
