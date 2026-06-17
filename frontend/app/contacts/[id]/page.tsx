// app/contacts/[id]/page.tsx - Server Component
export async function generateStaticParams() {
  return []
}

import ContactDetailClient from './ContactDetailClient'

export default function ContactPage() {
  return <ContactDetailClient />
}
