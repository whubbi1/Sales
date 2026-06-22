'use client'
import dynamic from 'next/dynamic'

const OpportunityDetailPage = dynamic(() => import('./OpportunityDetailPage'), { ssr: false })

export default function Page() {
  return <OpportunityDetailPage />
}
