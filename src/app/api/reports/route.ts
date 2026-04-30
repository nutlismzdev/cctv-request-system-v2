// src/app/api/reports/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic' // กัน cache สำหรับ GET

import crypto from 'crypto'
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { z } from 'zod'
import { NextResponse } from 'next/server'

// ------------ Zod schema ------------
const createReportSchema = z.object({
  // Personal info
  prefix: z.string().min(1, 'กรุณาระบุคำนำหน้า'),
  full_name: z.string().min(1, 'กรุณาระบุชื่อ-นามสกุล'),
  age: z.string()
    .min(1, 'กรุณาระบุอายุ')
    .refine(v => /^[0-9]+$/.test(v), 'อายุต้องเป็นตัวเลขเท่านั้น')
    .refine(v => parseInt(v) >= 1 && parseInt(v) <= 120, 'อายุต้องอยู่ระหว่าง 1-120 ปี'),
  id_or_passport_number: z.string().min(6, 'กรุณาระบุเลขบัตรประชาชน/หนังสือเดินทาง'),
  phone_number: z.string().min(9, 'กรุณาระบุเบอร์โทรศัพท์'),
  line_user_id_str: z.string().min(1, 'กรุณาเข้าสู่ระบบ LINE ใหม่อีกครั้ง').optional(),

  // Address
  house_number: z.string().optional(),
  village_number: z.string().optional(),
  alley: z.string().optional(),
  road: z.string().optional(),
  sub_district: z.string().min(1, 'กรุณาระบุตำบล/แขวง'),
  district: z.string().min(1, 'กรุณาระบุอำเภอ/เขต'),
  province: z.string().min(1, 'กรุณาระบุจังหวัด'),
  postal_code: z.string().min(5, 'กรุณาระบุรหัสไปรษณีย์'),
  language: z.enum(['th', 'en'], { message: 'กรุณาระบุภาษา' }).default('th'),

  // Request details
  category_id: z.number().int().min(1, 'กรุณาเลือกหมวดหมู่เหตุการณ์'),
  request_type: z.enum(['ขอดูข้อมูลรูปภาพ', 'ขอสำเนาข้อมูลภาพ'], {
    message: 'กรุณาเลือกประเภทคำร้อง',
  }),
  incident_date: z.string().min(1, 'กรุณาระบุวันที่เกิดเหตุ'),
  incident_time: z.string().min(1, 'กรุณาระบุเวลาที่เกิดเหตุ'),
  incident_location: z.string().min(1, 'กรุณาระบุสถานที่เกิดเหตุ'),

  // Involvement
  involvement_role: z.enum(['ผู้เสียหาย', 'ญาติ', 'ผู้เกี่ยวข้อง', 'เจ้าหน้าที่รัฐ', 'ประกัน'], {
    message: 'กรุณาเลือกสถานะการเกี่ยวข้อง',
  }),
  involvement_explain: z.string().optional(),

  request_details: z.string().optional(),

  // Supporting documents
  supporting_documents: z.object({
    id_card_copy: z.boolean(),
    police_report_copy: z.boolean(),
    other: z.boolean(),
    other_details: z.string().optional(),
  }).refine((docs) => {
    if (!docs.id_card_copy && !docs.police_report_copy && !docs.other) return false
    if (docs.other && !docs.other_details?.trim()) return false
    return true
  }, {
    message: 'กรุณาเลือกเอกสารหลักฐานประกอบอย่างน้อย 1 รายการ และกรอกรายละเอียดเอกสารอื่นๆ หากเลือก',
    path: ['supporting_documents'],
  }),

  consent: z.boolean().refine((v) => v, 'ต้องยอมรับเงื่อนไขก่อนยื่นคำร้อง'),
})

// ------------ Import shared database connection ------------
import { getOrCreateLineUserNumericId, getPool, secureResetLineUserId } from '@/lib/db'
import { sendGroupNotificationForNewReport } from '@/lib/line-notification'

// ------------ POST /api/reports ------------
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = createReportSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          message: 'ข้อมูลไม่ถูกต้อง',
          errors: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 422 },
      )
    }
    const data = parsed.data

    const cleanIdOrPassport = data.id_or_passport_number.replace(/-/g, '')
    const lineUserId = data.line_user_id_str
      ? await getOrCreateLineUserNumericId(data.line_user_id_str)
      : null

    // สร้าง token + link_code ก่อน INSERT เพื่อใส่ในแถวเดียว ตัด UPDATE รอบที่สองออก
    // 16 bytes random = 2^128 collision space → trust randomness; ถ้าชน UNIQUE จริง ๆ retry
    const trackingToken = crypto.randomBytes(32).toString('hex')

    const insertQuery = `
      INSERT INTO reports (
        prefix, full_name, age, id_or_passport_number, phone_number,
        house_number, village_number, alley, road,
        sub_district, district, province, postal_code, language,
        category_id, request_type, request_details,
        incident_date, incident_time, incident_location,
        involvement_role, involvement_explain, supporting_documents,
        line_user_id, status, priority, created_at, created_by,
        tracking_token, link_code
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?
      )
    `

    const baseValues = [
      data.prefix,
      data.full_name,
      parseInt(data.age, 10),
      cleanIdOrPassport,
      data.phone_number,
      data.house_number ?? null,
      data.village_number ?? null,
      data.alley ?? null,
      data.road ?? null,
      data.sub_district,
      data.district,
      data.province,
      data.postal_code,
      data.language,
      data.category_id,
      data.request_type,
      data.request_details ?? null,
      data.incident_date,
      data.incident_time,
      data.incident_location,
      data.involvement_role,
      data.involvement_explain ?? null,
      JSON.stringify(data.supporting_documents),
      lineUserId,
      'รอดำเนินการ',
      'medium',
      new Date(),
      data.line_user_id_str ? 'online_liff' : 'web_form',
      trackingToken,
    ]

    // INSERT พร้อม link_code; ถ้า UNIQUE collision (เกือบเป็นไปไม่ได้) retry สูงสุด 3 ครั้ง
    let res!: ResultSetHeader
    let linkCode = ''
    let attempts = 0
    const maxAttempts = 3
    while (attempts < maxAttempts) {
      linkCode = crypto.randomBytes(16).toString('hex')
      try {
        const [r] = await getPool().execute<ResultSetHeader>(insertQuery, [...baseValues, linkCode])
        res = r
        break
      } catch (e: unknown) {
        const errCode = (e as { code?: string })?.code
        if (errCode === 'ER_DUP_ENTRY' && attempts < maxAttempts - 1) {
          attempts++
          continue
        }
        throw e
      }
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`Created report with ID: ${res.insertId}`)
    }

    // กัน auto-link เฉพาะ legacy/web form เท่านั้น; online_liff ตั้ง line_user_id โดยตั้งใจอยู่แล้ว
    if (!data.line_user_id_str) {
      const [checkResult] = await getPool().execute<RowDataPacket[]>(
        'SELECT line_user_id FROM reports WHERE report_id = ?',
        [res.insertId]
      )
      if (checkResult.length > 0 && checkResult[0].line_user_id) {
        if (process.env.NODE_ENV !== 'production') {
          console.error(`SECURITY ALERT: Report ${res.insertId} was auto-linked to line_user_id ${checkResult[0].line_user_id} during creation! Resetting to NULL.`)
        }
        await secureResetLineUserId(res.insertId, `Auto-linked during report creation (line_user_id: ${checkResult[0].line_user_id})`)
        if (process.env.NODE_ENV !== 'production') {
          await getPool().execute(
            `
            INSERT INTO activity_logs (
              activity_type, entity_type, entity_id,
              actor_type, actor_id, action, description,
              metadata, ip_address
            ) VALUES (
              'security_incident', 'report', ?,
              'system', 'auto_link_prevention', 'AUTO_LINK_RESET',
              'Reset line_user_id that was set automatically during report creation',
              JSON_OBJECT('auto_linked_line_user_id', ?),
              'system'
            )
          `,
            [res.insertId, checkResult[0].line_user_id]
          )
        }
      }
    }

    // Fire-and-forget: ไม่บล็อก response ของผู้ใช้รอ LINE Push API (~500ms-2s)
    // หาก LINE API ช้า/ล้ม ก็ไม่ควรกระทบ flow การบันทึกคำร้อง
    void sendGroupNotificationForNewReport(res.insertId).catch((e) => {
      console.error('Failed to send LINE group notification:', e)
    })

    return NextResponse.json(
      {
        success: true,
        data: {
          report_id: res.insertId,
          tracking_token: trackingToken,
          link_code: linkCode,
          status: 'รอดำเนินการ',
          message: 'บันทึกคำร้องเรียบร้อยแล้ว',
        },
      },
      { status: 201 },
    )
  } catch (error: unknown) {
    console.error('Error creating report:', error)

    if (typeof error === 'object' && error && 'code' in error && (error as { code?: string }).code === 'ER_DUP_ENTRY') {
      return NextResponse.json(
        { success: false, message: 'พบข้อมูลซ้ำในระบบ' },
        { status: 409 },
      )
    }

    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' },
      { status: 500 },
    )
  }
}

// ------------ GET /api/reports ------------
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)

    // sanitize page/limit เป็นเลขแน่นอน
    const pageNum  = Number(searchParams.get('page'))
    const limitNum = Number(searchParams.get('limit'))
    const page  = Number.isFinite(pageNum)  && pageNum  > 0 ? pageNum  : 1
    let   limit = Number.isFinite(limitNum) && limitNum > 0 ? limitNum : 10
    if (limit > 100) limit = 100
    const offset = (page - 1) * limit

    const statusParam = searchParams.get('status')
    const status = statusParam && statusParam !== '__all__' ? statusParam : undefined
    const search = searchParams.get('search') || undefined
    const categoryIdRaw = searchParams.get('category_id')
    const categoryId = categoryIdRaw ? Number(categoryIdRaw) : undefined

    let where = 'WHERE 1=1'
    const params: Array<string | number> = []

    if (status) {
      where += ' AND r.status = ?'
      params.push(status)
    }
    if (Number.isFinite(categoryId!)) {
      where += ' AND r.category_id = ?'
      params.push(Number(categoryId))
    }
    if (search) {
      const like = `%${search}%`
      where += ' AND (r.full_name LIKE ? OR r.phone_number LIKE ? OR r.incident_location LIKE ?)'
      params.push(like, like, like)
    }

    // ⚠ ฝัง offset/limit หลัง sanitize แล้ว (เลี่ยง bind ใน LIMIT ที่ก่อปัญหา)
    const selectQuery = `
      SELECT
        r.report_id,
        r.submitted_at,
        r.prefix,
        r.full_name,
        r.age,
        r.id_or_passport_number,
        r.phone_number,
        r.house_number,
        r.village_number,
        r.alley,
        r.road,
        r.sub_district,
        r.district,
        r.province,
        r.postal_code,
        r.language,
        r.category_id,
        r.request_type,
        r.request_details,
        r.incident_date,
        r.incident_time,
        r.incident_location,
        r.involvement_role,
        r.involvement_explain,
        r.supporting_documents,
        r.status,
        r.priority,
        r.status_updated_at,
        r.assigned_officer_id,
        r.line_user_id,
        r.officer_comments,
        r.officer_decision,
        r.internal_notes,
        r.public_notes,
        r.rejection_reason,
        r.created_at,
        r.updated_at,
        r.created_by,
        r.updated_by,
        c.category_name
      FROM reports r
      LEFT JOIN categories c ON r.category_id = c.category_id
      ${where}
      ORDER BY r.created_at DESC
      LIMIT ${offset}, ${limit}
    `

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM reports r
      LEFT JOIN categories c ON r.category_id = c.category_id
      ${where}
    `

    // ✅ Promise.all: รัน SELECT และ COUNT พร้อมกัน (ไม่ต้องรอกัน)
    const [[rows], [countRows]] = await Promise.all([
      getPool().execute<RowDataPacket[]>(selectQuery, params),
      getPool().execute<RowDataPacket[]>(countQuery, params),
    ])

    const total = Number(countRows[0]?.total ?? 0)
    return NextResponse.json({
      success: true,
      data: {
        items: rows,
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching reports:', error)
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล' },
      { status: 500 },
    )
  }
}
