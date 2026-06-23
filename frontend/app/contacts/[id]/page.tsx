'use client' 
import dynamic from 'next/dynamic' 
const ContactDetail = dynamic(() =, { ssr: false }) 
export default function Page() { return <ContactDetail /> } 
