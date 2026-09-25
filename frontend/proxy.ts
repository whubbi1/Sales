// frontend/proxy.ts
// Host-based routing for the Customer/Partner portal. customer.wcomply.com and
// partner.wcomply.com serve the same Next.js app/deploy as the internal WHUBBI app,
// but every request on those hosts is confined to the /portal/{type} route tree —
// they never see (and can never rewrite/redirect into) any internal module. The
// reverse also holds: the internal app's own domain can't reach /portal/* directly.
//
// Next.js 16 renamed "middleware" to "proxy" (same file convention, same
// NextRequest/NextResponse API) — see node_modules/next/dist/docs/.../proxy.md.
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

type PortalType = 'customer' | 'partner'

function portalTypeForHost(hostname: string): PortalType | null {
  if (hostname === 'customer.wcomply.com' || hostname.startsWith('customer.')) return 'customer'
  if (hostname === 'partner.wcomply.com' || hostname.startsWith('partner.')) return 'partner'
  return null
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const portalType = portalTypeForHost(request.nextUrl.hostname)

  if (portalType) {
    const prefix = `/portal/${portalType}`
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return NextResponse.next()
    }
    const url = request.nextUrl.clone()
    url.pathname = `${prefix}${pathname === '/' ? '' : pathname}`
    return NextResponse.rewrite(url)
  }

  // Main WHUBBI domain — the portal route tree is only ever reached via the
  // customer./partner. subdomains above.
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
