'use client'
import { useState, useEffect, useRef } from 'react'
import HelpdeskLayout from '@/components/HelpdeskLayout'
import { API } from '../constants'

const COLORS = ['#DC2626','#D97706','#059669','#45B6E4','#156082','#e97132','#7C3AED','#848EA5','#0F172A','#BE185D']
const ICONS  = ['🎫','🔐','🖱️','💿','🖥️','⚙️','📋','📱','💻','🔷','🛡️','📧','🗂️','🌐','🔧']

function InlineText({ value, onSave, placeholder = '—', style = {} }: {
  value: string; onSave: (v: string) => void; placeholder?: string; style?: React.CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing && ref.current) ref.current.focus() }, [editing])
  const commit = () => { setEditing(false); if (draft.trim() !== value) onSave(draft.trim()) }
  return (
    <input ref={ref} value={editing ? draft : (value || placeholder)}
      readOnly={!editing}
      onClick={() => setEditing(true)}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
      style={{
        fontFamily: 'Montserrat, sans-serif', fontSize: '13px',
        border: editing ? '1.5px solid #156082' : '1.5px solid transparent',
        borderRadius: '6px', padding: '3px 7px', outline: 'none',
        background: editing ? 'white' : 'transparent', cursor: editing ? 'text' : 'pointer',
        width: '100%', boxSizing: 'border-box' as const,
        color: value ? '#1F2937' : '#9CA3AF', ...style,
      }} />
  )
}

export default function ITAdminCockpitPage() {
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // New category form
  const [newCatName, setNewCatName]   = useState('')
  const [newCatIcon, setNewCatIcon]   = useState('🎫')
  const [newCatColor, setNewCatColor] = useState('#45B6E4')
  const [addingCat, setAddingCat]     = useState(false)

  // New subcategory (keyed by parent id)
  const [newSubName, setNewSubName] = useState<Record<string, string>>({})

  const load = () => {
    setLoading(true)
    fetch(`${API}/helpdesk/categories`).then(r => r.json()).then(d => setCategories(d.categories || [])).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const saveCategory = async (id: string, field: string, value: string) => {
    const cat = categories.find(c => c.id === id)
    if (!cat) return
    const updated = { ...cat, [field]: value }
    setCategories(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c))
    await fetch(`${API}/helpdesk/categories/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: updated.name, color: updated.color, icon: updated.icon, group_id: updated.group_id || '' }),
    })
  }

  const createCategory = async () => {
    if (!newCatName.trim()) return
    setAddingCat(true)
    await fetch(`${API}/helpdesk/categories`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName.trim(), icon: newCatIcon, color: newCatColor, description: '' }),
    })
    setNewCatName(''); setAddingCat(false); load()
  }

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category and all its subcategories?')) return
    await fetch(`${API}/helpdesk/categories/${id}`, { method: 'DELETE' })
    setCategories(prev => prev.filter(c => c.id !== id))
    if (expandedId === id) setExpandedId(null)
  }

  const addSubcategory = async (parentId: string, parentColor: string) => {
    const name = (newSubName[parentId] || '').trim()
    if (!name) return
    await fetch(`${API}/helpdesk/categories`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, icon: '📱', color: parentColor, description: '', parent_id: parentId }),
    })
    setNewSubName(prev => ({ ...prev, [parentId]: '' }))
    load()
  }

  const deleteSubcategory = async (id: string) => {
    await fetch(`${API}/helpdesk/categories/${id}`, { method: 'DELETE' })
    setCategories(prev => prev.map(c => ({
      ...c, subcategories: (c.subcategories || []).filter((s: any) => s.id !== id)
    })))
  }

  const saveSubcategory = async (parentId: string, subId: string, name: string) => {
    setCategories(prev => prev.map(c => c.id === parentId
      ? { ...c, subcategories: (c.subcategories || []).map((s: any) => s.id === subId ? { ...s, name } : s) }
      : c))
    await fetch(`${API}/helpdesk/categories/${subId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
  }

  return (
    <HelpdeskLayout>
      <div style={{ padding: '24px 28px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>🔧 IT Admin Cockpit</h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>Manage ticket categories and subcategories</p>
        </div>

        {/* Add category */}
        <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '16px 20px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '12px' }}>Add Category</div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '4px' }}>Name *</label>
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createCategory()}
                placeholder="e.g. Network" autoFocus
                style={{ width: '100%', padding: '8px 10px', border: '1.5px solid #EDF2F7', borderRadius: '7px', fontFamily: 'Montserrat, sans-serif', fontSize: '13px', outline: 'none', boxSizing: 'border-box' as const }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '4px' }}>Icon</label>
              <select value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)}
                style={{ padding: '8px 10px', border: '1.5px solid #EDF2F7', borderRadius: '7px', fontFamily: 'Montserrat, sans-serif', fontSize: '16px', outline: 'none', background: 'white', cursor: 'pointer' }}>
                {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#45B6E4', marginBottom: '4px' }}>Color</label>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {COLORS.map(c => (
                  <button key={c} onClick={() => setNewCatColor(c)}
                    style={{ width: '20px', height: '20px', borderRadius: '4px', background: c, border: newCatColor === c ? '2px solid #1F2937' : '2px solid transparent', cursor: 'pointer', flexShrink: 0 }} />
                ))}
              </div>
            </div>
            <button onClick={createCategory} disabled={!newCatName.trim() || addingCat}
              style={{ padding: '9px 18px', background: newCatName.trim() ? '#156082' : '#F1F5F9', color: newCatName.trim() ? 'white' : '#94A3B8', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '700', cursor: newCatName.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
              {addingCat ? 'Adding…' : '+ Add'}
            </button>
          </div>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading…</div>}

        {/* Categories list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {categories.map(cat => {
            const expanded = expandedId === cat.id
            const subCount = cat.subcategories?.length || 0
            return (
              <div key={cat.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                {/* Category header */}
                <div style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: '12px', background: expanded ? '#F0F7FF' : 'white' }}>
                  {/* Icon picker (inline) */}
                  <select value={cat.icon} onChange={e => saveCategory(cat.id, 'icon', e.target.value)}
                    style={{ fontSize: '18px', border: 'none', background: 'transparent', cursor: 'pointer', padding: '0', outline: 'none', width: '32px' }}>
                    {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                  {/* Color dot */}
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: cat.color, cursor: 'pointer', flexShrink: 0 }} onClick={() => setExpandedId(expanded ? null : cat.id)} />
                  </div>
                  {/* Name */}
                  <div style={{ flex: 1, minWidth: 0 }} onClick={e => e.stopPropagation()}>
                    <InlineText value={cat.name || ''} placeholder="Category name"
                      onSave={v => saveCategory(cat.id, 'name', v)}
                      style={{ fontSize: '13px', fontWeight: '700', color: cat.color }} />
                  </div>
                  {/* Color picker */}
                  <div style={{ display: 'flex', gap: '3px' }}>
                    {COLORS.map(c => (
                      <button key={c} onClick={() => saveCategory(cat.id, 'color', c)}
                        style={{ width: '14px', height: '14px', borderRadius: '3px', background: c, border: cat.color === c ? '2px solid #1F2937' : '1px solid transparent', cursor: 'pointer' }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '11px', color: '#94A3B8', flexShrink: 0 }}>{subCount} sub{subCount !== 1 ? 's' : ''}</span>
                  <button onClick={() => setExpandedId(expanded ? null : cat.id)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#94A3B8' }}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                      style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  <button onClick={() => deleteCategory(cat.id)}
                    style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', width: '26px', height: '26px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                </div>

                {/* Subcategories */}
                {expanded && (
                  <div style={{ borderTop: '1px solid #EDF2F7', padding: '14px 18px' }}>
                    <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '10px' }}>Subcategories</div>
                    {(cat.subcategories || []).length === 0 && (
                      <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '10px' }}>No subcategories yet.</div>
                    )}
                    {(cat.subcategories || []).map((sub: any) => (
                      <div key={sub.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '14px' }}>{sub.icon || '📱'}</span>
                        <div style={{ flex: 1 }}>
                          <InlineText value={sub.name || ''} placeholder="Subcategory name"
                            onSave={v => saveSubcategory(cat.id, sub.id, v)}
                            style={{ fontSize: '12px' }} />
                        </div>
                        <button onClick={() => deleteSubcategory(sub.id)}
                          style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', width: '24px', height: '24px', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>×</button>
                      </div>
                    ))}
                    {/* Add subcategory */}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <input value={newSubName[cat.id] || ''} onChange={e => setNewSubName(prev => ({ ...prev, [cat.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && addSubcategory(cat.id, cat.color)}
                        placeholder="New subcategory name…"
                        style={{ flex: 1, padding: '6px 10px', border: '1.5px solid #EDF2F7', borderRadius: '6px', fontFamily: 'Montserrat, sans-serif', fontSize: '12px', outline: 'none' }} />
                      <button onClick={() => addSubcategory(cat.id, cat.color)}
                        disabled={!(newSubName[cat.id] || '').trim()}
                        style={{ padding: '6px 14px', background: (newSubName[cat.id] || '').trim() ? '#156082' : '#F1F5F9', color: (newSubName[cat.id] || '').trim() ? 'white' : '#94A3B8', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: (newSubName[cat.id] || '').trim() ? 'pointer' : 'not-allowed', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
                        + Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </HelpdeskLayout>
  )
}
