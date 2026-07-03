'use client'
import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Amplify } from 'aws-amplify'
import { getAmplifyConfig } from '@/lib/amplifyConfig'
import { getStoredUser, clearStoredUser, isAccessExcluded } from '@/lib/auth'

Amplify.configure(getAmplifyConfig())

// Blocks an already-signed-in user the moment they're excluded — access
// revocation must take effect immediately, not just on their next fresh login.
function AccessGate() {
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (pathname.startsWith('/auth/')) return
    const user = getStoredUser()
    if (!user) return
    isAccessExcluded(user.email).then(excluded => {
      if (excluded) {
        clearStoredUser()
        router.push('/auth/login')
      }
    })
  }, [pathname, router])

  return null
}

export function AmplifyProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AccessGate />
      {children}
    </>
  )
}
