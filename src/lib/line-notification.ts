// src/lib/line-notification.ts
import { getPool } from '@/lib/db'
import type { RowDataPacket } from 'mysql2/promise'
import crypto from 'crypto'

const LINE_API_BASE = 'https://api.line.me/v2/bot'

// ---------- LINE Notification Token Store (MySQL-backed) ----------
// Tokens used to be a Map on globalThis — they were lost on every server restart and
// did not survive scale-out. They now live in `line_tracking_tokens` (see
// database/line_tracking_tokens.sql) with TTL enforced via expires_at.

const LINE_TOKEN_TTL_MS = 24 * 60 * 60 * 1000 // 24h
let lastCleanupAt = 0

/**
 * สร้าง LINE notification token ใหม่ที่มีอายุ 24 ชั่วโมง
 */
async function createLineNotificationToken(reportId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + LINE_TOKEN_TTL_MS)
  await getPool().execute(
    `INSERT INTO line_tracking_tokens (token, report_id, expires_at)
     VALUES (?, ?, ?)`,
    [token, reportId, expiresAt]
  )
  // Best-effort cleanup at most once per hour
  if (Date.now() - lastCleanupAt > 60 * 60 * 1000) {
    lastCleanupAt = Date.now()
    getPool()
      .execute('DELETE FROM line_tracking_tokens WHERE expires_at < NOW()')
      .catch(err => console.warn('LINE token cleanup failed:', err))
  }
  return token
}

interface LineTokenRow extends RowDataPacket {
  report_id: number
  expires_at: Date
}

/**
 * ตรวจสอบ LINE token และคืนค่า reportId ถ้ายังไม่หมดอายุ
 */
export async function validateLineToken(token: string): Promise<number | null> {
  const [rows] = await getPool().execute<LineTokenRow[]>(
    `SELECT report_id, expires_at
     FROM line_tracking_tokens
     WHERE token = ?
     LIMIT 1`,
    [token]
  )
  if (rows.length === 0) return null
  const row = rows[0]
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await getPool()
      .execute('DELETE FROM line_tracking_tokens WHERE token = ?', [token])
      .catch(() => {})
    return null
  }
  return row.report_id
}

// Type definitions for database rows
interface LineUserRow extends RowDataPacket {
  line_user_id_str: string
  is_friend: number | boolean | null
}

interface ReportRow extends RowDataPacket {
  line_user_id: number | null
  status: string
  tracking_token: string
  applicant_name: string
  incident_date: Date | null
  incident_time: string | null
  incident_location: string | null
  request_details: string | null
  category_name: string | null
}

interface GroupReportRow extends RowDataPacket {
  applicant_name: string
  incident_date: Date | null
  incident_time: string | null
  incident_location: string | null
  request_details: string | null
  category_name: string | null
}

export interface NotificationData {
  report_id: number
  status: string
  download_url?: string
  message?: string
  applicant_name?: string | null
  incident_date?: string | null
  incident_time?: string | null
  incident_location?: string | null
  category_name?: string | null
  request_details?: string | null
  tracking_token?: string | null
}

/**
 * ส่งแจ้งเตือนไปยังผู้ยื่นคำร้อง (push รายบุคคล)
 * หมายเหตุ: activity_type ถูกปรับเป็น 'admin_action' ให้ตรง schema
 */
export async function sendLineNotification(lineUserId: number, data: NotificationData) {
  try {
    // หา line_user_id_str + is_friend จาก numeric id
    const [lineUsers] = await getPool().execute(
      'SELECT line_user_id_str, is_friend FROM line_users WHERE line_user_id = ? LIMIT 1',
      [lineUserId]
    ) as RowDataPacket[][]
    if (lineUsers.length === 0) throw new Error('LINE user not found')

    const lineUser = lineUsers[0] as LineUserRow
    const toUserIdStr = lineUser.line_user_id_str
    const isFriend = Boolean(lineUser.is_friend)

    const message = createNotificationMessage(data)
    if (!message) {
      // ไม่มีข้อความตามสถานะนี้ → ไม่ยิง API
      return { skipped: true, reason: 'no_message' as const }
    }

    // ⚠️ ต้องเป็นเพื่อนกับ OA ก่อน LINE Messaging API ถึงจะส่ง pushMessage ได้
    // ถ้าไม่ใช่ → ยิงไปก็ได้ error 403 → log ไว้เป็นความตั้งใจ (skipped) ไม่ใช่ failure
    if (!isFriend) {
      try {
        await getPool().execute(
          `INSERT INTO activity_logs (
            activity_type, entity_type, entity_id,
            actor_type, actor_id, action, description,
            metadata, ip_address
          ) VALUES (
            'admin_action', 'report', ?,
            'system', 'line_notification', 'NOTIFICATION_SKIPPED_NOT_FRIEND',
            'ผู้ยื่นยังไม่ได้เพิ่มเพื่อน LINE OA — ส่งแจ้งเตือนไม่ได้',
            JSON_OBJECT('line_user_id', ?),
            'system'
          )`,
          [data.report_id, lineUserId]
        )
      } catch (e) {
        console.warn('activity_logs insert failed (NOTIFICATION_SKIPPED_NOT_FRIEND):', e)
      }
      return { skipped: true, reason: 'not_friend' as const }
    }

    const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
    if (!accessToken) throw new Error('LINE_CHANNEL_ACCESS_TOKEN not configured')

    const res = await fetch(`${LINE_API_BASE}/message/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ to: toUserIdStr, messages: [message] })
    })

    if (!res.ok) {
      let errBody = ''
      try { errBody = await res.text() } catch {}
      throw new Error(`LINE API error: ${res.status} ${res.statusText} ${errBody}`)
    }

    // log (non-prod เท่านั้น เพื่อลดภาระ DB ใน prod)
    if (process.env.NODE_ENV !== 'production') {
      try {
        await getPool().execute(
          `INSERT INTO activity_logs (
            activity_type, entity_type, entity_id,
            actor_type, actor_id, action, description,
            metadata, ip_address
          ) VALUES (
            'admin_action', 'report', ?,
            'system', 'line_notification', 'NOTIFICATION_SENT',
            'ส่งแจ้งเตือน LINE สำเร็จ',
            NULL,
            'system'
          )`,
          [data.report_id]
        )
      } catch (e) {
        console.warn('activity_logs insert failed (NOTIFICATION_SENT):', e)
      }
    }

    // บางครั้ง LINE API ไม่มี body
    try { return await res.json() } catch { return { ok: true } }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('LINE notification error:', error)
    }
    // log fail ทุก env — admin จำเป็นต้องเห็นว่าส่งไม่สำเร็จเพื่อ follow-up ได้
    try {
      await getPool().execute(
        `INSERT INTO activity_logs (
          activity_type, entity_type, entity_id,
          actor_type, actor_id, action, description,
          metadata, ip_address
        ) VALUES (
          'admin_action', 'report', ?,
          'system', 'line_notification', 'NOTIFICATION_FAILED',
          'ส่งแจ้งเตือน LINE ไม่สำเร็จ',
          JSON_OBJECT('error', ?),
          'system'
        )`,
        [data.report_id, error instanceof Error ? error.message : String(error)]
      )
    } catch (e) {
      console.warn('activity_logs insert failed (NOTIFICATION_FAILED):', e)
    }
    throw error
  }
}

/**
 * สร้างข้อความ (Text) ตามสถานะที่อนุญาต
 */
function createNotificationMessage(data: NotificationData) {
  // อนุญาตส่งเฉพาะสองสถานะนี้
  if (data.status !== 'รอดำเนินการ' && data.status !== 'เอกสารอนุมัติเรียบร้อย') {
    return null
  }

  const base = { type: 'text' as const, text: '' }
  if (data.status === 'รอดำเนินการ') {
    base.text =
      `📄 แบบคำร้องขอเข้าดู/สำเนาข้อมูลภาพจากกล้องโทรทัศน์วงจรปิด CCTV:\n` +
      `${data.applicant_name ? `👤 ชื่อ-นามสกุล: ${data.applicant_name}\n` : ''}` +
      `${data.incident_date ? `📅 วันที่เกิดเหตุ: ${data.incident_date}\n` : ''}` +
      `${data.incident_time ? `🕒 เวลาที่เกิดเหตุ: ${data.incident_time}\n` : ''}` +
      `${data.incident_location ? `📍 สถานที่เกิดเหตุ: ${data.incident_location}\n` : ''}` +
      `${data.category_name ? `📂 หมวด/หมู่: ${data.category_name}\n` : ''}` +
      `${data.request_details ? `📋 รายละเอียดย่อย: ${data.request_details}\n` : ''}\n` +
      `🔗 ${data.download_url || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:4000'}/admin/request/${data.report_id}`}/edit\n` +
      `- ลิงก์เข้าสู่ระบบจัดการคำร้องสำหรับเจ้าหน้าที่`
  } else if (data.status === 'เอกสารอนุมัติเรียบร้อย') {
    base.text =
      `🎉 คำร้อง ของท่านได้รับการอนุมัติแล้ว!\n\n` +
      `📄 แบบคำร้องขอเข้าดู/สำเนาข้อมูลภาพจากกล้องโทรทัศน์วงจรปิด CCTV:\n` +
      `${data.applicant_name ? `👤 ชื่อ-นามสกุล: ${data.applicant_name}\n` : ''}` +
      `${data.incident_date ? `📅 วันที่เกิดเหตุ: ${data.incident_date}\n` : ''}` +
      `${data.incident_time ? `🕒 เวลาที่เกิดเหตุ: ${data.incident_time}\n` : ''}` +
      `${data.incident_location ? `📍 สถานที่เกิดเหตุ: ${data.incident_location}\n` : ''}` +
      `${data.category_name ? `📂 หมวด/หมู่: ${data.category_name}\n` : ''}` +
      `${data.request_details ? `📋 รายละเอียดย่อย: ${data.request_details}\n` : ''}\n` +
      `🔗 ${data.download_url || `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:4000'}/request/status/result?id=${data.report_id}&token=${data.tracking_token || ''}&external=1`}\n` +
      `- เว็บไซต์ตรวจสอบคำร้องขอดูภาพวงจรปิด\n` +
      `- คลิกลิงก์เพื่อดูรายละเอียดและดาวน์โหลดไฟล์\n` +
      `- ⚠️ หากเปิดไม่ขึ้น ให้กด "เปิดด้วยเบราว์เซอร์อื่น" หรือ copy ลิงก์ไปเปิดใน Chrome/Safari`
  }
  return base
}

/**
 * ส่งแจ้งเตือนไปยังกลุ่มเจ้าหน้าที่ (push เข้ากลุ่ม)
 * หมายเหตุ: activity_type ถูกปรับเป็น 'admin_action' ทั้งกรณีสำเร็จ/ล้มเหลว
 */
export async function sendLineNotificationToGroup(data: NotificationData) {
  try {
    const accessToken = process.env.LINE_GROUP_ACCESS_TOKEN
    if (!accessToken) throw new Error('LINE_GROUP_ACCESS_TOKEN not configured')

    const groupId = process.env.LINE_GROUP_ID
    if (!groupId) throw new Error('LINE_GROUP_ID not configured')

    const message = createNotificationMessage(data)
    if (!message) return { skipped: true }

    const res = await fetch(`${LINE_API_BASE}/message/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ to: groupId, messages: [message] })
    })

    if (!res.ok) {
      let errBody = ''
      try { errBody = await res.text() } catch {}
      throw new Error(`LINE API error: ${res.status} ${res.statusText} ${errBody}`)
    }

    if (process.env.NODE_ENV !== 'production') {
      try {
        await getPool().execute(
          `INSERT INTO activity_logs (
            activity_type, entity_type, entity_id,
            actor_type, actor_id, action, description,
            metadata, ip_address
          ) VALUES (
            'admin_action', 'report', ?,
            'system', 'line_group_notification', 'GROUP_NOTIFICATION_SENT',
            'ส่งแจ้งเตือนไปยังกลุ่ม LINE สำเร็จ',
            NULL,
            'system'
          )`,
          [data.report_id]
        )
      } catch (e) {
        console.warn('activity_logs insert failed (GROUP_NOTIFICATION_SENT):', e)
      }
    }

    try { return await res.json() } catch { return { ok: true } }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('LINE group notification error:', error)
      try {
        await getPool().execute(
          `INSERT INTO activity_logs (
            activity_type, entity_type, entity_id,
            actor_type, actor_id, action, description,
            metadata, ip_address
          ) VALUES (
            'admin_action', 'report', ?,
            'system', 'line_group_notification', 'GROUP_NOTIFICATION_FAILED',
            'ส่งแจ้งเตือนไปยังกลุ่ม LINE ไม่สำเร็จ',
            NULL,
            'system'
          )`,
          [data.report_id]
        )
      } catch (e) {
        console.warn('activity_logs insert failed (GROUP_NOTIFICATION_FAILED):', e)
      }
    }
    throw error
  }
}

/**
 * Helper: ส่งแจ้งเตือนไปยังเจ้าของคำร้อง (ดึงข้อมูลแล้วเรียก sendLineNotification)
 */
export async function sendNotificationToReportOwner(reportId: number, status: string, downloadUrl?: string) {
  try {
    const [rows] = await getPool().execute(
      `SELECT
        r.line_user_id,
        r.status,
        r.tracking_token,
        CONCAT(r.prefix, r.full_name) AS applicant_name,
        r.incident_date,
        r.incident_time,
        r.incident_location,
        r.request_details,
        c.category_name
       FROM reports r
       LEFT JOIN categories c ON r.category_id = c.category_id
      WHERE r.report_id = ?`,
      [reportId]
    ) as RowDataPacket[][]
    if (rows.length === 0) throw new Error(`Report ${reportId} not found`)

    const r = rows[0] as ReportRow
    if (!r.line_user_id) {
      if (process.env.NODE_ENV !== 'production') {
        console.log(`Report ${reportId} has no LINE user linked, skipping notification`)
      }
      return { skipped: true }
    }

    // แปลงวันที่ไทย (optional)
    let thaiDate = ''
    if (r.incident_date) {
      const d = new Date(r.incident_date)
      thaiDate = `${d.getDate()} ${d.toLocaleDateString('th-TH', { month: 'long' })} ${d.getFullYear() + 543}`
    }

    // สร้าง LINE notification token ใหม่ที่มีอายุ 24 ชั่วโมง
    const lineToken = await createLineNotificationToken(reportId)

    return await sendLineNotification(r.line_user_id, {
      report_id: reportId,
      status,
      download_url: downloadUrl,
      applicant_name: r.applicant_name,
      incident_date: thaiDate,
      incident_time: r.incident_time,
      incident_location: r.incident_location,
      category_name: r.category_name,
      request_details: r.request_details,
      tracking_token: lineToken // ใช้ token ใหม่ที่มี expire time
    })
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`Failed to send notification for report ${reportId}:`, error)
    }
    throw error
  }
}

/**
 * Helper: ส่งแจ้งเตือนไปยังกลุ่มเมื่อมีคำร้องใหม่
 */
export async function sendGroupNotificationForNewReport(reportId: number) {
  try {
    const [rows] = await getPool().execute(
      `SELECT
        CONCAT(r.prefix, r.full_name) AS applicant_name,
        r.incident_date,
        r.incident_time,
        r.incident_location,
        r.request_details,
        c.category_name
       FROM reports r
       LEFT JOIN categories c ON r.category_id = c.category_id
      WHERE r.report_id = ?`,
      [reportId]
    ) as RowDataPacket[][]
    if (rows.length === 0) throw new Error(`Report ${reportId} not found`)

    const r = rows[0] as GroupReportRow

    let thaiDate = ''
    if (r.incident_date) {
      const d = new Date(r.incident_date)
      thaiDate = `${d.getDate()} ${d.toLocaleDateString('th-TH', { month: 'long' })} ${d.getFullYear() + 543}`
    }

    return await sendLineNotificationToGroup({
      report_id: reportId,
      status: 'รอดำเนินการ',
      applicant_name: r.applicant_name,
      incident_date: thaiDate,
      incident_time: r.incident_time,
      incident_location: r.incident_location,
      category_name: r.category_name,
      request_details: r.request_details
    })
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`Failed to send group notification for new report ${reportId}:`, error)
    }
    throw error
  }
}
