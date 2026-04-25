// app/api/line/link-via-url/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPool, secureLinkReportByCode } from '@/lib/db'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:4000'

/**
 * ถ้ากดลิงก์ซ้ำแล้ว "ผูกกับผู้ใช้คนเดิม" อยู่แล้ว:
 * - false (ค่าแนะนำ): พาไปหน้า success?status=already_linked  → UX บอกว่าทำเสร็จแล้ว ไม่ต้องทำซ้ำ
 * - true: พาไปหน้า error?error=code_used               → มองว่าโค้ด single-use และไม่ควรใช้ซ้ำ
 */
const TREAT_RECLICK_AS_ERROR = false

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)

    // รองรับทั้งชื่อยาว/สั้น
    const linkCode = (searchParams.get('link_code') || searchParams.get('c') || '').trim()
    const reportIdStr = (searchParams.get('report_id') || searchParams.get('r') || '').trim()
    const userId = (searchParams.get('user_id') || searchParams.get('u') || '').trim()

    if (!linkCode || !reportIdStr || !userId) {
      return NextResponse.redirect(`${BASE_URL}/link-error-onsite?error=invalid_params`)
    }
    const reportId = Number(reportIdStr)
    if (!Number.isInteger(reportId) || reportId <= 0) {
      return NextResponse.redirect(`${BASE_URL}/link-error-onsite?error=invalid_params`)
    }

    // อ่านสถานะปัจจุบัน
    const [rows] = (await getPool().execute(
      `SELECT r.report_id, r.link_code, r.link_code_used, r.link_code_expires_at,
              r.line_user_id, r.status,
              lu.line_user_id_str AS linked_user_id_str
         FROM reports r
    LEFT JOIN line_users lu ON r.line_user_id = lu.line_user_id
        WHERE r.report_id = ?
        LIMIT 1`,
      [reportId]
    )) as import('mysql2/promise').RowDataPacket[][]

    if (rows.length === 0) {
      return NextResponse.redirect(`${BASE_URL}/link-error-onsite?error=report_not_found`)
    }

    const r = rows[0]

    // กรณีถูกผูกอยู่แล้ว
    if (r.line_user_id) {
      if (r.linked_user_id_str === userId) {
        // ผูกกับ user นี้อยู่แล้ว
        if (TREAT_RECLICK_AS_ERROR) {
          return NextResponse.redirect(`${BASE_URL}/link-error-onsite?error=code_used`)
        }
        // UX-friendly: บอกว่าเชื่อมเสร็จแล้ว
        return NextResponse.redirect(`${BASE_URL}/link-success-onsite?report_id=${reportId}&status=already_linked`)
      } else {
        // ผูกกับคนอื่นไปแล้ว
        return NextResponse.redirect(`${BASE_URL}/link-error-onsite?error=already_linked_to_other`)
      }
    }

    // ตรวจสอบโค้ดและสถานะก่อนทำจริง
    if (!r.link_code) {
      return NextResponse.redirect(`${BASE_URL}/link-error-onsite?error=report_not_found`)
    }
    if (r.link_code !== linkCode) {
      return NextResponse.redirect(`${BASE_URL}/link-error-onsite?error=invalid_params`)
    }
    if (Number(r.link_code_used) === 1) {
      return NextResponse.redirect(`${BASE_URL}/link-error-onsite?error=code_used`)
    }
    if (r.link_code_expires_at && new Date(r.link_code_expires_at).getTime() <= Date.now()) {
      return NextResponse.redirect(`${BASE_URL}/link-error-onsite?error=code_expired`)
    }
    if (r.status !== 'รอดำเนินการ') {
      return NextResponse.redirect(`${BASE_URL}/link-error-onsite?error=invalid_status`)
    }

    // ลิงก์แบบปลอดภัย (มีทรานแซกชัน + FOR UPDATE)
    try {
      await secureLinkReportByCode(reportId, linkCode, userId, 'liff_confirm_link', userId)
      return NextResponse.redirect(`${BASE_URL}/link-success-onsite?report_id=${reportId}&status=linked`)
    } catch {
      // อาจมี race condition หรือสถานะเปลี่ยนระหว่างทาง
      return NextResponse.redirect(`${BASE_URL}/link-error-onsite?error=code_used`)
    }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('link-via-url error:', error)
    }
    return NextResponse.redirect(`${BASE_URL}/link-error-onsite?error=server_error`)
  }
}
