'use client'
import { OrgEntitiesPage } from '@/components/legal/OrgEntitiesPage'

export default function OperationalTeamsPage() {
  return (
    <OrgEntitiesPage
      category="operational_team"
      icon="🏭"
      title="Operational Teams"
      subtitle="Internal teams delivering operations, each with an editable 5-digit code"
    />
  )
}
