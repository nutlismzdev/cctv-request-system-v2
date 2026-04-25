// src/app/admin/layout.tsx
// ✅ Server Component: admin navbar loaded only for admin routes (rendering optimization)
import { AdminNavbar } from '@/components/admin-navbar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AdminNavbar />
      {children}
    </>
  )
}
