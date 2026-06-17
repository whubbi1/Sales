'use client'
// app/opportunities/[id]/page.tsx
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { opportunitiesAPI, companiesAPI } from '@/lib/api'
import { RecordLayout, PropertyRow, SidebarSection, SidebarCard, TabNav } from '@/components/shared/RecordLayout'
import { OpportunityModal } from '@/components/opportunities/OpportunityModal'
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Presentation To Be Scheduled': { bg: '#EEF2FF', color: '#4F46E5' },
  'Presentation Done':            { bg: '#FFF7ED', color: '#D97706' },
  'Proposition Ongoing':          { bg: '#FFF7ED', color: '#EA580C' },
  'Proposition Accepted':         { bg: '#ECFDF5', color: '#059669' },
  'Contract Ongoing':             { bg: '#ECFDF5', color: '#059669' },
  'Contract Finalised':           { bg: '#D1FAE5', color: '#047857' },
  'PO Received':                  { bg: '#D1FAE5', color: '#047857' },
  'Contract Lost':                { bg: '#FEF2F2', color: '#DC2626' },
}
export default function OpportunityDetailClient() {
  const { id } = useParams()
  const router = useRouter()
  const [opp, setOpp] = useState<any>(null)
  const [companyDeals, setCompanyDeals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Overview')
  const [showEdit, setShowEdit] = useState(false)
  const load = async () => {
    try {
      const o = await opportunitiesAPI.get(id as string)
      setOpp(o)
      if (o.company_id) {
        const deals = await companiesAPI.getOpportunities(o.company_id)
        setCompanyDeals(deals.filter((d: any) => d.id !== id))
      }
    } catch { router.push('/opportunities') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [id])
  if (loading) return (
    <RecordLayout
      leftColumn={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#9B9B9B' }}>Loading...</div>}
      rightColumn={<div />}
    />
  )
  const statusStyle = STATUS_COLORS[opp.deal_status] || { bg: '#F1F5F9', color: '#475569' }
  const fmt = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
  const leftColumn = (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontSize: '11px', color: '#9B9B9B' }}>
        <button onClick={() => router.push('/opportunities')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontWeight: '600', fontSize: '11px', padding: 0 }}>Opportunities</button>
        <span>/</span>
        <span style={{ color: '#3F3F3F', fontWeight: '600' }}>{opp.deal_name}</span>
      </div>
      {/* Header card */}
      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1 }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: '#219BD6', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '800', flexShrink: 0 }}>
              {opp.deal_name[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#144766', margin: 0 }}>{opp.deal_name}</h1>
                <span style={{ background: statusStyle.bg, color: statusStyle.color, padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{opp.deal_status}</span>
                {opp.deal_type && <span style={{ background: '#EEF2FF', color: '#4F46E5', padding: '2px 9px', borderRadius: '12px', fontSize: '10px', fontWeight: '700' }}>{opp.deal_type}</span>}
              </div>
              <p style={{ color: '#9B9B9B', fontSize: '12px', margin: 0 }}>
                {opp.deal_id && `#${opp.deal_id} · `}
                {opp.company?.name || 'No company'}
                {opp.project_name && ` · ${opp.project_name}`}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginTop: '12px' }}>
                {opp.deal_amount && (
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '2px' }}>Deal Amount</div>
                    <div style={{ fontSize: '20px', fontWeight: '800', color: '#059669' }}>€{opp.deal_amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}</div>
                  </div>
                )}
                {opp.closing_date && (
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '2px' }}>Closing Date</div>
                    <div style={{ fontSize: '14px', fontWeight: '700', color: '#3F3F3F' }}>{fmt(opp.closing_date)}</div>
                  </div>
                )}
                {opp.project_status && (
                  <div>
                    <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '2px' }}>Project Status</div>
                    <div style={{ background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '8px', fontSize: '11px', fontWeight: '700', display: 'inline-block' }}>{opp.project_status}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <button onClick={() => setShowEdit(true)} style={{ background: 'white', color: '#144766', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #CBD5E0', cursor: 'pointer', flexShrink: 0 }}>Edit</button>
        </div>
      </div>
      {/* Tabs */}
      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '0 20px', background: '#FAFBFC', borderBottom: '2px solid #E2E8F0' }}>
          <TabNav tabs={['Overview', 'Contacts']} active={tab} onChange={setTab} />
        </div>
        <div style={{ padding: '20px' }}>
          {tab === 'Overview' && (
            <div>
              <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '10px' }}>Notes</p>
              <p style={{ color: opp.notes ? '#3F3F3F' : '#CBD5E0', fontSize: '13px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                {opp.notes || 'No notes. Click "Edit" to add some.'}
              </p>
              {opp.assigned_consultants?.length > 0 && (
                <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #F1F5F9' }}>
                  <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '8px' }}>Assigned Consultants</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {opp.assigned_consultants.map((c: string) => (
                      <span key={c} style={{ background: '#EFF6FF', color: '#2563EB', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {tab === 'Contacts' && (
            <div>
              {(!opp.contacts || opp.contacts.length === 0) ? (
                <div style={{ textAlign: 'center', padding: '32px', color: '#9B9B9B' }}>
                  <div style={{ fontSize: '32px', opacity: 0.35, marginBottom: '8px' }}>👤</div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#6B6B6B', marginBottom: '4px' }}>No contacts linked</div>
                  <div style={{ fontSize: '12px' }}>Edit this opportunity to link contacts.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {opp.contacts.map((c: any) => (
                    <div key={c.id} onClick={() => router.push(`/contacts/${c.id}`)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', border: '1px solid #EDF2F7', borderRadius: '8px', cursor: 'pointer', background: 'white' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F5F7FA')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                      <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#e97132', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: '800', flexShrink: 0 }}>
                        {c.first_name[0]?.toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: '700', color: '#144766', fontSize: '13px' }}>{c.first_name} {c.last_name}</div>
                        <div style={{ fontSize: '11px', color: '#9B9B9B' }}>{c.job_type || c.email || ''}</div>
                      </div>
                      {c.lead_status && (
                        <span style={{ background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{c.lead_status}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
  const rightColumn = (
    <div>
      {/* Deal details */}
      <SidebarSection title="Deal Details">
        <PropertyRow label="Deal ID" value={opp.deal_id} />
        <PropertyRow label="Deal Name" value={opp.deal_name} />
        <PropertyRow label="Project Name" value={opp.project_name} />
        <PropertyRow label="Deal Type" value={opp.deal_type} />
        <PropertyRow label="Deal Status" value={opp.deal_status} />
        <PropertyRow label="Project Status" value={opp.project_status} />
        <PropertyRow label="Amount" value={opp.deal_amount ? `€${opp.deal_amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}` : null} />
        <PropertyRow label="Closing Date" value={fmt(opp.closing_date)} />
        <PropertyRow label="Contract Start" value={fmt(opp.contract_start_date)} />
        <PropertyRow label="Contract End" value={fmt(opp.contract_end_date)} />
        <PropertyRow label="Contracting Party" value={opp.contracting_party} />
        <PropertyRow label="Assigned To" value={opp.assigned_to} />
        <PropertyRow label="Created" value={fmt(opp.created_at)} />
      </SidebarSection>
      {/* Company */}
      <SidebarSection title="Company">
        {opp.company ? (
          <SidebarCard title={opp.company.name} subtitle={`Status: ${opp.company.status}`} href={`/companies/${opp.company.id}`} color="#144766" />
        ) : (
          <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No company linked.</p>
        )}
      </SidebarSection>
      {/* Linked contacts */}
      <SidebarSection title={`Contacts (${opp.contacts?.length || 0})`}>
        {(!opp.contacts || opp.contacts.length === 0)
          ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No contacts linked.</p>
          : opp.contacts.map((c: any) => (
            <SidebarCard key={c.id} title={`${c.first_name} ${c.last_name}`} subtitle={c.job_type || c.email} href={`/contacts/${c.id}`} color="#e97132" />
          ))
        }
      </SidebarSection>
      {/* Other company deals */}
      {opp.company && (
        <SidebarSection title={`Other ${opp.company.name} Deals (${companyDeals.length})`}>
          {companyDeals.length === 0
            ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No other deals.</p>
            : companyDeals.map((d: any) => (
              <SidebarCard key={d.id} title={d.deal_name} subtitle={d.deal_status} href={`/opportunities/${d.id}`} color="#219BD6" />
            ))
          }
        </SidebarSection>
      )}
    </div>
  )
  return (
    <>
      <RecordLayout leftColumn={leftColumn} rightColumn={rightColumn} />
      {showEdit && <OpportunityModal opportunity={opp} onClose={() => setShowEdit(false)} onSave={() => { setShowEdit(false); load() }} />}
    </>
  )
}
