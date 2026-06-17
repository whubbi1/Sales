'use client'
// components/clients/ClientNotes.tsx
import { useState, useEffect } from 'react'
import { clientsAPI } from '@/lib/api'

export function ClientNotes({ clientId }: { clientId: string }) {
  const [notes, setNotes] = useState<any[]>([])
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const data = await clientsAPI.getNotes(clientId)
    setNotes(data)
  }

  useEffect(() => { load() }, [clientId])

  const handleAdd = async () => {
    if (!newNote.trim()) return
    setSaving(true)
    try {
      await clientsAPI.createNote(clientId, { content: newNote })
      setNewNote('')
      load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <textarea className="form-input" value={newNote} onChange={e => setNewNote(e.target.value)}
          placeholder="Add a note..." rows={3} style={{ marginBottom: '8px', resize: 'vertical' }} />
        <button className="btn-primary" onClick={handleAdd} disabled={saving || !newNote.trim()}>
          {saving ? 'Saving...' : 'Add Note'}
        </button>
      </div>

      {notes.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <div className="empty-state-title">No notes yet</div>
          <div className="empty-state-desc">Add your first note above</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {notes.map(note => (
            <div key={note.id} style={{
              background: '#FFFCF0', border: '1px solid #FDE68A',
              borderLeft: '4px solid var(--tertiary)', borderRadius: '8px', padding: '14px 16px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ fontSize: '13px', color: 'var(--text)', lineHeight: '1.7', flex: 1, whiteSpace: 'pre-wrap' }}>{note.content}</p>
                <button onClick={() => clientsAPI.deleteNote(clientId, note.id).then(load)}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '18px', marginLeft: '12px', flexShrink: 0, lineHeight: 1 }}>×</button>
              </div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                {new Date(note.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                {note.created_by && ` · ${note.created_by}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
