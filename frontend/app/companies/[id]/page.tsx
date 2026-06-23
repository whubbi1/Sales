'use client' 
import dynamic from 'next/dynamic' 
const CompanyDetail = dynamic(() =, { ssr: false }) 
export default function Page() { return <CompanyDetail /> } 
