'use client'
import { OperationsLayout, useOperationsPerm } from '@/components/OperationsLayout'
import { OperationsOpportunityList } from '@/components/operations/OperationsOpportunityList'

function ProjectsContent() {
  const { level } = useOperationsPerm('projects')
  if (level === 'loading') return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )
  return <OperationsOpportunityList module="operations_projects" title="Projects" icon="📁" projectTypes={['Daily Invoicing', 'Project']} />
}

export default function OperationsProjectsPage() {
  return <OperationsLayout><ProjectsContent /></OperationsLayout>
}
