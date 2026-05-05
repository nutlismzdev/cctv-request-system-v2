// src/app/api/reports/[id]/photos/route.ts
//
// CCTV media upload (images + videos) for a report.
// POST uses streaming multipart parsing (busboy) so a 100-500MB video upload
// never buffers in RAM. See src/lib/upload-stream.ts for why.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for large video uploads

import { RowDataPacket } from 'mysql2/promise'
import { unlink, mkdir } from 'fs/promises'
import { join } from 'path'
import { NextRequest } from 'next/server'

import { getPool } from '@/lib/db'
import { parseMultipartStream, UploadStreamError } from '@/lib/upload-stream'
import { requireAdmin } from '@/lib/auth-server'

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'cctv')

// Hoist directory creation to module init so the mkdir syscall doesn't run
// on every upload request. Idempotent on subsequent worker reuse.
const uploadDirReady = mkdir(UPLOAD_DIR, { recursive: true }).catch(() => {})

function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const dot = originalName.lastIndexOf('.')
  const extension = dot >= 0 ? originalName.slice(dot + 1) : 'bin'
  return `${timestamp}-${random}.${extension}`
}

// ------------ GET /api/reports/[id]/photos ------------
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let reportId = 0

  try {
    const guard = await requireAdmin(req)
    if ('response' in guard) return guard.response

    const { id } = await params
    reportId = parseInt(id, 10)
    if (isNaN(reportId)) {
      return Response.json({ success: false, message: 'รหัสคำร้องไม่ถูกต้อง' }, { status: 400 })
    }

    // Independent queries — fan out in parallel (async-parallel).
    const pool = getPool()
    const [[images], [videos]] = await Promise.all([
      pool.execute<RowDataPacket[]>(
        `SELECT
          CONCAT('image_', image_id) as id,
          file_name,
          file_path,
          file_size,
          mime_type,
          camera_id,
          camera_location,
          captured_at,
          description,
          approval_status,
          uploaded_at,
          CONCAT('/api/files/cctv/',
            CASE
              WHEN file_path LIKE 'cctv/%' THEN REPLACE(file_path, 'cctv/', '')
              ELSE file_path
            END
          ) as url,
          'image' as media_type,
          CASE WHEN approval_status = 'พร้อมใช้งาน' THEN 'true' ELSE 'false' END as published
        FROM cctv_images
        WHERE report_id = ? AND is_deleted = false
        ORDER BY uploaded_at DESC`,
        [reportId]
      ),
      pool.execute<RowDataPacket[]>(
        `SELECT
          CONCAT('video_', video_id) as id,
          file_name,
          file_path,
          file_size,
          mime_type,
          duration_seconds,
          camera_id,
          camera_location,
          recording_start,
          description,
          approval_status,
          uploaded_at,
          CONCAT('/api/files/cctv/',
            CASE
              WHEN file_path LIKE 'cctv/%' THEN REPLACE(file_path, 'cctv/', '')
              ELSE file_path
            END
          ) as url,
          'video' as media_type,
          CASE WHEN approval_status = 'พร้อมใช้งาน' THEN 'true' ELSE 'false' END as published
        FROM cctv_videos
        WHERE report_id = ? AND is_deleted = false
        ORDER BY uploaded_at DESC`,
        [reportId]
      ),
    ])

    const allMedia = [...images, ...videos].sort(
      (a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
    )

    return Response.json({ success: true, data: allMedia })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error fetching photos:', {
      error: errorMessage,
      reportId,
      stack: error instanceof Error ? error.stack : undefined,
    })
    return Response.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลไฟล์ CCTV' },
      { status: 500 }
    )
  }
}

// ------------ POST /api/reports/[id]/photos ------------
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let reportId = 0
  let uploadedPaths: string[] = []

  try {
    const guard = await requireAdmin(req)
    if ('response' in guard) return guard.response

    const { id } = await params
    reportId = parseInt(id, 10)
    if (isNaN(reportId)) {
      return Response.json({ success: false, message: 'รหัสคำร้องไม่ถูกต้อง' }, { status: 400 })
    }

    // Make sure the upload dir exists (resolves once after first worker request).
    await uploadDirReady

    const [existing] = await getPool().execute<RowDataPacket[]>(
      'SELECT report_id FROM reports WHERE report_id = ?',
      [reportId]
    )
    if (existing.length === 0) {
      return Response.json({ success: false, message: 'ไม่พบคำร้องที่ระบุ' }, { status: 404 })
    }

    // Streaming parse — files land on disk while bytes still flow in.
    const { files, rejected } = await parseMultipartStream(req, {
      uploadDir: UPLOAD_DIR,
      allowed: ['image', 'video'],
      generateFilename: generateUniqueFilename,
    })
    uploadedPaths = files.map(f => f.storedPath)

    if (files.length === 0) {
      const reason = rejected[0]?.reason || 'ไม่มีไฟล์ที่ผ่านเงื่อนไขการอัปโหลด'
      return Response.json({ success: false, message: reason }, { status: 400 })
    }

    type UploadedFileInfo = {
      id: string
      file_name: string
      file_path: string
      file_size: number
      file_type: string
      media_type: 'image' | 'video'
      url: string
      published: 'true' | 'false'
      uploaded_at: string
    }

    const insertedAt = new Date().toISOString()
    // Run DB inserts in parallel — pool has multiple connections and inserts are independent.
    // `kind` is narrowed via the `allowed: ['image', 'video']` we passed to the parser,
    // but TS can't see through that, so we narrow explicitly here.
    const insertResults = await Promise.all(
      files.map(async (file): Promise<UploadedFileInfo | null> => {
        const mediaKind = file.kind as 'image' | 'video'
        const sql = mediaKind === 'video'
          ? `INSERT INTO cctv_videos (
              report_id, file_name, file_path, file_size, mime_type,
              camera_id, camera_location, description, uploaded_by, uploaded_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`
          : `INSERT INTO cctv_images (
              report_id, file_name, file_path, file_size, mime_type,
              camera_id, camera_location, description, uploaded_by, uploaded_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`

        try {
          const [result] = await getPool().execute(sql, [
            reportId,
            file.originalName,
            file.storedName,
            file.size,
            file.detectedMime,
            null,
            null,
            null,
            'admin',
          ])
          const { insertId } = result as { insertId: number }

          return {
            id: `${mediaKind}_${insertId}`,
            file_name: file.originalName,
            file_path: file.storedName,
            file_size: file.size,
            file_type: file.detectedMime,
            media_type: mediaKind,
            url: `/api/files/cctv/${file.storedName}`,
            published: 'false',
            uploaded_at: insertedAt,
          }
        } catch (dbError: unknown) {
          // DB insert failed → orphaned file on disk. Best-effort cleanup.
          await unlink(file.storedPath).catch(() => {})
          console.error(`DB insert error for ${file.originalName}:`, dbError)
          return null
        }
      })
    )
    const uploadedFiles = insertResults.filter((x): x is UploadedFileInfo => x !== null)

    const skippedNote = rejected.length > 0
      ? ` (ข้าม ${rejected.length} ไฟล์: ${rejected.map(r => r.reason).join(', ')})`
      : ''

    return Response.json({
      success: true,
      message: `อัปโหลดไฟล์ ${uploadedFiles.length} ไฟล์เรียบร้อยแล้ว${skippedNote}`,
      data: uploadedFiles,
      rejected,
    })
  } catch (error: unknown) {
    // On hard error, parseMultipartStream cleans up its own writes; this catch
    // handles whatever it didn't see (DB errors after parse, etc).
    await Promise.allSettled(uploadedPaths.map(p => unlink(p).catch(() => {})))

    if (error instanceof UploadStreamError) {
      return Response.json({ success: false, message: error.message }, { status: error.status })
    }

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error uploading CCTV files:', {
      error: errorMessage,
      reportId,
      stack: error instanceof Error ? error.stack : undefined,
    })
    return Response.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์ CCTV' },
      { status: 500 }
    )
  }
}

// ------------ PATCH /api/reports/[id]/photos?mediaId=... ------------
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let reportId = 0

  try {
    const guard = await requireAdmin(req)
    if ('response' in guard) return guard.response

    const { id } = await params
    reportId = parseInt(id, 10)
    if (isNaN(reportId)) {
      return Response.json({ success: false, message: 'รหัสคำร้องไม่ถูกต้อง' }, { status: 400 })
    }

    const url = new URL(req.url)
    const mediaId = url.searchParams.get('mediaId')

    if (!mediaId) {
      return Response.json({ success: false, message: 'ต้องระบุรหัสไฟล์' }, { status: 400 })
    }

    const body = await req.json()
    const { published } = body
    const approvalStatus = published ? 'พร้อมใช้งาน' : 'ไม่พร้อมใช้งาน'

    const isVideo = mediaId.startsWith('video_')
    const fileId = parseInt(mediaId.replace(isVideo ? 'video_' : 'image_', ''), 10)

    if (isNaN(fileId)) {
      return Response.json({ success: false, message: 'รหัสไฟล์ไม่ถูกต้อง' }, { status: 400 })
    }

    const tableName = isVideo ? 'cctv_videos' : 'cctv_images'
    const idField = isVideo ? 'video_id' : 'image_id'

    await getPool().execute(
      `UPDATE ${tableName}
       SET approval_status = ?, approved_at = NOW(), approved_by = ?
       WHERE ${idField} = ? AND report_id = ?`,
      [approvalStatus, 'admin', fileId, reportId]
    )

    return Response.json({
      success: true,
      message: `อัปเดตสถานะไฟล์เรียบร้อยแล้ว`,
      data: { mediaId, published, approval_status: approvalStatus },
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error updating CCTV media status:', {
      error: errorMessage,
      reportId,
      stack: error instanceof Error ? error.stack : undefined,
    })
    return Response.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะไฟล์' },
      { status: 500 }
    )
  }
}

// ------------ DELETE /api/reports/[id]/photos?mediaId=... ------------
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let reportId = 0

  try {
    const guard = await requireAdmin(req)
    if ('response' in guard) return guard.response

    const { id } = await params
    reportId = parseInt(id, 10)
    if (isNaN(reportId)) {
      return Response.json({ success: false, message: 'รหัสคำร้องไม่ถูกต้อง' }, { status: 400 })
    }

    const url = new URL(req.url)
    const mediaId = url.searchParams.get('mediaId')

    if (!mediaId) {
      return Response.json({ success: false, message: 'ต้องระบุรหัสไฟล์' }, { status: 400 })
    }

    const isVideo = mediaId.startsWith('video_')
    const fileId = parseInt(mediaId.replace(isVideo ? 'video_' : 'image_', ''), 10)

    if (isNaN(fileId)) {
      return Response.json({ success: false, message: 'รหัสไฟล์ไม่ถูกต้อง' }, { status: 400 })
    }

    const tableName = isVideo ? 'cctv_videos' : 'cctv_images'
    const idField = isVideo ? 'video_id' : 'image_id'

    const [existing] = await getPool().execute<RowDataPacket[]>(
      `SELECT file_path FROM ${tableName} WHERE ${idField} = ? AND report_id = ? AND is_deleted = false`,
      [fileId, reportId]
    )

    if (existing.length === 0) {
      return Response.json({ success: false, message: 'ไม่พบไฟล์ที่ระบุ' }, { status: 404 })
    }

    const filePath = existing[0].file_path
    const pool = getPool()
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      await connection.query(
        `DELETE FROM ${tableName} WHERE ${idField} = ? AND report_id = ?`,
        [fileId, reportId]
      )

      const actualPath = join(UPLOAD_DIR, filePath)
      await unlink(actualPath).catch((err) => {
        console.warn(`File not found or unlinkable: ${actualPath}`, err)
      })

      await connection.commit()
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }

    return Response.json({ success: true, message: 'ลบไฟล์ CCTV เรียบร้อยแล้ว' })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error deleting CCTV file:', {
      error: errorMessage,
      reportId,
      stack: error instanceof Error ? error.stack : undefined,
    })
    return Response.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการลบไฟล์ CCTV' },
      { status: 500 }
    )
  }
}
