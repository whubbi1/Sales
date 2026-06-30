'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function LegalPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/legal/entities') }, [router])
  return null
}
