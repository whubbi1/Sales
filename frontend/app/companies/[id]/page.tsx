// app/companies/[id]/page.tsx - Server Component 
import CompanyDetailClient from './CompanyDetailClient' 
export async function generateStaticParams() { return [] } 
export default function CompanyPage() { return <CompanyDetailClient /> } 
