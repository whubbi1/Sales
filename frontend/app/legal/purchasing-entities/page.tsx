'use client'
import { OrgEntitiesPage } from '@/components/legal/OrgEntitiesPage'

export default function PurchasingEntitiesPage() {
  return (
    <OrgEntitiesPage
      category="purchasing_entity"
      icon="🛒"
      title="Purchasing Entities"
      subtitle="Entities used for purchasing, each with a 4-digit code"
    />
  )
}
