'use client'
// app/clients/[id]/page.tsx
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sidebar } from '@/components/Sidebar'
import { clientsAPI } from '@/lib/api'
import { ClientModal } from '@/components/clients/ClientModal'
import { ClientNotes } from '@/components/clients/ClientNotes'
import { ClientArticles } from '@/components/clients/ClientArticles'
import { ClientTasks } from '@/components/clients/ClientTasks'

const STATUS_BADGE: Record<string, string> = {
  lead: 'badge-lead', prospect: 'badge-prospect', client: 'badge-client', partner: 'badge-partner',
}
const LEVEL_LABELS: Record<number, string> = { 1: 'Group', 2: 'Parent', 3: 'Child', 4: 'Sub-Child' }
const TABS = ['Overview', 'Notes', 'Articles', 'Tasks']

export default function ClientDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [client, setClient] = useState<any>(null)
  const [allClients, setAllClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('Overview')
  const [showEdit, setShowEdit] = useState(false)

  const load = async () => {
    try {
      const [c, all] = await Promise.all([clientsAPI.get(id as string), clientsAPI.list({})])
      setClient(c)
      setAllClients(all)
    } catch {
      router.push('/clients')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  if (loading) return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main className="main-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
      </main>
    </div>
  )

  const primaryColor = client.level === 1 ? 'var(--primary)' : client.level === 2 ? 'var(--primary-light)' : client.level === 3 ? 'var(--secondary)' : '#7DD3F0'

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main className="main-content">
        <div className="page-container">

          {/* Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <button onClick={() => router.push('/clients')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--secondary)', fontWeight: '600', fontSize: '12px', padding: 0 }}>
              Clients
            </button>
            {client.parent && (
              <>
                <span>/</span>
                <Link href={`/clients/${client.parent.id}`} style={{ color: 'var(--secondary)', fontWeight: '600', textDecoration: 'none' }}>
                  {client.parent.company}
                </Link>
              </>
            )}
            <span>/</span>
            <span style={{ color: 'var(--text)', fontWeight: '600' }}>{client.company}</span>
          </div>

          {/* Two-column layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', alignItems: 'start' }}>

            {/* Left column — main content */}
            <div>
              {/* Header card */}
              <div className="card" style={{ padding: '24px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flex: 1 }}>
                    <div style={{
                      width: '52px', height: '52px', borderRadius: '12px',
                      background: primaryColor, color: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '20px', fontWeight: '800', flexShrink: 0
                    }}>
                      {client.company[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                        <h1 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--primary)' }}>{client.company}</h1>
                        <span className={`badge ${STATUS_BADGE[client.status]}`}>{client.status}</span>
                        <span className={`level-badge level-${client.level}`}>{LEVEL_LABELS[client.level]}</span>
                      </div>
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '10px' }}>
                        {client.name}{client.sector ? ` · ${client.sector}` : ''}
                        {client.assigned_to ? ` · Assigned to ${client.assigned_to}` : ''}
                      </p>
                      <div style={{ display: 'flex', gap: '14px', fontSize: '12px', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                        {client.phone && (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.18 2 2 0 0 1 3.6 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.57a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                            </svg>
                            {client.phone}
                          </span>
                        )}
                        {client.linkedin_url && (
                          <a href={client.linkedin_url} target="_blank" rel="noopener"
                            style={{ color: 'var(--secondary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                            LinkedIn ↗
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <button className="btn-secondary" onClick={() => setShowEdit(true)} style={{ flexShrink: 0 }}>Edit</button>
                </div>

                {/* Tags row */}
                {(client.main_erp?.length > 0 || client.cybersecurity_solutions?.length > 0 || client.sap_hosting_partner?.length > 0 || client.domain_names?.length > 0) && (
                  <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-light)', display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                    {client.domain_names?.length > 0 && (
                      <div>
                        <p className="section-title" style={{ marginBottom: '6px' }}>Domains</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {client.domain_names.map((d: string) => (
                            <span key={d} style={{ background: '#F1F5F9', color: '#475569', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>{d}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {client.main_erp?.length > 0 && (
                      <div>
                        <p className="section-title" style={{ marginBottom: '6px' }}>ERP</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {client.main_erp.map((v: string) => (
                            <span key={v} style={{ background: '#EEF2FF', color: '#4F46E5', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>{v}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {client.cybersecurity_solutions?.length > 0 && (
                      <div>
                        <p className="section-title" style={{ marginBottom: '6px' }}>Cybersecurity</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {client.cybersecurity_solutions.map((v: string) => (
                            <span key={v} style={{ background: '#FFF7ED', color: '#EA580C', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>{v}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {client.sap_hosting_partner?.length > 0 && (
                      <div>
                        <p className="section-title" style={{ marginBottom: '6px' }}>SAP Hosting</p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {client.sap_hosting_partner.map((v: string) => (
                            <span key={v} style={{ background: '#ECFDF5', color: '#059669', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '600' }}>{v}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="card" style={{ overflow: 'hidden' }}>
                <div className="tab-nav" style={{ padding: '0 24px', background: '#FAFBFC' }}>
                  {TABS.map(t => (
                    <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
                  ))}
                </div>
                <div style={{ padding: '24px' }}>
                  {tab === 'Overview' && (
                    <div>
                      <p className="section-title">General Notes</p>
                      <p style={{ color: client.notes ? 'var(--text)' : 'var(--text-muted)', fontSize: '14px', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>
                        {client.notes || 'No general notes. Click "Edit" to add some.'}
                      </p>
                    </div>
                  )}
                  {tab === 'Notes' && <ClientNotes clientId={id as string} />}
                  {tab === 'Articles' && <ClientArticles clientId={id as string} />}
                  {tab === 'Tasks' && <ClientTasks clientId={id as string} />}
                </div>
              </div>
            </div>

            {/* Right column — hierarchy + info */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              {/* Hierarchy tree */}
              <div className="card" style={{ padding: '18px' }}>
                <p className="section-title" style={{ marginBottom: '12px' }}>Company Hierarchy</p>
                <HierarchyTree client={client} currentId={id as string} />
              </div>

              {/* Quick info */}
              <div className="card" style={{ padding: '18px' }}>
                <p className="section-title" style={{ marginBottom: '12px' }}>Quick Info</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <InfoRow label="Status" value={<span className={`badge ${STATUS_BADGE[client.status]}`}>{client.status}</span>} />
                  <InfoRow label="Level" value={<span className={`level-badge level-${client.level}`}>{LEVEL_LABELS[client.level]}</span>} />
                  <InfoRow label="Sector" value={client.sector || '—'} />
                  <InfoRow label="Assigned to" value={client.assigned_to || '—'} />
                  <InfoRow label="Created" value={new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
                  <InfoRow label="Updated" value={new Date(client.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
                </div>
              </div>

            </div>
          </div>
        </div>

        {showEdit && (
          <ClientModal client={client} clients={allClients} onClose={() => setShowEdit(false)} onSave={() => { setShowEdit(false); load() }} />
        )}
      </main>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
      <span style={{ color: 'var(--text-muted)', fontWeight: '600' }}>{label}</span>
      <span style={{ color: 'var(--text)', fontWeight: '500', textAlign: 'right' }}>{value}</span>
    </div>
  )
}

function HierarchyTree({ client, currentId }: { client: any; currentId: string }) {
  const renderNode = (node: any, depth: number = 0) => {
    const isCurrent = node.id === currentId
    const levelColor = ['#144766', '#1a5a84', '#219BD6', '#7DD3F0'][node.level - 1] || '#144766'

    return (
      <div key={node.id}>
        <Link href={`/clients/${node.id}`} style={{ textDecoration: 'none' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '7px 8px', borderRadius: '7px', marginLeft: `${depth * 16}px`,
            background: isCurrent ? 'rgba(20,71,102,0.06)' : 'transparent',
            border: isCurrent ? '1.5px solid rgba(20,71,102,0.15)' : '1.5px solid transparent',
            cursor: 'pointer', transition: 'background 0.12s'
          }}>
            {depth > 0 && <span style={{ color: '#CBD5E0', fontSize: '14px', flexShrink: 0 }}>└</span>}
            <div style={{
              width: '24px', height: '24px', borderRadius: '5px',
              background: levelColor, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '10px', fontWeight: '800', flexShrink: 0
            }}>
              {node.company[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: '12px', fontWeight: isCurrent ? '700' : '500',
                color: isCurrent ? 'var(--primary)' : 'var(--text)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>{node.company}</p>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                Level {node.level} · {node.status}
              </p>
            </div>
          </div>
        </Link>
        {node.children?.map((child: any) => renderNode(child, depth + 1))}
      </div>
    )
  }

  // Find root
  const findRoot = (node: any): any => node.parent || node
  const root = findRoot(client)

  return <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>{renderNode(root)}</div>
}
