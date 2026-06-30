'use client'
import { LegalLayout } from '@/components/LegalLayout'

export default function LegalAdminPage() {
  return (
    <LegalLayout>
      <div style={{ padding: '32px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Legal Admin Cockpit</h1>
        <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 28px' }}>Configure legal module settings and permissions</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '24px' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>🔐</div>
            <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', margin: '0 0 6px' }}>Manage Permissions</h3>
            <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 14px', lineHeight: 1.6 }}>
              Set user access rights for Legal Entities, Templates, and Admin pages via the HR Permissions page.
            </p>
            <a href="/rh/permissions" style={{ fontSize: '11px', color: '#1a2744', fontWeight: '700', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              HR Permissions ↗
            </a>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '24px' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>🏢</div>
            <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', margin: '0 0 6px' }}>Legal Entities</h3>
            <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 14px', lineHeight: 1.6 }}>
              Manage WCOMPLY legal entities, registration information, and linked SharePoint documents.
            </p>
            <a href="/legal/entities" style={{ fontSize: '11px', color: '#1a2744', fontWeight: '700', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Legal Entities ↗
            </a>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '24px' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>📄</div>
            <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', margin: '0 0 6px' }}>Template Documents</h3>
            <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 14px', lineHeight: 1.6 }}>
              Maintain the library of legal document templates available to authorised users.
            </p>
            <a href="/legal/templates" style={{ fontSize: '11px', color: '#1a2744', fontWeight: '700', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              Templates ↗
            </a>
          </div>
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '24px' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>🤖</div>
            <h3 style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B', margin: '0 0 6px' }}>WHUBBI Bot</h3>
            <p style={{ fontSize: '11px', color: '#64748B', margin: '0 0 14px', lineHeight: 1.6 }}>
              Users can ask the WHUBBI Bot to access legal entities and templates based on their permissions.
            </p>
            <a href="/rh/chat" style={{ fontSize: '11px', color: '#1a2744', fontWeight: '700', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              WHUBBI Chat ↗
            </a>
          </div>
        </div>
      </div>
    </LegalLayout>
  )
}
