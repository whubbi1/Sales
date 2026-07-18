'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { contactsAPI } from '@/lib/api'
import { RecordLayout, PropertyRow, SidebarSection, SidebarCard, StatusBadge, TabNav } from '@/components/shared/RecordLayout'
import { ContactModal } from '@/components/contacts/ContactModal'
import { ContactNotes } from '@/components/contacts/ContactNotes'
import { ContactArticles } from '@/components/contacts/ContactArticles'
import { ContactTasks } from '@/components/contacts/ContactTasks'
import { ActivityFeed } from '@/components/shared/ActivityFeed'

const SUB_LABELS: Record<string, string> = { 'Marketing Information': '📧', 'Customer Service Communication': '💬', 'One to One': '🤝' }

export default function ContactDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [contact, setContact] = useState<any>(null)
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [notes, setNotes] = useState<any[]>([])
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Overview')
  const [showEdit, setShowEdit] = useState(false)
  const [showDelete, setShowDelete] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    try {
      const [c, opps, ntes, lds] = await Promise.all([
        contactsAPI.get(id as string),
        contactsAPI.getOpportunities(id as string),
        contactsAPI.getNotes(id as string),
        contactsAPI.getLeads(id as string),
      ])
      setContact(c)
      setOpportunities(opps)
      setNotes(ntes)
      setLeads(lds)
    } catch {
      router.push('/contacts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  if (loading) return (
    <RecordLayout
      leftColumn={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#9B9B9B' }}>Loading...</div>}
      rightColumn={<div />}
    />
  )

  if (!contact) return null

  const leftColumn = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontSize: '11px', color: '#9B9B9B' }}>
        <button onClick={() => router.push('/contacts')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontWeight: '600', fontSize: '11px', padding: 0 }}>Contacts</button>
        <span>/</span><span style={{ color: '#3F3F3F', fontWeight: '600' }}>{contact.first_name} {contact.last_name}</span>
      </div>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1 }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#e97132', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '800', flexShrink: 0 }}>
              {contact.first_name[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#144766', margin: 0 }}>{contact.first_name} {contact.last_name}</h1>
                {contact.internal_id && <span style={{ fontSize: '11px', fontWeight: '600', color: '#9B9B9B' }}>{contact.internal_id}</span>}
                <StatusBadge value={contact.lead_status || 'New'} />
                {contact.job_type && <span style={{ background: '#EEF2FF', color: '#4F46E5', padding: '2px 9px', borderRadius: '12px', fontSize: '10px', fontWeight: '700' }}>{contact.job_type}</span>}
              </div>
              <p style={{ color: '#9B9B9B', fontSize: '12px', margin: 0 }}>
                {contact.job_name && `${contact.job_name}`}
                {contact.company && ` · ${contact.company.name}`}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginTop: '10px', fontSize: '12px' }}>
                {contact.email && <a href={`mailto:${contact.email}`} style={{ color: '#219BD6', textDecoration: 'none' }}>✉ {contact.email}</a>}
                {contact.mobile_phone && <span style={{ color: '#6B6B6B' }}>📱 {contact.mobile_phone}</span>}
                {contact.office_phone && <span style={{ color: '#6B6B6B' }}>☎ {contact.office_phone}</span>}
                {contact.linkedin_url && <a href={contact.linkedin_url} target="_blank" rel="noopener" style={{ color: '#219BD6', fontWeight: '600' }}>LinkedIn ↗</a>}
              </div>
              {contact.subscriptions?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '10px' }}>
                  {contact.subscriptions.map((sub: string) => <span key={sub} style={{ background: '#ECFDF5', color: '#059669', padding: '2px 9px', borderRadius: '12px', fontSize: '10px', fontWeight: '600' }}>{SUB_LABELS[sub] || '✓'} {sub}</span>)}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setShowEdit(true)} style={{ background: 'white', color: '#144766', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #CBD5E0', cursor: 'pointer' }}>Edit</button>
            <button onClick={() => { setDeleteConfirm(''); setShowDelete(true) }} style={{ background: 'white', color: '#DC2626', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #FCA5A5', cursor: 'pointer' }}>Delete</button>
          </div>
        </div>
      </div>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '0 20px', background: '#FAFBFC', borderBottom: '2px solid #E2E8F0' }}>
          <TabNav tabs={['Overview', 'Notes', 'Articles', 'Tasks']} active={tab} onChange={setTab} />
        </div>
        <div style={{ padding: '20px' }}>
          {tab === 'Overview' && (
            <div>
              <p style={{ color: contact.notes ? '#3F3F3F' : '#CBD5E0', fontSize: '13px', lineHeight: '1.8', marginBottom: '18px' }}>{contact.notes || 'No notes.'}</p>
              <p className="section-label">Activity</p>
              <ActivityFeed opportunities={opportunities} notes={notes} opportunityHref={o => `/opportunities/${o.id}`} />
            </div>
          )}
          {tab === 'Notes' && <ContactNotes contactId={id as string} onChange={() => contactsAPI.getNotes(id as string).then(setNotes)} />}
          {tab === 'Articles' && <ContactArticles contactId={id as string} />}
          {tab === 'Tasks' && <ContactTasks contactId={id as string} />}
        </div>
      </div>
    </div>
  )

  const rightColumn = (
    <div>
      <SidebarSection title="Company / Partner">
        {contact.company ? (
          <SidebarCard title={contact.company.name} subtitle={`Status: ${contact.company.status}`} href={`/companies/${contact.company.id}`} color="#144766" />
        ) : contact.partner ? (
          <SidebarCard title={contact.partner.name} subtitle={`Status: ${contact.partner.status}`} href={`/partners/${contact.partner.id}`} color="#7C3AED" />
        ) : <p style={{ fontSize: '12px', color: '#9B9B9B' }}>None.</p>}
      </SidebarSection>
      <SidebarSection
        title={`Opportunities (${opportunities.length})`}
        onAdd={() => router.push(`/opportunities?contact_id=${id}${contact.company_id ? `&company_id=${contact.company_id}` : ''}${contact.partner_id ? `&partner_id=${contact.partner_id}` : ''}`)}
      >
        {opportunities.length === 0 ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No opportunities.</p> : opportunities.map((opp: any) => <SidebarCard key={opp.id} title={opp.deal_name} subtitle={opp.deal_status} href={`/opportunities/${opp.id}`} color="#219BD6" />)}
      </SidebarSection>
      <SidebarSection title={`Leads (${leads.length})`}>
        {leads.length === 0 ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No leads.</p> : leads.map((lead: any) => <SidebarCard key={lead.id} title={lead.title || lead.name} subtitle={lead.status} href={`/leads/${lead.id}`} color="#D97706" />)}
      </SidebarSection>
      <SidebarSection title="Contact Details">
        <PropertyRow label="First Name" value={contact.first_name} />
        <PropertyRow label="Last Name" value={contact.last_name} />
        <PropertyRow label="Email" value={contact.email} />
        <PropertyRow label="Mobile" value={contact.mobile_phone} />
        <PropertyRow label="Office" value={contact.office_phone} />
        <PropertyRow label="Job Title" value={contact.job_name} />
        <PropertyRow label="Job Type" value={contact.job_type} />
        <PropertyRow label="Lead Status" value={contact.lead_status ? <StatusBadge value={contact.lead_status} /> : null} />
        <PropertyRow label="Language" value={contact.preferred_language} />
        <PropertyRow label="Assigned To" value={contact.assigned_to} />
      </SidebarSection>
    </div>
  )

  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') return
    setDeleting(true)
    try {
      await contactsAPI.delete(contact.id)
      router.push('/contacts')
    } catch {
      setDeleting(false)
    }
  }

  return (
    <>
      <RecordLayout leftColumn={leftColumn} rightColumn={rightColumn} />
      {showEdit && <ContactModal contact={contact} onClose={() => setShowEdit(false)} onSave={() => { setShowEdit(false); load() }} />}
      {showDelete && (
        <div className="modal-overlay" onClick={() => setShowDelete(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#DC2626' }}>Delete Contact</h2>
              <button onClick={() => setShowDelete(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '13px', color: '#3F3F3F', marginBottom: '8px' }}>
                You are about to permanently delete <strong>{contact.first_name} {contact.last_name}</strong>. This action cannot be undone.
              </p>
              <p style={{ fontSize: '13px', color: '#3F3F3F', marginBottom: '12px' }}>
                Type <strong style={{ color: '#DC2626' }}>DELETE</strong> to confirm.
              </p>
              <input
                className="form-input"
                value={deleteConfirm}
                onChange={e => setDeleteConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleDelete()}
                placeholder="Type DELETE to confirm"
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDelete(false)}>Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== 'DELETE' || deleting}
                style={{ background: deleteConfirm === 'DELETE' ? '#DC2626' : '#FCA5A5', color: 'white', padding: '8px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: '600', border: 'none', cursor: deleteConfirm === 'DELETE' ? 'pointer' : 'not-allowed', transition: 'background 0.15s' }}
              >
                {deleting ? 'Deleting...' : 'Delete Contact'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
