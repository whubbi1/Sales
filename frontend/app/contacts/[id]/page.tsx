'use client'
import dynamic from 'next/dynamic'
const ContactDetail = dynamic(() => import('./ContactDetail'), { ssr: false })
export default function Page() { return <ContactDetail /> }
