/**
 * PDPA Privacy Notice — single source of truth (frontend + backend)
 *
 * เปลี่ยนเวอร์ชันเมื่อมีการแก้ไขเนื้อหา Privacy Notice เพื่อให้ consent_logs สามารถ
 * พิสูจน์ได้ว่าผู้ใช้ยินยอมภายใต้เนื้อหาเวอร์ชันใด
 */
export const PDPA_PRIVACY_NOTICE_VERSION = '2026-05-11'
export const PDPA_PRIVACY_NOTICE_EFFECTIVE_AT = '2026-05-11'

export const PDPA_CONSENT_TYPES = {
  PRIVACY_NOTICE: 'pdpa_privacy_notice',
} as const

export type PdpaConsentAction = 'accepted' | 'rejected' | 'withdrawn'
export type PdpaSubjectType = 'applicant' | 'line_user' | 'admin' | 'anonymous'
