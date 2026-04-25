// src/app/api/admin/notifications/route.ts
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0 // No caching

import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'

export async function GET() {
  try {
    const pool = getPool()

    // ดึงจำนวนคำร้องที่ยังไม่ได้ดำเนินการ (เฉพาะรอดำเนินการ)
    const [countRows] = await pool.execute<RowDataPacket[]>(
      `SELECT COUNT(*) as count FROM reports WHERE status = 'รอดำเนินการ'`
    )

    const pendingCount = countRows[0]?.count || 0

    // ดึงคำร้องล่าสุด 5 รายการที่ยังไม่ได้ดำเนินการ (เฉพาะรอดำเนินการ)
    const [recentRows] = await pool.execute<RowDataPacket[]>(
      `SELECT report_id, submitted_at, full_name, request_type, incident_location
       FROM reports
       WHERE status = 'รอดำเนินการ'
       ORDER BY submitted_at DESC
       LIMIT 5`
    )

    const recentReports = recentRows.map(row => ({
      report_id: row.report_id,
      submitted_at: row.submitted_at,
      full_name: row.full_name,
      request_type: row.request_type,
      incident_location: row.incident_location
    }))

    return NextResponse.json({
      success: true,
      data: {
        pending_reports: pendingCount,
        recent_reports: recentReports
      }
    })

  } catch (error) {
    console.error('Error fetching notifications:', error)
    return NextResponse.json(
      { success: false, message: 'ไม่สามารถดึงข้อมูลการแจ้งเตือนได้' },
      { status: 500 }
    )
  }
}
