'use client'
import dynamic from 'next/dynamic'

const ContactDetailPage = dynamic(() => import('./ContactDetailPage'), { ssr: false })

export default function Page() {
  return <ContactDetailPage />
}
