'use client'
import { OrgEntitiesPage } from '@/components/legal/OrgEntitiesPage'

export default function OperationalTeamsPage() {
  return (
    <OrgEntitiesPage
      category="operational_team"
      icon="🏭"
      title="Operational Teams"
      subtitle="Internal teams delivering operations, each with a 4-digit code"
    />
  )
}
