// src/app/api/reports/[id]/attachments/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'
import { writeFile, mkdir, unlink, stat } from 'fs/promises'
import { accessSync } from 'fs'
import path, { join } from 'path'
import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

// ===================== Types for DB rows ======================
// แถวที่อ่าน "ดิบ" จากฐานข้อมูล (สืบทอด RowDataPacket ได้)
interface RequestDocumentRawRow extends RowDataPacket {
  doc_id: number
  document_type: string
  file_name: string
  file_path: string
  file_size: number
  mime_type: string
  verification_status: string
  uploaded_at: string
  uploaded_by_ip: string
}

interface FilePathOnlyRow extends RowDataPacket {
  file_path: string
}

// ชนิด "ผลลัพธ์ส่งออกให้ frontend" ไม่ต้อง extends RowDataPacket
interface RequestDocumentRow {
  id: number
  document_type: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  verification_status: string
  uploaded_at: string
  uploaded_by_ip: string
  url: string
  category?: string
}

// ==================== File upload utilities ===================
const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads', 'attachments')

async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true })
  } catch {
    // ignore
  }
}

function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 15)
  const dot = originalName.lastIndexOf('.')
  const ext = dot >= 0 ? originalName.slice(dot) : ''
  return `${timestamp}-${random}${ext}`
}

function validateFile(file: File): { valid: boolean; reason?: string } {
  const allowedTypes = [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/heic',
  ]
  const allowedExtensions = /\.(pdf|png|jpg|jpeg|heic)$/i
  const maxSize = 10 * 1024 * 1024 // 10MB

  if (file.size > maxSize) return { valid: false, reason: 'ไฟล์มีขนาดใหญ่เกิน 10MB' }
  if (!allowedTypes.includes(file.type) && !allowedExtensions.test(file.name)) {
    return { valid: false, reason: 'ประเภทไฟล์ไม่ถูกต้อง' }
  }
  return { valid: true }
}

// ===================== GET /attachments =======================
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let reportId = 0

  try {
    const { id } = await params
    reportId = parseInt(id, 10)
    if (isNaN(reportId)) {
      return NextResponse.json({ success: false, message: 'รหัสคำร้องไม่ถูกต้อง' }, { status: 400 })
    }

    const [rowsRaw] = await getPool().execute<RequestDocumentRawRow[]>(
      `SELECT
        doc_id,
        document_type,
        file_name,
        file_path,
        file_size,
        mime_type,
        verification_status,
        uploaded_at,
        uploaded_by_ip
      FROM request_documents
      WHERE report_id = ? AND is_deleted = false
      ORDER BY uploaded_at DESC`,
      [reportId]
    )

    // แปลง raw -> shape ที่ frontend ใช้
    const toPublicRow = (r: RequestDocumentRawRow): RequestDocumentRow => {
      // จัดการข้อมูลเก่า: ถ้า file_path ขึ้นต้นด้วย 'attachments/' ให้ตัดออก
      const cleanFilePath = r.file_path.startsWith('attachments/')
        ? r.file_path.substring('attachments/'.length)
        : r.file_path

      // ตรวจสอบไฟล์จริงว่ามีอยู่หรือไม่ (เฉพาะใน development)
      const fullPath = join(UPLOAD_DIR, cleanFilePath)
      const fileExists = process.env.NODE_ENV === 'development'
        ? (() => {
            try {
              accessSync(fullPath)
              return true
            } catch {
              console.warn(`File not found at expected location: ${fullPath} (original path: ${r.file_path})`)
              return false
            }
          })()
        : true // ใน production ไม่เช็คไฟล์เพื่อประสิทธิภาพ

      console.log(`Attachment ${r.doc_id}: DB path "${r.file_path}" -> URL "/uploads/attachments/${cleanFilePath}" (exists: ${fileExists})`)

      // Debug: แสดง URL เต็ม
      const fullUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:4000'}/uploads/attachments/${cleanFilePath}`
      console.log(`Full URL for ${r.doc_id}: ${fullUrl}`)

      return {
        id: r.doc_id,
        document_type: r.document_type,
        file_name: r.file_name,
        file_path: r.file_path, // เก็บค่าเดิมไว้ใน file_path (เพื่อความเข้ากันได้กับ DELETE)
        file_size: r.file_size,
        file_type: r.mime_type,
        verification_status: r.verification_status,
        uploaded_at: r.uploaded_at,
        uploaded_by_ip: r.uploaded_by_ip,
        url: `/api/files/attachments/${cleanFilePath}`,
      }
    }

    const rows: RequestDocumentRow[] = rowsRaw.map(toPublicRow)

    // Map document_type -> category (compat)
    const categoryMap: Record<string, string> = {
      id_card_copy: 'idcopy',
      supporting_document: 'operation',
      identity_verification_photo: 'selfie',
      passport_copy: 'passport',
      police_report: 'police',
      incident_report: 'incident',
      power_of_attorney: 'power_of_attorney',
      legal_document: 'legal',
    }

    const processedRows = rows.map((row) => ({
      ...row,
      category: categoryMap[row.document_type] || 'operation',
    }))

    return NextResponse.json({ success: true, data: processedRows })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error fetching attachments:', {
      error: errorMessage,
      reportId,
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลเอกสารแนบ' },
      { status: 500 }
    )
  }
}

// ===================== POST /attachments ======================
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let reportId = 0
  let files: File[] = []

  try {
    const { id } = await params
    reportId = parseInt(id, 10)
    if (isNaN(reportId)) {
      return NextResponse.json({ success: false, message: 'รหัสคำร้องไม่ถูกต้อง' }, { status: 400 })
    }

    // verify report exists
    const [existing] = await getPool().execute<RowDataPacket[]>(
      'SELECT report_id FROM reports WHERE report_id = ?',
      [reportId]
    )
    if (existing.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบคำร้องที่ระบุ' }, { status: 404 })
    }

    const formData = await req.formData()

    files = formData.getAll('files') as File[]
    const category = (formData.get('category') as string) || 'idcopy'
    const categories = formData.getAll('categories').map(String)

    // Map category -> document_type
    const documentTypeMap: Record<string, string> = {
      idcopy: 'id_card_copy',
      operation: 'supporting_document',
      selfie: 'identity_verification_photo',
      passport: 'passport_copy',
      police: 'police_report',
      incident: 'incident_report',
      power_of_attorney: 'power_of_attorney',
      legal: 'legal_document',
    }
    if (!files || files.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่มีไฟล์ที่อัปโหลด' }, { status: 400 })
    }

    await ensureUploadDir()

    interface UploadedFile {
      id: number
      file_name: string
      file_path: string
      file_size: number
      file_type: string
      category: string
      url: string
      uploaded_at: string
    }

    const uploadedFiles: UploadedFile[] = []
    const uploadedByIp = req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      'unknown'
    const insertValues: Array<string | number> = []
    const now = new Date().toISOString()

    const preparedFiles = await Promise.all(files.map(async (file, index) => {
      const validation = validateFile(file)
      if (!validation.valid) {
        console.warn(`Skipping file ${file.name}: ${validation.reason}`)
        return null
      }

      const fileCategory = categories[index] || category
      const documentType = documentTypeMap[fileCategory] || 'supporting_document'
      const uniqueFilename = generateUniqueFilename(file.name)
      const filePathOnly = uniqueFilename
      const fullPath = join(UPLOAD_DIR, uniqueFilename)

      const bytes = await file.arrayBuffer()
      await writeFile(fullPath, new Uint8Array(bytes))

      insertValues.push(
        reportId,
        documentType,
        file.name,
        filePathOnly,
        file.size,
        file.type || 'application/octet-stream',
        'pending',
        uploadedByIp,
      )

      return {
        file_name: file.name,
        file_path: filePathOnly,
        file_size: file.size,
        file_type: file.type || 'application/octet-stream',
        category: fileCategory,
        url: `/api/files/attachments/${uniqueFilename}`,
        uploaded_at: now,
      }
    }))

    const validFiles = preparedFiles.filter((file): file is Omit<UploadedFile, 'id'> => file !== null)

    if (validFiles.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่มีไฟล์ที่ผ่านเงื่อนไขการอัปโหลด' }, { status: 400 })
    }

    const placeholders = validFiles.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
    const [result] = await getPool().execute<ResultSetHeader>(
      `INSERT INTO request_documents (
        report_id, document_type, file_name, file_path, file_size,
        mime_type, verification_status, uploaded_by_ip
      ) VALUES ${placeholders}`,
      insertValues,
    )

    for (let index = 0; index < validFiles.length; index++) {
      uploadedFiles.push({
        id: result.insertId + index,
        ...validFiles[index],
      })
    }

    return NextResponse.json({
      success: true,
      message: `อัปโหลดไฟล์ ${uploadedFiles.length} ไฟล์เรียบร้อยแล้ว`,
      data: uploadedFiles,
    })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    console.error('Error uploading attachments:', {
      error: errorMessage,
      stack: errorStack,
      reportId,
      fileCount: files?.length || 0,
    })
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์ กรุณาลองใหม่อีกครั้ง' },
      { status: 500 }
    )
  }
}

// ===================== DELETE /attachments =====================
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let reportId = 0
  let attachmentId = ''

  try {
    const { id } = await params
    reportId = parseInt(id, 10)
    if (isNaN(reportId)) {
      return NextResponse.json({ success: false, message: 'รหัสคำร้องไม่ถูกต้อง' }, { status: 400 })
    }

    const url = new URL(req.url)
    attachmentId = url.searchParams.get('attachmentId') || ''
    if (!attachmentId) {
      return NextResponse.json({ success: false, message: 'ต้องระบุรหัสไฟล์แนบ' }, { status: 400 })
    }

    const docId = parseInt(attachmentId, 10)
    if (isNaN(docId)) {
      return NextResponse.json({ success: false, message: 'รหัสไฟล์แนบไม่ถูกต้อง' }, { status: 400 })
    }

    const [existing] = await getPool().execute<FilePathOnlyRow[]>(
      'SELECT file_path FROM request_documents WHERE doc_id = ? AND report_id = ? AND is_deleted = false',
      [docId, reportId]
    )
    if (existing.length === 0) {
      return NextResponse.json({ success: false, message: 'ไม่พบไฟล์แนบที่ระบุ' }, { status: 404 })
    }

    const fileNameSafe = path.basename(existing[0].file_path)
    const fullPath = join(UPLOAD_DIR, fileNameSafe)

    try {
      await stat(fullPath)
      await unlink(fullPath)
    } catch (error) {
      console.warn('Could not delete file from disk:', error)
    }

    await getPool().execute<ResultSetHeader>(
      `UPDATE request_documents
       SET is_deleted = true, deleted_at = NOW(), deleted_by = ?
       WHERE doc_id = ? AND report_id = ?`,
      ['system', docId, reportId]
    )

    return NextResponse.json({ success: true, message: 'ลบไฟล์แนบเรียบร้อยแล้ว' })
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error deleting attachment:', {
      error: errorMessage,
      reportId,
      attachmentId: attachmentId || 'unknown',
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการลบไฟล์' },
      { status: 500 }
    )
  }
}
