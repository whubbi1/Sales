'use client'
import dynamic from 'next/dynamic'
const CompanyDetail = dynamic(() => import('./CompanyDetail'), { ssr: false })
export default function Page() { return <CompanyDetail /> }
