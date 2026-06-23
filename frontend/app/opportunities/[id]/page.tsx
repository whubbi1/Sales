'use client'
import dynamic from 'next/dynamic'
const OpportunityDetail = dynamic(() => import('./OpportunityDetail'), { ssr: false })
export default function Page() { return <OpportunityDetail /> }
