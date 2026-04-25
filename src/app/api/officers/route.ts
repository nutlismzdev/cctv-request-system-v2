// src/app/api/officers/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import mysql, { RowDataPacket } from 'mysql2/promise'

// ------------ MySQL Pool ------------
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'cctv_huahin',
  dateStrings: true,
  charset: 'utf8mb4',
  connectionLimit: 10,
})

// ------------ GET /api/officers ------------
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const active = searchParams.get('active')

    let sql = `SELECT
      officer_id,
      prefix,
      full_name,
      position,
      phone,
      email,
      is_active,
      created_at
    FROM officers`

    const params: Array<string | number | boolean | null> = []

    if (active === 'true') {
      sql += ' WHERE is_active = ?'
      params.push(true)
    }

    sql += ' ORDER BY officer_id ASC'

    const [rows] = await pool.execute<RowDataPacket[]>(sql, params)

    // Map to match interface
    const officers = rows.map(row => ({
      officer_id: row.officer_id,
      prefix: row.prefix,
      full_name: `${row.prefix} ${row.full_name}`,
      position: row.position
    }))

    return Response.json({
      success: true,
      data: officers
    })

  } catch (error: unknown) {
    console.error('Error fetching officers:', error)
    return Response.json(
      { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลเจ้าหน้าที่' },
      { status: 500 }
    )
  }
}
