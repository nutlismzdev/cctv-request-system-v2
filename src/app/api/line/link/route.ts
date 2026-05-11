// app/api/line/link/route.ts
import { NextRequest, NextResponse, after } from 'next/server'
import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { getPool } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { report_id, tracking_token, userId, is_friend } = await req.json()
    const friendFlag = Boolean(is_friend)

    // Validate required parameters
    if (!report_id || !tracking_token || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters: report_id, tracking_token, userId' },
        { status: 400 }
      )
    }

    // capture IP ตั้งแต่ตอนนี้ — req.headers อ่านใน after() ภายหลังไม่ได้
    const ipAddress =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      'unknown'

    // Verify report exists and tracking token matches
    const [reports] = await getPool().execute<RowDataPacket[]>(
      'SELECT report_id, status, line_user_id FROM reports WHERE report_id = ? AND tracking_token = ?',
      [report_id, tracking_token]
    )

    if (reports.length === 0) {
      return NextResponse.json(
        { error: 'Invalid report_id or tracking_token' },
        { status: 404 }
      )
    }

    const report = reports[0]

    // Check if report is already linked to a LINE user
    if (report.line_user_id) {
      return NextResponse.json(
        { error: 'Report is already linked to a LINE user' },
        { status: 409 }
      )
    }

    // Begin transaction
    await getPool().execute('START TRANSACTION')

    try {
      // UPSERT line_users + รับ line_user_id กลับใน 1 query เดียว
      // - is_friend สะท้อนสถานะจริงตอน link (จาก liff.getFriendship() ฝั่ง client)
      // - webhook follow event จะมา update เป็น true ถ้าผู้ใช้เพิ่มเพื่อนทีหลัง
      // - LAST_INSERT_ID(line_user_id) trick: บังคับให้ MySQL คืน existing id ผ่าน insertId
      //   ตอน ON DUPLICATE KEY → ตัด SELECT รอบ 2 ออก (~10-30ms)
      const [upsertResult] = await getPool().execute<ResultSetHeader>(`
        INSERT INTO line_users (line_user_id_str, is_friend, friend_added_at, last_active_at)
        VALUES (?, ?, IF(?, NOW(), NULL), NOW())
        ON DUPLICATE KEY UPDATE
          line_user_id = LAST_INSERT_ID(line_user_id),
          is_friend = VALUES(is_friend),
          friend_added_at = COALESCE(friend_added_at, VALUES(friend_added_at)),
          last_active_at = VALUES(last_active_at),
          updated_at = NOW()
      `, [userId, friendFlag ? 1 : 0, friendFlag ? 1 : 0])

      const lineUserId = upsertResult.insertId
      if (!lineUserId) {
        throw new Error('Failed to retrieve line_user_id from upsert')
      }

      // Link report with LINE user
      await getPool().execute(
        'UPDATE reports SET line_user_id = ?, updated_at = NOW(), updated_by = ? WHERE report_id = ?',
        [lineUserId, userId || 'api_user', report_id]
      )

      // Commit transaction
      await getPool().execute('COMMIT')

      // Rule: server-after-nonblocking — log activity หลัง response ส่งไปแล้ว
      // ผู้ใช้ไม่ต้องรอ DB INSERT ก่อนเห็น "ผูกแล้ว ✓" (~50-150ms saved)
      after(async () => {
        try {
          await getPool().execute(`
            INSERT INTO activity_logs (
              activity_type, entity_type, entity_id,
              actor_type, actor_id, action, description,
              metadata, ip_address
            ) VALUES (
              'report_updated', 'report', ?,
              'applicant', ?, 'LINE_LINK',
              'ผูกคำร้องกับ LINE User',
              JSON_OBJECT('line_user_id', ?, 'userId', ?),
              ?
            )
          `, [report_id, userId, lineUserId, userId, ipAddress])
        } catch (e) {
          console.warn('LINE link activity log failed:', e)
        }
      })

      return NextResponse.json({
        success: true,
        message: 'Report successfully linked to LINE user',
        data: {
          report_id,
          line_user_id: lineUserId,
          linked_at: new Date().toISOString()
        }
      })

    } catch (error) {
      await getPool().execute('ROLLBACK')
      throw error
    }

  } catch (error) {
    console.error('LINE Link API Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to check link status
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const report_id = searchParams.get('report_id')
    const tracking_token = searchParams.get('tracking_token')

    if (!report_id || !tracking_token) {
      return NextResponse.json(
        { error: 'Missing required parameters: report_id, tracking_token' },
        { status: 400 }
      )
    }

    // Check if report exists and get link status
    const [reports] = await getPool().execute(`
      SELECT
        r.report_id,
        r.status,
        r.line_user_id,
        r.tracking_token,
        lu.line_user_id_str,
        lu.display_name,
        lu.is_friend,
        lu.friend_added_at
      FROM reports r
      LEFT JOIN line_users lu ON r.line_user_id = lu.line_user_id
      WHERE r.report_id = ? AND r.tracking_token = ?
    `, [report_id, tracking_token]) as import('mysql2/promise').RowDataPacket[][]

    if (reports.length === 0) {
      return NextResponse.json(
        { error: 'Invalid report_id or tracking_token' },
        { status: 404 }
      )
    }

    const report = reports[0]

    return NextResponse.json({
      success: true,
      data: {
        report_id: report.report_id,
        status: report.status,
        is_linked: !!report.line_user_id,
        line_user: report.line_user_id ? {
          line_user_id: report.line_user_id,
          line_user_id_str: report.line_user_id_str,
          display_name: report.display_name,
          is_friend: report.is_friend,
          friend_added_at: report.friend_added_at
        } : null
      }
    })

  } catch (error) {
    console.error('LINE Link Status Check Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
