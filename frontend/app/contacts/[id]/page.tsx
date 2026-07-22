'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { contactsAPI, marketingAPI, projectsAPI, partnersAPI } from '@/lib/api'
import { RecordLayout, PropertyRow, SidebarSection, SidebarCard, StatusBadge, TabNav } from '@/components/shared/RecordLayout'
import { ContactModal } from '@/components/contacts/ContactModal'
import { ContactNotes } from '@/components/contacts/ContactNotes'
import { ContactArticles } from '@/components/contacts/ContactArticles'
import { EntityTasks } from '@/components/tasks/EntityTasks'
import { ActivityFeed } from '@/components/shared/ActivityFeed'

const SUB_LABELS: Record<string, string> = { 'Marketing Information': '📧', 'Customer Service Communication': '💬', 'One to One': '🤝', 'Opted Out': '🚫' }

const DATA_SOURCE_OPTIONS = ['LinkedIn', 'Event', 'Project', 'Partner']

// Maps a Data Source ref type to how to fetch/list/label its records.
const REF_TYPE_CONFIG: Record<string, { fetch: () => Promise<any[]>; label: (r: any) => string }> = {
  Event:   { fetch: () => marketingAPI.listEvents().then((d: any) => d.events || []), label: (r: any) => r.title },
  Project: { fetch: () => projectsAPI.list(), label: (r: any) => r.project_name },
  Partner: { fetch: () => partnersAPI.list(), label: (r: any) => r.name },
}

function DataSourcePickerModal({ type, onClose, onSelect }: { type: string; onClose: () => void; onSelect: (id: string, name: string) => void }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const cfg = REF_TYPE_CONFIG[type]

  useEffect(() => {
    cfg.fetch().then(setItems).catch(() => setItems({} as any)).finally(() => setLoading(false))
  }, [type])

  const filtered = (Array.isArray(items) ? items : []).filter(i => !search || cfg.label(i)?.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766' }}>Select {type}</h2>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body">
          <input className="form-input" autoFocus placeholder={`Search ${type.toLowerCase()}s…`} value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', boxSizing: 'border-box', marginBottom: '10px' }} />
          <div style={{ maxHeight: '320px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {loading ? (
              <p style={{ fontSize: '12px', color: '#9B9B9B', textAlign: 'center', padding: '20px' }}>Loading…</p>
            ) : filtered.length === 0 ? (
              <p style={{ fontSize: '12px', color: '#9B9B9B', textAlign: 'center', padding: '20px' }}>No {type.toLowerCase()}s found.</p>
            ) : filtered.map(item => (
              <div key={item.id} onClick={() => onSelect(item.id, cfg.label(item))}
                style={{ padding: '9px 12px', borderRadius: '7px', border: '1px solid #EDF2F7', cursor: 'pointer', fontSize: '13px', color: '#144766', fontWeight: '600' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {cfg.label(item) || '(unnamed)'}
              </div>
            ))}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

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

  const [editingDataSource, setEditingDataSource] = useState(false)
  const [dataSourceRefName, setDataSourceRefName] = useState('')
  const [pickerType, setPickerType] = useState<string | null>(null)

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
      if (c.data_source_ref_type && c.data_source_ref_id) {
        const cfg = REF_TYPE_CONFIG[c.data_source_ref_type]
        if (cfg) {
          const items = await cfg.fetch().catch(() => [])
          const match = (Array.isArray(items) ? items : []).find((i: any) => i.id === c.data_source_ref_id)
          setDataSourceRefName(match ? cfg.label(match) : '')
        }
      } else {
        setDataSourceRefName('')
      }
    } catch {
      router.push('/contacts')
    } finally {
      setLoading(false)
    }
  }

  const saveDataSource = async (newSource: string) => {
    setEditingDataSource(false)
    if (newSource === 'LinkedIn') {
      await contactsAPI.update(contact.id, { data_source: 'LinkedIn', data_source_ref_type: null, data_source_ref_id: null })
      load()
    } else {
      await contactsAPI.update(contact.id, { data_source: newSource, data_source_ref_type: newSource, data_source_ref_id: null })
      setPickerType(newSource)
      load()
    }
  }

  const selectDataSourceRef = async (refId: string, refName: string) => {
    if (!pickerType) return
    await contactsAPI.update(contact.id, { data_source: pickerType, data_source_ref_type: pickerType, data_source_ref_id: refId })
    setDataSourceRefName(refName)
    setPickerType(null)
    load()
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
                {editingDataSource ? (
                  <select autoFocus className="form-input" style={{ fontSize: '10px', padding: '2px 4px' }} defaultValue={contact.data_source || 'LinkedIn'}
                    onChange={e => saveDataSource(e.target.value)} onBlur={() => setEditingDataSource(false)}>
                    {DATA_SOURCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <span onClick={() => setEditingDataSource(true)} title="Data Source — click to change"
                    style={{ background: '#F1F5F9', color: '#45B6E4', padding: '2px 9px', borderRadius: '12px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>
                    📍 {contact.data_source || 'LinkedIn'}
                  </span>
                )}
                {contact.data_source && contact.data_source !== 'LinkedIn' && (
                  <span onClick={() => setPickerType(contact.data_source)} title="Click to select the record"
                    style={{ background: dataSourceRefName ? '#EFF6FF' : '#FEF2F2', color: dataSourceRefName ? '#156082' : '#DC2626', padding: '2px 9px', borderRadius: '12px', fontSize: '10px', fontWeight: '700', cursor: 'pointer' }}>
                    {dataSourceRefName || 'select record…'}
                  </span>
                )}
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
                  {contact.subscriptions.map((sub: string) => (
                    <span key={sub} style={{ background: sub === 'Opted Out' ? '#FEF2F2' : '#ECFDF5', color: sub === 'Opted Out' ? '#DC2626' : '#059669', padding: '2px 9px', borderRadius: '12px', fontSize: '10px', fontWeight: '600' }}>
                      {SUB_LABELS[sub] || '✓'} {sub}
                    </span>
                  ))}
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
          {tab === 'Tasks' && <EntityTasks entityType="contact" entityId={id as string} entityLabel={`${contact.first_name} ${contact.last_name}`} />}
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
      <SidebarSection
        title={`Leads (${leads.length})`}
        onAdd={() => router.push(`/leads?contact_id=${id}${contact.company_id ? `&company_id=${contact.company_id}` : ''}${contact.partner_id ? `&partner_id=${contact.partner_id}` : ''}`)}
      >
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
        <PropertyRow label="Data Source" value={
          editingDataSource ? (
            <select autoFocus className="form-input" style={{ fontSize: '12px', padding: '4px 6px' }} defaultValue={contact.data_source || 'LinkedIn'}
              onChange={e => saveDataSource(e.target.value)} onBlur={() => setEditingDataSource(false)}>
              {DATA_SOURCE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <span>
              <span onClick={() => setEditingDataSource(true)} title="Click to change" style={{ cursor: 'pointer', padding: '4px 6px', margin: '-4px -6px', borderRadius: '5px', display: 'inline-block' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F1F5F9')} onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                {contact.data_source || 'LinkedIn'}
              </span>
              {contact.data_source && contact.data_source !== 'LinkedIn' && (
                <span onClick={() => setPickerType(contact.data_source)} title="Click to select the record" style={{ cursor: 'pointer', color: dataSourceRefName ? '#144766' : '#DC2626', marginLeft: '4px' }}>
                  — {dataSourceRefName || 'select…'}
                </span>
              )}
            </span>
          )
        } />
        <PropertyRow label="Language" value={contact.preferred_language} />
        <PropertyRow label="Assigned To" value={contact.assigned_to} />
        <PropertyRow label="Created" value={contact.created_at ? new Date(contact.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null} />
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
      {pickerType && <DataSourcePickerModal type={pickerType} onClose={() => setPickerType(null)} onSelect={selectDataSourceRef} />}
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
