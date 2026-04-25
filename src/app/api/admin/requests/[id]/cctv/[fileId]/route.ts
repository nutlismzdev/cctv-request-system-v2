import { NextRequest } from 'next/server';
import { query } from '@/lib/db';

// Type definitions for database results
interface DatabaseResult {
  affectedRows: number;
  insertId?: number;
}

interface UpdateResult {
  success: boolean;
  type?: 'image' | 'video';
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Helper function to update both image and video tables
async function tryUpdateBoth(reportId: number, fileId: number, sql: string, params: unknown[]): Promise<UpdateResult> {
  const r1 = await query(sql.replace('__TABLE__', 'cctv_images').replace('__COLUMN__', 'image_id'), [...params, reportId, fileId]) as DatabaseResult[];
  if (r1[0]?.affectedRows > 0) return { success: true, type: 'image' };
  const r2 = await query(sql.replace('__TABLE__', 'cctv_videos').replace('__COLUMN__', 'video_id'), [...params, reportId, fileId]) as DatabaseResult[];
  return r2[0]?.affectedRows > 0 ? { success: true, type: 'video' } : { success: false };
}

// Helper function to delete from both tables
async function tryDeleteBoth(reportId: number, fileId: number): Promise<UpdateResult> {
  const d1 = await query(
    'DELETE FROM cctv_images WHERE report_id = ? AND image_id = ? LIMIT 1',
    [reportId, fileId]
  ) as DatabaseResult[];
  if (d1[0]?.affectedRows > 0) return { success: true, type: 'image' };

  const d2 = await query(
    'DELETE FROM cctv_videos WHERE report_id = ? AND video_id = ? LIMIT 1',
    [reportId, fileId]
  ) as DatabaseResult[];
  return d2[0]?.affectedRows > 0 ? { success: true, type: 'video' } : { success: false };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const paramsData = await params;
    const { id, fileId } = paramsData;
    const reportId = parseInt(id);
    const fileIdNum = parseInt(fileId);

    if (isNaN(reportId) || isNaN(fileIdNum)) {
      return Response.json({
        success: false,
        message: 'รหัสคำร้องหรือไฟล์ไม่ถูกต้อง'
      }, { status: 400 });
    }

    const body = await req.json();

    if (!body.approval_status) {
      return Response.json({
        success: false,
        message: 'ต้องระบุ approval_status'
      }, { status: 400 });
    }

    const validStatuses = ['รอดำเนินการ', 'พร้อมใช้งาน', 'ไม่พร้อมใช้งาน', 'กำลังตรวจสอบ'];
    if (!validStatuses.includes(body.approval_status)) {
      return Response.json({
        success: false,
        message: 'สถานะไม่ถูกต้อง'
      }, { status: 400 });
    }

    const result = await tryUpdateBoth(
      reportId,
      fileIdNum,
      `UPDATE __TABLE__ SET approval_status = ?, updated_at = NOW(), approved_at = NOW(), approved_by = ? WHERE report_id = ? AND __COLUMN__ = ?`,
      [body.approval_status, body.approved_by || 'system']
    );

    if (!result.success) {
      return Response.json({
        success: false,
        message: 'ไม่พบไฟล์ที่ระบุ'
      }, { status: 404 });
    }

    return Response.json({
      success: true,
      message: `อัปเดตสถานะ${result.type === 'image' ? 'ภาพ' : 'วิดีโอ'}เรียบร้อยแล้ว`,
      data: {
        approval_status: body.approval_status,
        media_type: result.type
      }
    });
  } catch (error: unknown) {
    console.error('Error updating file status:', error);
    const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการอัปเดตสถานะไฟล์';
    return Response.json({
      success: false,
      message: errorMessage
    }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const paramsData = await params;
    const { id, fileId } = paramsData;
    const reportId = parseInt(id);
    const fileIdNum = parseInt(fileId);

    if (isNaN(reportId) || isNaN(fileIdNum)) {
      return Response.json({
        success: false,
        message: 'รหัสคำร้องหรือไฟล์ไม่ถูกต้อง'
      }, { status: 400 });
    }

    const result = await tryDeleteBoth(reportId, fileIdNum);

    if (!result.success) {
      return Response.json({
        success: false,
        message: 'ไม่พบไฟล์ที่ระบุ'
      }, { status: 404 });
    }

    return Response.json({
      success: true,
      message: `ลบ${result.type === 'image' ? 'รูปภาพ' : 'วิดีโอ'}เรียบร้อยแล้ว`
    });
  } catch (error: unknown) {
    console.error('Error deleting file:', error);
    const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบไฟล์';
    return Response.json({
      success: false,
      message: errorMessage
    }, { status: 500 });
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  try {
    const paramsData = await params;
    const { id, fileId } = paramsData;
    const reportId = parseInt(id);
    const fileIdNum = parseInt(fileId);

    if (isNaN(reportId) || isNaN(fileIdNum)) {
      return Response.json({
        success: false,
        message: 'รหัสคำร้องหรือไฟล์ไม่ถูกต้อง'
      }, { status: 400 });
    }

    // Try to get from images first
    const images: Record<string, unknown>[] = await query(
      `SELECT 'image' as media_type, * FROM cctv_images WHERE report_id = ? AND image_id = ?`,
      [reportId, fileIdNum]
    );

    if (images.length > 0) {
      return Response.json({
        success: true,
        data: images[0]
      });
    }

    // Try to get from videos
    const videos: Record<string, unknown>[] = await query(
      `SELECT 'video' as media_type, * FROM cctv_videos WHERE report_id = ? AND video_id = ?`,
      [reportId, fileIdNum]
    );

    if (videos.length > 0) {
      return Response.json({
        success: true,
        data: videos[0]
      });
    }

    return Response.json({
      success: false,
      message: 'ไม่พบไฟล์ที่ระบุ'
    }, { status: 404 });
  } catch (error: unknown) {
    console.error('Error fetching file detail:', error);
    const errorMessage = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลไฟล์';
    return Response.json({
      success: false,
      message: errorMessage
    }, { status: 500 });
  }
}
