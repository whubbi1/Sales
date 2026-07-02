'use client'
import { useState, useEffect } from 'react'
import ProfileLayout from '@/components/ProfileLayout'
import { getStoredUser } from '@/lib/auth'

const API = 'https://api.whubbi.wcomply.com'

export default function LicensesGroupsPage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const user = getStoredUser()
    if (user?.email) loadProfile(user.email)
    else setLoading(false)
  }, [])

  const loadProfile = async (email: string) => {
    setLoading(true)
    try {
      const res = await fetch(`${API}/settings/profile/${email}`)
      const data = await res.json()
      setProfile(data)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  return (
    <ProfileLayout>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>Licenses & Groups</h1>
          <p style={{ fontSize: '13px', color: '#45B6E4', margin: 0 }}>Your Microsoft licenses, groups, and roles</p>
        </div>

        {loading && <div style={{ textAlign: 'center', padding: '48px', color: '#45B6E4' }}>Loading...</div>}

        {!loading && profile && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            {/* Licenses */}
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '16px' }}>Microsoft Licenses ({profile.ms_licenses?.length || 0})</h3>
              {(profile.ms_licenses || []).length === 0 ? (
                <p style={{ color: '#45B6E4', fontSize: '13px' }}>No licenses found. Sync profile first.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(profile.ms_licenses || []).map((lic: string) => (
                    <div key={lic} style={{ padding: '8px 12px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid #EDF2F7', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px' }}>📄</span>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#3F3F3F' }}>{lic}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Groups */}
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '16px' }}>Microsoft Groups ({profile.ms_groups?.length || 0})</h3>
              {(profile.ms_groups || []).length === 0 ? (
                <p style={{ color: '#45B6E4', fontSize: '13px' }}>No groups found. Sync profile first.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(profile.ms_groups || []).map((grp: string) => (
                    <div key={grp} style={{ padding: '8px 12px', background: '#EFF6FF', borderRadius: '8px', border: '1px solid #DBEAFE', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px' }}>👥</span>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#156082' }}>{grp}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Roles */}
            <div style={{ background: 'white', borderRadius: '14px', border: '1px solid #EDF2F7', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <h3 style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '16px' }}>Microsoft Roles ({profile.ms_roles?.length || 0})</h3>
              {(profile.ms_roles || []).length === 0 ? (
                <p style={{ color: '#45B6E4', fontSize: '13px' }}>No roles assigned.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(profile.ms_roles || []).map((role: string) => (
                    <div key={role} style={{ padding: '8px 12px', background: '#ECFDF5', borderRadius: '8px', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px' }}>🔐</span>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: '#059669' }}>{role}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ProfileLayout>
  )
}
