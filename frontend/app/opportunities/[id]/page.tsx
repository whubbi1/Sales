// app/opportunities/[id]/page.tsx - Server Component
export async function generateStaticParams() {
  return []
}

import OpportunityDetailClient from './OpportunityDetailClient'

export default function OpportunityPage() {
  return <OpportunityDetailClient />
}
