'use client'
import { GRCLayout, useGRCPerm } from '@/components/GRCLayout'

function WhistleblowingContent() {
  const { level } = useGRCPerm('whistleblowing')

  if (level === 'loading') return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
      <p style={{ fontSize: '13px' }}>You don't have permission to access Whistleblowing & Ethics. Ask HR to grant it via WHUBBI Permissions.</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100vh - 40px)' }}>
      <div style={{ textAlign: 'center', padding: '48px' }}>
        <div style={{ fontSize: '72px', marginBottom: '24px' }}>🚧</div>
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#156082', marginBottom: '12px' }}>Under Construction</h1>
        <p style={{ fontSize: '14px', color: '#45B6E4', maxWidth: '420px', margin: '0 auto', lineHeight: '1.7' }}>
          The Whistleblowing & Ethics module is currently being developed. It will provide a confidential channel for reporting ethics and compliance concerns at WCOMPLY.
        </p>
      </div>
    </div>
  )
}

export default function WhistleblowingPage() {
  return <GRCLayout><WhistleblowingContent /></GRCLayout>
}
