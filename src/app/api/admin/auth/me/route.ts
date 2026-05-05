import { NextRequest } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req)
  if (!admin) {
    return Response.json({ success: false, authenticated: false }, { status: 401 })
  }
  return Response.json({
    success: true,
    authenticated: true,
    user: {
      id: 1,
      username: admin.sub,
      role: admin.role,
      name: admin.name,
    },
  })
}
