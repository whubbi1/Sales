// lib/contactOptions.ts
// Shared Contact field options — single source of truth for the internal CRM's
// ContactModal, the portal's self-service profile page, and the "create new contact"
// form inside Project Management's Members tab. Keep these three in sync with the
// backend's VALID_SUBSCRIPTIONS (backend/app/routers/portal.py).
export const LANGUAGES = ['Afrikaans','Albanian','Amharic','Arabic','Armenian','Azerbaijani','Basque','Belarusian','Bengali','Bosnian','Bulgarian','Catalan','Chinese (Simplified)','Chinese (Traditional)','Croatian','Czech','Danish','Dutch','English','Estonian','Finnish','French','Georgian','German','Greek','Gujarati','Hebrew','Hindi','Hungarian','Icelandic','Indonesian','Irish','Italian','Japanese','Kazakh','Korean','Latvian','Lithuanian','Macedonian','Malay','Maltese','Mongolian','Nepali','Norwegian','Persian','Polish','Portuguese','Romanian','Russian','Serbian','Slovak','Slovenian','Spanish','Swahili','Swedish','Tamil','Telugu','Thai','Turkish','Ukrainian','Urdu','Vietnamese','Welsh']

// 'Operations' is mandatory to use Project Management via the portal (see pm_user() in
// backend/app/routers/project_management.py) — a contact without it is treated as having
// no access at all, same as having no PMMember row.
export const SUBSCRIPTIONS = ['Marketing Information', 'Customer Service Communication', 'One to One', 'Operations', 'Opted Out']

// Mutually exclusive with 'Opted Out', in both directions — an opted-out contact can't
// receive marketing, and can't be marked as using the tool operationally either.
const CLEARED_BY_OPT_OUT = ['Marketing Information', 'Operations']

export function toggleSubscription(current: string[], sub: string): string[] {
  const isOn = current.includes(sub)
  let next = isOn ? current.filter(s => s !== sub) : [...current, sub]
  if (sub === 'Opted Out' && !isOn) next = next.filter(s => !CLEARED_BY_OPT_OUT.includes(s))
  if (CLEARED_BY_OPT_OUT.includes(sub) && !isOn) next = next.filter(s => s !== 'Opted Out')
  return next
}

export const NUMBER_FORMATS: { value: string; label: string }[] = [
  { value: 'european', label: 'European (1.234,56)' },
  { value: 'us', label: 'US (1,234.56)' },
]

export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY', 'SEK', 'NOK', 'DKK', 'PLN', 'AED', 'SAR']
