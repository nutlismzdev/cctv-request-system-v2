/**
 * Submission channel mapping — single source of truth
 *
 * reports.created_by ถูกตั้งใน POST /api/reports:
 *   - 'online_liff' = ยื่นออนไลน์ผ่าน /request (LIFF)
 *   - 'web_form'    = ยื่นที่หน้างานผ่าน /request-onsite
 *   - อื่น ๆ/null   = ข้อมูล legacy หรือสร้างจากระบบภายใน
 */

export type ReportSourceKind = 'online' | 'onsite' | 'unknown'

export interface ReportSourceInfo {
  kind: ReportSourceKind
  /** ป้ายภาษาไทยสำหรับแสดงใน UI */
  label: string
  /** สำหรับ filter dropdown */
  shortLabel: string
}

export function getReportSource(createdBy?: string | null): ReportSourceInfo {
  if (createdBy === 'online_liff') {
    return { kind: 'online', label: 'ยื่นออนไลน์', shortLabel: 'ออนไลน์' }
  }
  if (createdBy === 'web_form') {
    return { kind: 'onsite', label: 'ยื่นหน้างาน', shortLabel: 'หน้างาน' }
  }
  return { kind: 'unknown', label: 'ไม่ระบุช่องทาง', shortLabel: 'ไม่ระบุ' }
}

/**
 * Filter value → SQL fragment สำหรับ /api/reports GET
 * คืน null = ไม่ filter
 */
export function buildReportSourceFilter(
  source: string | null | undefined,
): { sql: string; params: string[] } | null {
  if (!source || source === 'all' || source === '__all__') return null
  if (source === 'online') {
    return { sql: 'r.created_by = ?', params: ['online_liff'] }
  }
  if (source === 'onsite') {
    // web_form หรือค่าอื่นที่ไม่ใช่ online_liff (รวมถึง legacy NULL)
    return {
      sql: '(r.created_by = ? OR r.created_by IS NULL)',
      params: ['web_form'],
    }
  }
  return null
}
