'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function DevelopmentRoot() {
  const router = useRouter()
  useEffect(() => { router.replace('/development/requests') }, [])
  return null
}
