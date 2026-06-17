// app/companies/[id]/page.tsx - Server Component
export async function generateStaticParams() {
  return []
}

export default function CompanyPage() {
  return <CompanyDetailClient />
}

import CompanyDetailClient from './CompanyDetailClient'
