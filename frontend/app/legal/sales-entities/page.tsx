'use client'
import { OrgEntitiesPage } from '@/components/legal/OrgEntitiesPage'

export default function SalesEntitiesPage() {
  return (
    <OrgEntitiesPage
      category="sales_entity"
      icon="🏷️"
      title="Sales Entities"
      subtitle="Legal entities used for sales purposes, each with a 4-digit code"
    />
  )
}
