'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export function BackendCheck() {
  const router = useRouter()

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('https://api.whubbi.wcomply.com/health', {
          signal: AbortSignal.timeout(8000)
        })
        if (!res.ok) router.push('/error/backend-down')
      } catch {
        router.push('/error/backend-down')
      }
    }
    check()
  }, [router])

  return null
}
