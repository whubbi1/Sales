'use client'

export function StaffingDrilldownModal({ title, subtitle, rows, onClose }: {
  title: string
  subtitle?: string
  rows: { label: string; sublabel?: string; days: number }[]
  onClose: () => void
}) {
  const total = rows.reduce((s, r) => s + r.days, 0)
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
        <div className="modal-header">
          <div>
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#144766', margin: 0 }}>{title}</h2>
            {subtitle && <p style={{ fontSize: '11px', color: '#9B9B9B', margin: '2px 0 0' }}>{subtitle}</p>}
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '20px', color: '#9B9B9B', lineHeight: 1 }}>×</button>
        </div>
        <div className="modal-body">
          {rows.length === 0 ? (
            <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No assignments found.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {rows.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', border: '1px solid #EDF2F7', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: '#144766' }}>{r.label}</div>
                    {r.sublabel && <div style={{ fontSize: '11px', color: '#9B9B9B' }}>{r.sublabel}</div>}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#156082' }}>{r.days}d</div>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', marginTop: '4px', borderTop: '2px solid #E2E8F0', fontWeight: '800' }}>
                <span style={{ color: '#144766' }}>Total</span>
                <span style={{ color: '#059669' }}>{total}d</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
