import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const LOG_DIR = path.join(process.cwd(), 'logs')
const LOG_FILE = path.join(LOG_DIR, 'liff-debug.log')
const MAX_BODY_SIZE = 64 * 1024

export async function POST(req: NextRequest) {
  try {
    const text = await req.text()
    if (text.length > MAX_BODY_SIZE) {
      return NextResponse.json({ ok: false, error: 'payload too large' }, { status: 413 })
    }

    let payload: unknown
    try {
      payload = JSON.parse(text)
    } catch {
      payload = { raw: text }
    }

    const ua = req.headers.get('user-agent') || ''
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      ''
    const ts = new Date().toISOString()
    const line =
      JSON.stringify({ ts, ip, ua, payload }, (_k, v) =>
        typeof v === 'string' && v.length > 2000 ? v.slice(0, 2000) + '…[truncated]' : v
      ) + '\n'

    await fs.mkdir(LOG_DIR, { recursive: true })
    await fs.appendFile(LOG_FILE, line, 'utf8')
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[liff-log] write failed:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }
}
