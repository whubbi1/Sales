'use client'
// app/staffing/page.tsx
import { useState, useEffect, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { opportunitiesAPI } from '@/lib/api'
import { PageHeader } from '@/components/shared/RecordLayout'

function ByEmployee({ allStaffing, users, router, nameSearch }: any) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const byEmail: Record<string, any[]> = {}
  for (const s of allStaffing) {
    (byEmail[s.user_email] = byEmail[s.user_email] || []).push(s)
  }

  const rows = users.map((u: any) => ({ user: u, entries: byEmail[u.email] || [] }))
    .filter((r: any) => r.entries.length > 0)
    .filter((r: any) => !nameSearch.trim() || (r.user.display_name || `${r.user.first_name} ${r.user.last_name}`).toLowerCase().includes(nameSearch.trim().toLowerCase()))
    .sort((a: any, b: any) => b.entries.length - a.entries.length)

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead style={{ background: '#FAFBFC' }}>
        <tr>
          {['Employee', 'Department', 'Opportunities Staffed', ''].map(h => (
            <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#9B9B9B', fontSize: '13px' }}>No staffing assignments yet.</td></tr>
        ) : rows.map(({ user, entries }: any) => (
          <Fragment key={user.email}>
            <tr style={{ borderBottom: '1px solid #F1F5F9' }}>
              <td style={{ padding: '11px 16px', fontWeight: '700', color: '#144766', fontSize: '12px' }}>{user.display_name || `${user.first_name} ${user.last_name}`}</td>
              <td style={{ padding: '11px 16px', fontSize: '12px', color: '#3F3F3F' }}>{user.department || '—'}</td>
              <td style={{ padding: '11px 16px' }}>
                <span style={{ background: '#EFF6FF', color: '#219BD6', padding: '2px 9px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{entries.length}</span>
              </td>
              <td style={{ padding: '11px 16px' }}>
                <button onClick={() => setExpanded(expanded === user.email ? null : user.email)} style={{ padding: '4px 10px', background: '#F1F5F9', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#3F3F3F', fontWeight: '600' }}>
                  {expanded === user.email ? '▲ Hide' : '▼ View'}
                </button>
              </td>
            </tr>
            {expanded === user.email && (
              <tr>
                <td colSpan={4} style={{ padding: 0, background: '#F8FAFC' }}>
                  <div style={{ padding: '10px 20px' }}>
                    {entries.map((e: any) => (
                      <div key={e.id} onClick={() => router.push(`/opportunities/${e.opportunity_id}`)} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '12px', borderBottom: '1px solid #EDF2F7', cursor: 'pointer' }}>
                        <span style={{ fontWeight: '600', color: '#219BD6' }}>{e.opportunity_name}</span>
                        <span style={{ color: '#9B9B9B' }}>{e.role || ''}</span>
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            )}
          </Fragment>
        ))}
      </tbody>
    </table>
  )
}

function ByOpportunity({ opportunities, users, router, nameSearch }: any) {
  const [selected, setSelected] = useState('')
  const filteredOpportunities = opportunities.filter((o: any) => !nameSearch.trim() || o.deal_name.toLowerCase().includes(nameSearch.trim().toLowerCase()))
  const [staffing, setStaffing] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState('')

  const load = async (oppId: string) => {
    setLoading(true)
    try { setStaffing(await opportunitiesAPI.getStaffing(oppId)) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (selected) load(selected); else setStaffing([]) }, [selected])

  const addStaffing = async () => {
    if (!addEmail) return
    const u = users.find((uu: any) => uu.email === addEmail)
    await opportunitiesAPI.addStaffing(selected, { user_email: addEmail, user_name: u?.display_name || `${u?.first_name} ${u?.last_name}`, role: addRole })
    setAddEmail(''); setAddRole('')
    load(selected)
  }

  const removeStaffing = async (id: string) => {
    await opportunitiesAPI.removeStaffing(selected, id)
    load(selected)
  }

  return (
    <div>
      <div style={{ marginBottom: '14px' }}>
        <select className="form-input" style={{ width: '360px' }} value={selected} onChange={e => setSelected(e.target.value)}>
          <option value="">Select an opportunity…</option>
          {filteredOpportunities.map((o: any) => <option key={o.id} value={o.id}>{o.deal_name}{o.company ? ` · ${o.company.name}` : ''}</option>)}
        </select>
      </div>
      {!selected ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#9B9B9B', fontSize: '13px' }}>Pick an opportunity to manage its staffing.</div>
      ) : loading ? (
        <div style={{ textAlign: 'center', padding: '32px', color: '#219BD6', fontSize: '13px' }}>Loading…</div>
      ) : (
        <div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <select className="form-input" style={{ width: '240px' }} value={addEmail} onChange={e => setAddEmail(e.target.value)}>
              <option value="">Select employee…</option>
              {users.map((u: any) => <option key={u.email} value={u.email}>{u.display_name || `${u.first_name} ${u.last_name}`}</option>)}
            </select>
            <input className="form-input" style={{ width: '200px' }} placeholder="Role (optional)" value={addRole} onChange={e => setAddRole(e.target.value)} />
            <button className="btn-primary" onClick={addStaffing} disabled={!addEmail}>+ Add</button>
          </div>
          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#FAFBFC' }}>
                <tr>
                  {['Employee', 'Role', ''].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staffing.length === 0 ? (
                  <tr><td colSpan={3} style={{ textAlign: 'center', padding: '32px', color: '#9B9B9B', fontSize: '13px' }}>No one staffed on this opportunity yet.</td></tr>
                ) : staffing.map((s: any) => (
                  <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={{ padding: '10px 16px', fontWeight: '700', color: '#144766', fontSize: '12px' }}>{s.user_name || s.user_email}</td>
                    <td style={{ padding: '10px 16px', fontSize: '12px', color: '#3F3F3F' }}>{s.role || '—'}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <button onClick={() => removeStaffing(s.id)} style={{ padding: '4px 10px', background: '#FEF2F2', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', color: '#DC2626', fontWeight: '700' }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default function StaffingPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'employee' | 'opportunity'>('employee')
  const [allStaffing, setAllStaffing] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [opportunities, setOpportunities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [nameSearch, setNameSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [staffing, usersResp, opps] = await Promise.all([
        opportunitiesAPI.getAllStaffing(),
        fetch('https://api.whubbi.wcomply.com/settings/users').then(r => r.json()),
        opportunitiesAPI.list({}),
      ])
      setAllStaffing(staffing)
      setUsers(usersResp.users || [])
      setOpportunities(opps)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  return (
    <div style={{ display: 'flex' }}>
      <Sidebar />
      <main style={{ marginLeft: '220px', minHeight: '100vh', width: 'calc(100vw - 220px)', background: '#F5F7FA' }}>
        <div style={{ padding: '24px 28px' }}>
          <PageHeader title="Staffing" count={allStaffing.length} search={{ value: nameSearch, onChange: setNameSearch }} />

          <div style={{ display: 'flex', gap: '3px', marginBottom: '16px', background: 'white', padding: '4px', borderRadius: '10px', border: '1px solid #EDF2F7', width: 'fit-content' }}>
            {[{ id: 'employee', label: 'By Employee' }, { id: 'opportunity', label: 'By Opportunity' }].map(t => (
              <button key={t.id} onClick={() => setTab(t.id as any)} style={{ padding: '8px 18px', borderRadius: '7px', border: 'none', background: tab === t.id ? '#156082' : 'transparent', color: tab === t.id ? 'white' : '#219BD6', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden', padding: tab === 'opportunity' ? '20px' : 0 }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '48px', color: '#9B9B9B', fontSize: '13px' }}>Loading...</div>
            ) : tab === 'employee' ? (
              <ByEmployee allStaffing={allStaffing} users={users} router={router} nameSearch={nameSearch} />
            ) : (
              <ByOpportunity opportunities={opportunities} users={users} router={router} nameSearch={nameSearch} />
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
