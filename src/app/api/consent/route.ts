// app/api/consent/route.ts
//
// บันทึก PDPA consent log — เก็บหลักฐานว่าผู้ใช้ยินยอม/ไม่ยินยอม Privacy Notice เวอร์ชันใด
// จาก IP / User-Agent ใด เวลาเท่าไหร่ เพื่อใช้พิสูจน์เมื่อมีการตรวจสอบจาก สคส.
//
// เป็น append-only — ไม่มี endpoint สำหรับ UPDATE/DELETE record เก่า

import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import type { ResultSetHeader } from 'mysql2/promise'
import { getPool } from '@/lib/db'
import {
  PDPA_PRIVACY_NOTICE_VERSION,
  PDPA_CONSENT_TYPES,
  type PdpaConsentAction,
  type PdpaSubjectType,
} from '@/lib/pdpa'

interface ConsentBody {
  action?: PdpaConsentAction
  consent_type?: string
  policy_version?: string
  line_user_id_str?: string | null
  report_id?: number | null
  id_or_passport_number?: string | null
  page_path?: string | null
  locale?: string | null
  metadata?: Record<string, unknown> | null
}

const VALID_ACTIONS: ReadonlySet<PdpaConsentAction> = new Set([
  'accepted',
  'rejected',
  'withdrawn',
])

function pickClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return req.headers.get('x-real-ip') || 'unknown'
}

function hashIdNumber(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.replace(/[\s-]/g, '')
  if (!trimmed) return null
  return createHash('sha256').update(trimmed).digest('hex')
}

export async function POST(req: NextRequest) {
  let body: ConsentBody
  try {
    body = (await req.json()) as ConsentBody
  } catch {
    return NextResponse.json({ error: 'INVALID_JSON' }, { status: 400 })
  }

  const action = body.action
  if (!action || !VALID_ACTIONS.has(action)) {
    return NextResponse.json(
      { error: 'INVALID_ACTION', allowed: Array.from(VALID_ACTIONS) },
      { status: 400 },
    )
  }

  const consentType = body.consent_type?.trim() || PDPA_CONSENT_TYPES.PRIVACY_NOTICE
  const policyVersion = body.policy_version?.trim() || PDPA_PRIVACY_NOTICE_VERSION
  const lineUserIdStr = body.line_user_id_str?.trim() || null
  const reportId =
    typeof body.report_id === 'number' && Number.isFinite(body.report_id)
      ? body.report_id
      : null
  const pagePath = body.page_path?.trim() || null
  const locale = body.locale?.trim() || null
  const idHash = hashIdNumber(body.id_or_passport_number)

  const subjectType: PdpaSubjectType = lineUserIdStr ? 'line_user' : 'anonymous'

  const ipAddress = pickClientIp(req)
  const userAgent = req.headers.get('user-agent') || null
  const metadataJson = body.metadata ? JSON.stringify(body.metadata) : null

  try {
    const [result] = await getPool().execute<ResultSetHeader>(
      `INSERT INTO consent_logs (
         consent_type, policy_version, action,
         subject_type, line_user_id_str, report_id,
         id_or_passport_hash, ip_address, user_agent,
         locale, page_path, metadata
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        consentType,
        policyVersion,
        action,
        subjectType,
        lineUserIdStr,
        reportId,
        idHash,
        ipAddress,
        userAgent,
        locale,
        pagePath,
        metadataJson,
      ],
    )

    return NextResponse.json({
      success: true,
      data: {
        consent_id: result.insertId,
        policy_version: policyVersion,
        action,
        recorded_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    // ถ้า table ยังไม่ migrate (ER_NO_SUCH_TABLE) ให้ตอบ 503 แบบชัดเจน
    const code = (error as { code?: string } | null)?.code
    if (code === 'ER_NO_SUCH_TABLE') {
      console.error(
        '[consent] consent_logs table missing — run database/pdpa_consent_logs.sql',
      )
      return NextResponse.json(
        { error: 'CONSENT_LOG_TABLE_MISSING' },
        { status: 503 },
      )
    }
    console.error('[consent] insert failed:', error)
    return NextResponse.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
