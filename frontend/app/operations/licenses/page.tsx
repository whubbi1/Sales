'use client'
import { OperationsLayout, useOperationsPerm } from '@/components/OperationsLayout'
import { OperationsProjectList } from '@/components/operations/OperationsProjectList'

function LicensesContent() {
  const { level } = useOperationsPerm('licenses')
  if (level === 'loading') return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )
  return <OperationsProjectList mode="license" />
}

export default function OperationsLicensesPage() {
  return <OperationsLayout><LicensesContent /></OperationsLayout>
}
