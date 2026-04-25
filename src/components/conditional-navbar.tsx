'use client'

import { usePathname } from 'next/navigation'
import dynamic from 'next/dynamic'

// ✅ Dynamic import so only the relevant navbar is loaded (bundle-dynamic-imports)
const Navbar = dynamic(() => import('./navbar').then(m => ({ default: m.Navbar })))

export function ConditionalNavbar() {
  const pathname = usePathname() ?? '/'
  const isAdmin = /^\/admin(?:\/|$)/.test(pathname)

  // Admin routes now use admin/layout.tsx, so skip navbar here to avoid duplication
  if (isAdmin) return null

  return <Navbar />
}
