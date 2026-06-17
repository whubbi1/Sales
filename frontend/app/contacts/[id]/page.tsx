// app/contacts/[id]/page.tsx - Server Component 
import ContactDetailClient from './ContactDetailClient' 
export async function generateStaticParams() { return [] } 
export default function ContactPage() { return <ContactDetailClient /> } 
