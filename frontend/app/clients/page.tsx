'use client'
// app/clients/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { clientsAPI } from '@/lib/api'
import { ClientModal } from '@/components/clients/ClientModal'

const STATUS_BADGE: Record<string, string> = {
  lead: 'badge-lead', prospect: 'badge-prospect', client: 'badge-client', partner: 'badge-partner',
}

const LEVEL_LABELS: Record<number, string> = {
  1: 'Group', 2: 'Parent', 3: 'Child', 4: 'Sub-Child'
}

export default function ClientsPage() {
  const router = useRouter()
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showModal, setShowModal] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      const data = await clientsAPI.list({ search: search || undefined, status: statusFilter || undefined })
      setClients(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [search, statusFilter])

  const topLevel = clients.filter(c => !c.parent_id)
  const byParent: Record<string, any[]> = {}
  clients.forEach(c => {
    if (c.parent_id) {
      if (!byParent[c.parent_id]) byParent[c.parent_id] = []
      byParent[c.parent_id].push(c)
    }
  })

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main className="main-content">
        <div className="page-container">

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
            <div>
              <h1 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--primary)', marginBottom: '3px' }}>Clients</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{clients.length} compan{clients.length !== 1 ? 'ies' : 'y'}</p>
            </div>
            <button className="btn-primary" onClick={() => setShowModal(true)}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Client
            </button>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1', minWidth: '220px', maxWidth: '360px' }}>
              <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input className="form-input" style={{ paddingLeft: '32px' }}
                placeholder="Search by company or contact..."
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select className="form-input" style={{ width: '160px' }}
              value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              <option value="lead">Lead</option>
              <option value="prospect">Prospect</option>
              <option value="client">Client</option>
              <option value="partner">Partner</option>
            </select>
          </div>

          {/* Table */}
          <div className="card">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Company</th>
                    <th>Contact</th>
                    <th>Level</th>
                    <th>Domains</th>
                    <th>ERP</th>
                    <th>Hosting</th>
                    <th>Status</th>
                    <th>Assigned To</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                      Loading...
                    </td></tr>
                  ) : clients.length === 0 ? (
                    <tr><td colSpan={8}>
                      <div className="empty-state">
                        <div className="empty-state-icon">🏢</div>
                        <div className="empty-state-title">No clients yet</div>
                        <div className="empty-state-desc">Create your first client by clicking "New Client"</div>
                      </div>
                    </td></tr>
                  ) : clients.map((client) => (
                    <tr key={client.id} onClick={() => router.push(`/clients/${client.id}`)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {/* Indentation based on level */}
                          {client.level > 1 && (
                            <span style={{ color: '#CBD5E0', fontSize: '16px', marginLeft: `${(client.level - 1) * 16}px` }}>└</span>
                          )}
                          <div style={{
                            width: '32px', height: '32px', borderRadius: '7px',
                            background: client.level === 1 ? 'var(--primary)' : client.level === 2 ? 'var(--primary-light)' : client.level === 3 ? 'var(--secondary)' : '#7DD3F0',
                            color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '13px', fontWeight: '700', flexShrink: 0
                          }}>
                            {client.company[0].toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontWeight: '600', color: 'var(--primary)', fontSize: '13px' }}>{client.company}</div>
                            {client.parent && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>↑ {client.parent.company}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '13px' }}>{client.name}</td>
                      <td><span className={`level-badge level-${client.level}`}>{LEVEL_LABELS[client.level]}</span></td>
                      <td>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {(client.domain_names || []).slice(0, 2).join(', ')}
                          {(client.domain_names || []).length > 2 && <span style={{ color: 'var(--secondary)' }}> +{client.domain_names.length - 2}</span>}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                          {(client.main_erp || []).slice(0, 2).map((e: string) => (
                            <span key={e} style={{ background: '#EEF2FF', color: '#4F46E5', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{e}</span>
                          ))}
                          {(client.main_erp || []).length > 2 && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>+{client.main_erp.length - 2}</span>}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                          {(client.sap_hosting_partner || []).slice(0, 2).map((h: string) => (
                            <span key={h} style={{ background: '#ECFDF5', color: '#059669', padding: '2px 7px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{h}</span>
                          ))}
                        </div>
                      </td>
                      <td><span className={`badge ${STATUS_BADGE[client.status]}`}>{client.status}</span></td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{client.assigned_to || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
        {showModal && <ClientModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); load() }} clients={clients} />}
      </main>
    </div>
  )
}
