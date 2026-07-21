'use client'
import { useState, useEffect } from 'react'
import { getStoredUser } from '@/lib/auth'
import { HRLayout } from '@/components/HRLayout'
import { PayfitTestPanel } from '@/components/payfit/PayfitTestPanel'

const API = 'https://api.whubbi.wcomply.com'
const COUNTRIES = [
  { value: 'global', label: '🌍 Global (all countries)' },
  { value: 'france', label: '🇫🇷 France' },
  { value: 'portugal', label: '🇵🇹 Portugal' },
  { value: 'czech_republic', label: '🇨🇿 Czech Republic' },
  { value: 'romania', label: '🇷🇴 Romania' },
  { value: 'spain', label: '🇪🇸 Spain' },
]

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px', border: '1.5px solid #EDF2F7', borderRadius: '7px',
  fontFamily: 'Montserrat, sans-serif', fontSize: '12px', outline: 'none', boxSizing: 'border-box',
}

export default function AdminCockpit() {
  const [currentUserEmail, setCurrentUserEmail] = useState('')
  const [tab, setTab] = useState<'skills'|'questions'|'payfit'>('skills')
  const [country, setCountry] = useState('global')

  const [skills, setSkills] = useState<any[]>([])
  const [newSkillName, setNewSkillName] = useState('')
  const [newSkillCountry, setNewSkillCountry] = useState('global')
  const [skillSaving, setSkillSaving] = useState(false)

  const [questions, setQuestions] = useState<any[]>([])
  const [newQuestionText, setNewQuestionText] = useState('')
  const [newQuestionCountry, setNewQuestionCountry] = useState('global')
  const [questionSaving, setQuestionSaving] = useState(false)

  useEffect(() => {
    const user = getStoredUser(); if (user) setCurrentUserEmail(user.email)
  }, [])

  const loadSkills = () => {
    fetch(`${API}/hr/admin/interview-skills?country=${country}`)
      .then(r => r.json())
      .then(d => setSkills(d.skills || []))
  }

  const loadQuestions = () => {
    fetch(`${API}/hr/admin/interview-questions?country=${country}`)
      .then(r => r.json())
      .then(d => setQuestions(d.questions || []))
  }

  useEffect(() => { loadSkills(); loadQuestions() }, [country])

  const addSkill = async () => {
    if (!newSkillName.trim()) return
    setSkillSaving(true)
    await fetch(`${API}/hr/admin/interview-skills`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skill_name: newSkillName.trim(), country: newSkillCountry, created_by: currentUserEmail })
    })
    setNewSkillName(''); loadSkills(); setSkillSaving(false)
  }

  const deleteSkill = async (id: string) => {
    await fetch(`${API}/hr/admin/interview-skills/${id}`, { method: 'DELETE' })
    loadSkills()
  }

  const addQuestion = async () => {
    if (!newQuestionText.trim()) return
    setQuestionSaving(true)
    await fetch(`${API}/hr/admin/interview-questions`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_text: newQuestionText.trim(), country: newQuestionCountry, created_by: currentUserEmail })
    })
    setNewQuestionText(''); loadQuestions(); setQuestionSaving(false)
  }

  const deleteQuestion = async (id: string) => {
    await fetch(`${API}/hr/admin/interview-questions/${id}`, { method: 'DELETE' })
    loadQuestions()
  }

  return (
    <HRLayout>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#156082', margin: '0 0 4px' }}>⚙️ Admin Cockpit</h1>
          <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>Configure interview skills and questions per country</p>
        </div>

        {/* Country filter */}
        <div style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', whiteSpace: 'nowrap' }}>View by country</span>
          <select value={country} onChange={e => setCountry(e.target.value)}
            style={{ ...inputStyle, width: '240px', cursor: 'pointer' }}>
            {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <span style={{ fontSize: '11px', color: '#94A3B8' }}>Showing global + country-specific entries</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, marginBottom: '20px', background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', overflow: 'hidden', width: 'fit-content' }}>
          {[{ key: 'skills', label: `Skills (${skills.length})` }, { key: 'questions', label: `Questions (${questions.length})` }, { key: 'payfit', label: 'PayFit Integration' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              style={{ padding: '9px 20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '700', fontFamily: 'Montserrat, sans-serif',
                background: tab === t.key ? '#156082' : 'transparent', color: tab === t.key ? 'white' : '#45B6E4' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Skills tab */}
        {tab === 'skills' && (
          <div>
            {/* Add skill */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '12px' }}>Add Skill</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px auto', gap: '10px', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#45B6E4', marginBottom: '4px' }}>Skill Name *</label>
                  <input value={newSkillName} onChange={e => setNewSkillName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addSkill()}
                    placeholder="e.g. React, Python, Communication..."
                    style={inputStyle}/>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#45B6E4', marginBottom: '4px' }}>Country</label>
                  <select value={newSkillCountry} onChange={e => setNewSkillCountry(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <button onClick={addSkill} disabled={!newSkillName.trim() || skillSaving}
                  style={{ padding: '8px 18px', background: newSkillName.trim() ? '#156082' : '#F1F5F9', color: newSkillName.trim() ? 'white' : '#94A3B8', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '700', cursor: newSkillName.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
                  {skillSaving ? 'Adding…' : '+ Add Skill'}
                </button>
              </div>
            </div>

            {/* Skills list */}
            {skills.length === 0 ? (
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '48px', textAlign: 'center', color: '#45B6E4', fontSize: '13px' }}>
                No skills configured yet. Add the first one above.
              </div>
            ) : (
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                <div style={{ padding: '12px 20px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFC', display: 'grid', gridTemplateColumns: '1fr 160px 120px 40px', gap: '12px' }}>
                  <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8' }}>Skill</span>
                  <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8' }}>Country</span>
                  <span style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#94A3B8' }}>Added</span>
                  <span></span>
                </div>
                {skills.map((s, i) => (
                  <div key={s.id} style={{ padding: '12px 20px', borderBottom: '1px solid #F9FAFB', background: i % 2 === 0 ? 'white' : '#FAFBFC', display: 'grid', gridTemplateColumns: '1fr 160px 120px 40px', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#7C3AED' }}>{s.skill_name}</span>
                    <span style={{ fontSize: '11px', color: '#156082', background: '#EFF6FF', padding: '2px 8px', borderRadius: '10px', display: 'inline-block', width: 'fit-content' }}>
                      {COUNTRIES.find(c => c.value === s.country)?.label || s.country}
                    </span>
                    <span style={{ fontSize: '11px', color: '#94A3B8' }}>{s.created_at ? new Date(s.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
                    <button onClick={() => deleteSkill(s.id)}
                      style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '13px' }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Questions tab */}
        {tab === 'questions' && (
          <div>
            {/* Add question */}
            <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '16px 20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: '#45B6E4', marginBottom: '12px' }}>Add Question</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 200px auto', gap: '10px', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#45B6E4', marginBottom: '4px' }}>Question *</label>
                  <input value={newQuestionText} onChange={e => setNewQuestionText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addQuestion()}
                    placeholder="e.g. Tell us about your experience with..."
                    style={inputStyle}/>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#45B6E4', marginBottom: '4px' }}>Country</label>
                  <select value={newQuestionCountry} onChange={e => setNewQuestionCountry(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <button onClick={addQuestion} disabled={!newQuestionText.trim() || questionSaving}
                  style={{ padding: '8px 18px', background: newQuestionText.trim() ? '#156082' : '#F1F5F9', color: newQuestionText.trim() ? 'white' : '#94A3B8', border: 'none', borderRadius: '7px', fontSize: '12px', fontWeight: '700', cursor: newQuestionText.trim() ? 'pointer' : 'not-allowed', fontFamily: 'Montserrat, sans-serif', whiteSpace: 'nowrap' }}>
                  {questionSaving ? 'Adding…' : '+ Add Question'}
                </button>
              </div>
            </div>

            {/* Questions list */}
            {questions.length === 0 ? (
              <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '48px', textAlign: 'center', color: '#45B6E4', fontSize: '13px' }}>
                No questions configured yet. Add the first one above.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {questions.map((q, i) => (
                  <div key={q.id} style={{ background: 'white', borderRadius: '10px', border: '1px solid #EDF2F7', padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: '14px', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: '#45B6E4', minWidth: '20px' }}>{i + 1}.</span>
                    <span style={{ flex: 1, fontSize: '13px', color: '#3F3F3F', lineHeight: '1.6' }}>{q.question_text}</span>
                    <span style={{ fontSize: '11px', color: '#156082', background: '#EFF6FF', padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                      {COUNTRIES.find(c => c.value === q.country)?.label || q.country}
                    </span>
                    <button onClick={() => deleteQuestion(q.id)}
                      style={{ background: '#FEF2F2', color: '#DC2626', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '13px', flexShrink: 0 }}>×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PayFit Integration tab */}
        {tab === 'payfit' && (
          <div style={{ background: 'white', borderRadius: '12px', border: '1px solid #EDF2F7', padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <PayfitTestPanel />
          </div>
        )}
      </div>
    </HRLayout>
  )
}
