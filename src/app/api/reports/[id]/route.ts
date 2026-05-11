// src/app/api/reports/[id]/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { NextRequest } from 'next/server'
import { z } from 'zod'

// ------------ Zod schema for report update ------------
const updateReportSchema = z.object({
  // Personal info
  prefix: z.string().optional(),
  full_name: z.string().optional(),
  age: z.number().nullable().optional(),
  phone_number: z.string().optional(),

  // Address
  house_number: z.string().nullable().optional(),
  village_number: z.string().nullable().optional(),
  alley: z.string().nullable().optional(),
  road: z.string().nullable().optional(),
  sub_district: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  postal_code: z.string().nullable().optional(),

  // Request details
  category_id: z.number().nullable().optional(),
  request_type: z.enum(['ขอดูข้อมูลรูปภาพ','ขอสำเนาข้อมูลภาพ']).optional(),
  request_details: z.string().nullable().optional(),
  incident_date: z.string().nullable().optional(),
  incident_time: z.string().nullable().optional(),
  incident_location: z.string().nullable().optional(),

  // Involvement
  involvement_role: z.string().nullable().optional(),
  involvement_explain: z.string().nullable().optional(),

  // Status
  status: z.enum([
    'รอดำเนินการ',
    'รอยื่นเอกสาร',
    'รอเอกสารอนุมัติ',
    'เอกสารอนุมัติเรียบร้อย',
    'ปฏิเสธคำร้อง'
  ]).optional(),
  priority: z.enum(['low','medium','high','urgent']).optional(),

  // Officer
  assigned_officer_id: z.number().nullable().optional(),

  // Notes & Comments
  officer_comments: z.string().nullable().optional(),
  officer_decision: z.enum(['อนุญาต', 'ไม่อนุญาต', 'รอพิจารณา', 'ต้องการข้อมูลเพิ่มเติม']).nullable().optional(),
  internal_notes: z.string().nullable().optional(),
  public_notes: z.string().nullable().optional(),
  rejection_reason: z.string().nullable().optional(),

  // Location coordinates
  latitude: z.coerce.number().nullable().optional(),
  longitude: z.coerce.number().nullable().optional(),
  location_verified_by: z.number().nullable().optional(),
})

// ------------ Import shared database connection ------------
import { getPool } from '@/lib/db'
import { requireAdmin } from '@/lib/auth-server'

// ------------ Import LINE notification function ------------
import { sendNotificationToReportOwner } from '@/lib/line-notification'

// ------------ PATCH /api/reports/[id] - Update report status ------------
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdmin(req)
    if ('response' in guard) return guard.response

    const resolvedParams = await params
    const { id } = resolvedParams
    const reportId = parseInt(id, 10)
    if (isNaN(reportId)) {
      return Response.json(
        { success: false, message: 'รหัสคำร้องไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const body = await req.json()

    const parsed = updateReportSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json(
        {
          success: false,
          message: 'ข้อมูลไม่ถูกต้อง',
          errors: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 422 }
      )
    }

    const data = parsed.data

    // Check if report exists
    const [existingReport] = await getPool().execute<RowDataPacket[]>(
      'SELECT report_id, status FROM reports WHERE report_id = ?',
      [reportId]
    )

    if (existingReport.length === 0) {
      return Response.json(
        { success: false, message: 'ไม่พบคำร้องที่ระบุ' },
        { status: 404 }
      )
    }

    const currentStatus = existingReport[0].status

    // Debug logging
    console.log('PATCH /api/reports/[id] - Received data:', {
      reportId,
      currentStatus,
      newStatus: data.status,
      hasStatusChange: data.status && data.status !== currentStatus
    })

    // Update the report
    const updateQuery = `
      UPDATE reports
      SET
        prefix = COALESCE(?, prefix),
        full_name = COALESCE(?, full_name),
        age = COALESCE(?, age),
        phone_number = COALESCE(?, phone_number),
        house_number = COALESCE(?, house_number),
        village_number = COALESCE(?, village_number),
        alley = COALESCE(?, alley),
        road = COALESCE(?, road),
        sub_district = COALESCE(?, sub_district),
        district = COALESCE(?, district),
        province = COALESCE(?, province),
        postal_code = COALESCE(?, postal_code),
        category_id = COALESCE(?, category_id),
        request_type = COALESCE(?, request_type),
        request_details = COALESCE(?, request_details),
        incident_date = COALESCE(?, incident_date),
        incident_time = COALESCE(?, incident_time),
        incident_location = COALESCE(?, incident_location),
        involvement_role = COALESCE(?, involvement_role),
        involvement_explain = COALESCE(?, involvement_explain),
        status = COALESCE(?, status),
        priority = COALESCE(?, priority),
        status_updated_at = CASE WHEN ? != status THEN NOW() ELSE status_updated_at END,
        approved_at = CASE WHEN ? IS NOT NULL AND ? = 'เอกสารอนุมัติเรียบร้อย' AND ? != 'เอกสารอนุมัติเรียบร้อย' THEN NOW() ELSE approved_at END,
        assigned_officer_id = COALESCE(?, assigned_officer_id),
        officer_comments = COALESCE(?, officer_comments),
        officer_decision = COALESCE(?, officer_decision),
        internal_notes = COALESCE(?, internal_notes),
        public_notes = COALESCE(?, public_notes),
        rejection_reason = COALESCE(?, rejection_reason),
        latitude = COALESCE(?, latitude),
        longitude = COALESCE(?, longitude),
        location_verified_by = COALESCE(?, location_verified_by),
        location_verified_at = CASE WHEN (? IS NOT NULL AND ? IS NOT NULL AND (latitude IS NULL OR longitude IS NULL OR latitude != ? OR longitude != ?)) THEN NOW() ELSE location_verified_at END,
        updated_at = NOW(),
        updated_by = 'admin'
      WHERE report_id = ?
    `

    const values = [
      data.prefix ?? null,
      data.full_name ?? null,
      data.age ?? null,
      data.phone_number ?? null,
      data.house_number ?? null,
      data.village_number ?? null,
      data.alley ?? null,
      data.road ?? null,
      data.sub_district ?? null,
      data.district ?? null,
      data.province ?? null,
      data.postal_code ?? null,
      data.category_id ?? null,
      data.request_type ?? null,
      data.request_details ?? null,
      data.incident_date ?? null,
      data.incident_time ?? null,
      data.incident_location ?? null,
      data.involvement_role ?? null,
      data.involvement_explain ?? null,
      data.status ?? null,
      data.priority ?? null,
      data.status ?? null, // for CASE WHEN ? != status
      data.status ?? null, // for CASE WHEN ? IS NOT NULL
      data.status ?? null, // for CASE WHEN ? = 'เอกสารอนุมัติเรียบร้อย'
      currentStatus, // for CASE WHEN ? != 'เอกสารอนุมัติเรียบร้อย'
      data.assigned_officer_id ?? null,
      data.officer_comments ?? null,
      data.officer_decision ?? null,
      data.internal_notes ?? null,
      data.public_notes ?? null,
      data.rejection_reason ?? null,
      data.latitude ?? null,
      data.longitude ?? null,
      data.location_verified_by ?? null,
      data.latitude ?? null,
      data.longitude ?? null,
      data.latitude ?? null,
      data.longitude ?? null,
      reportId
    ]


    const [updateResult] = await getPool().execute(updateQuery, values)

    if ((updateResult as { affectedRows?: number }).affectedRows === 0) {
      return Response.json(
        { success: false, message: 'ไม่สามารถอัปเดตคำร้องได้' },
        { status: 500 }
      )
    }

    // Log the status change if status was changed
    if (data.status && data.status !== currentStatus) {
      await getPool().execute(`
        INSERT INTO status_history (
          report_id, previous_status, new_status, changed_by, changed_at, notes
        ) VALUES (?, ?, ?, ?, NOW(), ?)
      `, [
        reportId,
        currentStatus,
        data.status,
        'admin',
        `เปลี่ยนสถานะจาก "${currentStatus}" เป็น "${data.status}"`
      ])

      // Send LINE notification if status changed to "เอกสารอนุมัติเรียบร้อย"
      if (data.status === 'เอกสารอนุมัติเรียบร้อย') {
        try {
          console.log(`Sending LINE notification for report ${reportId} - status changed to approved`)
          await sendNotificationToReportOwner(reportId, data.status)

          // Update notification_sent_at timestamp
          await getPool().execute(
            'UPDATE reports SET notification_sent_at = NOW() WHERE report_id = ?',
            [reportId]
          )

        } catch (notificationError) {
          console.error('Failed to send LINE notification:', notificationError)
          // Don't fail the entire request if notification fails
          // Just log the error and continue
        }
      }
    }

    // Fetch updated report data to return complete information
    const [updatedRows] = await getPool().execute<RowDataPacket[]>(`
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
        r.category_id,
        r.request_type,
        r.request_details,
        r.incident_date,
        r.incident_time,
        r.incident_location,
        r.involvement_role,
        r.involvement_explain,
        r.status,
        r.priority,
        r.status_updated_at,
        r.reviewed_at,
        r.approved_at,
        r.assigned_officer_id,
        r.officer_comments,
        r.officer_decision,
        r.notification_sent_at,
        r.internal_notes,
        r.public_notes,
        r.rejection_reason,
        r.pdf_url,
        r.pdf_generated_at,
        r.created_at,
        r.updated_at,
        r.created_by,
        r.updated_by,
        r.latitude,
        r.longitude,
        r.location_verified_by,
        r.location_verified_at,
        c.category_name,
        o.prefix AS officer_prefix,
        o.full_name AS officer_name,
        o.position AS officer_position,
        loc_o.prefix AS location_verified_officer_prefix,
        loc_o.full_name AS location_verified_officer_name
      FROM reports r
      LEFT JOIN categories c ON r.category_id = c.category_id
      LEFT JOIN officers o ON r.assigned_officer_id = o.officer_id
      LEFT JOIN officers loc_o ON r.location_verified_by = loc_o.officer_id
      WHERE r.report_id = ?
      LIMIT 1
    `, [reportId])

    if (updatedRows.length === 0) {
      return Response.json(
        { success: false, message: 'ไม่พบข้อมูลคำร้องหลังการอัปเดต' },
        { status: 404 }
      )
    }


    return Response.json({
      success: true,
      data: updatedRows[0],
      message: 'อัปเดตคำร้องเรียบร้อยแล้ว'
    })

  } catch (error: unknown) {
    console.error('Error updating report status:', error)
    return Response.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะ' },
      { status: 500 }
    )
  }
}

// ------------ DELETE /api/reports/[id] - Delete report ------------
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdmin(req)
    if ('response' in guard) return guard.response

    const resolvedParams = await params
    const { id } = resolvedParams
    const reportId = parseInt(id, 10)
    if (isNaN(reportId)) {
      return Response.json(
        { success: false, message: 'รหัสคำร้องไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    // Check if report exists
    const [existingReport] = await getPool().execute<RowDataPacket[]>(
      'SELECT report_id FROM reports WHERE report_id = ?',
      [reportId]
    )

    if (existingReport.length === 0) {
      return Response.json(
        { success: false, message: 'ไม่พบคำร้องที่ระบุ' },
        { status: 404 }
      )
    }

    // Delete the report (this will cascade delete related records due to FK constraints)
    const [deleteResult] = await getPool().execute<ResultSetHeader>('DELETE FROM reports WHERE report_id = ?', [reportId])

    if (deleteResult.affectedRows === 0) {
      return Response.json(
        { success: false, message: 'ไม่สามารถลบคำร้องได้' },
        { status: 500 }
      )
    }

    return Response.json({
      success: true,
      message: 'ลบคำร้องเรียบร้อยแล้ว'
    })

  } catch (error: unknown) {
    console.error('Error deleting report:', error)
    return Response.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการลบคำร้อง' },
      { status: 500 }
    )
  }
}

// ------------ GET /api/reports/[id] - Get single report ------------
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const guard = await requireAdmin(req)
    if ('response' in guard) return guard.response

    const resolvedParams = await params
    const { id } = resolvedParams
    const reportId = parseInt(id, 10)
    if (isNaN(reportId)) {
      return Response.json(
        { success: false, message: 'รหัสคำร้องไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const [rows] = await getPool().execute<RowDataPacket[]>(
      `SELECT
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
        r.reviewed_at,
        r.approved_at,
        r.assigned_officer_id,
        r.officer_comments,
        r.officer_decision,
        r.notification_sent_at,
        r.internal_notes,
        r.public_notes,
        r.rejection_reason,
        r.pdf_url,
        r.pdf_generated_at,
        r.created_at,
        r.updated_at,
        r.created_by,
        r.updated_by,
        r.latitude,
        r.longitude,
        r.location_verified_by,
        r.location_verified_at,
        c.category_name,
        r.line_user_id,
        lu.is_friend AS line_is_friend,
        lu.display_name AS line_display_name
      FROM reports r
      LEFT JOIN categories c ON r.category_id = c.category_id
      LEFT JOIN line_users lu ON r.line_user_id = lu.line_user_id
      WHERE r.report_id = ?`,
      [reportId]
    )

    if (rows.length === 0) {
      return Response.json(
        { success: false, message: 'ไม่พบคำร้องที่ระบุ' },
        { status: 404 }
      )
    }

    return Response.json({
      success: true,
      data: rows[0]
    })

  } catch (error: unknown) {
    console.error('Error fetching report:', error)
    return Response.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลคำร้อง' },
      { status: 500 }
    )
  }
}
