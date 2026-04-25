// app/api/line/link/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const { report_id, tracking_token, userId } = await req.json()

    // Validate required parameters
    if (!report_id || !tracking_token || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters: report_id, tracking_token, userId' },
        { status: 400 }
      )
    }

    // Verify report exists and tracking token matches
    const [reports] = await getPool().execute(
      'SELECT report_id, status, line_user_id FROM reports WHERE report_id = ? AND tracking_token = ?',
      [report_id, tracking_token]
    ) as import('mysql2/promise').RowDataPacket[][]

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
      // UPSERT line_users table
      await getPool().execute(`
        INSERT INTO line_users (line_user_id_str, is_friend, friend_added_at, last_active_at)
        VALUES (?, true, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
          is_friend = VALUES(is_friend),
          friend_added_at = IF(friend_added_at IS NULL, VALUES(friend_added_at), friend_added_at),
          last_active_at = VALUES(last_active_at),
          updated_at = NOW()
      `, [userId])

      // Get the line_user_id
      const [lineUsers] = await getPool().execute(
        'SELECT line_user_id FROM line_users WHERE line_user_id_str = ?',
        [userId]
      ) as import('mysql2/promise').RowDataPacket[][]

      if (lineUsers.length === 0) {
        throw new Error('Failed to create/retrieve line_user')
      }

      const lineUserId = lineUsers[0].line_user_id

      // Link report with LINE user
      await getPool().execute(
        'UPDATE reports SET line_user_id = ?, updated_at = NOW(), updated_by = ? WHERE report_id = ?',
        [lineUserId, userId || 'api_user', report_id]
      )

      // Commit transaction
      await getPool().execute('COMMIT')

      // Log activity
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
      `, [
        report_id,
        userId,
        lineUserId,
        userId,
        req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown'
      ])

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
