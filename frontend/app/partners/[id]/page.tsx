'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { partnersAPI } from '@/lib/api'
import { RecordLayout, PropertyRow, SidebarSection, SidebarCard, StatusBadge, TabNav } from '@/components/shared/RecordLayout'
import { PartnerModal } from '@/components/partners/PartnerModal'
import { PartnerActionItems } from '@/components/partners/PartnerActionItems'

export default function PartnerDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [partner, setPartner] = useState<any>(null)
  const [contacts, setContacts] = useState<any[]>([])
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Overview')
  const [showEdit, setShowEdit] = useState(false)

  const load = async () => {
    try {
      const [p, ctcts, opps] = await Promise.all([
        partnersAPI.get(id as string),
        partnersAPI.getContacts(id as string),
        partnersAPI.getOpportunities(id as string),
      ])
      setPartner(p)
      setContacts(ctcts)
      setOpportunities(opps)
    } catch {
      router.push('/partners')
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

  if (!partner) return null

  const color = '#7C3AED'

  const leftColumn = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontSize: '11px', color: '#9B9B9B' }}>
        <button onClick={() => router.push('/partners')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#219BD6', fontWeight: '600', fontSize: '11px', padding: 0 }}>Partners</button>
        <span>/</span><span style={{ color: '#3F3F3F', fontWeight: '600' }}>{partner.name}</span>
      </div>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1 }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '10px', background: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '800', flexShrink: 0 }}>
              {partner.name[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <h1 style={{ fontSize: '18px', fontWeight: '800', color: '#144766', margin: 0 }}>{partner.name}</h1>
                <StatusBadge value={partner.status} />
              </div>
              <p style={{ color: '#9B9B9B', fontSize: '12px', margin: 0 }}>
                {partner.contact_name && `${partner.contact_name} · `}
                {partner.sector || 'No sector'}
                {partner.country && ` · ${partner.country}`}
              </p>
              <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '11px' }}>
                {partner.phone && <span style={{ color: '#6B6B6B' }}>📞 {partner.phone}</span>}
                {partner.linkedin_url && <a href={partner.linkedin_url} target="_blank" rel="noopener" style={{ color: '#219BD6', fontWeight: '600' }}>LinkedIn ↗</a>}
              </div>
            </div>
          </div>
          <button onClick={() => setShowEdit(true)} style={{ background: 'white', color: '#144766', padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: '600', border: '1.5px solid #CBD5E0', cursor: 'pointer' }}>Edit</button>
        </div>
        {(partner.main_erp?.length > 0 || partner.cybersecurity_solutions?.length > 0 || partner.sap_hosting_partner?.length > 0 || partner.domain_names?.length > 0) && (
          <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid #F1F5F9', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {partner.domain_names?.length > 0 && <div><div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '5px' }}>Domains</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>{partner.domain_names.map((d: string) => <span key={d} style={{ background: '#F1F5F9', color: '#475569', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{d}</span>)}</div></div>}
            {partner.main_erp?.length > 0 && <div><div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '5px' }}>ERP</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>{partner.main_erp.map((v: string) => <span key={v} style={{ background: '#EEF2FF', color: '#4F46E5', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{v}</span>)}</div></div>}
            {partner.cybersecurity_solutions?.length > 0 && <div><div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '5px' }}>Cybersecurity</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>{partner.cybersecurity_solutions.map((v: string) => <span key={v} style={{ background: '#FFF7ED', color: '#EA580C', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{v}</span>)}</div></div>}
            {partner.sap_hosting_partner?.length > 0 && <div><div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', marginBottom: '5px' }}>SAP Hosting</div><div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>{partner.sap_hosting_partner.map((v: string) => <span key={v} style={{ background: '#ECFDF5', color: '#059669', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '600' }}>{v}</span>)}</div></div>}
          </div>
        )}
      </div>

      <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div style={{ padding: '0 20px', background: '#FAFBFC', borderBottom: '2px solid #E2E8F0' }}>
          <TabNav tabs={['Overview', 'Contacts', 'Opportunities', 'Action Items']} active={tab} onChange={setTab} />
        </div>
        <div style={{ padding: '20px' }}>
          {tab === 'Overview' && <p style={{ color: partner.notes ? '#3F3F3F' : '#CBD5E0', fontSize: '13px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{partner.notes || 'No general notes.'}</p>}
          {tab === 'Contacts' && (
            contacts.length === 0 ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No contacts yet.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {contacts.map((c: any) => (
                  <a key={c.id} href={`/contacts/${c.id}`} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#156082' }}>{c.first_name} {c.last_name}</span>
                    <span style={{ fontSize: '11px', color: '#9B9B9B' }}>{c.job_type || c.email || ''}</span>
                  </a>
                ))}
              </div>
            )
          )}
          {tab === 'Opportunities' && (
            opportunities.length === 0 ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No opportunities yet.</p> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {opportunities.map((o: any) => (
                  <a key={o.id} href={`/opportunities/${o.id}`} style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', padding: '10px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '600', color: '#156082' }}>{o.deal_name}</span>
                    <span style={{ fontSize: '11px', color: '#9B9B9B' }}>{o.deal_status}</span>
                  </a>
                ))}
              </div>
            )
          )}
          {tab === 'Action Items' && <PartnerActionItems partnerId={id as string} />}
        </div>
      </div>
    </div>
  )

  const rightColumn = (
    <div>
      <SidebarSection title="About this partner">
        <PropertyRow label="Status" value={<StatusBadge value={partner.status} />} />
        <PropertyRow label="Sector" value={partner.sector} />
        <PropertyRow label="Country" value={partner.country} />
        <PropertyRow label="Assigned to" value={partner.assigned_to} />
        <PropertyRow label="Created" value={new Date(partner.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
      </SidebarSection>
      <SidebarSection title={`Contacts (${contacts.length})`} onAdd={() => router.push(`/contacts?partner_id=${id}`)}>
        {contacts.length === 0 ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No contacts.</p> : contacts.map((c: any) => <SidebarCard key={c.id} title={`${c.first_name} ${c.last_name}`} subtitle={c.job_type || c.email} href={`/contacts/${c.id}`} color="#e97132" />)}
      </SidebarSection>
      <SidebarSection title={`Opportunities (${opportunities.length})`} onAdd={() => router.push(`/opportunities?partner_id=${id}`)}>
        {opportunities.length === 0 ? <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No opportunities.</p> : opportunities.map((o: any) => <SidebarCard key={o.id} title={o.deal_name} subtitle={o.deal_status} href={`/opportunities/${o.id}`} color="#219BD6" />)}
      </SidebarSection>
    </div>
  )

  return (
    <>
      <RecordLayout leftColumn={leftColumn} rightColumn={rightColumn} />
      {showEdit && <PartnerModal partner={partner} onClose={() => setShowEdit(false)} onSave={() => { setShowEdit(false); load() }} />}
    </>
  )
}
