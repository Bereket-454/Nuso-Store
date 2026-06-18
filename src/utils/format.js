export const birr = (value) =>
  new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    maximumFractionDigits: 0,
  }).format(value)

export const capitalize = (value = '') =>
  value.charAt(0).toUpperCase() + value.slice(1)

// Returns a human-readable delivery date string, e.g. "Friday, June 20" (EN)
// or "ዓርብ፣ ጁን 20" (AM).  Accepts an ISO date string (YYYY-MM-DD or full ISO).
export function formatDeliveryDate(isoDateStr, language = 'en') {
  if (!isoDateStr) return ''
  // Parse as local midnight so the day name is correct in the user's timezone.
  const [y, m, d] = String(isoDateStr).split('T')[0].split('-').map(Number)
  const date = new Date(y, m - 1, d)
  if (isNaN(date.getTime())) return ''
  try {
    const locale = language === 'am' ? 'am-ET' : 'en-US'
    return date.toLocaleDateString(locale, { weekday: 'long', month: 'long', day: 'numeric' })
  } catch {
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  }
}

// Returns the ISO date string (YYYY-MM-DD) for n calendar days from now.
export function addCalendarDays(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
