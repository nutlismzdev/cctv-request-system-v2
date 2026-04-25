// src/app/api/reports/[id]/photos/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes for file uploads

import { RowDataPacket } from 'mysql2/promise'
import { writeFile, mkdir, unlink } from 'fs/promises'
import { join } from 'path'
import { NextRequest } from 'next/server'

// ------------ Import shared database connection ------------
import { getPool } from '@/lib/db'

// ------------ Error handling utilities ------------
function isError(error: unknown): error is Error {
  return error instanceof Error
}

function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Unknown error occurred'
}

function getErrorCode(error: unknown): string | undefined {
  if (isError(error) && 'code' in error) {
    return (error as NodeJS.ErrnoException).code
  }
  return undefined
}

// ------------ File upload utilities ------------
const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'cctv')

async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true })
  } catch {
    // Directory already exists
  }
}

function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const extension = originalName.split('.').pop()
  return `${timestamp}-${random}.${extension}`
}

function validateFile(file: File): { valid: boolean; reason?: string; isVideo?: boolean } {
  const allowedImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/heic', 'image/webp']
  const allowedVideoTypes = ['video/mp4', 'video/mov', 'video/avi', 'video/m4v', 'video/webm']
  const allowedExtensions = /\.(png|jpg|jpeg|heic|webp|mp4|mov|avi|m4v|webm)$/i
  const maxSize = 500 * 1024 * 1024 // 500MB
  const minSize = 1024 // 1KB

  // ตรวจสอบขนาดไฟล์
  if (file.size > maxSize) {
    return { valid: false, reason: `ไฟล์มีขนาดใหญ่เกิน ${maxSize / (1024 * 1024)}MB` }
  }

  if (file.size < minSize) {
    return { valid: false, reason: 'ไฟล์มีขนาดเล็กเกินไป' }
  }

  // ตรวจสอบ MIME type และนามสกุลไฟล์
  const isVideo = allowedVideoTypes.includes(file.type) || /\.(mp4|mov|avi|m4v|webm)$/i.test(file.name)
  const isImage = allowedImageTypes.includes(file.type) || /\.(png|jpg|jpeg|heic|webp)$/i.test(file.name)

  // ตรวจสอบความถูกต้องของไฟล์
  if (!isVideo && !isImage) {
    if (!allowedExtensions.test(file.name)) {
      return { valid: false, reason: 'ประเภทไฟล์ไม่รองรับ (รองรับเฉพาะรูปภาพและวิดีโอ)' }
    }
  }

  // ตรวจสอบชื่อไฟล์
  if (file.name.length > 255) {
    return { valid: false, reason: 'ชื่อไฟล์ยาวเกินไป' }
  }

  // ตรวจสอบอักขระพิเศษในชื่อไฟล์
  if (/[<>:"/\\|?*]/.test(file.name)) {
    return { valid: false, reason: 'ชื่อไฟล์มีอักขระที่ไม่ถูกต้อง' }
  }

  return { valid: true, isVideo }
}

// ------------ GET /api/reports/[id]/photos ------------
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let reportId: number = 0

  try {
    const { id } = await params
    reportId = parseInt(id, 10)
    if (isNaN(reportId)) {
      return Response.json(
        { success: false, message: 'รหัสคำร้องไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    // ดึงข้อมูลรูปภาพ
    const [images] = await getPool().execute<RowDataPacket[]>(
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
    )

    // ดึงข้อมูลวิดีโอ
    const [videos] = await getPool().execute<RowDataPacket[]>(
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
    )

    // รวมข้อมูลและจัดเรียงตามเวลาอัปโหลด
    const allMedia = [...images, ...videos].sort((a, b) =>
      new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
    )

    return Response.json({
      success: true,
      data: allMedia
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error fetching photos:', {
      error: errorMessage,
      reportId,
      stack: error instanceof Error ? error.stack : undefined
    })
    return Response.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลไฟล์ CCTV' },
      { status: 500 }
    )
  }
}

// ------------ POST /api/reports/[id]/photos ------------
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  console.log('Photos API: Received upload request')

  let reportId: number = 0
  let files: File[] = []

  try {
    // Add timeout check to prevent long-running requests
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
      console.warn('Request timeout after 4m 40s')
    }, 280000) // 4m 40s timeout

    const { id } = await params
    reportId = parseInt(id, 10)
    if (isNaN(reportId)) {
      clearTimeout(timeoutId)
      controller.abort()
      return Response.json(
        { success: false, message: 'รหัสคำร้องไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    // ตรวจสอบว่ามีคำร้องนี้อยู่จริง
    const [existing] = await getPool().execute<RowDataPacket[]>(
      'SELECT report_id FROM reports WHERE report_id = ?',
      [reportId]
    )
    if (existing.length === 0) {
      clearTimeout(timeoutId)
      controller.abort()
      return Response.json(
        { success: false, message: 'ไม่พบคำร้องที่ระบุ' },
        { status: 404 }
      )
    }

    clearTimeout(timeoutId) // Clear timeout if everything is successful

    // Process formData with proper timeout handling for large files
    let formData: FormData
    let parseTimeoutId: NodeJS.Timeout | undefined
    let totalSize = 0 // Initialize total size

    try {
      // Parse formData with proper timeout handling
      const parsePromise = req.formData()

      // Calculate appropriate timeout based on estimated file size (if available from headers)
      // For large files, allow more time (up to 5 minutes)
      const contentLength = req.headers.get('content-length')
      const estimatedSize = contentLength ? parseInt(contentLength, 10) : 10 * 1024 * 1024 // Default 10MB
      const baseTimeout = 120000 // 2 minutes base
      const sizeMultiplier = Math.ceil(estimatedSize / (10 * 1024 * 1024)) // +1 minute per 10MB
      const timeoutMs = Math.min(baseTimeout + (sizeMultiplier * 60000), 300000) // Max 5 minutes

      console.log(`Processing form data with ${timeoutMs}ms timeout for estimated ${(estimatedSize / (1024 * 1024)).toFixed(1)}MB`)

      // Create a promise that rejects on timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        parseTimeoutId = setTimeout(() => {
          reject(new Error(`FormData parsing timeout after ${timeoutMs}ms for estimated ${(estimatedSize / (1024 * 1024)).toFixed(1)}MB file`))
        }, timeoutMs)
      })

      // Race between formData parsing and timeout
      formData = await Promise.race([
        parsePromise,
        timeoutPromise
      ])

      clearTimeout(parseTimeoutId)
      files = formData.getAll('files') as File[]
      totalSize = files.reduce((sum, f) => sum + f.size, 0)

      console.log(`FormData parsed successfully: ${files.length} files, total size ${(totalSize / (1024 * 1024)).toFixed(1)}MB`)

    } catch (error: unknown) {
      if (parseTimeoutId) clearTimeout(parseTimeoutId)

      const errorMessage = getErrorMessage(error)

      // Handle timeout errors specifically
      if (errorMessage.includes('timeout')) {
        console.error('FormData parsing timeout:', errorMessage)
        const estimatedSize = totalSize || (req.headers.get('content-length') ? parseInt(req.headers.get('content-length')!, 10) : 10 * 1024 * 1024)
        return Response.json(
          {
            success: false,
            message: `ไฟล์มีขนาดใหญ่เกินไป ${((estimatedSize || 0) / (1024 * 1024)).toFixed(1)}MB ใช้เวลาประมวลผลนานเกินไป กรุณาลองแบ่งไฟล์เป็นชุดเล็กๆ หรือใช้อินเทอร์เน็ตที่เร็วขึ้น`
          },
          { status: 413 } // Payload Too Large
        )
      }

      console.error('FormData parsing error:', error)
      return Response.json(
        { success: false, message: `เกิดข้อผิดพลาดในการประมวลผลไฟล์: ${errorMessage}` },
        { status: 400 }
      )
    }

    if (!files || files.length === 0) {
      if (parseTimeoutId) clearTimeout(parseTimeoutId)
      return Response.json(
        { success: false, message: 'ไม่มีไฟล์ที่อัปโหลด' },
        { status: 400 }
      )
    }

    // Clear any remaining timeouts
    if (parseTimeoutId) clearTimeout(parseTimeoutId)

    await ensureUploadDir()
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
    const uploadedFiles: UploadedFileInfo[] = []

    for (const file of files) {
      try {
        // Validate file
        const validation = validateFile(file)
        if (!validation.valid) {
          console.warn(`Skipping file ${file.name}: ${validation.reason}`)
          continue // Skip invalid files
        }

        const uniqueFilename = generateUniqueFilename(file.name)
        const filePath = uniqueFilename // เก็บเฉพาะชื่อไฟล์ ไม่ต้องมี subdirectory
        const fullPath = join(UPLOAD_DIR, uniqueFilename)

        // เขียนไฟล์ลง disk with proper timeout handling and memory management
        let bytes: ArrayBuffer
        let fileTimeoutId: NodeJS.Timeout | undefined

        try {
          // Calculate timeout based on file size
          const timeoutMs = Math.min(Math.max(file.size / (1024 * 1024) * 5000, 15000), 120000) // 5s per MB, min 15s, max 2min

          // Use streaming for large files to prevent memory issues
          if (file.size > 50 * 1024 * 1024) { // > 50MB
            console.log(`Processing large file: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)}MB)`)
          }

          // Create timeout promise
          const timeoutPromise = new Promise<never>((_, reject) => {
            fileTimeoutId = setTimeout(() => {
              reject(new Error(`File reading timeout after ${timeoutMs}ms for ${(file.size / (1024 * 1024)).toFixed(1)}MB file`))
            }, timeoutMs)
          })

          // Race between file reading and timeout
          bytes = await Promise.race([
            file.arrayBuffer(),
            timeoutPromise
          ])

          clearTimeout(fileTimeoutId)

          // Validate file content
          if (bytes.byteLength === 0) {
            throw new Error('ไฟล์ว่างเปล่า')
          }

          if (bytes.byteLength !== file.size) {
            throw new Error(`ขนาดไฟล์ไม่ตรงกัน: expected ${file.size}, got ${bytes.byteLength}`)
          }
        } catch (error: unknown) {
          if (fileTimeoutId) clearTimeout(fileTimeoutId)
          console.error(`File processing error for ${file.name}:`, error)
          continue // Skip this file
        }

        // เขียนไฟล์ลง disk with comprehensive error handling
        try {
          // เขียนไฟล์ลง disk
          await writeFile(fullPath, new Uint8Array(bytes))

          // ตรวจสอบไฟล์หลังเขียนด้วยการหน่วงเวลาเล็กน้อย
          await new Promise(resolve => setTimeout(resolve, 100)) // Wait for file system sync

          const fs = await import('fs')
          if (!fs.existsSync(fullPath)) {
            throw new Error('ไฟล์ไม่ถูกสร้างหลังเขียน')
          }

          const stats = fs.statSync(fullPath)
          if (stats.size === 0) {
            throw new Error('ไฟล์ถูกเขียนแต่มีขนาดเป็นศูนย์')
          }

          if (stats.size !== bytes.byteLength) {
            throw new Error(`ขนาดไฟล์ไม่ตรงกัน: expected ${bytes.byteLength}, got ${stats.size}`)
          }

          console.log(`File successfully written: ${fullPath} (${(stats.size / (1024 * 1024)).toFixed(2)}MB)`)

  } catch (error: unknown) {
          console.error(`File write error for ${file.name}:`, error)

          // ลบไฟล์ที่ไม่สมบูรณ์
          try {
            const fs = await import('fs')
            if (fs.existsSync(fullPath)) {
              await unlink(fullPath)
              console.log(`Cleaned up incomplete file: ${fullPath}`)
            }
          } catch (cleanupError) {
            console.error(`Failed to cleanup incomplete file: ${cleanupError}`)
          }

          // จัดการ error types ต่างๆ
          const errorCode = getErrorCode(error)
          const errorMessage = getErrorMessage(error)

          if (errorCode === 'ENOSPC') {
            throw new Error('พื้นที่เก็บข้อมูลไม่เพียงพอ')
          } else if (errorCode === 'EACCES') {
            throw new Error('ไม่มีสิทธิ์เข้าถึงโฟลเดอร์')
          } else if (errorCode === 'EMFILE') {
            throw new Error('เปิดไฟล์มากเกินไป กรุณารอสักครู่แล้วลองใหม่')
          }

          throw new Error(`ไม่สามารถบันทึกไฟล์ได้: ${errorMessage}`)
        }

        // บันทึกข้อมูลลงฐานข้อมูล
        let insertResult: { insertId: number }
        // tableName not used; removed

        try {
          if (validation.isVideo) {
            // บันทึกเป็นวิดีโอ
            const [result] = await getPool().execute(
              `INSERT INTO cctv_videos (
                report_id, file_name, file_path, file_size, mime_type,
                camera_id, camera_location, description, uploaded_by, uploaded_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
              [
                reportId,
                file.name,
                filePath,
                file.size,
                file.type || 'video/mp4',
                null, // camera_id
                null, // camera_location
                null, // description
                'admin' // uploaded_by
              ]
            )

            insertResult = result as { insertId: number }

            uploadedFiles.push({
              id: `video_${insertResult.insertId}`,
              file_name: file.name,
              file_path: filePath,
              file_size: file.size,
              file_type: file.type || 'video/mp4',
              media_type: 'video',
              url: `/api/files/cctv/${uniqueFilename}`,
              published: 'false',
              uploaded_at: new Date().toISOString()
            })
          } else {
            // บันทึกเป็นรูปภาพ
            const [result] = await getPool().execute(
              `INSERT INTO cctv_images (
                report_id, file_name, file_path, file_size, mime_type,
                camera_id, camera_location, description, uploaded_by, uploaded_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
              [
                reportId,
                file.name,
                filePath,
                file.size,
                file.type || 'image/jpeg',
                null, // camera_id
                null, // camera_location
                null, // description
                'admin' // uploaded_by
              ]
            )

            insertResult = result as { insertId: number }

            uploadedFiles.push({
              id: `image_${insertResult.insertId}`,
              file_name: file.name,
              file_path: filePath,
              file_size: file.size,
              file_type: file.type || 'image/jpeg',
              media_type: 'image',
              url: `/api/files/cctv/${uniqueFilename}`,
              published: 'false',
              uploaded_at: new Date().toISOString()
            })
          }
        } catch (dbError: unknown) {
          console.error(`Database insert error for ${file.name}:`, dbError)
          // ลบไฟล์ที่อัปโหลดแล้วเนื่องจาก database error
          try {
            await unlink(fullPath)
          } catch {}
          const dbErrorMessage = getErrorMessage(dbError)
          throw new Error(`ไม่สามารถบันทึกข้อมูลไฟล์ได้: ${dbErrorMessage}`)
        }

      } catch (fileError: unknown) {
        console.error(`Error processing file ${file.name}:`, fileError)

        // Force garbage collection if available (for large files)
        if (global.gc) {
          global.gc()
        }

        // Continue with next file instead of failing entire upload
        continue
      }
    }

    return Response.json({
      success: true,
      message: `อัปโหลดไฟล์ ${uploadedFiles.length} ไฟล์เรียบร้อยแล้ว`,
      data: uploadedFiles
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error uploading CCTV files:', {
      error: errorMessage,
      reportId,
      fileCount: files?.length || 0,
      stack: errorStack
    })
    return Response.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์ CCTV' },
      { status: 500 }
    )
  }
}

// ------------ PATCH /api/reports/[id]/photos/[mediaId] ------------
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let reportId: number = 0

  try {
    const { id } = await params
    reportId = parseInt(id, 10)
    if (isNaN(reportId)) {
      return Response.json(
        { success: false, message: 'รหัสคำร้องไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const url = new URL(req.url)
    const mediaId = url.searchParams.get('mediaId')

    if (!mediaId) {
      return Response.json(
        { success: false, message: 'ต้องระบุรหัสไฟล์' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const { published } = body
    const approvalStatus = published ? 'พร้อมใช้งาน' : 'ไม่พร้อมใช้งาน'

    // แยกประเภทไฟล์และ ID จาก mediaId
    const isVideo = mediaId.startsWith('video_')
    const fileId = parseInt(mediaId.replace(isVideo ? 'video_' : 'image_', ''), 10)

    if (isNaN(fileId)) {
      return Response.json(
        { success: false, message: 'รหัสไฟล์ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    // อัปเดตสถานะในฐานข้อมูล
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
      data: {
        mediaId,
        published,
        approval_status: approvalStatus
      }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error updating CCTV media status:', {
      error: errorMessage,
      reportId,
      stack: error instanceof Error ? error.stack : undefined
    })
    return Response.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการอัปเดตสถานะไฟล์' },
      { status: 500 }
    )
  }
}

// ------------ DELETE /api/reports/[id]/photos/[mediaId] ------------
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let reportId: number = 0

  try {
    const { id } = await params
    reportId = parseInt(id, 10)
    if (isNaN(reportId)) {
      return Response.json(
        { success: false, message: 'รหัสคำร้องไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    const url = new URL(req.url)
    const mediaId = url.searchParams.get('mediaId')

    if (!mediaId) {
      return Response.json(
        { success: false, message: 'ต้องระบุรหัสไฟล์' },
        { status: 400 }
      )
    }

    // แยกประเภทไฟล์และ ID จาก mediaId
    const isVideo = mediaId.startsWith('video_')
    const fileId = parseInt(mediaId.replace(isVideo ? 'video_' : 'image_', ''), 10)

    if (isNaN(fileId)) {
      return Response.json(
        { success: false, message: 'รหัสไฟล์ไม่ถูกต้อง' },
        { status: 400 }
      )
    }

    // ตรวจสอบว่ามีไฟล์นี้อยู่จริง
    const tableName = isVideo ? 'cctv_videos' : 'cctv_images'
    const idField = isVideo ? 'video_id' : 'image_id'

    const [existing] = await getPool().execute<RowDataPacket[]>(
      `SELECT file_path FROM ${tableName} WHERE ${idField} = ? AND report_id = ? AND is_deleted = false`,
      [fileId, reportId]
    )

    if (existing.length === 0) {
      return Response.json(
        { success: false, message: 'ไม่พบไฟล์ที่ระบุ' },
        { status: 404 }
      )
    }

    const filePath = existing[0].file_path

    // ใช้ transaction เพื่อให้แน่ใจว่าทั้งลบไฟล์และฐานข้อมูลสำเร็จพร้อมกัน
    const pool = getPool()
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      // ลบข้อมูลจากฐานข้อมูลก่อน (ถ้าลบฐานข้อมูลสำเร็จแล้วค่อยลบไฟล์)
      await connection.query(
        `DELETE FROM ${tableName}
         WHERE ${idField} = ? AND report_id = ?`,
        [fileId, reportId]
      )

      // ลบไฟล์จาก disk หลังจากลบฐานข้อมูลสำเร็จ
      const filename = filePath
      const actualPath = join(UPLOAD_DIR, filename)

      const fs = await import('fs')
      if (fs.existsSync(actualPath)) {
        await unlink(actualPath)
        console.log(`File deleted from disk: ${actualPath}`)
      } else {
        console.warn(`File not found at expected location: ${actualPath}`)
      }

      // ถ้าทุกอย่างสำเร็จ commit transaction
      await connection.commit()
      console.log(`Successfully deleted ${tableName} record and file for ID: ${fileId}`)

    } catch (error) {
      // ถ้ามี error ให้ rollback transaction และลบไฟล์ที่อาจจะอัปโหลดไว้
      await connection.rollback()
      console.error('Error during deletion, rolled back transaction:', error)

      // พยายามลบไฟล์ที่อาจจะเหลืออยู่
      try {
        const filename = filePath
        const actualPath = join(UPLOAD_DIR, filename)
        const fs = await import('fs')
        if (fs.existsSync(actualPath)) {
          await unlink(actualPath)
          console.log(`Cleaned up file after rollback: ${actualPath}`)
        }
      } catch (cleanupError) {
        console.warn('Could not cleanup file after rollback:', cleanupError)
      }

      throw error // Re-throw to be handled by outer catch block
    } finally {
      connection.release()
    }

    return Response.json({
      success: true,
      message: 'ลบไฟล์ CCTV เรียบร้อยแล้ว'
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error deleting CCTV file:', {
      error: errorMessage,
      reportId,
      stack: error instanceof Error ? error.stack : undefined
    })
    return Response.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการลบไฟล์ CCTV' },
      { status: 500 }
    )
  }
}
