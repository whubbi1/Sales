'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function NewTicketPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/helpdesk/tickets?new=1') }, [])
  return null
}
