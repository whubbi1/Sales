'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function AssignedTicketsPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/helpdesk/tickets?assigned=1') }, [])
  return null
}
