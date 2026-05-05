import { NextRequest } from 'next/server'
import { ADMIN_COOKIE_NAME, getVerifiedAdminTokenFromRequest, revokeAdminJti } from '@/lib/auth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const verified = await getVerifiedAdminTokenFromRequest(req)
  if (typeof verified?.payload.jti === 'string') {
    revokeAdminJti(verified.payload.jti, verified.exp)
  }

  const res = Response.json({ success: true })
  res.headers.append(
    'Set-Cookie',
    [
      `${ADMIN_COOKIE_NAME}=`,
      'Path=/',
      'HttpOnly',
      'SameSite=Strict',
      'Max-Age=0',
      process.env.NODE_ENV === 'production' ? 'Secure' : '',
    ]
      .filter(Boolean)
      .join('; ')
  )
  return res
}
