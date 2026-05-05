import { NextRequest, NextResponse } from 'next/server'
import { getAdminFromRequest } from '@/lib/auth-server'

const PUBLIC_API_PREFIXES = [
  '/api/admin/auth/login',
  '/api/admin/auth/logout',
  '/api/admin/auth/me',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PUBLIC_API_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next()
  }

  const isAdminPage = pathname.startsWith('/admin')
  const isAdminApi = pathname.startsWith('/api/admin')
  const isProtectedAttachment = pathname.startsWith('/uploads/attachments/')

  if (!isAdminPage && !isAdminApi && !isProtectedAttachment) {
    return NextResponse.next()
  }

  const admin = await getAdminFromRequest(req)
  if (admin) {
    return NextResponse.next()
  }

  if (isAdminApi) {
    return Response.json(
      { success: false, message: 'ไม่ได้รับอนุญาต' },
      { status: 401 }
    )
  }

  if (isProtectedAttachment) {
    return new NextResponse('Not found', { status: 404 })
  }

  const loginUrl = req.nextUrl.clone()
  loginUrl.pathname = '/login'
  loginUrl.searchParams.set('next', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*', '/uploads/attachments/:path*'],
}
