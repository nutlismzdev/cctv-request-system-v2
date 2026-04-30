// app/api/line/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import fs from 'fs'
import os from 'os'
import path from 'path'
import type { RowDataPacket } from 'mysql2/promise'
import { getPool } from '@/lib/db'            // ไม่ต้องใช้ postback แล้ว จึงไม่ต้อง import secureLinkReportByCode

export const runtime = 'nodejs'

const SECRET = process.env.LINE_CHANNEL_SECRET!
const ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:4000'

/* ===== Minimal LINE webhook types ===== */
interface LineSource { userId?: string }
interface LineMessage { type?: string; text?: string }
interface LineEvent {
  type: string
  replyToken?: string
  source?: LineSource
  message?: LineMessage
}
interface LineWebhookBody { events?: LineEvent[] }
/* ===================================== */

/* ===== Thai Date Utilities ===== */
const THAI_MONTHS_FULL = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'
] as const

/** yyyy-mm-dd | Date | string → "D เดือนไทย YYYY+543" (พ.ศ.) */
function toThaiDateStringThaiFull(v: unknown): string {
  if (!v) return ''
  if (typeof v === 'string') {
    const m = v.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) {
      const yBE = parseInt(m[1], 10) + 543
      const moIdx = Math.max(0, Math.min(11, parseInt(m[2], 10) - 1))
      const d = String(parseInt(m[3], 10))
      return `${d} ${THAI_MONTHS_FULL[moIdx]} ${yBE}`
    }
    const dObj = new Date(v)
    if (!isNaN(dObj.getTime())) {
      const yBE = dObj.getFullYear() + 543
      const moIdx = dObj.getMonth()
      const d = String(dObj.getDate())
      return `${d} ${THAI_MONTHS_FULL[moIdx]} ${yBE}`
    }
    return v
  }
  if (v instanceof Date) {
    const yBE = v.getFullYear() + 543
    const moIdx = v.getMonth()
    const d = String(v.getDate())
    return `${d} ${THAI_MONTHS_FULL[moIdx]} ${yBE}`
  }
  return String(v)
}
/* ===================================== */

/* ============================ Logging ============================ */
const LOG_DIR = process.env.LOG_DIR || path.join(os.tmpdir(), 'cctv-logs')
const LOG_FILE = path.join(LOG_DIR, 'line-webhook.log')
function ensureLogDir() { try { fs.mkdirSync(LOG_DIR, { recursive: true }) } catch {} }
function logLine(message: unknown) {
  if (process.env.NODE_ENV === 'production') {
    console.log('[LINE-WEBHOOK]', typeof message === 'string' ? message : JSON.stringify(message))
  } else {
    const line = `[${new Date().toISOString()}] ` + (typeof message === 'string' ? message : JSON.stringify(message)) + '\n'
    console.log('[LINE-WEBHOOK]', message)
    try { ensureLogDir(); fs.appendFileSync(LOG_FILE, line) } catch {}
  }
}
/* ================================================================ */

/* ========================= Utilities ============================ */
function truncate(s: string, max: number) {
  if (s == null) return ''
  const t = String(s)
  return t.length > max ? t.slice(0, max - 1) + '…' : t
}
function normText(s: string) {
  return s.normalize('NFKC').replace(/\u200B/g, '').trim()
}
function tokenize(s: string, limit = 3) {
  return normText(s)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, limit)
}
/* ================================================================ */

/* ========================= LINE Reply =========================== */
async function reply(replyToken: string, messages: Array<{ type: string; [k: string]: unknown }>) {
  try {
    const res = await fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ACCESS_TOKEN}`
      },
      body: JSON.stringify({ replyToken, messages })
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '<no body>')
      logLine(`Reply API failed: ${res.status} ${res.statusText} — ${text}`)
    } else if (process.env.NODE_ENV !== 'production') {
      logLine(`Reply API ok: ${res.status}`)
    }
  } catch (e) {
    logLine(`Failed to send reply: ${String(e)}`)
  }
}
/* ================================================================ */

/* ============= สร้าง & ส่ง Flex สำหรับชุดรายงานที่กำหนด ============= */
type ReportRow = {
  report_id: number
  link_code: string
  full_name?: string | null
  incident_location?: string | null
  submitted_at?: string | null
  category_name?: string | null
}

/** ปุ่มเดียว: เชื่อมผ่านลิงก์ (ให้หน้าเว็บแสดงผลสำเร็จ/ไม่สำเร็จ) */
function buildFlexFromReports(reports: ReportRow[], userId: string) {
  const bubbles = reports.map((r) => {
    const title = truncate(`คำร้อง #${r.report_id}`, 40)
    const lines: string[] = []
    if (r.full_name) lines.push(`👤 ชื่อ-นามสกุล ${r.full_name}`)
    if (r.incident_location) lines.push(`📍สถานที่่เกิดเหตุ ${r.incident_location}`)
    if (r.submitted_at) lines.push(`📅 วันที่ยื่น ${toThaiDateStringThaiFull(r.submitted_at)}`)
    if (r.category_name) lines.push(`📂 ประเภทเหตุการณ์ ${r.category_name}`)

    const encodedCode = encodeURIComponent(r.link_code)
    const linkUrl = `${BASE_URL}/api/line/link-via-url?c=${encodedCode}&r=${r.report_id}&u=${encodeURIComponent(userId)}`

    return {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          { type: 'text', text: title, weight: 'bold', size: 'lg', wrap: true },
          ...lines.map(text => ({ type: 'text', text: truncate(text, 120), size: 'sm', wrap: true }))
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            action: {
              type: 'uri',
              label: 'เชื่อมคำร้องนี้',
              uri: linkUrl
            }
          }
        ]
      }
    }
  })

  const flex =
    bubbles.length === 1
      ? { type: 'flex', altText: 'เชื่อมต่อคำร้อง', contents: bubbles[0] }
      : { type: 'flex', altText: 'เชื่อมต่อคำร้องหลายรายการ', contents: { type: 'carousel', contents: bubbles } }

  return flex
}

async function sendFlexForReports(userId: string, replyToken: string, reports: ReportRow[]): Promise<boolean> {
  if (!reports || reports.length === 0) return false
  await reply(replyToken, [buildFlexFromReports(reports, userId)])
  if (process.env.NODE_ENV !== 'production') {
    await getPool().execute(
      `INSERT INTO activity_logs (
        activity_type, entity_type, entity_id,
        actor_type, actor_id, action, description, metadata, ip_address
      ) VALUES ('admin_action','system',0,'system',?,'AUTO_LINK_CHOICES_SENT','ส่ง Flex ปุ่มเชื่อมลิงก์',NULL,'webhook')`,
      [userId]
    )
  }
  return true
}
/* ================================================================ */

/* ====== เงื่อนไข “พร้อมให้ผูก” (STRICT) ====== */
const ELIGIBLE = `
  r.line_user_id IS NULL
  AND r.link_code IS NOT NULL
  AND r.link_code_used = 0
  AND (r.link_code_expires_at IS NULL OR r.link_code_expires_at > NOW())
  AND r.status = 'รอดำเนินการ'
` as const

/* === ดีบั๊ก: ถ้าหาเจอข้อความแต่ไม่เข้าเงื่อนไข จะ log ให้ === */
async function debugWhyNotEligible(reportIds: number[]) {
  if (process.env.NODE_ENV === 'production' || reportIds.length === 0) return
  const [rows] = await getPool().execute(
    `SELECT report_id, incident_location, link_code, link_code_used, line_user_id, link_code_expires_at, status, submitted_at
       FROM reports
      WHERE report_id IN (${reportIds.map(()=>'?').join(',')})
      ORDER BY report_id DESC
      LIMIT 10`,
    reportIds
  ) as RowDataPacket[][]
  logLine({ debug_not_eligible: rows })
}

/* =============== ค้นหารายงานตามข้อความผู้ใช้ (ยืดหยุ่น + fallback) ============== */
async function findReportsByUserText(qRaw: string): Promise<ReportRow[]> {
  const q = normText(qRaw)
  if (!q) return []

  const isNumeric = /^\d+$/.test(q)

  // A) ตัวเลข → report_id ตรงเป๊ะ (STRICT)
  if (isNumeric) {
    const [rows] = (await getPool().execute(
      `
      SELECT r.report_id, r.link_code, r.full_name, r.incident_location, r.submitted_at, c.category_name
        FROM reports r
        LEFT JOIN categories c ON r.category_id = c.category_id
       WHERE r.report_id = ?
         AND ${ELIGIBLE}
       LIMIT 1
      `,
      [Number(q)]
    )) as RowDataPacket[][]
    if (rows.length > 0) return rows as unknown as ReportRow[]
  }

  // B) ตัวเลข → incident_location LIKE %ตัวเลข% (STRICT)
  if (isNumeric) {
    const [rows] = (await getPool().execute(
      `
      SELECT r.report_id, r.link_code, r.full_name, r.incident_location, r.submitted_at, c.category_name
        FROM reports r
        LEFT JOIN categories c ON r.category_id = c.category_id
       WHERE ${ELIGIBLE}
         AND r.incident_location LIKE ?
       ORDER BY r.submitted_at DESC
       LIMIT 5
      `,
      [`%${q}%`]
    )) as RowDataPacket[][]
    if (rows.length > 0) return rows as unknown as ReportRow[]
  }

  // C) ข้อความทั่วไป → AND LIKE (STRICT)
  const tokens = tokenize(q, 3)
  if (tokens.length > 0) {
    const andConds = tokens.map(() => `r.incident_location LIKE ?`).join(' AND ')
    const andParams = tokens.map(t => `%${t}%`)
    const [rowsAnd] = (await getPool().execute(
      `
      SELECT r.report_id, r.link_code, r.full_name, r.incident_location, r.submitted_at, c.category_name
        FROM reports r
        LEFT JOIN categories c ON r.category_id = c.category_id
       WHERE ${ELIGIBLE}
         AND ${andConds}
       ORDER BY r.submitted_at DESC
       LIMIT 5
      `,
      andParams
    )) as RowDataPacket[][]
    if (rowsAnd.length > 0) return rowsAnd as unknown as ReportRow[]

    // D) OR LIKE (STRICT)
    const orConds = tokens.map(() => `r.incident_location LIKE ?`).join(' OR ')
    const orParams = tokens.map(t => `%${t}%`)
    const [rowsOr] = (await getPool().execute(
      `
      SELECT r.report_id, r.link_code, r.full_name, r.incident_location, r.submitted_at, c.category_name
        FROM reports r
        LEFT JOIN categories c ON r.category_id = c.category_id
       WHERE ${ELIGIBLE}
         AND (${orConds})
       ORDER BY r.submitted_at DESC
       LIMIT 5
      `,
      orParams
    )) as RowDataPacket[][]
    if (rowsOr.length > 0) return rowsOr as unknown as ReportRow[]
  }

  // E) ยังไม่เจอ (STRICT = 0) → คลายเงื่อนไขเพื่อหาตัวผู้ต้องสงสัย แล้ว log สาเหตุ
  const [suspects] = (await getPool().execute(
    `
    SELECT r.report_id
      FROM reports r
     WHERE r.incident_location LIKE ?
     ORDER BY r.submitted_at DESC
     LIMIT 5
    `,
    [`%${q}%`]
  )) as RowDataPacket[][]
  if (suspects.length > 0) {
    await debugWhyNotEligible(suspects.map((s: RowDataPacket) => Number(s.report_id)))
  }

  return []
}
/* ================================================================ */

/* ===================== LINE user upsert ========================= */
async function upsertLineUser(lineUserId: string, displayName?: string, pictureUrl?: string, statusMessage?: string) {
  try {
    await getPool().execute(
      `
      INSERT INTO line_users (line_user_id_str, display_name, picture_url, status_message, is_friend, friend_added_at, last_active_at)
      VALUES (?, ?, ?, ?, true, NOW(), NOW())
      ON DUPLICATE KEY UPDATE
        display_name = COALESCE(VALUES(display_name), display_name),
        picture_url = COALESCE(VALUES(picture_url), picture_url),
        status_message = COALESCE(VALUES(status_message), status_message),
        is_friend = VALUES(is_friend),
        last_active_at = VALUES(last_active_at),
        updated_at = NOW()
      `,
      [lineUserId, displayName || null, pictureUrl || null, statusMessage || null]
    )
    if (process.env.NODE_ENV !== 'production') logLine(`LINE user upserted: ${lineUserId}`)
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') logLine(`Error upserting LINE user ${lineUserId}: ${String(error)}`)
  }
}
/* ================================================================ */

/* ================= Signature verification ====================== */
function verifySignature(raw: string, sig?: string | null) {
  if (process.env.NODE_ENV !== 'production') {
    logLine(`=== Signature Verification ===`)
    logLine(`Raw body length: ${raw.length}`)
    logLine(`Has signature: ${!!sig}`)
    logLine(`Has secret: ${!!SECRET}`)
  }
  if (!sig || !SECRET) {
    if (process.env.NODE_ENV !== 'production') logLine(`Signature verification failed: missing sig or secret`)
    return false
  }
  try {
    const expected = crypto.createHmac('sha256', SECRET).update(raw, 'utf8').digest('base64')
    const isValid = crypto.timingSafeEqual(Buffer.from(expected, 'base64'), Buffer.from(sig, 'base64'))
    if (process.env.NODE_ENV !== 'production') {
      logLine(`Signature valid: ${isValid}`)
      if (!isValid) logLine(`Signature mismatch!`)
    }
    return isValid
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') logLine(`Signature verification error: ${String(error)}`)
    return false
  }
}
/* ================================================================ */

/* =============================== POST ========================== */
export async function POST(req: NextRequest) {
  try {
    const raw = await req.text()
    const sig = req.headers.get('x-line-signature')

    if (process.env.NODE_ENV !== 'production') {
      logLine(`Raw body length: ${raw.length}`)
    }

    if (!raw || raw.length === 0) {
      logLine(`Empty body received!`)
      return NextResponse.json({ ok: true, message: 'Empty body received' })
    }
    if (!verifySignature(raw, sig)) {
      if (process.env.NODE_ENV !== 'production') logLine(`Signature verification failed`)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    let parsed: LineWebhookBody
    try { parsed = JSON.parse(raw) as LineWebhookBody }
    catch (e) { if (process.env.NODE_ENV !== 'production') logLine(`JSON parse error: ${String(e)}`); return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

    if (process.env.NODE_ENV !== 'production') logLine({ received: parsed })

    for (const ev of parsed.events ?? []) {
      const userId: string | undefined = ev?.source?.userId
      if (process.env.NODE_ENV !== 'production') logLine({ type: ev.type, userId })

      if (userId) await upsertLineUser(userId)

      // ===== TEXT MESSAGE: ค้นหาเสมอ; ส่งเฉพาะเมื่อ “พร้อมผูก” =====
      if (ev.type === 'message' && ev.message?.type === 'text') {
        const messageText: string = normText(ev.message.text || '')
        const reports = await findReportsByUserText(messageText)
        if (process.env.NODE_ENV !== 'production') logLine(`Search "${messageText}" -> ${reports.length} candidate(s)`)
        if (reports.length > 0 && userId && ev.replyToken) {
          const sent = await sendFlexForReports(userId, ev.replyToken, reports)
          if (sent) {
            await getPool().execute(
              'UPDATE line_users SET last_link_prompt_at = NOW() WHERE line_user_id_str = ?',
              [userId]
            )
          }
        }
        continue
      }

      // ไม่มี postback handler แล้ว เพราะเราใช้ปุ่มลิงก์เพียงอย่างเดียว
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') logLine(`Webhook processing error: ${String(error)}`)
    return NextResponse.json({ status: 'error logged' }, { status: 200 })
  }
}

/* =============================== GET =========================== */
export async function GET() {
  return NextResponse.json({
    status: 'LINE Webhook is active',
    timestamp: new Date().toISOString(),
    channel_secret_configured: !!process.env.LINE_CHANNEL_SECRET,
    access_token_configured: !!process.env.LINE_CHANNEL_ACCESS_TOKEN
  })
}
