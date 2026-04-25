// src/app/api/heatmap/categories/route.ts
// API สำหรับดึงรายการหมวดหมู่ที่มีข้อมูล Heatmap (สำหรับ filter dropdown)

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { RowDataPacket } from 'mysql2/promise'
import { getPool } from '@/lib/db'

interface CategoryWithCount {
  category_id: number
  category_name: string
  count: number
}

/**
 * GET /api/heatmap/categories
 * 
 * ดึงรายการหมวดหมู่ที่มี reports พร้อมพิกัด
 * ใช้สำหรับแสดงใน filter dropdown ของ Heatmap
 */
export async function GET(): Promise<Response> {
  try {
    const [rows] = await getPool().execute<RowDataPacket[]>(`
      SELECT 
        c.category_id,
        c.category_name,
        COUNT(r.report_id) as count
      FROM categories c
      INNER JOIN reports r ON c.category_id = r.category_id
      WHERE r.latitude IS NOT NULL 
        AND r.longitude IS NOT NULL
        AND r.status != 'ปฏิเสธคำร้อง'
      GROUP BY c.category_id, c.category_name
      HAVING count > 0
      ORDER BY count DESC
    `)

    const categories: CategoryWithCount[] = rows.map(row => ({
      category_id: row.category_id,
      category_name: row.category_name,
      count: row.count
    }))

    return Response.json({
      success: true,
      data: categories
    })

  } catch (error) {
    console.error('Heatmap categories error:', error)
    return Response.json(
      { success: false, message: 'เกิดข้อผิดพลาด', data: [] },
      { status: 500 }
    )
  }
}
