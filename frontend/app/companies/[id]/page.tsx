'use client'
import dynamic from 'next/dynamic'

const CompanyDetailPage = dynamic(() => import('./CompanyDetailPage'), { ssr: false })

export default function Page() {
  return <CompanyDetailPage />
}
