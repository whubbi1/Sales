'use client'
import { useState, useEffect } from 'react'

const API = 'https://api.whubbi.wcomply.com'

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const btn: React.CSSProperties = { padding: '7px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }

export function ApplicationLinksSection({ application, canEdit }: any) {
  const [links, setLinks] = useState<any[]>([])
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null)

  const load = async () => {
    const d = await fetch(`${API}/it/applications/${application.id}/links`).then(r => r.json()).catch(() => ({ links: [] }))
    setLinks(d.links || [])
  }
  useEffect(() => { load() }, [application.id])

  const add = async () => {
    if (!url.trim()) return
    await fetch(`${API}/it/applications/${application.id}/links`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.trim(), description }),
    })
    setUrl(''); setDescription('')
    load()
  }
  const patch = async (lid: string, fields: any) => {
    await fetch(`${API}/it/applications/${application.id}/links/${lid}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields),
    })
    setEditing(null)
    load()
  }
  const remove = async (l: any) => {
    if (!confirm(`Delete this link?`)) return
    await fetch(`${API}/it/applications/${application.id}/links/${l.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '20px 24px', marginBottom: '16px' }}>
      <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#156082', margin: '0 0 14px' }}>🔗 Links</h2>
      {links.length === 0 ? (
        <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: 0 }}>No links yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
          {links.map((l: any) => (
            <div key={l.id} style={{ border: '1px solid #EDF2F7', borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                {editing?.id === l.id && editing?.field === 'url' ? (
                  <input autoFocus style={{ ...inp, flex: 1, marginRight: '8px' }} defaultValue={l.url} onBlur={e => patch(l.id, { url: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                ) : (
                  <div onClick={() => canEdit && setEditing({ id: l.id, field: 'url' })} style={{ fontSize: '13px', fontWeight: '700', cursor: canEdit ? 'pointer' : 'default' }}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3B82F6' }} onClick={e => canEdit && e.preventDefault()}>🔗 {l.url}</a>
                  </div>
                )}
                {canEdit && <button onClick={() => remove(l)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>}
              </div>
              {editing?.id === l.id && editing?.field === 'description' ? (
                <textarea autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, marginTop: '6px', minHeight: '50px', resize: 'vertical' }} defaultValue={l.description} onBlur={e => patch(l.id, { description: e.target.value })} />
              ) : (
                <div onClick={() => canEdit && setEditing({ id: l.id, field: 'description' })} style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', cursor: canEdit ? 'pointer' : 'default' }}>{l.description || <span style={{ color: '#CBD5E0' }}>No description — click to add</span>}</div>
              )}
            </div>
          ))}
        </div>
      )}
      {canEdit && (
        <div style={{ borderTop: '1px solid #F1F5F9', paddingTop: '14px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <input style={{ ...inp, flex: 1 }} placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} />
          </div>
          <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '50px', resize: 'vertical', marginBottom: '8px' }} placeholder="Description of this document/link…" value={description} onChange={e => setDescription(e.target.value)} />
          <button onClick={add} disabled={!url.trim()} style={{ ...btn, background: url.trim() ? '#156082' : '#94A3B8', color: 'white' }}>+ Add Link</button>
        </div>
      )}
    </div>
  )
}
