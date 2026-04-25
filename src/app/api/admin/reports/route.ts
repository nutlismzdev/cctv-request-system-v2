// app/api/admin/reports/route.ts
import { NextResponse } from 'next/server'
import { RowDataPacket } from 'mysql2/promise'
import { getPool } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Database row type definitions
interface TotalRow extends RowDataPacket {
  total: number
}

interface StatusRow extends RowDataPacket {
  status: string
  count: number
}

interface TypeRow extends RowDataPacket {
  request_type: string | null
  count: number
}

interface TrendRow extends RowDataPacket {
  month: string
  year: number
  month_num: number
  count: number
}

interface CategoryRow extends RowDataPacket {
  category_name: string | null
  count: number
}

interface LocationRow extends RowDataPacket {
  incident_location: string
  count: number
}

interface ProcessingTimeRow extends RowDataPacket {
  avg_days: number | null
}

interface DocAvgRow extends RowDataPacket {
  avg_minutes: number | null
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const days = Number(url.searchParams.get('days') || 30)
  if (!Number.isFinite(days) || days <= 0) {
    return NextResponse.json({ success: false, message: 'invalid days' }, { status: 400 })
  }

  try {
    const pool = getPool()

    // ---------------------------
    // 1) จำนวนคำร้องทั้งหมด
    // ---------------------------
    const [totalRows] = await pool.execute<TotalRow[]>(
      `
      SELECT COUNT(*) AS total
      FROM reports
      WHERE created_at >= NOW() - INTERVAL ? DAY
      `,
      [days]
    )
    const total_reports = Number(totalRows[0]?.total || 0)

    // ---------------------------
    // 2) สัดส่วนสถานะ (ปัด 2 ตำแหน่ง)
    // ---------------------------
    const [statusRows] = await pool.execute<StatusRow[]>(
      `
      SELECT status, COUNT(*) AS count
      FROM reports
      WHERE created_at >= NOW() - INTERVAL ? DAY
      GROUP BY status
      ORDER BY count DESC
      `,
      [days]
    )

    const status_breakdown = statusRows.map((row) => ({
      status: row.status,
      count: Number(row.count),
      percentage:
        total_reports > 0
          ? Math.round((Number(row.count) / total_reports) * 10000) / 100 // 2 ตำแหน่ง
          : 0,
    }))

    // ---------------------------
    // 3) ประเภทคำร้อง (ปัด 2 ตำแหน่ง)
    // ---------------------------
    const [typeRows] = await pool.execute<TypeRow[]>(
      `
      SELECT COALESCE(request_type, 'ไม่ระบุ') AS request_type, COUNT(*) AS count
      FROM reports
      WHERE created_at >= NOW() - INTERVAL ? DAY
      GROUP BY COALESCE(request_type, 'ไม่ระบุ')
      ORDER BY count DESC
      `,
      [days]
    )

    const request_type_breakdown = typeRows.map((row) => ({
      type: row.request_type || 'ไม่ระบุ',
      count: Number(row.count),
      percentage:
        total_reports > 0
          ? Math.round((Number(row.count) / total_reports) * 10000) / 100
          : 0,
    }))

    // ---------------------------
    // 4) แนวโน้มรายเดือน (เรียงตามเวลา “ขึ้นไปขวา”)
    // ---------------------------
    const [trendRows] = await pool.execute<TrendRow[]>(
      `
      SELECT
        DATE_FORMAT(created_at, '%M %Y') AS month,
        YEAR(created_at) AS year,
        MONTH(created_at) AS month_num,
        COUNT(*) AS count
      FROM reports
      WHERE created_at >= NOW() - INTERVAL ? DAY
      GROUP BY YEAR(created_at), MONTH(created_at), DATE_FORMAT(created_at, '%M %Y')
      ORDER BY year ASC, month_num ASC
      `,
      [days]
    )

    const monthly_trend = trendRows.map((row) => ({
      month: row.month,
      year: Number(row.year),
      count: Number(row.count),
    }))

    // ---------------------------
    // 5) หมวดหมู่เหตุการณ์ (ถ้าไม่มี categories จริง ให้คงไว้/ลบส่วนนี้ได้)
    // ---------------------------
    const [categoryRows] = await pool.execute<CategoryRow[]>(
      `
      SELECT c.category_name, COUNT(r.report_id) AS count
      FROM reports r
      LEFT JOIN categories c ON r.category_id = c.category_id
      WHERE r.created_at >= NOW() - INTERVAL ? DAY
      GROUP BY c.category_id, c.category_name
      ORDER BY count DESC
      LIMIT 10
      `,
      [days]
    )

    const category_breakdown = categoryRows.map((row) => ({
      category_name: row.category_name || 'ไม่ระบุ',
      count: Number(row.count),
      percentage:
        total_reports > 0
          ? Math.round((Number(row.count) / total_reports) * 10000) / 100
          : 0,
    }))

    // ---------------------------
    // 6) สถานที่ยอดนิยม (ปรับชื่อคอลัมน์ให้ตรงสคีม่าจริง)
    // ---------------------------
    const [locationRows] = await pool.execute<LocationRow[]>(
      `
      SELECT incident_location, COUNT(*) AS count
      FROM reports
      WHERE created_at >= NOW() - INTERVAL ? DAY
        AND incident_location IS NOT NULL
        AND incident_location <> ''
      GROUP BY incident_location
      ORDER BY count DESC
      LIMIT 10
      `,
      [days]
    )

    const top_locations = locationRows.map((row) => ({
      location: row.incident_location,
      count: Number(row.count),
    }))

    // ---------------------------
    // 7) เวลาดำเนินการเฉลี่ยรวม (ยื่น -> อนุมัติ) หน่วย: วัน
    //    ถ้ามีคอลัมน์ approved_at ใน reports ใช้ได้เลย; ถ้าไม่มี ให้คำนวณจาก status_history
    // ---------------------------
    // เวอร์ชันใช้ตาราง status_history หา "ครั้งแรกที่อนุมัติ"
    const [processingTimeRows] = await pool.execute<ProcessingTimeRow[]>(
      `
      SELECT
        AVG(TIMESTAMPDIFF(DAY, r.created_at, s.first_approved_at)) AS avg_days
      FROM reports r
      JOIN (
        SELECT sh.report_id, MIN(sh.changed_at) AS first_approved_at
        FROM status_history sh
        WHERE sh.new_status = 'เอกสารอนุมัติเรียบร้อย'
        GROUP BY sh.report_id
      ) s ON s.report_id = r.report_id
      WHERE r.created_at >= NOW() - INTERVAL ? DAY
      `,
      [days]
    )

    const processing_time_avg =
      processingTimeRows[0]?.avg_days != null
        ? Number(processingTimeRows[0].avg_days)
        : null

    // ---------------------------
    // 8) เวลาช่วง “รอเอกสารอนุมัติ -> เอกสารอนุมัติเรียบร้อย” หน่วย: นาที
    // ---------------------------
    const [docAvgRows] = await pool.execute<DocAvgRow[]>(
      `
      SELECT AVG(TIMESTAMPDIFF(MINUTE, t.wait_doc_at, t.approved_at)) AS avg_minutes
      FROM (
        SELECT
          r.report_id,
          (SELECT MIN(sh1.changed_at)
           FROM status_history sh1
           WHERE sh1.report_id = r.report_id
             AND sh1.new_status = 'รอเอกสารอนุมัติ') AS wait_doc_at,
          (SELECT MIN(sh2.changed_at)
           FROM status_history sh2
           WHERE sh2.report_id = r.report_id
             AND sh2.new_status = 'เอกสารอนุมัติเรียบร้อย') AS approved_at
        FROM reports r
        WHERE r.created_at >= NOW() - INTERVAL ? DAY
      ) AS t
      WHERE t.wait_doc_at IS NOT NULL
        AND t.approved_at IS NOT NULL
        AND t.approved_at > t.wait_doc_at
      `,
      [days]
    )

    const processing_time_doc_avg_minutes =
      docAvgRows[0]?.avg_minutes != null
        ? Number(docAvgRows[0].avg_minutes)
        : null

    // ---------------------------
    // ส่งค่าให้หน้า UI
    // ---------------------------
    return NextResponse.json({
      success: true,
      data: {
        total_reports,
        status_breakdown,
        request_type_breakdown,
        monthly_trend,
        category_breakdown,
        recent_activity: [],
        top_locations,
        processing_time_avg,
        processing_time_doc_avg_minutes, // << เพิ่มฟิลด์นี้ให้ตรง UI
      },
    })
  } catch (e: unknown) {
    console.error(e)
    const message = e instanceof Error ? e.message : 'Server error'
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
