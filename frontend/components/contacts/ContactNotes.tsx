'use client'
import { useState, useEffect } from 'react'
import { contactsAPI } from '@/lib/api'
import { EmptyState } from '@/components/shared/RecordLayout'

export function ContactNotes({ contactId }: { contactId: string }) {
  const [notes, setNotes] = useState<any[]>([])
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)
  const load = async () => setNotes(await contactsAPI.getNotes(contactId))
  useEffect(() => { load() }, [contactId])
  const handleAdd = async () => {
    if (!newNote.trim()) return
    setSaving(true)
    try { await contactsAPI.createNote(contactId, { content: newNote }); setNewNote(''); load() }
    finally { setSaving(false) }
  }
  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <textarea className="form-input" value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..." rows={3} style={{ marginBottom: '8px', resize: 'vertical' }} />
        <button className="btn-primary" onClick={handleAdd} disabled={saving || !newNote.trim()}>{saving ? 'Saving...' : 'Add Note'}</button>
      </div>
      {notes.length === 0 ? <EmptyState icon="📝" title="No notes yet" description="Add your first note above" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {notes.map(note => (
            <div key={note.id} style={{ background: '#FFFCF0', border: '1px solid #FDE68A', borderLeft: '4px solid #e97132', borderRadius: '8px', padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ fontSize: '13px', color: '#3F3F3F', lineHeight: '1.7', flex: 1, whiteSpace: 'pre-wrap', margin: 0 }}>{note.content}</p>
                <button onClick={() => contactsAPI.deleteNote(contactId, note.id).then(load)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9B9B9B', fontSize: '16px', marginLeft: '10px', lineHeight: 1 }}>×</button>
              </div>
              <p style={{ fontSize: '10px', color: '#9B9B9B', marginTop: '6px', margin: '6px 0 0' }}>{new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}{note.created_by && ` · ${note.created_by}`}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
