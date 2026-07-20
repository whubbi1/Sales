'use client'
import { OrgEntitiesPage } from '@/components/legal/OrgEntitiesPage'

export default function PurchasingEntitiesPage() {
  return (
    <OrgEntitiesPage
      category="purchasing_entity"
      icon="🛒"
      title="Purchasing Entities"
      subtitle="Entities used for purchasing, each with an editable 5-digit code"
    />
  )
}
