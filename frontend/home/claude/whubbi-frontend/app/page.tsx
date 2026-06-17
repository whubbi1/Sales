'use client'
// app/page.tsx
// Page d'accueil - redirige vers login

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentUser } from 'aws-amplify/auth'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    const checkAuth = async () => {
      try {
        await getCurrentUser()
        router.push('/dashboard')
      } catch {
        router.push('/auth/login')
      }
    }
    checkAuth()
  }, [router])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  )
}
