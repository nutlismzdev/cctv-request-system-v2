import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { z } from 'zod'
import { validateLineToken } from '@/lib/line-notification'

// รันบน Node.js runtime ให้พฤติกรรม Map อยู่ในโปรเซสเดียว (ถ้าแอพตั้งค่า Edge อาจแตกต่าง)
export const runtime = 'nodejs'

// ---------- Global token store ----------
type TokenData = { reportId: number; expires: number }

declare global {
  var statusTokenStore: Map<string, TokenData> | undefined
}

interface GlobalWithStatusStore {
  statusTokenStore?: Map<string, TokenData>
}

const globalForStore = globalThis as GlobalWithStatusStore
if (!globalForStore.statusTokenStore) {
  globalForStore.statusTokenStore = new Map<string, TokenData>()
}
const tokenStore = globalForStore.statusTokenStore!

// ---------- Helper: JSON with no-store ----------
function json(data: unknown, init?: number | ResponseInit) {
  const base: ResponseInit = typeof init === 'number' ? { status: init } : (init || {})
  return NextResponse.json(data, {
    ...base,
    headers: {
      'Cache-Control': 'no-store',
      ...(base.headers || {}),
    },
  })
}

// ---------- Zod Schemas / Types ----------
const DBReportRow = z.object({
  report_id: z.coerce.number(),
  submitted_at: z.string().nullable().optional(),
  full_name: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  request_details: z.string().nullable().optional(),
  incident_date: z.string().nullable().optional(),
  incident_time: z.string().nullable().optional(),
  incident_location: z.string().nullable().optional(),
  request_type: z.string().nullable().optional(),
  pdf_url: z.string().nullable().optional(),
  public_notes: z.string().nullable().optional(),
  rejection_reason: z.string().nullable().optional(),
  approved_at: z.string().nullable().optional(),
  id_or_passport_number: z.string().nullable().optional(),
  phone_number: z.union([z.string(), z.number()]).nullable().optional(),
})
type TDBReportRow = z.infer<typeof DBReportRow>
const DBReportRows = z.array(DBReportRow)

const DBUserIdentity = z.object({
  id_or_passport_number: z.string().nullable().optional(),
  phone_number: z.union([z.string(), z.number()]).nullable().optional(),
})
const DBUserIdentityRows = z.array(DBUserIdentity)

const DBImageRow = z.object({
  image_id: z.coerce.number(),
  file_name: z.string().nullable().optional(),
  file_path: z.string(),
  camera_location: z.string().nullable().optional(),
  captured_at: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
})
type TDBImageRow = z.infer<typeof DBImageRow>
const DBImageRows = z.array(DBImageRow)

const DBVideoRow = z.object({
  video_id: z.coerce.number(),
  file_name: z.string().nullable().optional(),
  file_path: z.string(),
  camera_location: z.string().nullable().optional(),
  recording_start: z.string().nullable().optional(),
  recording_end: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  mime_type: z.string().nullable().optional(),
  duration_seconds: z.coerce.number().nullable().optional(),
})
type TDBVideoRow = z.infer<typeof DBVideoRow>
const DBVideoRows = z.array(DBVideoRow)

// ---------- Handler ----------
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const requestedReportId = searchParams.get('id')

    if (!token) {
      return json({ error: 'กรุณาระบุ token สำหรับเข้าถึงข้อมูล' }, 400)
    }

    let reportId: number

    // ตรวจสอบ token จากทั้งสอง store (statusTokenStore และ lineTokenStore)
    let tokenData = tokenStore.get(token!)

    // ถ้าไม่พบใน statusTokenStore ให้ลองหาใน lineTokenStore
    if (!tokenData) {
      const reportIdFromLineToken = await validateLineToken(token!)
      if (reportIdFromLineToken) {
        // สร้าง token data สำหรับ LINE token (ยังมีอายุ 24 ชั่วโมง)
        tokenData = { reportId: reportIdFromLineToken, expires: Date.now() + (24 * 60 * 60 * 1000) }
      }
    }

    if (!tokenData) return json({ error: 'Token ไม่พบหรือหมดอายุ' }, 404)
    if (tokenData.expires < Date.now()) {
      tokenStore.delete(token!)
      return json({ error: 'Token หมดอายุ' }, 401)
    }

    reportId = tokenData.reportId

    // ถ้ามีการระบุ report ID มาด้วย ให้ตรวจสอบว่าเป็นของผู้ใช้คนเดียวกันหรือไม่
    if (requestedReportId) {
      const parsed = Number.parseInt(requestedReportId, 10)
      if (Number.isNaN(parsed) || parsed <= 0) {
        return json({ error: 'รูปแบบ report ID ไม่ถูกต้อง' }, 400)
      }

      // ถ้า report ID ที่ขอไม่ตรงกับ token ให้ตรวจสอบว่าเป็นของผู้ใช้คนเดียวกันหรือไม่
      if (parsed !== reportId) {
        // ดึงข้อมูล identity ของ report ที่ขอ
        try {
          const requestedRaw = (await query(
            `
            SELECT r.id_or_passport_number, r.phone_number
            FROM reports r
            WHERE r.report_id = ?
          `,
            [parsed]
          )) as unknown

          const requestedIdentity = DBUserIdentityRows.safeParse(requestedRaw)
          if (!requestedIdentity.success || requestedIdentity.data.length === 0) {
            return json({ error: 'ไม่พบข้อมูลคำร้องที่ระบุ' }, 404)
          }

          // ดึงข้อมูล identity ของ report จาก token
          const tokenRaw = (await query(
            `
            SELECT r.id_or_passport_number, r.phone_number
            FROM reports r
            WHERE r.report_id = ?
          `,
            [reportId]
          )) as unknown

          const tokenIdentity = DBUserIdentityRows.safeParse(tokenRaw)
          if (!tokenIdentity.success || tokenIdentity.data.length === 0) {
            return json({ error: 'ข้อมูล token ไม่ถูกต้อง' }, 401)
          }

          const requestedUser = requestedIdentity.data[0]
          const tokenUser = tokenIdentity.data[0]

          // ตรวจสอบว่าผู้ใช้คนเดียวกันหรือไม่ (ใช้ id_or_passport_number และ 4 หลักท้าย phone)
          const sameUser = requestedUser.id_or_passport_number === tokenUser.id_or_passport_number &&
                          String(requestedUser.phone_number ?? '').slice(-4) === String(tokenUser.phone_number ?? '').slice(-4)

          if (!sameUser) {
            return json({ error: 'ไม่มีสิทธิ์เข้าถึงข้อมูลคำร้องนี้' }, 403)
          }

          // ถ้าเป็นผู้ใช้คนเดียวกัน ให้เปลี่ยนไปใช้ report ID ที่ขอ
          reportId = parsed
        } catch {
          return json({ error: 'เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์' }, 500)
        }
      }
    }

    // ดึงรายงานหลัก
    const reportRaw = (await query(
      `
      SELECT
        r.report_id,
        r.submitted_at,
        r.full_name,
        r.status,
        r.request_details,
        r.incident_date,
        r.incident_time,
        r.incident_location,
        r.request_type,
        r.pdf_url,
        r.public_notes,
        r.rejection_reason,
        r.approved_at,
        r.id_or_passport_number,
        r.phone_number
      FROM reports r
      WHERE r.report_id = ?
    `,
      [reportId]
    )) as unknown

    const reportParsed = DBReportRows.safeParse(reportRaw)
    if (!reportParsed.success || reportParsed.data.length === 0) {
      return json({ error: 'ไม่พบข้อมูลคำร้อง' }, 404)
    }
    let report: TDBReportRow = reportParsed.data[0]

    // หากเรียกด้วย token และรายงานยังไม่ approved ให้ลองสลับไป approved ล่าสุดของผู้ใช้เดียวกัน
    if (report.status !== 'เอกสารอนุมัติเรียบร้อย' && !requestedReportId) {
      try {
        const apRaw = (await query(
          `
          SELECT
            r.report_id,
            r.submitted_at,
            r.full_name,
            r.status,
            r.request_details,
            r.incident_date,
            r.incident_time,
            r.incident_location,
            r.request_type,
            r.pdf_url,
            r.public_notes,
            r.rejection_reason,
            r.approved_at,
            r.id_or_passport_number,
            r.phone_number
          FROM reports r
          WHERE r.id_or_passport_number = ?
            AND RIGHT(r.phone_number, 4) = ?
            AND r.status = 'เอกสารอนุมัติเรียบร้อย'
          ORDER BY r.submitted_at DESC
          LIMIT 1
        `,
          [report.id_or_passport_number, String(report.phone_number ?? '').slice(-4)]
        )) as unknown

        const apParsed = DBReportRows.safeParse(apRaw)
        if (apParsed.success && apParsed.data.length > 0) {
          report = apParsed.data[0]
        }
      } catch {
        // ไม่ล้ม API
      }
    }

    // ตรวจสอบความครบถ้วนขั้นต่ำ
    if (!report.id_or_passport_number && (report.phone_number == null || report.phone_number === '')) {
      return json(
        { error: 'ข้อมูลคำร้องไม่สมบูรณ์ - ไม่พบเลขบัตรประชาชนและเบอร์โทรศัพท์' },
        400
      )
    }

    // ดึงรายการคำร้องทั้งหมดของผู้ใช้เดียวกัน (อิง id + 4 หลักท้ายเบอร์)
    let allUserReports: TDBReportRow[] = []
    const userId = report.id_or_passport_number ?? null
    const userPhone = report.phone_number ?? null

    if (userId && userPhone) {
      try {
        const listRaw = (await query(
          `
          SELECT
            r.report_id,
            r.submitted_at,
            r.full_name,
            r.status,
            r.request_details,
            r.incident_date,
            r.incident_time,
            r.incident_location,
            r.request_type,
            r.pdf_url,
            r.public_notes,
            r.rejection_reason,
            r.approved_at,
            r.id_or_passport_number,
            r.phone_number
          FROM reports r
          WHERE r.id_or_passport_number = ?
            AND RIGHT(r.phone_number, 4) = ?
          ORDER BY r.submitted_at DESC
        `,
          [userId, String(userPhone).slice(-4)]
        )) as unknown

        const listParsed = DBReportRows.safeParse(listRaw)
        if (listParsed.success) {
          allUserReports = listParsed.data
        }
      } catch {
        // ไม่ล้ม API
      }
    }

    // สื่อจะแสดงเฉพาะเมื่อสถานะ Approved
    let images: TDBImageRow[] = []
    let videos: TDBVideoRow[] = []

    if (report.status === 'เอกสารอนุมัติเรียบร้อย') {
      try {
        const imgRaw = (await query(
          `
          SELECT
            i.image_id,
            i.file_name,
            i.file_path,
            i.camera_location,
            i.captured_at,
            i.description
          FROM cctv_images i
          WHERE i.report_id = ?
            AND i.approval_status = 'พร้อมใช้งาน'
            AND i.is_deleted = false
          ORDER BY i.captured_at ASC
        `,
          [report.report_id]
        )) as unknown

        const imgParsed = DBImageRows.safeParse(imgRaw)
        if (imgParsed.success) images = imgParsed.data
      } catch {
        images = []
      }

      try {
        const vidRaw = (await query(
          `
          SELECT
            v.video_id,
            v.file_name,
            v.file_path,
            v.camera_location,
            v.recording_start,
            v.recording_end,
            v.description,
            v.mime_type,
            v.duration_seconds
          FROM cctv_videos v
          WHERE v.report_id = ?
            AND v.approval_status = 'พร้อมใช้งาน'
            AND v.is_deleted = false
          ORDER BY v.recording_start ASC
        `,
          [report.report_id]
        )) as unknown

        const vidParsed = DBVideoRows.safeParse(vidRaw)
        if (vidParsed.success) videos = vidParsed.data
      } catch {
        videos = []
      }
    }

    return json({
      report: {
        ...report,
        images,
        videos,
      },
      all_user_reports: allUserReports.map((r) => ({
        report_id: r.report_id,
        submitted_at: r.submitted_at ?? null,
        status: r.status ?? null,
        request_type: r.request_type ?? null,
        incident_date: r.incident_date ?? null,
        incident_location: r.incident_location ?? null,
      })),
    })
  } catch (error) {
    // เก็บล็อกเฉพาะ error สำคัญ (ไม่เผยรายละเอียดต่อผู้ใช้)
    console.error('[STATUS RESULT] Error:', error)
    if (error instanceof Error) {
      const msg = error.message.toLowerCase()
      if (msg.includes('connection') || msg.includes('econnrefused')) {
        return json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง' }, 503)
      }
      if (msg.includes('timeout')) {
        return json({ error: 'การเชื่อมต่อฐานข้อมูลหมดเวลา กรุณาลองใหม่อีกครั้ง' }, 504)
      }
    }
    return json({ error: 'เกิดข้อผิดพลาดในการโหลดข้อมูล กรุณาลองใหม่อีกครั้ง' }, 500)
  }
}
