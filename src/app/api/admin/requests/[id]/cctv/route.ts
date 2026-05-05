// src/app/api/admin/requests/[id]/cctv/route.ts
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { query } from '@/lib/db'

const cctvMetadataSchema = z.object({
  media_type: z.enum(['image', 'video']),
  file_name: z.string().min(1).max(255).regex(/^[^<>:"/\\|?*]+$/, 'ชื่อไฟล์มีอักขระต้องห้าม'),
  // file_path is a server-relative reference — must be a bare filename, no traversal
  file_path: z.string().min(1).max(255).regex(/^[A-Za-z0-9._-]+$/, 'รูปแบบ file_path ไม่ถูกต้อง'),
  file_size: z.number().int().positive().max(500 * 1024 * 1024),
  mime_type: z.string().min(1).max(100),
  camera_id: z.union([z.string(), z.number(), z.null()]).optional(),
  camera_location: z.string().max(255).nullable().optional(),
  captured_at: z.string().max(64).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  access_level: z.enum(['restricted', 'public', 'internal']).optional(),
  uploaded_by: z.union([z.string(), z.number()]).nullable().optional(),
  duration_seconds: z.number().int().nonnegative().nullable().optional(),
  resolution_width: z.number().int().positive().nullable().optional(),
  resolution_height: z.number().int().positive().nullable().optional(),
  recording_start: z.string().max(64).nullable().optional(),
  recording_end: z.string().max(64).nullable().optional(),
})


type ApprovalStatus = 'อนุมัติ' | 'รอดำเนินการ' | 'กำลังตรวจสอบ' | 'ปฏิเสธ'
type AccessLevel = 'restricted' | 'public' | 'internal' | string

interface CCTVFileRow {
  media_type: 'image' | 'video'
  file_id: number
  file_name: string
  file_path: string
  file_size: number
  mime_type: string
  camera_id: string | number | null
  camera_location: string | null
  captured_at: string // หรือ Date ถ้าคุณตั้ง mysql2 ให้คืน Date
  description: string | null
  approval_status: ApprovalStatus
  approved_by: number | null
  approved_at: string | null
  rejection_reason: string | null
  access_level: AccessLevel
  download_count: number | null
  view_count: number | null
  last_accessed_at: string | null
  uploaded_by: string | number | null
  uploaded_at: string
  is_deleted: 0 | 1 | boolean
}

// ---- Types ----
interface CCTVStats {
  total_images: number
  total_videos: number
  approved_files: number
  pending_files: number
  reviewing_files: number
  rejected_files: number
}

interface DatabaseInsertResult {
  insertId: number
  affectedRows: number
}

type RouteParams = { id: string }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// -------------------------------- GET --------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<RouteParams> }   // 👈 Next 15: params เป็น Promise
) {
  try {
    const { id } = await params                      // 👈 ต้อง await
    const reportId = Number(id)

    if (Number.isNaN(reportId)) {
      return Response.json({ success: false, message: 'หมายเลขคำร้องไม่ถูกต้อง' }, { status: 400 })
    }

    // ตรวจว่ามีคำร้องหรือไม่
    const existing = await query<{ report_id: number }>(
      'SELECT report_id FROM reports WHERE report_id = ?',
      [reportId]
    )
    if (existing.length === 0) {
      return Response.json({ success: false, message: 'ไม่พบคำร้องที่ระบุ' }, { status: 404 })
    }

    // รวมไฟล์ภาพ/วิดีโอทั้งหมดของคำร้อง
    const cctvSql = `
      SELECT
        'image' as media_type,
        image_id as file_id,
        file_name,
        file_path,
        file_size,
        mime_type,
        camera_id,
        camera_location,
        captured_at,
        description,
        approval_status,
        approved_by,
        approved_at,
        rejection_reason,
        access_level,
        download_count,
        view_count,
        last_accessed_at,
        uploaded_by,
        uploaded_at,
        is_deleted
      FROM cctv_images
      WHERE report_id = ?
      UNION ALL
      SELECT
        'video' as media_type,
        video_id as file_id,
        file_name,
        file_path,
        file_size,
        mime_type,
        camera_id,
        camera_location,
        recording_start as captured_at,
        description,
        approval_status,
        approved_by,
        approved_at,
        rejection_reason,
        access_level,
        download_count,
        view_count,
        last_accessed_at,
        uploaded_by,
        uploaded_at,
        is_deleted
      FROM cctv_videos
      WHERE report_id = ?
      ORDER BY uploaded_at DESC
    `
    const cctvFiles = await query<CCTVFileRow>(cctvSql, [reportId, reportId])

    // สถิติ
    const statsSql = `
      SELECT
        COUNT(CASE WHEN media_type = 'image' THEN 1 END) as total_images,
        COUNT(CASE WHEN media_type = 'video' THEN 1 END) as total_videos,
        COUNT(CASE WHEN approval_status = 'อนุมัติ' THEN 1 END) as approved_files,
        COUNT(CASE WHEN approval_status = 'รอดำเนินการ' THEN 1 END) as pending_files,
        COUNT(CASE WHEN approval_status = 'กำลังตรวจสอบ' THEN 1 END) as reviewing_files,
        COUNT(CASE WHEN approval_status = 'ปฏิเสธ' THEN 1 END) as rejected_files
      FROM (
        SELECT 'image' as media_type, approval_status FROM cctv_images WHERE report_id = ?
        UNION ALL
        SELECT 'video' as media_type, approval_status FROM cctv_videos WHERE report_id = ?
      ) as combined_files
    `
    const stats = await query<CCTVStats>(statsSql, [reportId, reportId])
    const statistics = stats[0] ?? {
      total_images: 0,
      total_videos: 0,
      approved_files: 0,
      pending_files: 0,
      reviewing_files: 0,
      rejected_files: 0,
    }

    return Response.json({
      success: true,
      data: cctvFiles,
      statistics: { ...statistics, total_files: statistics.total_images + statistics.total_videos },
    })
  } catch (error: unknown) {
    console.error('Error fetching CCTV files:', error)
    const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลไฟล์ CCTV'
    return Response.json({ success: false, message: errorMessage }, { status: 500 })
  }
}

// -------------------------------- POST --------------------------------
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<RouteParams> }   // 👈 เช่นเดียวกัน
) {
  try {
    const { id } = await params
    const reportId = Number(id)

    if (Number.isNaN(reportId)) {
      return Response.json({ success: false, message: 'หมายเลขคำร้องไม่ถูกต้อง' }, { status: 400 })
    }

    // ตรวจว่ามีคำร้องหรือไม่
    const existing = await query<{ report_id: number }>(
      'SELECT report_id FROM reports WHERE report_id = ?',
      [reportId]
    )
    if (existing.length === 0) {
      return Response.json({ success: false, message: 'ไม่พบคำร้องที่ระบุ' }, { status: 404 })
    }

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return Response.json({ success: false, message: 'รูปแบบคำขอไม่ถูกต้อง' }, { status: 400 })
    }
    const parsed = cctvMetadataSchema.safeParse(rawBody)
    if (!parsed.success) {
      return Response.json(
        { success: false, message: 'ข้อมูลไฟล์ไม่ถูกต้อง', issues: parsed.error.issues },
        { status: 400 }
      )
    }
    const body = parsed.data

    if (body.media_type === 'image') {
      const sql = `
        INSERT INTO cctv_images (
          report_id, file_name, file_path, file_size, mime_type,
          camera_id, camera_location, captured_at, description,
          approval_status, access_level, uploaded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      const values = [
        reportId, body.file_name, body.file_path, body.file_size, body.mime_type,
        body.camera_id, body.camera_location, body.captured_at, body.description,
        'รอดำเนินการ', body.access_level ?? 'restricted', body.uploaded_by ?? 'system',
      ]
      const result = await query<DatabaseInsertResult>(sql, values)
      return Response.json({
        success: true,
        message: 'อัปโหลดภาพ CCTV สำเร็จ',
        data: { media_type: 'image', file_id: result[0].insertId },
      })
    }

    if (body.media_type === 'video') {
      const sql = `
        INSERT INTO cctv_videos (
          report_id, file_name, file_path, file_size, mime_type,
          duration_seconds, resolution_width, resolution_height,
          camera_id, camera_location, recording_start, recording_end,
          description, approval_status, access_level, uploaded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      const values = [
        reportId, body.file_name, body.file_path, body.file_size, body.mime_type,
        body.duration_seconds, body.resolution_width, body.resolution_height,
        body.camera_id, body.camera_location, body.recording_start, body.recording_end,
        body.description, 'รอดำเนินการ', body.access_level ?? 'restricted', body.uploaded_by ?? 'system',
      ]
      const result = await query<DatabaseInsertResult>(sql, values)
      return Response.json({
        success: true,
        message: 'อัปโหลดวิดีโอ CCTV สำเร็จ',
        data: { media_type: 'video', file_id: result[0].insertId },
      })
    }

    return Response.json({ success: false, message: 'ชนิดไฟล์ไม่ถูกต้อง (ต้องเป็น image หรือ video)' }, { status: 400 })
  } catch (error: unknown) {
    console.error('Error uploading CCTV file:', error)
    const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์ CCTV'
    return Response.json({ success: false, message: errorMessage }, { status: 500 })
  }
}
