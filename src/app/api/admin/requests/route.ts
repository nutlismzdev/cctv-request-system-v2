import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

// Type definitions for request data
interface ReportCount {
  total: number;
}

interface DatabaseInsertResult {
  insertId: number;
  affectedRows: number;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const status = searchParams.get('status');
    const officerId = searchParams.get('officer_id');
    const search = searchParams.get('search');

    const offset = (page - 1) * pageSize;

    // Build WHERE clause
    let whereClause = '';
    const params: unknown[] = [];

    if (status) {
      whereClause += ' AND r.status = ?';
      params.push(status);
    }

    if (officerId) {
      whereClause += ' AND r.assigned_officer_id = ?';
      params.push(officerId);
    }

    if (search) {
      whereClause += ` AND (r.full_name LIKE ? OR r.id_or_passport_number LIKE ? OR r.phone_number LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    // Get total count
    const countSql = `
      SELECT COUNT(*) as total
      FROM reports r
      WHERE 1=1 ${whereClause}
    `;
    const countResult: ReportCount[] = await query(countSql, params);
    const total = (countResult[0] as ReportCount)?.total || 0;

    // Get reports with pagination
    const sql = `
      SELECT
        r.report_id,
        r.submitted_at,
        r.prefix,
        r.full_name,
        r.age,
        r.phone_number,
        r.id_or_passport_number,
        r.request_type,
        r.incident_date,
        r.incident_time,
        r.incident_location,
        r.status,
        r.priority,
        r.status_updated_at,
        r.assigned_officer_id,
        o.full_name as officer_name,
        o.position as officer_position,
        (
          SELECT COUNT(*)
          FROM cctv_images ci
          WHERE ci.report_id = r.report_id
        ) + (
          SELECT COUNT(*)
          FROM cctv_videos cv
          WHERE cv.report_id = r.report_id
        ) as media_count
      FROM reports r
      LEFT JOIN officers o ON r.assigned_officer_id = o.officer_id
      WHERE 1=1 ${whereClause}
      ORDER BY r.submitted_at DESC
      LIMIT ? OFFSET ?
    `;

    params.push(pageSize, offset);
    const reports = await query(sql, params);

    return Response.json({
      success: true,
      data: reports,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  } catch (error: unknown) {
    console.error('Error fetching requests:', error);
    const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลคำร้อง';
    return Response.json({
      success: false,
      message: errorMessage
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const sql = `
      INSERT INTO reports (
        prefix, full_name, age, id_or_passport_number, phone_number,
        house_number, village_number, alley, road, sub_district, district, province, postal_code,
        request_type, request_details, incident_date, incident_time, incident_location,
        involvement_role, involvement_explain, status, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const params = [
      body.prefix, body.full_name, body.age, body.id_or_passport_number, body.phone_number,
      body.house_number, body.village_number, body.alley, body.road, body.sub_district, body.district, body.province, body.postal_code,
      body.request_type, body.request_details, body.incident_date, body.incident_time, body.incident_location,
      body.involvement_role, body.involvement_explain, 'รอดำเนินการ', body.priority || 'medium'
    ];

    const result = await query(sql, params) as DatabaseInsertResult[];

    return Response.json({
      success: true,
      message: 'สร้างคำร้องเรียบร้อยแล้ว',
      data: {
        report_id: result[0].insertId,
        status: 'รอดำเนินการ'
      }
    });
  } catch (error: unknown) {
    console.error('Error creating request:', error);
    const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการสร้างคำร้อง';
    return Response.json({
      success: false,
      message: errorMessage
    }, { status: 500 });
  }
}
