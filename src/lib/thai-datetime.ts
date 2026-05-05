const THAI_MONTHS_FULL = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
] as const

const THAI_MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
] as const

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const TIME_RE = /^(\d{1,2}):(\d{2})/

function parseIsoDateParts(value: string): { y: number; m: number; d: number } | null {
  const m = value.match(ISO_DATE_RE)
  if (!m) return null
  const y = parseInt(m[1], 10)
  const mo = parseInt(m[2], 10)
  const d = parseInt(m[3], 10)
  if (!y || !mo || !d) return null
  return { y, m: mo, d }
}

/**
 * Convert a year that may have been emitted in Thai Buddhist era by a
 * misbehaving browser (Android Chrome / Samsung Internet under th-TH) back
 * to Common Era. Anything >= 2400 is assumed to be พ.ศ.
 */
export function beYearToCe(year: number): number {
  return year >= 2400 ? year - 543 : year
}

/**
 * Normalize an ISO date string from <input type="date">. Returns
 * yyyy-mm-dd in Common Era, or empty string if unparsable.
 */
export function normalizeIsoDate(value: string | null | undefined): string {
  if (!value) return ''
  const parts = parseIsoDateParts(value)
  if (!parts) return value
  const ce = beYearToCe(parts.y)
  return `${String(ce).padStart(4, '0')}-${String(parts.m).padStart(2, '0')}-${String(parts.d).padStart(2, '0')}`
}

/**
 * Normalize a time string from <input type="time">. Always returns HH:mm
 * (24h, zero-padded).
 */
export function normalizeTime(value: string | null | undefined): string {
  if (!value) return ''
  const m = value.match(TIME_RE)
  if (!m) return value
  const hh = String(Math.max(0, Math.min(23, parseInt(m[1], 10)))).padStart(2, '0')
  const mm = String(Math.max(0, Math.min(59, parseInt(m[2], 10)))).padStart(2, '0')
  return `${hh}:${mm}`
}

/**
 * Format yyyy-mm-dd as Thai long date with พ.ศ. (e.g. "5 พฤษภาคม 2569").
 * Tolerates BE-year input — returns the same display either way.
 */
export function formatThaiDateLong(value: string | null | undefined, opts?: { short?: boolean }): string {
  if (!value) return ''
  const parts = parseIsoDateParts(value)
  if (!parts) return ''
  const ce = beYearToCe(parts.y)
  const yBE = ce + 543
  const moIdx = Math.max(0, Math.min(11, parts.m - 1))
  const months = opts?.short ? THAI_MONTHS_SHORT : THAI_MONTHS_FULL
  return `${parts.d} ${months[moIdx]} ${yBE}`
}

/** Format HH:mm as Thai time (e.g. "14:30 น."). */
export function formatThaiTime(value: string | null | undefined): string {
  const t = normalizeTime(value)
  return t ? `${t} น.` : ''
}

/** Combined "วันที่ … เวลา … น." for review/preview. */
export function formatThaiDateTimeLong(date: string | null | undefined, time: string | null | undefined): string {
  const d = formatThaiDateLong(date)
  const t = formatThaiTime(time)
  if (d && t) return `${d} เวลา ${t}`
  return d || t
}
