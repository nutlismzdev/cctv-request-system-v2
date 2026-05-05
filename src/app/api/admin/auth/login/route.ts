import { NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { ADMIN_COOKIE_NAME, ADMIN_SESSION_TTL_SECONDS, signAdminToken } from '@/lib/auth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const loginSchema = z.object({
  password: z.string().min(1).max(256),
})

const FIXED_BCRYPT_ROUNDS = 10
const TIMING_DUMMY_HASH = '$2a$10$abcdefghijklmnopqrstuvCsPpZ1234567890abcdefghijklmno12'

async function verifyPassword(input: string): Promise<boolean> {
  const stored = process.env.ADMIN_PASSWORD || ''
  if (!stored) {
    await bcrypt.compare(input, TIMING_DUMMY_HASH)
    return false
  }
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    return bcrypt.compare(input, stored)
  }
  // Fallback: ADMIN_PASSWORD set in plaintext. Compare via constant-time hash to avoid leaking length.
  const hash = await bcrypt.hash(stored, FIXED_BCRYPT_ROUNDS)
  return bcrypt.compare(input, hash)
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ success: false, message: 'รูปแบบคำขอไม่ถูกต้อง' }, { status: 400 })
  }

  const parsed = loginSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ success: false, message: 'รูปแบบคำขอไม่ถูกต้อง' }, { status: 400 })
  }

  const ok = await verifyPassword(parsed.data.password)
  if (!ok) {
    return Response.json({ success: false, message: 'รหัสผ่านไม่ถูกต้อง' }, { status: 401 })
  }

  const token = await signAdminToken({
    sub: 'admin',
    role: 'administrator',
    name: 'ผู้ดูแลระบบ',
  })

  const res = Response.json({
    success: true,
    user: { id: 1, username: 'admin', role: 'administrator', name: 'ผู้ดูแลระบบ' },
  })
  res.headers.append(
    'Set-Cookie',
    [
      `${ADMIN_COOKIE_NAME}=${token}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
      `Max-Age=${ADMIN_SESSION_TTL_SECONDS}`,
      process.env.NODE_ENV === 'production' ? 'Secure' : '',
    ]
      .filter(Boolean)
      .join('; ')
  )
  return res
}
