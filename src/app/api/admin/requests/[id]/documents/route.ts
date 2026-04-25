import { NextRequest } from 'next/server'
import { query } from '@/lib/db'

/** Rows returned from request_documents */
interface DocumentRecord {
  doc_id: number
  document_type: string
  file_name: string
  file_path: string
  file_size: number
  mime_type: string
  verification_status: 'pending' | 'verified' | 'rejected'
  verification_notes: string | null
  uploaded_at: string // หรือ Date ถ้าคุณตั้ง mysql2 ให้คืน Date
  uploaded_by_ip: string
  is_deleted: 0 | 1 | boolean
  deleted_at: string | null
  deleted_by: number | null
}

interface DocumentStats {
  total_documents: number
  verified_documents: number
  pending_documents: number
  rejected_documents: number
  total_size: number | null
}

interface InsertResult {
  insertId: number
  affectedRows: number
}

type RouteParams = { id: string }

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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
        { status: 400 },
      )
    }

    // ตรวจว่ามีคำร้องนี้จริงไหม
    const existing = await query<{ report_id: number }>(
      'SELECT report_id FROM reports WHERE report_id = ?',
      [reportId],
    )
    if (existing.length === 0) {
      return Response.json(
        { success: false, message: 'ไม่พบคำร้องที่ระบุ' },
        { status: 404 },
      )
    }

    // ดึงเอกสารของคำร้อง
    const sql = `
      SELECT
        doc_id,
        document_type,
        file_name,
        file_path,
        file_size,
        mime_type,
        verification_status,
        verification_notes,
        uploaded_at,
        uploaded_by_ip,
        is_deleted,
        deleted_at,
        deleted_by
      FROM request_documents
      WHERE report_id = ? AND is_deleted = false
      ORDER BY uploaded_at DESC
    `
    const documents = await query<DocumentRecord>(sql, [reportId])

    // สถิติ
    const statsSql = `
      SELECT
        COUNT(*)                                                   AS total_documents,
        COUNT(CASE WHEN verification_status = 'verified' THEN 1 END) AS verified_documents,
        COUNT(CASE WHEN verification_status = 'pending'  THEN 1 END) AS pending_documents,
        COUNT(CASE WHEN verification_status = 'rejected' THEN 1 END) AS rejected_documents,
        SUM(file_size)                                            AS total_size
      FROM request_documents
      WHERE report_id = ? AND is_deleted = false
    `
    const stats = await query<DocumentStats>(statsSql, [reportId])
    const statistics: DocumentStats = stats[0] ?? {
      total_documents: 0,
      verified_documents: 0,
      pending_documents: 0,
      rejected_documents: 0,
      total_size: 0,
    }

    return Response.json({
      success: true,
      data: documents,
      statistics,
    })
  } catch (error) {
    console.error('Error fetching documents:', error)
    const message =
      error instanceof Error
        ? error.message
        : 'เกิดข้อผิดพลาดในการดึงข้อมูลเอกสาร'
    return Response.json({ success: false, message }, { status: 500 })
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const { id } = await params
    const reportId = Number.parseInt(id, 10)

    if (Number.isNaN(reportId)) {
      return Response.json(
        { success: false, message: 'รหัสคำร้องไม่ถูกต้อง' },
        { status: 400 },
      )
    }

    // ตรวจว่ามีคำร้องนี้จริงไหม
    const existing = await query<{ report_id: number }>(
      'SELECT report_id FROM reports WHERE report_id = ?',
      [reportId],
    )
    if (existing.length === 0) {
      return Response.json(
        { success: false, message: 'ไม่พบคำร้องที่ระบุ' },
        { status: 404 },
      )
    }

    const body: {
      document_type: string
      file_name: string
      file_path: string
      file_size: number
      mime_type: string
      uploaded_by?: number | string
    } = await req.json()

    const sql = `
      INSERT INTO request_documents (
        report_id, document_type, file_name, file_path, file_size,
        mime_type, verification_status, uploaded_by_ip, uploaded_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    const values = [
      reportId,
      body.document_type,
      body.file_name,
      body.file_path,
      body.file_size,
      body.mime_type,
      'pending',
      req.headers.get('x-forwarded-for') ||
        req.headers.get('x-real-ip') ||
        'unknown',
      body.uploaded_by ?? 'system',
    ]

    const result = await query<InsertResult>(sql, values)

    return Response.json({
      success: true,
      message: 'อัปโหลดเอกสารเรียบร้อยแล้ว',
      data: {
        doc_id: result[0]?.insertId,
        document_type: body.document_type,
        verification_status: 'pending' as const,
      },
    })
  } catch (error) {
    console.error('Error uploading document:', error)
    const message =
      error instanceof Error
        ? error.message
        : 'เกิดข้อผิดพลาดในการอัปโหลดเอกสาร'
    return Response.json({ success: false, message }, { status: 500 })
  }
}
