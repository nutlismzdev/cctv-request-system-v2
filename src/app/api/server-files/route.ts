// src/app/api/server-files/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { join, extname, basename } from 'path'
import { requireAdmin } from '@/lib/auth-server'

// ============================================
// Configuration
// ============================================
const SCAN_PATH = 'D:\\Scan'
const PROCESSED_PATH = 'D:\\Scan\\Processed'

// ไฟล์ที่อนุญาตให้แสดง (PDF เท่านั้น)
const ALLOWED_EXTENSIONS = ['.pdf', '.PDF']

// ขนาดไฟล์สูงสุดที่อนุญาตให้ copy (100 MB)
const MAX_FILE_SIZE = 100 * 1024 * 1024

// สร้างโฟลเดอร์ Processed ถ้ายังไม่มี
async function ensureProcessedFolder() {
  try {
    await fs.access(PROCESSED_PATH)
  } catch {
    await fs.mkdir(PROCESSED_PATH, { recursive: true })
  }
}

// ============================================
// Types
// ============================================
export interface ServerFile {
  name: string
  path: string
  size: number
  sizeFormatted: string
  modifiedAt: string
  extension: string
}

interface ListFilesResponse {
  success: boolean
  data?: {
    files: ServerFile[]
    totalCount: number
    totalSize: number
    path: string
  }
  error?: string
}

// ============================================
// Helper Functions
// ============================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function isAllowedFile(filename: string): boolean {
  const ext = extname(filename).toLowerCase()
  return ALLOWED_EXTENSIONS.includes(ext)
}

async function listPdfFiles(folderPath: string): Promise<ServerFile[]> {
  const entries = await fs.readdir(folderPath, { withFileTypes: true })
  const files: ServerFile[] = []

  for (const entry of entries) {
    if (entry.isFile() && isAllowedFile(entry.name)) {
      const fullPath = join(folderPath, entry.name)
      const stat = await fs.stat(fullPath)

      files.push({
        name: entry.name,
        path: fullPath,
        size: stat.size,
        sizeFormatted: formatFileSize(stat.size),
        modifiedAt: formatDate(stat.mtime),
        extension: extname(entry.name).toLowerCase(),
      })
    }
  }

  return files.sort((a, b) => a.name.localeCompare(b.name))
}

// ============================================
// GET: List ไฟล์ PDF ทั้งหมดจาก D:\Scan
// ============================================
export async function GET(request: NextRequest): Promise<NextResponse<ListFilesResponse>> {
  try {
    const guard = await requireAdmin(request)
    if ('response' in guard) return guard.response as NextResponse<ListFilesResponse>

    const files = await listPdfFiles(SCAN_PATH)
    const totalSize = files.reduce((sum, f) => sum + f.size, 0)

    return NextResponse.json({
      success: true,
      data: {
        files,
        totalCount: files.length,
        totalSize,
        path: SCAN_PATH,
      },
    })
  } catch (error) {
    console.error('Error reading server files:', error)
    
    let errorMessage = 'ไม่สามารถอ่านไฟล์จาก Server ได้'
    
    if (error instanceof Error) {
      if (error.message.includes('ENOENT')) {
        errorMessage = `ไม่พบโฟลเดอร์ ${SCAN_PATH} กรุณาตรวจสอบว่า Path ถูกต้อง`
      } else if (error.message.includes('EACCES') || error.message.includes('EPERM')) {
        errorMessage = 'ไม่มีสิทธิ์เข้าถึงโฟลเดอร์ กรุณาตรวจสอบ Permission'
      }
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    )
  }
}

// ============================================
// POST: Copy ไฟล์จาก D:\Scan มา Attach กับคำร้อง
// Body: { fileName: string, reportId: number, category?: string }
// ============================================
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const guard = await requireAdmin(request)
    if ('response' in guard) return guard.response as NextResponse

    const body = await request.json()
    const { fileName, reportId, category = 'idcopy' } = body

    if (!fileName || !reportId) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุ fileName และ reportId' },
        { status: 400 }
      )
    }

    // Security: ใช้ basename เพื่อป้องกัน Path Traversal
    const safeFileName = basename(fileName)
    const sourcePath = join(SCAN_PATH, safeFileName)

    // ตรวจสอบว่าไฟล์อยู่ใน SCAN_PATH จริงๆ
    if (!sourcePath.toLowerCase().startsWith(SCAN_PATH.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: 'Invalid file path' },
        { status: 403 }
      )
    }

    // ตรวจสอบว่าเป็น PDF
    if (!isAllowedFile(safeFileName)) {
      return NextResponse.json(
        { success: false, error: 'อนุญาตเฉพาะไฟล์ PDF เท่านั้น' },
        { status: 400 }
      )
    }

    // อ่านข้อมูลไฟล์
    const stat = await fs.stat(sourcePath)
    
    if (stat.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: `ไฟล์ใหญ่เกินไป (สูงสุด ${formatFileSize(MAX_FILE_SIZE)})` },
        { status: 400 }
      )
    }

    // อ่านไฟล์เป็น Buffer
    const fileBuffer = await fs.readFile(sourcePath)
    
    // สร้าง FormData ส่งต่อไปยัง API attachments
    const formData = new FormData()
    const blob = new Blob([new Uint8Array(fileBuffer)], { type: 'application/pdf' })
    formData.append('files', blob, safeFileName)
    formData.append('category', category)

    // ส่งไปยัง API attachments
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `http://localhost:${process.env.PORT || 3000}`
    const uploadRes = await fetch(
      `${baseUrl}/api/reports/${reportId}/attachments`,
      {
        method: 'POST',
        headers: {
          cookie: request.headers.get('cookie') || '',
        },
        body: formData,
      }
    )

    if (!uploadRes.ok) {
      const errorData = await uploadRes.json().catch(() => ({}))
      throw new Error(errorData.message || 'Upload failed')
    }

    const result = await uploadRes.json()
    
    // ย้ายไฟล์ไป Processed หลังจากแนบสำเร็จ
    await ensureProcessedFolder()
    const processedPath = join(PROCESSED_PATH, safeFileName)
    
    // ตรวจสอบว่าไฟล์ปลายทางมีอยู่แล้วหรือไม่
    try {
      await fs.access(processedPath)
      // ถ้ามีอยู่แล้ว ให้ลบไฟล์เดิมก่อน
      await fs.unlink(processedPath)
    } catch {
      // ไฟล์ไม่มีอยู่ ไม่ต้องทำอะไร
    }
    
    // ย้ายไฟล์
    await fs.rename(sourcePath, processedPath)
    
    return NextResponse.json({
      success: true,
      message: `แนบไฟล์ ${safeFileName} สำเร็จ (ย้ายไป Processed)`,
      data: result.data,
    })

  } catch (error) {
    console.error('Error copying server file:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'ไม่สามารถ copy ไฟล์ได้' 
      },
      { status: 500 }
    )
  }
}
