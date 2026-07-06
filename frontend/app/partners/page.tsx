'use client'
// app/partners/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { partnersAPI } from '@/lib/api'
import { PageHeader, StatusBadge, EmptyState } from '@/components/shared/RecordLayout'
import { PartnerModal } from '@/components/partners/PartnerModal'
import { useReportBuilder, applyReport, ReportPanel, ReportColumn } from '@/components/it/ReportBuilder'
import { getStoredUser } from '@/lib/auth'

const COLUMNS: ReportColumn[] = [
  { key: 'internal_id', label: 'ID', filterable: 'text' },
  { key: 'name', label: 'Partner', filterable: 'text' },
  { key: 'main_contact_display', label: 'Contact', filterable: 'text' },
  { key: 'sector', label: 'Sector', filterable: 'text' },
  { key: 'country', label: 'Country', filterable: 'text' },
  { key: 'status', label: 'Status', filterable: 'select', options: ['active', 'inactive'] },
  { key: 'assigned_to', label: 'Assigned', filterable: 'text' },
]

export default function PartnersPage() {
  const router = useRouter()
  const [partners, setPartners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  const rb = useReportBuilder('partner', COLUMNS, userEmail)

  const load = async () => {
    try {
      setLoading(true)
      const data = await partnersAPI.list({})
      setPartners(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    const u = getStoredUser()
    if (u?.email) setUserEmail(u.email)
  }, [])

  const withDisplay = partners.map(p => ({
    ...p,
    main_contact_display: p.main_contact_first_name ? `${p.main_contact_first_name} ${p.main_contact_last_name}` : '',
  }))
  const reported = applyReport(withDisplay, COLUMNS, rb.filters, rb.sortField, rb.sortDir)
  const isVisible = (key: string) => rb.visibleCols.includes(key)

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        <div style={{ padding: '24px 28px' }}>
          <PageHeader
            title="Partners"
            count={reported.length}
            action={
              <div style={{ display: 'flex', gap: '8px' }}>
                <ReportPanel columns={COLUMNS} rb={rb} />
                <button className="btn-primary" onClick={() => setShowModal(true)}>
                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  New Partner
                </button>
              </div>
            }
          />

          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#FAFBFC' }}>
                <tr>
                  {COLUMNS.filter(c => isVisible(c.key)).map(c => (
                    <th key={c.key} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={COLUMNS.length} style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>Loading...</td></tr>
                ) : reported.length === 0 ? (
                  <tr><td colSpan={COLUMNS.length}><EmptyState icon="🤝" title="No partners yet" description="Create your first partner by clicking New Partner" /></td></tr>
                ) : reported.map(partner => (
                  <tr key={partner.id} onClick={() => router.push(`/partners/${partner.id}`)} style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FAFBFC')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                    {isVisible('internal_id') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '11px', color: '#9B9B9B', fontWeight: '600' }}>{partner.internal_id || '—'}</td>
                    )}
                    {isVisible('name') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: '#7C3AED', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '800', flexShrink: 0 }}>
                            {partner.name[0]?.toUpperCase()}
                          </div>
                          <div style={{ fontWeight: '700', color: '#144766', fontSize: '13px' }}>{partner.name}</div>
                        </div>
                      </td>
                    )}
                    {isVisible('main_contact_display') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#3F3F3F' }}>{partner.main_contact_display || '—'}</td>
                    )}
                    {isVisible('sector') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#3F3F3F' }}>{partner.sector || '—'}</td>
                    )}
                    {isVisible('country') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '12px', color: '#3F3F3F' }}>{partner.country || '—'}</td>
                    )}
                    {isVisible('status') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9' }}>
                        <StatusBadge value={partner.status} />
                      </td>
                    )}
                    {isVisible('assigned_to') && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', fontSize: '11px', color: '#9B9B9B' }}>{partner.assigned_to || '—'}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {showModal && <PartnerModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} />}
      </main>
    </div>
  )
}
