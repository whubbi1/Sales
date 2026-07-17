'use client'

const COLORS = ['#156082', '#219BD6', '#7C3AED', '#059669', '#D97706', '#DC2626', '#0EA5E9', '#EC4899']

function toLabelValuePairs(rows: any[], spec: any): { label: string; value: number }[] {
  if (!rows.length) return []
  const groupCol = spec.group_by?.[0]
  const agg = spec.aggregates?.[0]
  if (groupCol && agg) {
    const alias = `${agg.function}_${agg.column}`
    return rows.map(r => ({ label: String(r[groupCol] ?? '—'), value: Number(r[alias]) || 0 }))
  }
  const cols = spec.columns && spec.columns.length ? spec.columns : Object.keys(rows[0])
  const labelCol = cols[0]
  const valueCol = cols.find((c: string, i: number) => i > 0 && typeof rows[0][c] === 'number')
  if (valueCol) {
    return rows.map(r => ({ label: String(r[labelCol] ?? '—'), value: Number(r[valueCol]) || 0 }))
  }
  const counts = new Map<string, number>()
  rows.forEach(r => {
    const label = String(r[labelCol] ?? '—')
    counts.set(label, (counts.get(label) || 0) + 1)
  })
  return [...counts.entries()].map(([label, value]) => ({ label, value }))
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n - 1) + '…' : s }

function BarChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const width = 640, height = 260, padding = 40
  const barWidth = (width - padding * 2) / Math.max(data.length, 1)
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {data.map((d, i) => {
        const barHeight = (d.value / max) * (height - padding * 2)
        const x = padding + i * barWidth
        const y = height - padding - barHeight
        return (
          <g key={i}>
            <rect x={x + 4} y={y} width={Math.max(barWidth - 8, 1)} height={barHeight} fill={COLORS[i % COLORS.length]} rx={3} />
            <text x={x + barWidth / 2} y={height - padding + 14} textAnchor="middle" fontSize="9" fill="#64748B">{truncate(d.label, 12)}</text>
            <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill="#144766">{d.value}</text>
          </g>
        )
      })}
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#E2E8F0" />
    </svg>
  )
}

function LineChart({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const width = 640, height = 260, padding = 40
  const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0
  const points = data.map((d, i) => ({
    x: padding + i * stepX,
    y: height - padding - (d.value / max) * (height - padding * 2),
    d,
  }))
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} style={{ fontFamily: 'Montserrat, sans-serif' }}>
      <path d={path} fill="none" stroke="#156082" strokeWidth={2} />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill="#156082" />
          <text x={p.x} y={height - padding + 14} textAnchor="middle" fontSize="9" fill="#64748B">{truncate(p.d.label, 12)}</text>
          <text x={p.x} y={p.y - 8} textAnchor="middle" fontSize="10" fontWeight="700" fill="#144766">{p.d.value}</text>
        </g>
      ))}
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#E2E8F0" />
    </svg>
  )
}

function PieChart({ data }: { data: { label: string; value: number }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const size = 200, cx = size / 2, cy = size / 2, r = size / 2 - 10
  let angle = -90
  const toXY = (a: number): [number, number] => [cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180)]
  const slices = data.map((d, i) => {
    const fraction = d.value / total
    const startAngle = angle
    const endAngle = angle + fraction * 360
    angle = endAngle
    const largeArc = fraction > 0.5 ? 1 : 0
    const [x1, y1] = toXY(startAngle)
    const [x2, y2] = toXY(endAngle)
    const path = fraction >= 0.999
      ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
    return { path, color: COLORS[i % COLORS.length], d }
  })
  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} />)}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: s.color, flexShrink: 0 }} />
            <span style={{ color: '#144766', fontWeight: 600 }}>{s.d.label}</span>
            <span style={{ color: '#9B9B9B' }}>{s.d.value} ({Math.round((s.d.value / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TableView({ rows, columns }: { rows: any[]; columns: string[] }) {
  if (!rows.length) return <p style={{ color: '#9B9B9B', fontSize: '13px' }}>No data.</p>
  const cols = columns && columns.length ? columns : Object.keys(rows[0])
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <thead>
          <tr>{cols.map(c => <th key={c} style={{ textAlign: 'left', padding: '8px 10px', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', color: '#9B9B9B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{cols.map(c => <td key={c} style={{ padding: '7px 10px', borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap' }}>{r[c] === null || r[c] === undefined ? '—' : String(r[c])}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ReportChart({ rows, spec }: { rows: any[]; spec: any }) {
  const chartType = spec?.chart_type || 'table'
  const tableColumns = (spec?.group_by || []).concat((spec?.aggregates || []).map((a: any) => `${a.function}_${a.column}`))
  const columns = tableColumns.length ? tableColumns : (spec?.columns || [])

  if (chartType === 'table' || !rows.length) return <TableView rows={rows} columns={columns} />

  const data = toLabelValuePairs(rows, spec)
  if (chartType === 'bar') return <BarChart data={data} />
  if (chartType === 'line') return <LineChart data={data} />
  if (chartType === 'pie') return <PieChart data={data} />
  return <TableView rows={rows} columns={columns} />
}
