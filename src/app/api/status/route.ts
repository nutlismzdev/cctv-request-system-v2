import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import crypto from 'crypto'
import { z } from 'zod'

export const runtime = 'nodejs'

// ---------- Helpers ----------
function json(data: unknown, init?: number | ResponseInit) {
  const base: ResponseInit = typeof init === 'number' ? { status: init } : (init || {})
  return NextResponse.json(data, {
    ...base,
    headers: { 'Cache-Control': 'no-store', ...(base.headers || {}) },
  })
}

// ---------- Global token store ----------
type TokenData = { reportId: number; expires: number }

declare global {
  var statusTokenStore: Map<string, TokenData> | undefined
}

const tokenStore: Map<string, TokenData> =
  (globalThis.statusTokenStore ??= new Map<string, TokenData>())

let cleanupScheduled = false
if (!cleanupScheduled) {
  // ล้าง token หมดอายุทุก 5 นาที
  const t = setInterval(() => {
    const now = Date.now()
    for (const [tk, data] of tokenStore.entries()) {
      if (data.expires < now) tokenStore.delete(tk)
    }
  }, 5 * 60 * 1000)
  // ไม่รั้ง event loop (รองรับ Node runtime เท่านั้น)
  ;(t as unknown as { unref?: () => void }).unref?.()
  cleanupScheduled = true
}

// ---------- Schemas / Types ----------
const BodySchema = z.object({
  idNumber: z.string().min(1),
  phoneLast4: z.string().regex(/^\d{4}$/),
})

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
  id_or_passport_number: z.string().nullable().optional(),
  phone_number: z.union([z.string(), z.number()]).nullable().optional(),
})
type TDBReportRow = z.infer<typeof DBReportRow>

const DBReportRows = z.array(DBReportRow)

function getClientIp(req: NextRequest): string {
  const cf = req.headers.get('cf-connecting-ip')
  if (cf) return cf.trim()
  const trueClient = req.headers.get('true-client-ip')
  if (trueClient) return trueClient.trim()
  const realIp = req.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  const xff = req.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const withIp = req as unknown as { ip?: string }
  return withIp.ip ?? 'unknown'
}

export async function POST(request: NextRequest) {
  try {
    const parsedBody = BodySchema.safeParse(await request.json().catch(() => null))
    if (!parsedBody.success) return json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, 400)

    const { idNumber, phoneLast4 } = parsedBody.data
    const cleanIdNumber = idNumber.replace(/[-\s]/g, '').trim()

    const raw = (await query(
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
        r.id_or_passport_number,
        r.phone_number
      FROM reports r
      WHERE (
        r.id_or_passport_number = ?
        OR REPLACE(REPLACE(r.id_or_passport_number, '-', ''), ' ', '') = ?
        OR REPLACE(REPLACE(?, '-', ''), ' ', '') = REPLACE(REPLACE(r.id_or_passport_number, '-', ''), ' ', '')
      )
        AND (
          RIGHT(r.phone_number, 4) = ?
          OR RIGHT(REPLACE(r.phone_number, '-', ''), 4) = ?
        )
      ORDER BY r.submitted_at DESC
      `,
      [idNumber, cleanIdNumber, cleanIdNumber, phoneLast4, phoneLast4]
    )) as unknown

    const reportsParsed = DBReportRows.safeParse(raw)
    if (!reportsParsed.success || reportsParsed.data.length === 0) {
      return json(
        { error: 'ไม่พบคำร้องที่ตรงกับข้อมูลที่กรอก กรุณาตรวจสอบเลขบัตรประชาชนและเบอร์โทรศัพท์' },
        404
      )
    }
    const reports = reportsParsed.data

    // คัดเฉพาะที่มี field จำเป็นครบ
    const validReports: TDBReportRow[] = reports.filter(
      (r) => !!r.report_id && !!r.id_or_passport_number && r.phone_number != null
    )
    if (validReports.length === 0) {
      return json({ error: 'ข้อมูลคำร้องไม่สมบูรณ์ กรุณาติดต่อเจ้าหน้าที่' }, 500)
    }

    const reportsWithBasicInfo = validReports.map((r) => ({
      report_id: r.report_id,
      submitted_at: r.submitted_at ?? null,
      status: r.status ?? null,
      request_type: r.request_type ?? null,
      incident_date: r.incident_date ?? null,
      incident_location: r.incident_location ?? null,
    }))

    const latestReport = validReports[0]
    const token = crypto.randomBytes(32).toString('hex')
    const expires = Date.now() + 30 * 60 * 1000 // 30 นาที
    tokenStore.set(token, { reportId: latestReport.report_id, expires })

    // log (ไม่ทำให้ล้มเหลวหากเขียน log ไม่ได้)
    try {
      const ip = getClientIp(request)
      await query(
        `
        INSERT INTO file_access_logs (
          report_id,
          file_type,
          file_id,
          action,
          access_method,
          accessed_by_type,
          accessed_by_name,
          ip_address,
          success
        ) VALUES (?, 'document', ?, 'view', 'web', 'applicant', ?, ?, true)
        `,
        [latestReport.report_id, latestReport.report_id, latestReport.full_name ?? 'anonymous', ip]
      )
    } catch (logErr) {
      console.error('[STATUS API] Failed to log access:', logErr)
    }

    return json({
      reports: reportsWithBasicInfo,
      latest_report: { report_id: latestReport.report_id },
      token,
    })
  } catch (error) {
    console.error('[STATUS API] Status check error:', error)
    const msg = error instanceof Error ? error.message.toLowerCase() : ''
    if (msg.includes('connection') || msg.includes('econnrefused')) {
      return json({ error: 'ไม่สามารถเชื่อมต่อฐานข้อมูล กรุณาลองใหม่อีกครั้ง' }, 503)
    }
    if (msg.includes('timeout')) {
      return json({ error: 'การเชื่อมต่อฐานข้อมูลหมดเวลา กรุณาลองใหม่อีกครั้ง' }, 504)
    }
    return json({ error: 'เกิดข้อผิดพลาดในการตรวจสอบสถานะ กรุณาลองใหม่อีกครั้ง' }, 500)
  }
}
