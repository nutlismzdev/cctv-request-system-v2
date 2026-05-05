import { getStatusStyle } from '@/lib/theme-colors'

export function getLocalizedPrefix(prefix: string, language?: string): string {
  if (language !== 'en') return prefix
  const prefixMap: Record<string, string> = {
    'นาย': 'Mr.',
    'นาง': 'Mrs.',
    'นางสาว': 'Ms.',
  }
  return prefixMap[prefix] || prefix
}

const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

export function formatThaiDateBE(input?: string | null) {
  if (!input) return ''
  const m = input.match?.(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) {
    const d = new Date(input)
    if (isNaN(d.getTime())) return input
    return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`
  }
  const y = parseInt(m[1], 10) + 543
  const mo = parseInt(m[2], 10) - 1
  const day = parseInt(m[3], 10)
  return `${day} ${THAI_MONTHS_SHORT[mo]} ${y}`
}

export const STATUS_TONE: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  'รอดำเนินการ': getStatusStyle('รอดำเนินการ'),
  'รอยื่นเอกสาร': getStatusStyle('รอยื่นเอกสาร'),
  'รอเอกสารอนุมัติ': getStatusStyle('รอเอกสารอนุมัติ'),
  'เอกสารอนุมัติเรียบร้อย': getStatusStyle('เอกสารอนุมัติเรียบร้อย'),
  'ปฏิเสธคำร้อง': getStatusStyle('ปฏิเสธคำร้อง'),
}

export function isVideoMedia(fileType: string, fileName: string): boolean {
  return /^video\//i.test(fileType) || /\.(mp4|mov|avi|m4v|webm)$/i.test(fileName)
}

export function isOperationImage(category: string | undefined, fileName: string): boolean {
  return category === 'operation' && /(png|jpg|jpeg|heic)$/i.test(fileName || '')
}
