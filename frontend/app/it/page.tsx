'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function ITIndexPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/it/equipments') }, [])
  return null
}
