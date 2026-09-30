'use client'
import { useEffect, useRef, useState } from 'react'
import { OperationsLayout, useOperationsPerm } from '@/components/OperationsLayout'
import { projectDefaultsAPI } from '@/lib/api'

function ProjectDefaultsContent() {
  const { level, canEdit } = useOperationsPerm('project_defaults')
  const [templates, setTemplates] = useState<any[] | null>(null)
  const [error, setError] = useState('')
  const [busyType, setBusyType] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const load = () => projectDefaultsAPI.list().then(setTemplates).catch(() => {})
  useEffect(() => { if (level !== 'loading' && level !== 'none') load() }, [level])

  const download = (templateType: string) => {
    setBusyType(templateType); setError('')
    projectDefaultsAPI.download(templateType)
      .then(({ blob, name }) => {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url; a.download = name; a.click()
        URL.revokeObjectURL(url)
      })
      .catch(() => setError('Could not download this template.'))
      .finally(() => setBusyType(null))
  }

  const upload = (templateType: string, file?: File) => {
    if (!file) return
    setBusyType(templateType); setError('')
    projectDefaultsAPI.upload(templateType, file.name, file).then(load).catch(() => setError('Could not upload this template.')).finally(() => setBusyType(null))
  }

  const remove = (templateType: string) => {
    if (!confirm('Remove this custom template? The generated standard template will be used again.')) return
    setBusyType(templateType); setError('')
    projectDefaultsAPI.remove(templateType).then(load).catch(() => setError('Could not remove this template.')).finally(() => setBusyType(null))
  }

  if (level === 'loading') return <div style={{ padding: '48px', textAlign: 'center', color: '#45B6E4' }}>Loading…</div>
  if (level === 'none') return (
    <div style={{ padding: '48px', textAlign: 'center', color: '#94A3B8' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔒</div>
      <h2 style={{ color: '#156082', fontSize: '18px', fontWeight: '800', margin: '0 0 8px' }}>Access Denied</h2>
    </div>
  )

  return (
    <div style={{ padding: '24px 28px' }}>
      <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#144766', margin: '0 0 4px' }}>Project Defaults</h1>
      <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '20px' }}>
        Standard Excel templates used across every project's Project Management &gt; register tabs, when a project hasn't uploaded its own (under Project Setup).
      </p>
      {error && <div style={{ background: '#FEF2F2', color: '#DC2626', padding: '10px 14px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>{error}</div>}

      <div style={{ display: 'grid', gap: '12px', maxWidth: '640px' }}>
        {(templates || []).map(t => (
          <div key={t.template_type} style={{ background: 'white', border: '1px solid #EDF2F7', borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#144766' }}>{t.label}</div>
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                {t.is_custom ? <>Custom — {t.filename} (by {t.uploaded_by})</> : 'Standard (generated)'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-secondary" disabled={busyType === t.template_type} onClick={() => download(t.template_type)}>⬇ Download</button>
              {canEdit && (
                <>
                  <label className="btn-secondary" style={{ cursor: 'pointer' }}>
                    ⬆ {t.is_custom ? 'Replace' : 'Upload custom'}
                    <input ref={el => { fileRefs.current[t.template_type] = el }} type="file" accept=".xlsx" hidden
                      onChange={e => upload(t.template_type, e.target.files?.[0])} />
                  </label>
                  {t.is_custom && <button className="btn-secondary" disabled={busyType === t.template_type} onClick={() => remove(t.template_type)}>Remove</button>}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ProjectDefaultsPage() {
  return <OperationsLayout><ProjectDefaultsContent /></OperationsLayout>
}
