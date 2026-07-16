'use client'
import { useState, useEffect } from 'react'
import { opportunitiesAPI } from '@/lib/api'

const inp: React.CSSProperties = {
  fontSize: '12px', padding: '7px 11px', border: '1px solid #E2E8F0',
  borderRadius: '8px', fontFamily: 'Montserrat, sans-serif', outline: 'none', background: 'white',
}
const btn: React.CSSProperties = { padding: '7px 14px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif' }

// Office desktop apps register these URI schemes to open a document directly instead of
// through the browser — `ofe|u|<url>` is the "open from URL" form Office understands.
function officeAppScheme(url: string): string | null {
  const clean = url.split('?')[0].split('#')[0].toLowerCase()
  if (clean.endsWith('.doc') || clean.endsWith('.docx')) return 'ms-word'
  if (clean.endsWith('.ppt') || clean.endsWith('.pptx')) return 'ms-powerpoint'
  if (clean.endsWith('.xls') || clean.endsWith('.xlsx')) return 'ms-excel'
  return null
}

export function OpportunityLinksSection({ opportunityId }: { opportunityId: string }) {
  const [links, setLinks] = useState<any[]>([])
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [editing, setEditing] = useState<{ id: string; field: string } | null>(null)

  const load = async () => {
    const d = await opportunitiesAPI.getLinks(opportunityId).catch(() => ({ links: [] }))
    setLinks(d.links || [])
  }
  useEffect(() => { load() }, [opportunityId])

  const add = async () => {
    if (!url.trim()) return
    await opportunitiesAPI.addLink(opportunityId, { url: url.trim(), description })
    setUrl(''); setDescription('')
    load()
  }
  const patch = async (lid: string, fields: any) => {
    await opportunitiesAPI.updateLink(opportunityId, lid, fields)
    setEditing(null)
    load()
  }
  const remove = async (l: any) => {
    if (!confirm('Delete this link?')) return
    await opportunitiesAPI.deleteLink(opportunityId, l.id)
    load()
  }

  return (
    <div style={{ marginTop: '18px', paddingTop: '18px', borderTop: '1px solid #F1F5F9' }}>
      <p className="section-label" style={{ marginBottom: '6px' }}>Linked Files &amp; Folders</p>
      {links.length === 0 ? (
        <p style={{ fontSize: '12px', color: '#9B9B9B' }}>No files or folders linked yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
          {links.map((l: any) => {
            const scheme = officeAppScheme(l.url)
            return (
              <div key={l.id} style={{ border: '1px solid #EDF2F7', borderRadius: '8px', padding: '10px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  {editing?.id === l.id && editing?.field === 'url' ? (
                    <input autoFocus style={{ ...inp, flex: 1, marginRight: '8px' }} defaultValue={l.url} onBlur={e => patch(l.id, { url: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }} />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <a href={l.url} target="_blank" rel="noopener noreferrer" style={{ color: '#219BD6', fontSize: '13px', fontWeight: '700' }}>🔗 Open in browser</a>
                      {scheme && <a href={`${scheme}:ofe|u|${encodeURIComponent(l.url)}`} style={{ color: '#7C3AED', fontSize: '13px', fontWeight: '700' }}>📎 Open in app</a>}
                      <span onClick={() => setEditing({ id: l.id, field: 'url' })} style={{ fontSize: '11px', color: '#9B9B9B', cursor: 'pointer' }} title="Click to edit link">{l.url}</span>
                    </div>
                  )}
                  <button onClick={() => remove(l)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: '14px', padding: 0, lineHeight: 1 }}>×</button>
                </div>
                {editing?.id === l.id && editing?.field === 'description' ? (
                  <textarea autoFocus style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, marginTop: '6px', minHeight: '50px', resize: 'vertical' }} defaultValue={l.description} onBlur={e => patch(l.id, { description: e.target.value })} />
                ) : (
                  <div onClick={() => setEditing({ id: l.id, field: 'description' })} style={{ fontSize: '11px', color: '#64748B', marginTop: '4px', cursor: 'pointer' }}>{l.description || <span style={{ color: '#CBD5E0' }}>No description — click to add</span>}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
        <input style={{ ...inp, flex: 1 }} placeholder="https://wcomply.sharepoint.com/..." value={url} onChange={e => setUrl(e.target.value)} />
      </div>
      <textarea style={{ ...inp, width: '100%', boxSizing: 'border-box' as const, minHeight: '50px', resize: 'vertical', marginBottom: '8px' }} placeholder="Description of this file/folder…" value={description} onChange={e => setDescription(e.target.value)} />
      <button onClick={add} disabled={!url.trim()} style={{ ...btn, background: url.trim() ? '#156082' : '#94A3B8', color: 'white' }}>+ Add Link</button>
    </div>
  )
}
