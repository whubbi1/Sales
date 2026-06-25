'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function MyTicketsPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/helpdesk/tickets?mine=1') }, [])
  return null
}
