'use client'
// Default formatting preferences (MyWHUBBI > Profile), loaded once at the app shell and
// applied through formatDate/formatNumber/formatCurrency wherever a page opts in (today:
// project-management/shared.tsx's fmtDate — see that file's comment for what this does and
// doesn't cover yet). Internal-app only: getStoredUser() is null on portal pages, so this
// silently stays at the defaults there — harmless, nothing portal-side reads it.
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { getStoredUser } from './auth'
import { apiFetch } from './apiClient'

export const DATE_FORMATS: { value: string; label: string }[] = [
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2026)' },
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2026)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-12-31)' },
]

interface Prefs {
  preferred_language: string
  number_format: string
  date_format: string
  currency: string
}

const DEFAULTS: Prefs = { preferred_language: 'English', number_format: 'european', date_format: 'DD/MM/YYYY', currency: 'EUR' }

interface AppSettings extends Prefs {
  loading: boolean
  formatDate: (d?: string | Date | null) => string
  formatNumber: (n?: number | null) => string
  formatCurrency: (n?: number | null) => string
  refresh: () => void
}

const AppSettingsContext = createContext<AppSettings>({
  ...DEFAULTS, loading: false,
  formatDate: d => formatDateWith(d, DEFAULTS.date_format),
  formatNumber: n => formatNumberWith(n, DEFAULTS.number_format),
  formatCurrency: n => formatCurrencyWith(n, DEFAULTS.number_format, DEFAULTS.currency),
  refresh: () => {},
})

function formatDateWith(d: string | Date | null | undefined, dateFormat: string): string {
  if (!d) return '—'
  const dt = typeof d === 'string' ? new Date(d) : d
  if (isNaN(dt.getTime())) return '—'
  const dd = String(dt.getDate()).padStart(2, '0')
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const yyyy = String(dt.getFullYear())
  if (dateFormat === 'MM/DD/YYYY') return `${mm}/${dd}/${yyyy}`
  if (dateFormat === 'YYYY-MM-DD') return `${yyyy}-${mm}-${dd}`
  return `${dd}/${mm}/${yyyy}`
}

const numberLocale = (numberFormat: string) => (numberFormat === 'us' ? 'en-US' : 'de-DE')

function formatNumberWith(n: number | null | undefined, numberFormat: string): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return new Intl.NumberFormat(numberLocale(numberFormat)).format(n)
}

function formatCurrencyWith(n: number | null | undefined, numberFormat: string, currency: string): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  return new Intl.NumberFormat(numberLocale(numberFormat), { style: 'currency', currency }).format(n)
}

// Module-level mirror of the loaded prefs, for non-component call sites that can't use the
// useAppSettings() hook (e.g. project-management/shared.tsx's fmtDate, a plain function
// reused by several components) — set whenever the provider's own fetch resolves. A page
// that mounts and calls fmtDate before this resolves briefly sees the default format; in
// practice its own data fetch usually finishes around the same time and re-renders anyway.
let globalPrefs: Prefs = { ...DEFAULTS }

export function formatDateGlobal(d?: string | Date | null): string {
  return formatDateWith(d, globalPrefs.date_format)
}
export function formatNumberGlobal(n?: number | null): string {
  return formatNumberWith(n, globalPrefs.number_format)
}
export function formatCurrencyGlobal(n?: number | null): string {
  return formatCurrencyWith(n, globalPrefs.number_format, globalPrefs.currency)
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS)
  const [loading, setLoading] = useState(true)

  const load = () => {
    const user = getStoredUser()
    if (!user?.email) { setLoading(false); return }
    apiFetch(`/settings/profile/${encodeURIComponent(user.email)}`)
      .then(r => r.json())
      .then(p => {
        const next = {
          preferred_language: p.preferred_language || DEFAULTS.preferred_language,
          number_format: p.number_format || DEFAULTS.number_format,
          date_format: p.date_format || DEFAULTS.date_format,
          currency: p.currency || DEFAULTS.currency,
        }
        globalPrefs = next
        setPrefs(next)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const value: AppSettings = {
    ...prefs, loading,
    formatDate: d => formatDateWith(d, prefs.date_format),
    formatNumber: n => formatNumberWith(n, prefs.number_format),
    formatCurrency: n => formatCurrencyWith(n, prefs.number_format, prefs.currency),
    refresh: load,
  }
  return <AppSettingsContext.Provider value={value}>{children}</AppSettingsContext.Provider>
}

export function useAppSettings(): AppSettings {
  return useContext(AppSettingsContext)
}
