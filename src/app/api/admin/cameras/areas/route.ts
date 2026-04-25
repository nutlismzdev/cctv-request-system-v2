// app/api/admin/cameras/areas/route.ts
import { NextResponse } from 'next/server'
import { RowDataPacket } from 'mysql2/promise'
import { getPool } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface AreaRow extends RowDataPacket {
  area: string
}

export async function GET() {
  try {
    const sql = `
      SELECT DISTINCT area
      FROM cctv
      WHERE area IS NOT NULL AND area <> ''
      ORDER BY area
    `
    const [rows] = await getPool().execute<AreaRow[]>(sql)
    const data = rows.map(r => ({ area: r.area }))
    return NextResponse.json({ success: true, data })
  } catch (e: unknown) {
    console.error('[areas] error:', e)
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    )
  }
}
