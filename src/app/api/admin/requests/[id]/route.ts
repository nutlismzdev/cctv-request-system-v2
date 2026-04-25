// app/api/admin/requests/[id]/route.ts
import { NextRequest } from 'next/server'
import { query } from '@/lib/db'

// -------- Types --------
interface ReportDetail {
  report_id: number
  submitted_at: string | Date
  prefix: string
  full_name: string
  age: number | null
  phone_number: string
  id_or_passport_number: string
  request_type: string
  incident_date: string
  incident_time: string
  incident_location: string
  status: string
  priority: 'low' | 'medium' | 'high'
  status_updated_at: string | Date | null
  assigned_officer_id: number | null
  officer_name: string | null
  officer_position: string | null
  officer_phone: string | null
  officer_email: string | null
  image_count: number
  video_count: number
  document_count: number
  [key: string]: unknown // รองรับคอลัมน์อื่น ๆ ของ r.*
}

interface DocumentSummary {
  doc_id: number
  document_type: string
  file_name: string
  file_size: number
  mime_type: string
  verification_status: 'pending' | 'verified' | 'rejected'
  uploaded_at: string | Date
}

type CCTVFileSummary =
  | {
      type: 'image'
      file_id: number
      file_name: string
      file_size: number
      approval_status: string
      uploaded_at: string | Date
      camera_id: number | string | null
      camera_location: string | null
      description: string | null
    }
  | {
      type: 'video'
      file_id: number
      file_name: string
      file_size: number
      approval_status: string
      uploaded_at: string | Date
      camera_id: number | string | null
      camera_location: string | null
      description: string | null
    }

type RouteParams = { id: string }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// -------- GET /admin/requests/[id] --------
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { id } = await params
    const reportId = Number.parseInt(id, 10)

    if (Number.isNaN(reportId)) {
      return Response.json(
        { success: false, message: 'รหัสคำร้องไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const reportSql = `
      SELECT
        r.*,
        o.full_name AS officer_name,
        o.position  AS officer_position,
        o.phone     AS officer_phone,
        o.email     AS officer_email,
        (SELECT COUNT(*) FROM cctv_images  ci WHERE ci.report_id = r.report_id) AS image_count,
        (SELECT COUNT(*) FROM cctv_videos  cv WHERE cv.report_id = r.report_id) AS video_count,
        (SELECT COUNT(*) FROM request_documents rd WHERE rd.report_id = r.report_id) AS document_count
      FROM reports r
      LEFT JOIN officers o ON r.assigned_officer_id = o.officer_id
      WHERE r.report_id = ?
    `
    const reports = await query<ReportDetail>(reportSql, [reportId])
    if (reports.length === 0) {
      return Response.json(
        { success: false, message: 'ไม่พบคำร้องที่ระบุ' },
        { status: 404 }
      )
    }
    const report = reports[0]

    const documentsSql = `
      SELECT
        doc_id,
        document_type,
        file_name,
        file_size,
        mime_type,
        verification_status,
        uploaded_at
      FROM request_documents
      WHERE report_id = ?
      ORDER BY uploaded_at DESC
    `
    const documents = await query<DocumentSummary>(documentsSql, [reportId])

    const cctvSql = `
      SELECT
        'image'      AS type,
        image_id     AS file_id,
        file_name,
        file_size,
        approval_status,
        uploaded_at,
        camera_id,
        camera_location,
        description
      FROM cctv_images
      WHERE report_id = ?
      UNION ALL
      SELECT
        'video'      AS type,
        video_id     AS file_id,
        file_name,
        file_size,
        approval_status,
        uploaded_at,
        camera_id,
        camera_location,
        description
      FROM cctv_videos
      WHERE report_id = ?
      ORDER BY uploaded_at DESC
    `
    const cctvFiles = await query<CCTVFileSummary>(cctvSql, [reportId, reportId])

    return Response.json({
      success: true,
      data: {
        ...report,
        documents,
        cctv_files: cctvFiles,
      },
    })
  } catch (error) {
    console.error('Error fetching request detail:', error)
    const message =
      error instanceof Error
        ? error.message
        : 'เกิดข้อผิดพลาดในการดึงข้อมูลคำร้อง'
    return Response.json({ success: false, message }, { status: 500 })
  }
}

// -------- PATCH /admin/requests/[id] --------
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { id } = await params
    const reportId = Number.parseInt(id, 10)

    if (Number.isNaN(reportId)) {
      return Response.json(
        { success: false, message: 'รหัสคำร้องไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const body = (await req.json()) as Record<string, unknown>

    const existing = await query<{ report_id: number }>(
      'SELECT report_id FROM reports WHERE report_id = ?',
      [reportId]
    )
    if (existing.length === 0) {
      return Response.json(
        { success: false, message: 'ไม่พบคำร้องที่ระบุ' },
        { status: 404 }
      )
    }

    const allowedFields = [
      'status',
      'priority',
      'assigned_officer_id',
      'officer_comments',
      'officer_decision',
      'reviewed_at',
      'approved_at',
      'internal_notes',
      'public_notes',
      'rejection_reason',
      'pdf_url',
      'pdf_generated_at',
    ] as const

    const updateFields: string[] = []
    const values: unknown[] = []

    for (const key of allowedFields) {
      if (key in body && body[key] !== undefined) {
        updateFields.push(`${key} = ?`)
        values.push(body[key])
      }
    }

    if (updateFields.length === 0) {
      return Response.json(
        { success: false, message: 'ไม่มีข้อมูลที่จะอัปเดต' },
        { status: 400 }
      )
    }

    const sql = `
      UPDATE reports
      SET ${updateFields.join(', ')},
          updated_at = NOW(),
          status_updated_at = NOW()
      WHERE report_id = ?
    `
    values.push(reportId)
    await query(sql, values)

    return Response.json({
      success: true,
      message: 'อัปเดตคำร้องเรียบร้อยแล้ว',
    })
  } catch (error) {
    console.error('Error updating request:', error)
    const message =
      error instanceof Error
        ? error.message
        : 'เกิดข้อผิดพลาดในการอัปเดตคำร้อง'
    return Response.json({ success: false, message }, { status: 500 })
  }
}
