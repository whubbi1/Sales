'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const API = 'https://api.whubbi.wcomply.com'

const MODULE_COLOR: Record<string,string> = {
  hr: '#156082', grc: '#0a2d40', helpdesk: '#45B6E4', admin: '#e97132',
}
const ACTION_COLOR: Record<string,{bg:string;color:string}> = {
  CREATE: { bg:'#ECFDF5', color:'#059669' },
  UPDATE: { bg:'#FFF7ED', color:'#D97706' },
  DELETE: { bg:'#FEF2F2', color:'#DC2626' },
}

export default function AuditPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'logs'|'retention'>('logs')

  // ── Audit logs state ──────────────────────────────────────────────────────
  const [logs, setLogs]         = useState<any[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(false)
  const [page, setPage]         = useState(0)
  const [filter, setFilter]     = useState({ module:'', action:'', table_name:'', changed_by:'' })
  const [expanded, setExpanded] = useState<string|null>(null)
  const PAGE_SIZE = 50

  // ── Retention state ───────────────────────────────────────────────────────
  const [retentionSettings, setRetentionSettings] = useState<any[]>([])
  const [retLoading, setRetLoading] = useState(false)
  const [editing, setEditing]       = useState<Record<string,number>>({})
  const [saving, setSaving]         = useState<string|null>(null)
  const [cleanupResult, setCleanupResult] = useState<any>(null)
  const [running, setRunning] = useState(false)

  const loadLogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE), offset: String(page * PAGE_SIZE),
      ...(filter.module      && { module:      filter.module }),
      ...(filter.action      && { action:      filter.action }),
      ...(filter.table_name  && { table_name:  filter.table_name }),
      ...(filter.changed_by  && { changed_by:  filter.changed_by }),
    })
    try {
      const r = await fetch(`${API}/admin/audit/logs?${params}`)
      const d = await r.json()
      setLogs(d.logs || [])
      setTotal(d.total || 0)
    } finally { setLoading(false) }
  }, [page, filter])

  const loadRetention = async () => {
    setRetLoading(true)
    try {
      const r = await fetch(`${API}/admin/audit/retention`)
      const d = await r.json()
      setRetentionSettings(d.settings || [])
      const ed: Record<string,number> = {}
      for (const s of d.settings || []) ed[s.table_name] = s.retention_days
      setEditing(ed)
    } finally { setRetLoading(false) }
  }

  useEffect(() => { loadLogs() }, [loadLogs])
  useEffect(() => { if (tab === 'retention') loadRetention() }, [tab])

  const saveRetention = async (table_name: string, module: string) => {
    setSaving(table_name)
    await fetch(`${API}/admin/audit/retention/${encodeURIComponent(table_name)}`, {
      method: 'PUT', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ retention_days: editing[table_name], module, updated_by: 'william.delcour@wcomply.com' })
    })
    setSaving(null)
  }

  const runCleanup = async () => {
    setRunning(true); setCleanupResult(null)
    try {
      const r = await fetch(`${API}/admin/audit/cleanup`, { method: 'POST' })
      const d = await r.json()
      setCleanupResult(d)
      await loadLogs()
    } finally { setRunning(false) }
  }

  const fmtDate = (iso: string) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) + ' ' +
           d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  const TAB: React.CSSProperties = { padding:'8px 18px', border:'none', cursor:'pointer', fontFamily:'Montserrat, sans-serif', fontSize:'12px', fontWeight:'700', borderRadius:'8px 8px 0 0' }

  return (
    <div style={{ padding:'28px 32px', fontFamily:'Montserrat, sans-serif' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
        <div>
          <h1 style={{ fontSize:'20px', fontWeight:'800', color:'#156082', marginBottom:'4px' }}>📋 Audit Logs</h1>
          <p style={{ fontSize:'12px', color:'#45B6E4' }}>All data changes across WHUBBI — {total.toLocaleString()} total entries</p>
        </div>
        <button onClick={() => router.push('/admin')}
          style={{ padding:'8px 16px', background:'#EFF6FF', color:'#156082', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
          ← Admin
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'2px solid #EDF2F7', marginBottom:'20px' }}>
        <button onClick={() => setTab('logs')} style={{ ...TAB, background:tab==='logs'?'white':'transparent', color:tab==='logs'?'#156082':'#45B6E4', borderBottom:tab==='logs'?'2px solid #156082':'none', marginBottom:'-2px' }}>Audit Logs</button>
        <button onClick={() => setTab('retention')} style={{ ...TAB, background:tab==='retention'?'white':'transparent', color:tab==='retention'?'#156082':'#45B6E4', borderBottom:tab==='retention'?'2px solid #156082':'none', marginBottom:'-2px' }}>Retention Settings</button>
      </div>

      {/* ── LOGS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'logs' && (
        <>
          {/* Filters */}
          <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'16px', marginBottom:'16px', display:'flex', gap:'10px', flexWrap:'wrap' }}>
            {([
              ['module',     'Module',      ['','hr','grc','helpdesk','admin']],
              ['action',     'Action',      ['','CREATE','UPDATE','DELETE']],
            ] as [keyof typeof filter, string, string[]][]).map(([key, label, options]) => (
              <div key={key}>
                <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'4px' }}>{label}</label>
                <select value={filter[key]} onChange={e => { setFilter(f => ({...f,[key]:e.target.value})); setPage(0) }}
                  style={{ padding:'7px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', background:'white' }}>
                  {options.map(o => <option key={o} value={o}>{o || `All ${label}s`}</option>)}
                </select>
              </div>
            ))}
            <div>
              <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'4px' }}>Table</label>
              <input value={filter.table_name} onChange={e => { setFilter(f => ({...f,table_name:e.target.value})); setPage(0) }} placeholder="Filter by table..."
                style={{ padding:'7px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', width:'160px' }}/>
            </div>
            <div>
              <label style={{ display:'block', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', marginBottom:'4px' }}>Changed by</label>
              <input value={filter.changed_by} onChange={e => { setFilter(f => ({...f,changed_by:e.target.value})); setPage(0) }} placeholder="Email..."
                style={{ padding:'7px 10px', border:'1.5px solid #EDF2F7', borderRadius:'7px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none', width:'160px' }}/>
            </div>
          </div>

          {/* Table */}
          <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden' }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                <thead>
                  <tr style={{ background:'#F8FAFC' }}>
                    {['When','Module','Table','Record ID','Action','Changed by','Description'].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', borderBottom:'1px solid #EDF2F7', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr><td colSpan={7} style={{ padding:'48px', textAlign:'center', color:'#45B6E4' }}>Loading...</td></tr>
                  )}
                  {!loading && logs.length === 0 && (
                    <tr><td colSpan={7} style={{ padding:'48px', textAlign:'center', color:'#45B6E4' }}>No audit logs yet. Changes will be recorded here as users interact with the system.</td></tr>
                  )}
                  {logs.map((log, i) => {
                    const ac = ACTION_COLOR[log.action] || { bg:'#F1F5F9', color:'#45B6E4' }
                    const isExp = expanded === log.id
                    return (
                      <>
                        <tr key={log.id} onClick={() => setExpanded(isExp ? null : log.id)}
                          style={{ borderBottom:'1px solid #F9FAFB', background:i%2===0?'white':'#FAFBFC', cursor:'pointer' }}>
                          <td style={{ padding:'10px 14px', color:'#3F3F3F', whiteSpace:'nowrap' }}>{fmtDate(log.changed_at)}</td>
                          <td style={{ padding:'10px 14px' }}>
                            <span style={{ background:`${MODULE_COLOR[log.module]||'#45B6E4'}15`, color:MODULE_COLOR[log.module]||'#45B6E4', padding:'2px 7px', borderRadius:'4px', fontSize:'10px', fontWeight:'700' }}>
                              {log.module || '—'}
                            </span>
                          </td>
                          <td style={{ padding:'10px 14px', color:'#156082', fontWeight:'600' }}>{log.table_name}</td>
                          <td style={{ padding:'10px 14px', color:'#45B6E4', fontSize:'10px', fontFamily:'monospace', maxWidth:'120px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{log.record_id || '—'}</td>
                          <td style={{ padding:'10px 14px' }}>
                            <span style={{ background:ac.bg, color:ac.color, padding:'2px 8px', borderRadius:'4px', fontSize:'10px', fontWeight:'700' }}>{log.action}</span>
                          </td>
                          <td style={{ padding:'10px 14px', color:'#3F3F3F', maxWidth:'180px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{log.changed_by || '—'}</td>
                          <td style={{ padding:'10px 14px', color:'#3F3F3F', maxWidth:'200px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{log.description || '—'}</td>
                        </tr>
                        {isExp && (log.old_values || log.new_values) && (
                          <tr key={`${log.id}-exp`}>
                            <td colSpan={7} style={{ padding:'12px 14px', background:'#F0F9FF', borderBottom:'1px solid #EDF2F7' }}>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
                                {log.old_values && (
                                  <div>
                                    <div style={{ fontSize:'10px', fontWeight:'700', color:'#DC2626', marginBottom:'6px' }}>BEFORE</div>
                                    <pre style={{ fontSize:'11px', background:'white', padding:'10px', borderRadius:'6px', border:'1px solid #EDF2F7', margin:0, overflow:'auto', maxHeight:'200px' }}>{JSON.stringify(log.old_values,null,2)}</pre>
                                  </div>
                                )}
                                {log.new_values && (
                                  <div>
                                    <div style={{ fontSize:'10px', fontWeight:'700', color:'#059669', marginBottom:'6px' }}>AFTER</div>
                                    <pre style={{ fontSize:'11px', background:'white', padding:'10px', borderRadius:'6px', border:'1px solid #EDF2F7', margin:0, overflow:'auto', maxHeight:'200px' }}>{JSON.stringify(log.new_values,null,2)}</pre>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ padding:'12px 16px', borderTop:'1px solid #EDF2F7', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontSize:'12px', color:'#45B6E4' }}>Page {page+1} of {totalPages} — {total} entries</span>
                <div style={{ display:'flex', gap:'6px' }}>
                  <button onClick={() => setPage(p => Math.max(0,p-1))} disabled={page===0}
                    style={{ padding:'5px 12px', border:'1px solid #EDF2F7', borderRadius:'6px', background:'white', cursor:page===0?'not-allowed':'pointer', fontSize:'12px', color:page===0?'#94A3B8':'#156082' }}>← Prev</button>
                  <button onClick={() => setPage(p => Math.min(totalPages-1,p+1))} disabled={page===totalPages-1}
                    style={{ padding:'5px 12px', border:'1px solid #EDF2F7', borderRadius:'6px', background:'white', cursor:page===totalPages-1?'not-allowed':'pointer', fontSize:'12px', color:page===totalPages-1?'#94A3B8':'#156082' }}>Next →</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── RETENTION TAB ────────────────────────────────────────────────── */}
      {tab === 'retention' && (
        <div>
          {/* Run cleanup */}
          <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', padding:'16px 20px', marginBottom:'20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ fontSize:'13px', fontWeight:'700', color:'#156082', marginBottom:'4px' }}>🧹 Run Log Cleanup Now</div>
              <div style={{ fontSize:'11px', color:'#45B6E4' }}>Deletes audit log entries older than the configured retention period</div>
              {cleanupResult && (
                <div style={{ fontSize:'11px', color:'#059669', marginTop:'6px', fontWeight:'600' }}>
                  ✓ Deleted {cleanupResult.deleted} entries (cutoff: {cleanupResult.cutoff?.slice(0,10)}, retention: {cleanupResult.retention_days} days)
                </div>
              )}
            </div>
            <button onClick={runCleanup} disabled={running}
              style={{ padding:'9px 20px', background:running?'#F1F5F9':'#156082', color:running?'#45B6E4':'white', border:'none', borderRadius:'8px', fontSize:'12px', fontWeight:'700', cursor:running?'not-allowed':'pointer', fontFamily:'Montserrat, sans-serif' }}>
              {running ? 'Running...' : '🗑️ Run Cleanup'}
            </button>
          </div>

          {retLoading && <div style={{ textAlign:'center', padding:'48px', color:'#45B6E4' }}>Loading settings...</div>}

          {!retLoading && (
            <div style={{ background:'white', borderRadius:'12px', border:'1px solid #EDF2F7', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                <thead>
                  <tr style={{ background:'#F8FAFC' }}>
                    {['Module','Table','Retention (days)','Last updated by',''].map(h => (
                      <th key={h} style={{ padding:'10px 16px', textAlign:'left', fontSize:'10px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'#45B6E4', borderBottom:'1px solid #EDF2F7' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {retentionSettings.map((s, i) => (
                    <tr key={s.table_name} style={{ borderBottom:'1px solid #F9FAFB', background:i%2===0?'white':'#FAFBFC' }}>
                      <td style={{ padding:'10px 16px' }}>
                        <span style={{ background:`${MODULE_COLOR[s.module]||'#45B6E4'}15`, color:MODULE_COLOR[s.module]||'#45B6E4', padding:'2px 7px', borderRadius:'4px', fontSize:'10px', fontWeight:'700' }}>{s.module}</span>
                      </td>
                      <td style={{ padding:'10px 16px', color:'#156082', fontWeight:'600' }}>{s.table_name}</td>
                      <td style={{ padding:'10px 16px' }}>
                        <input
                          type="number" min={1} max={3650}
                          value={editing[s.table_name] ?? s.retention_days}
                          onChange={e => setEditing(prev => ({...prev, [s.table_name]: parseInt(e.target.value)||1}))}
                          style={{ width:'80px', padding:'5px 8px', border:'1.5px solid #EDF2F7', borderRadius:'6px', fontFamily:'Montserrat, sans-serif', fontSize:'12px', outline:'none' }}
                        />
                        <span style={{ fontSize:'11px', color:'#45B6E4', marginLeft:'6px' }}>days (~{Math.round((editing[s.table_name]??s.retention_days)/30)}mo)</span>
                      </td>
                      <td style={{ padding:'10px 16px', color:'#3F3F3F', fontSize:'11px' }}>{s.updated_by || '—'}</td>
                      <td style={{ padding:'10px 16px' }}>
                        <button onClick={() => saveRetention(s.table_name, s.module)} disabled={saving===s.table_name}
                          style={{ padding:'5px 12px', background:saving===s.table_name?'#F1F5F9':'#156082', color:saving===s.table_name?'#45B6E4':'white', border:'none', borderRadius:'6px', fontSize:'11px', fontWeight:'700', cursor:'pointer', fontFamily:'Montserrat, sans-serif' }}>
                          {saving===s.table_name ? 'Saving...' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
