// app/api/admin/reports/search/route.ts
import { NextResponse } from 'next/server'
import { RowDataPacket } from 'mysql2/promise'
import { getPool } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Database row interface for search results
interface SearchResultRow extends RowDataPacket {
  report_id: number
  created_at: string | null
  status: string | null
  request_type: string | null
  incident_location: string | null
  full_name: string | null
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const q = (url.searchParams.get('q') || '').trim()

  if (!q) {
    return NextResponse.json({ success: true, data: [] })
  }

  try {
    const isNumeric = /^\d+$/.test(q)
    const params: (string | number)[] = []
    let sql = `
      SELECT
        r.report_id,
        DATE_FORMAT(r.created_at, '%Y-%m-%d %H:%i:%s') AS created_at,
        r.status,
        r.request_type,
        r.incident_location,
        r.full_name
      FROM reports r
      WHERE
    `

    if (isNumeric) {
      // พิมพ์เลข: หา report_id ที่ขึ้นต้นด้วย q หรือเท่ากับ q
      sql += ` (CAST(r.report_id AS CHAR) LIKE ? OR r.report_id = ?) `
      params.push(`${q}%`, Number(q))
    } else {
      // พิมพ์คำ: หาใน incident_location / request_type / full_name
      sql += ` (r.incident_location LIKE ? OR r.request_type LIKE ? OR r.full_name LIKE ?) `
      params.push(`%${q}%`, `%${q}%`, `%${q}%`)
    }

    sql += `
      ORDER BY r.report_id DESC
      LIMIT 20
    `

    const [rows] = await getPool().execute<SearchResultRow[]>(sql, params)
    const data = rows.map(r => ({
      report_id: Number(r.report_id),
      created_at: r.created_at ?? null,
      status: r.status ?? null,
      request_type: r.request_type ?? null,
      incident_location: r.incident_location ?? null,
      full_name: r.full_name ?? null,               // ✅ เพิ่มคืนค่า full_name
    }))

    return NextResponse.json({ success: true, data })
  } catch (e: unknown) {
    console.error(e)
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
