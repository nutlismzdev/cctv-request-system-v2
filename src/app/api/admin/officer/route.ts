import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const active = searchParams.get('active');

    let sql = 'SELECT * FROM officers';
    const params: unknown[] = [];

    if (active === 'true') {
      sql += ' WHERE is_active = ?';
      params.push(true);
    }

    sql += ' ORDER BY officer_id ASC';

    const officers = await query(sql, params);

    return Response.json({
      success: true,
      data: officers,
      count: officers.length
    });
  } catch (error: unknown) {
    console.error('Error fetching officers:', error);
    const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลเจ้าหน้าที่';
    return Response.json({
      success: false,
      message: errorMessage
    }, { status: 500 });
  }
}
