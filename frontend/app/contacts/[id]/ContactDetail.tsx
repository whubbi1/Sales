'use client'
// app/contacts/[id]/page.tsx
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { contactsAPI } from '@/lib/api'
import { RecordLayout, PropertyRow, SidebarSection, SidebarCard, StatusBadge, TabNav } from '@/components/shared/RecordLayout'
import { ContactModal } from '@/components/contacts/ContactModal'
const SUB_LABELS: Record<string, string> = {
  'Marketing Information': '📧',
  'Customer Service Communication': '💬',
  'One to One': '🤝'
}
export default function ContactDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [contact, setContact] = useState<any>(null)
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Overview')
  const [showEdit, setShowEdit] = useState(false)
  const load = async () => {
    try {
      const [c, opps] = await Promise.all([
        contactsAPI.get(id as string),
        contactsAPI.getOpportunities(id as string),
      ])
      setContact(c)
      setOpportunities(opps)
    } catch { router.push('/contacts') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [id])
  if (loading) return (
    <RecordLayout
      leftColumn={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#9B9B9B' }}>Loading...</div>}
      rightColumn={<div />}
    />
  )
  const leftColumn = (
    <div>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontSize: '11px', color: '#9B9B9B' }}>
        <button onClick={() => router.push('/contacts')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontWeight: '600', fontSize: '11px', padding: 0 }}>Contacts</button>
        <span>/</span>
        <span style={{ color: '#3F3F3F', fontWeight: '600' }}>{contact.first_name} {contact.last_name}</span>
      </div>
      {/* Header card */}
      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1 }}>
            {/* Avatar */}
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#e97132', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '800', flexShrink: 0 }}>
              {contact.first_name[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#144766', margin: 0 }}>{contact.first_name} {contact.last_name}</h1>
                <StatusBadge value={contact.lead_status || 'New'} />
                {contact.job_type && (
                  <span style={{ background: '#EEF2FF', color: '#4F46E5', padding: '2px 9px', borderRadius: '12px', fontSize: '10px', fontWeight: '700' }}>{contact.job_type}</span>
                )}
              </div>
              <p style={{ color: '#9B9B9B', fontSize: '12px', margin: 0 }}>
                {contact.job_name && `${contact.job_name}`}
                {contact.company && ` · ${contact.company.name}`}
                {contact.preferred_language && ` · 🌐 ${contact.preferred_language}`}
              </p>
              {/* Contact details */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '10px', fontSize: '12px' }}>
                {contact.email && (
                  <a href={`mailto:${contact.email}`} style={{ color: '#219BD6', textDecoration: 'none', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    ✉ {contact.email}
                  </a>
                )}
                {contact.mobile_phone && <span style={{ color: '#6B6B6B' }}>📱 {contact.mobile_phone}</span>}
                {contact.office_phone && <span style={{ color: '#6B6B6B' }}>☎ {contact.office_phone}</span>}
                {contact.linkedin_url && (
                  <a href={contact.linkedin_url} target="_blank" rel="noopener" style={{ color: '#219BD6', textDecoration: 'none', fontWeight: '600' }}>LinkedIn ↗</a>
                )}
              </div>
              {/* Subscriptions */}
              {contact.subscriptions?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '10px' }}>
                  {contact.subscriptions.map((sub: string) => (
                    <span key={sub} style={{ background: '#ECFDF5', color: '#059669', padding: '2px 9px', borderRadius: '12px', fontSize: '10px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {SUB_LABELS[sub] || '✓'} {sub}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button onClick={() => setShowEdit(true)} style={{ background: 'white', color: '#144766', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #CBD5E0', cursor: 'pointer', flexShrink: 0 }}>Edit</button>
        </div>
      </div>
      {/* Tabs */}
      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '0 20px', background: '#FAFBFC', borderBottom: '2px solid #E2E8F0' }}>
          <TabNav tabs={['Overview', 'Opportunities']} active={tab} onChange={setTab} />
        </div>
        <div style={{ padding: '20px' }}>
          {tab === 'Overview' && (
            <div>
              <p style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '10px' }}>Notes</p>
              <p style={{ color: contact.notes ? '#3F3F3F' : '#CBD5E0', fontSize: '13px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                {contact.notes || 'No notes. Click "Edit" to add some.'}
              </p>
            </div>
          )}
          {tab === 'Opportunities' && (
            <div>
              {opportunities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: '#9B9B9B' }}>
                  <div style={{ fontSize: '32px', opacity: 0.35, marginBottom: '8px' }}>💼</div>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#6B6B6B', marginBottom: '4px' }}>No opportunities linked</div>
                  <div style={{ fontSize: '12px' }}>Link this contact to an opportunity from the Opportunities page.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {opportunities.map(opp => (
                    <div key={opp.id} onClick={() => router.push(`/opportunities/${opp.id}`)} style={{ padding: '12px 14px', border: '1px solid #EDF2F7', borderRadius: '8px', background: 'white', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F5F7FA')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '700', color: '#144766', marginBottom: '3px' }}>{opp.deal_name}</div>
                          <div style={{ fontSize: '11px', color: '#9B9B9B' }}>
                            {opp.deal_status}
                            {opp.closing_date && ` · Close ${new Date(opp.closing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                          </div>
                        </div>
                        {opp.deal_amount && (
                          <div style={{ fontSize: '14px', fontWeight: '800', color: '#059669' }}>
                            €{opp.deal_amount.toLocaleString('en-US', { minimumFractionDigits: 0 })}
                          </div>
                        )}
                      </div>
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
      {/* Contact info */}
      <SidebarSection title="Contact Details">
        <PropertyRow label="First Name" value={contact.first_name} />
        <PropertyRow label="Last Name" value={contact.last_name} />
        <PropertyRow label="Email" value={contact.email} />
        <PropertyRow label="Mobile Phone" value={contact.mobile_phone} />
        <PropertyRow label="Office Phone" value={contact.office_phone} />
        <PropertyRow label="Job Name" value={contact.job_name} />
        <PropertyRow label="Job Type" value={contact.job_type} />
        <PropertyRow label="Lead Status" value={contact.lead_status ? <StatusBadge value={contact.lead_status} /> : null} />
        <PropertyRow label="Preferred Language" value={contact.preferred_language} />
        <PropertyRow label="Assigned To" value={contact.assigned_to} />
        <PropertyRow label="Created" value={new Date(contact.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
      </SidebarSection>
      {/* Company */}
      <SidebarSection title="Company">
        {contact.company ? (
          <SidebarCard
            title={contact.company.name}
            subtitle={`Status: ${contact.company.status}`}
            href={`/companies/${contact.company.id}`}
            color="#144766"
          />
        ) : (
          <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No company linked.</p>
        )}
      </SidebarSection>
      {/* Deals */}
      <SidebarSection title={`Deals (${opportunities.length})`}>
        {opportunities.length === 0
          ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No deals linked.</p>
          : opportunities.map(opp => (
            <SidebarCard key={opp.id} title={opp.deal_name} subtitle={opp.deal_status} href={`/opportunities/${opp.id}`} color="#219BD6" />
          ))
        }
      </SidebarSection>
    </div>
  )
  return (
    <>
      <RecordLayout leftColumn={leftColumn} rightColumn={rightColumn} />
      {showEdit && <ContactModal contact={contact} onClose={() => setShowEdit(false)} onSave={() => { setShowEdit(false); load() }} />}
    </>
  )
}
