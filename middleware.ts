import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Check if the request is for admin routes
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // For API routes, check for Authorization header
    if (request.nextUrl.pathname.startsWith('/admin/') && request.nextUrl.pathname.includes('/api/')) {
      const authHeader = request.headers.get('authorization')

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { success: false, message: 'Unauthorized' },
          { status: 401 }
        )
      }

      // You can add JWT verification here
      // For now, just check if token exists
      const token = authHeader.substring(7) // Remove 'Bearer ' prefix

      if (!token) {
        return NextResponse.json(
          { success: false, message: 'Invalid token' },
          { status: 401 }
        )
      }

      return NextResponse.next()
    }

    // For page routes, redirect to login if no session
    // Note: In client-side rendering, we can't check localStorage here
    // This would need to be handled in the component or use server-side auth
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - uploads (static uploaded files)
     * - public folder
     * - next-intl locale files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|uploads|public|_next-intl).*)',
  ],
}
