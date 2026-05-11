'use client'

import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'

// Dynamic import เพื่อไม่ดึง footer bundle เข้าหน้าที่ไม่ใช้
const SiteFooter = dynamic(
  () => import('./site-footer').then((m) => ({ default: m.SiteFooter })),
)

// หน้าที่ "ไม่" แสดง footer:
//  - admin/*       — มี layout ของตัวเอง
//  - login         — full-screen layout
//  - liff*         — เปิดใน LINE in-app browser, footer รบกวนพื้นที่กล้อง/QR
//  - success-onsite, link-success-onsite, link-error-onsite — landing แบบ standalone ใน LIFF flow
const HIDE_PATTERNS: ReadonlyArray<RegExp> = [
  /^\/admin(?:\/|$)/,
  /^\/login(?:\/|$)/,
  /^\/liff(?:\/|-onsite)?(?:\/|$)/,
  /^\/success(?:-onsite)?(?:\/|$)/,
  /^\/link-(?:success|error)(?:-onsite)?(?:\/|$)/,
]

export function ConditionalFooter() {
  const pathname = usePathname() ?? '/'
  if (HIDE_PATTERNS.some((re) => re.test(pathname))) return null
  return <SiteFooter />
}
