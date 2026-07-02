'use client'
import { useState, useEffect } from 'react'
import ProfileLayout from '@/components/ProfileLayout'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

const TYPE_ICON: Record<string, string> = { IT: '💻', Furniture: '🪑', Hardware: '🔧', Others: '📦' }

export default function MyEquipmentsPage() {
  const [equipments, setEquipments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const user = getStoredUser()
    if (!user?.email) { setLoading(false); return }
    fetch(`${API}/it/equipments?assigned_email=${encodeURIComponent(user.email)}`)
      .then(r => r.json())
      .then(d => setEquipments(d.equipments || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <ProfileLayout>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Equipments</h1>
          <p style={{ fontSize: '13px', color: '#45B6E4', margin: 0 }}>Equipment provided to you by the company</p>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading...</div>}

        {!loading && equipments.length === 0 && (
          <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '48px 28px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>📭</div>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>No equipment currently assigned to you.</p>
          </div>
        )}

        {!loading && equipments.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {equipments.map(eq => {
              const ended = !!eq.end_service_date
              return (
                <div key={eq.id} style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <span style={{ fontSize: '22px' }}>{TYPE_ICON[eq.equipment_type] || '📦'}</span>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: '800', color: '#156082' }}>{eq.name}</div>
                      <span style={{ background: '#F1F5F9', color: '#3F3F3F', padding: '1px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: '700' }}>{eq.equipment_type}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px' }}>
                    {eq.serial_number && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#94A3B8' }}>Serial Number</span>
                        <span style={{ color: '#3F3F3F', fontWeight: '600' }}>{eq.serial_number}</span>
                      </div>
                    )}
                    {eq.entry_service_date && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#94A3B8' }}>In Service Since</span>
                        <span style={{ color: '#3F3F3F', fontWeight: '600' }}>{new Date(eq.entry_service_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94A3B8' }}>Status</span>
                      <span style={{ color: ended ? '#DC2626' : '#059669', fontWeight: '700' }}>{ended ? 'End of Service' : 'Active'}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </ProfileLayout>
  )
}
