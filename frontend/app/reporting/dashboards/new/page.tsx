'use client'
import { ReportingLayout, useReportingPerm } from '@/components/ReportingLayout'
import { DashboardBuilderForm } from '@/components/reporting/DashboardBuilderForm'

function NewDashboardContent() {
  const { level } = useReportingPerm('dashboards')
  if (level === 'loading') return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )
  return (
    <div style={{ padding: '24px 28px' }}>
      <h1 style={{ fontSize: '19px', fontWeight: '800', color: '#156082', marginBottom: '20px', letterSpacing: '-0.01em' }}>🗂️ New Dashboard</h1>
      <DashboardBuilderForm />
    </div>
  )
}

export default function NewDashboardPage() {
  return <ReportingLayout><NewDashboardContent /></ReportingLayout>
}
