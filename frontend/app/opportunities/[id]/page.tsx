// app/opportunities/[id]/page.tsx - Server Component 
import OpportunityDetailClient from './OpportunityDetailClient' 
export async function generateStaticParams() { return [] } 
export default function OpportunityPage() { return <OpportunityDetailClient /> } 
