'use client'
import { useRef, useState } from 'react'
import { pmAPI } from '@/lib/api'
import { Modal, ErrorBanner, useAction, downloadBlob, LINK_BTN } from './shared'

type PreviewRow = { key?: string; id?: string; diffs?: Record<string, { old: string; new: string }>; row: Record<string, any> }
type Preview = { changed: PreviewRow[]; added: PreviewRow[]; unmatched: PreviewRow[] }

// Shared bulk-import control for the 5 register tabs (Members, Actions, Decisions, Risks,
// Deliverables): "Download template" (project-specific if one's been uploaded under Project
// Setup, else the WHUBBI-standard one) + "Upload Excel" -> preview (nothing written yet) ->
// review/approve -> apply.
export function ExcelImportControls({ register, projectId, onImported }: { register: string; projectId: string; onImported: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const { busy, error, run } = useAction()

  const rowKey = (kind: 'changed' | 'added', i: number) => `${kind}:${i}`

  const downloadTemplate = () => run(async () => {
    const { blob, name } = await pmAPI.downloadRegisterTemplate(projectId, register)
    downloadBlob(blob, name)
  })

  const pickFile = () => fileRef.current?.click()

  const onFile = (file?: File) => {
    if (!file) return
    run(async () => {
      const p: Preview = await pmAPI.importPreview(projectId, register, file)
      setPreview(p)
      const next: Record<string, boolean> = {}
      p.changed.forEach((_, i) => { next[rowKey('changed', i)] = true })
      p.added.forEach((_, i) => { next[rowKey('added', i)] = true })
      setChecked(next)
    })
    if (fileRef.current) fileRef.current.value = ''
  }

  const apply = () => run(async () => {
    if (!preview) return
    const changed = preview.changed.filter((_, i) => checked[rowKey('changed', i)])
    const added = preview.added.filter((_, i) => checked[rowKey('added', i)])
    await pmAPI.importApply(projectId, register, { changed, added })
    setPreview(null)
    onImported()
  })

  return (
    <>
      <button className="btn-secondary" onClick={downloadTemplate} disabled={busy}>⬇ Download template</button>
      <button className="btn-secondary" onClick={pickFile} disabled={busy}>⬆ Upload Excel</button>
      <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={e => onFile(e.target.files?.[0])} />

      {preview && (
        <Modal title="Review changes before applying" onClose={() => setPreview(null)} onSave={apply} saving={busy} saveLabel="Apply approved changes" width={860}>
          <div style={{ gridColumn: '1 / -1' }}>
            <ErrorBanner error={error} />
            <p style={{ fontSize: '12px', color: '#64748B', marginTop: 0 }}>
              Nothing has been written yet. Uncheck anything you don't want, then apply.
            </p>

            {preview.changed.length === 0 && preview.added.length === 0 && preview.unmatched.length === 0 && (
              <p style={{ fontSize: '13px', color: '#94A3B8' }}>No differences found — the file matches what's already here.</p>
            )}

            {preview.changed.length > 0 && (
              <>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#156082', margin: '14px 0 6px' }}>Changed ({preview.changed.length})</div>
                {preview.changed.map((item, i) => (
                  <label key={rowKey('changed', i)} style={{ display: 'block', padding: '8px 10px', border: '1px solid #EDF2F7', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <input type="checkbox" checked={!!checked[rowKey('changed', i)]} onChange={e => setChecked({ ...checked, [rowKey('changed', i)]: e.target.checked })} />
                      <b style={{ fontSize: '12px' }}>{item.key}</b>
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginLeft: '22px' }}>
                      {Object.entries(item.diffs || {}).map(([field, d]) => (
                        <div key={field}><b>{field}</b>: {d.old || '—'} → {d.new || '—'}</div>
                      ))}
                    </div>
                  </label>
                ))}
              </>
            )}

            {preview.added.length > 0 && (
              <>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#156082', margin: '14px 0 6px' }}>Added ({preview.added.length})</div>
                {preview.added.map((item, i) => (
                  <label key={rowKey('added', i)} style={{ display: 'block', padding: '8px 10px', border: '1px solid #EDF2F7', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={!!checked[rowKey('added', i)]} onChange={e => setChecked({ ...checked, [rowKey('added', i)]: e.target.checked })} style={{ marginRight: '8px' }} />
                    <span style={{ fontSize: '11px', color: '#3F3F3F' }}>
                      {Object.entries(item.row).filter(([, v]) => v).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ')}
                    </span>
                  </label>
                ))}
              </>
            )}

            {preview.unmatched.length > 0 && (
              <>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#B45309', margin: '14px 0 6px' }}>Unmatched ({preview.unmatched.length})</div>
                <p style={{ fontSize: '11px', color: '#94A3B8', marginTop: 0 }}>These rows had a value that didn't match any existing entry — check it and re-upload, or clear it to add them as new. Not applied.</p>
                {preview.unmatched.map((item, i) => (
                  <div key={i} style={{ fontSize: '11px', color: '#B45309', padding: '4px 0' }}>{item.key}</div>
                ))}
              </>
            )}
          </div>
        </Modal>
      )}
    </>
  )
}
