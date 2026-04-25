// app/api/admin/camera-issues/route.ts
import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type IssueType = 'no_signal' | 'offline' | 'broken' | 'missing' | 'other'

type Payload = {
  cctv_id?: number | null
  related_report_id?: number
  issue_type: IssueType
  description?: string
  occurred_at?: string // 'YYYY-MM-DDTHH:mm'
}

// แถวผลลัพธ์จาก SELECT
interface CameraIssueRow extends RowDataPacket {
  issue_id: number
  cctv_id: number | null
  issue_type: IssueType
  description: string | null
  occurred_at: string | null       // 'YYYY-MM-DD HH:mm:ss'
  status: 'open' | 'closed' | 'in_progress' | string
  related_report_id: number | null
  created_at: string               // 'YYYY-MM-DD HH:mm:ss'
  area: string | null
  camera_name: string | null
  ip_address: string | null
  report_full_name: string | null
}

// helper: build "YYYY-MM-DD HH:mm:ss" or null
function toSqlDatetimeLocal(input?: string): string | null {
  if (!input) return null
  const s = input.includes('T') ? input : input.replace(' ', 'T')
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`
}

export async function GET(req: Request) {
  const url = new URL(req.url)

  // --- parse cctv_id อย่างปลอดภัย ---
  const cctvIdRaw = url.searchParams.get('cctv_id')
  const cctvIdParsed = cctvIdRaw !== null ? Number.parseInt(cctvIdRaw, 10) : null
  const hasValidCctvId = cctvIdParsed !== null && Number.isFinite(cctvIdParsed)

  // --- parse limit อย่างปลอดภัยและล็อกกรอบ 1..100 ---
  const limitRaw = Number.parseInt(url.searchParams.get('limit') || '20', 10)
  const limitSafe = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20

  try {
    const pool = getPool()

    // ใส่ LIMIT แบบ inline (ไม่ใช้ placeholder) เพื่อกัน ER_WRONG_ARGUMENTS
    const baseSelect = `
      SELECT
        i.issue_id AS issue_id,
        i.cctv_id,
        i.issue_type,
        i.description,
        DATE_FORMAT(i.occurred_at, '%Y-%m-%d %H:%i:%s') AS occurred_at,
        i.status,
        i.related_report_id,
        DATE_FORMAT(i.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        c.area,
        c.camera_name,
        c.ip_address,
        r.full_name AS report_full_name
      FROM camera_issues i
      LEFT JOIN cctv c ON c.id = i.cctv_id
      LEFT JOIN reports r ON r.report_id = i.related_report_id
    `

    let sql: string
    let params: ReadonlyArray<number>

    if (hasValidCctvId) {
      sql = `
        ${baseSelect}
        WHERE i.cctv_id = ?
        ORDER BY i.created_at DESC
        LIMIT ${limitSafe}
      `
      params = [cctvIdParsed as number]
    } else {
      sql = `
        ${baseSelect}
        ORDER BY i.created_at DESC
        LIMIT ${limitSafe}
      `
      params = []
    }

    const [rows] = await pool.execute<CameraIssueRow[]>(sql, params)
    return NextResponse.json({ success: true, data: rows })
  } catch (e) {
    console.error('GET /api/admin/camera-issues error:', e)
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload

    if (!body?.issue_type) {
      return NextResponse.json({ success: false, message: 'missing issue_type' }, { status: 400 })
    }

    // อนุญาต cctv_id = null เฉพาะกรณี issue_type = 'missing'
    const allowNullCctv = body.issue_type === 'missing'

    const cctvIdFinal: number | null =
      body.cctv_id === null || body.cctv_id === undefined
        ? null
        : Number.isFinite(Number(body.cctv_id))
          ? Number(body.cctv_id)
          : null

    if (!allowNullCctv && cctvIdFinal == null) {
      return NextResponse.json({ success: false, message: 'cctv_id is required for this issue_type' }, { status: 400 })
    }

    const occurredSql: string | null = toSqlDatetimeLocal(body.occurred_at) // null => ใช้ NOW()

    const pool = getPool()

    // กำหนดประเภทของพารามิเตอร์เป็น tuple ชัดเจน
    const params: [
      number | null,           // cctv_id
      number | null,           // related_report_id
      IssueType,               // issue_type
      string | null,           // description
      string | null            // occurred_at (หรือ null)
    ] = [
      cctvIdFinal,
      body.related_report_id ?? null,
      body.issue_type,
      body.description ?? null,
      occurredSql
    ]

    const insertSql = `
      INSERT INTO camera_issues
        (cctv_id, related_report_id, issue_type, description, occurred_at, status, created_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, COALESCE(?, NOW()), 'open', 'admin', NOW(), NOW())
    `

    await pool.execute<ResultSetHeader>(insertSql, params)

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('POST /api/admin/camera-issues error:', e)
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
