'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FileText, Settings, BarChart3, Bell, User, LogOut, Menu, X, Home } from 'lucide-react'
import { logout } from '@/lib/auth'
import { THEME_COLORS } from '@/lib/theme-colors'

type AdminItem = {
  label: string
  href: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  description: string
}

const adminMenuItems: AdminItem[] = [
  { label: 'คำร้องทั้งหมด', href: '/admin/request', icon: FileText, description: 'จัดการคำร้องขอดูภาพ CCTV' },
  { label: 'รายงานสถิติ', href: '/admin/reports', icon: BarChart3, description: 'ดูสถิติและรายงานการใช้งาน' },
  { label: 'ตั้งค่าระบบ', href: '/admin/settings', icon: Settings, description: 'การตั้งค่าระบบทั่วไป' },
]

interface RecentReport {
  report_id: number
  submitted_at: string
  full_name: string
  request_type: string
  incident_location: string
}

export function AdminNavbar() {
  const router = useRouter()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [pendingReports, setPendingReports] = useState(0)
  const [recentReports, setRecentReports] = useState<RecentReport[]>([])
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const pathname = usePathname() || '/'

  const isActive = (href: string) => {
    // ให้ active กับเส้นทางย่อยด้วย เช่น /admin/request/123
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  // Fetch pending reports count and recent reports
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // Add cache busting parameter
        const res = await fetch(`/api/admin/notifications?t=${Date.now()}`)
        const data = await res.json()
        if (data.success) {
          setPendingReports(data.data.pending_reports)
          setRecentReports(data.data.recent_reports || [])
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error)
      }
    }

    // Initial fetch
    fetchNotifications()

    // Poll every 30 seconds for updates (✅ reduced from 10s to avoid excessive requests)
    const interval = setInterval(fetchNotifications, 30000)

    return () => clearInterval(interval)
  }, [])

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <nav className={`sticky top-0 z-50 ${THEME_COLORS.card} border-b ${THEME_COLORS.border}`}>
      <div className="max-w-7xl mx-auto px-4 lg:px-6">
        {/* Top bar */}
        <div className="flex items-center justify-between h-14">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <Link href="/admin" className="flex items-center gap-2" aria-label="ไปหน้าแดชบอร์ดผู้ดูแล">
              <div className={`p-1.5 ${THEME_COLORS.card} ${THEME_COLORS.border} rounded-lg shadow-sm`}>
                <Image
                  src="/logo/1_0.ico"
                  alt="เทศบาลนครหัวหิน"
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </div>
              <div className="leading-tight">
                <div className={`font-semibold ${THEME_COLORS.foreground}`}>เทศบาลนครหัวหิน</div>
                <div className={`text-xs ${THEME_COLORS.mutedForeground} hidden md:block`}>ระบบจัดการคำร้องขอข้อมูลภาพจากกล้อง</div>
              </div>
            </Link>
            <Badge
              variant="outline"
              className={`hidden lg:inline-flex ${THEME_COLORS.border} ${THEME_COLORS.mutedForeground}`}
              aria-hidden="true"
            >
              Admin
            </Badge>
          </div>

          {/* Desktop menu */}
          <div className="hidden lg:flex items-center gap-1">
            {adminMenuItems.map(({ href, label, icon: Icon }) => {
              const active = isActive(href)
              return (
                <Link key={href} href={href} aria-current={active ? 'page' : undefined}>
                  <Button
                    variant={active ? 'default' : 'ghost'}
                    size="sm"
                    className={`h-9 px-3 font-medium ${
                      active
                        ? `${THEME_COLORS.primary} ${THEME_COLORS.primaryHover} ${THEME_COLORS.primaryForeground}`
                        : `${THEME_COLORS.mutedForeground} hover:${THEME_COLORS.foreground} hover:bg-[var(--accent)]/20`
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {label}
                  </Button>
                </Link>
              )
            })}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1">
            {/* Notifications */}
            <DropdownMenu open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`relative h-9 w-9 p-0 ${THEME_COLORS.mutedForeground} hover:${THEME_COLORS.foreground} hover:bg-[var(--accent)]/20`}
                  aria-label="การแจ้งเตือนคำร้องใหม่"
                >
                  <Bell className="h-4 w-4" />
                  {pendingReports > 0 && (
                    <span
                      className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full ${THEME_COLORS.destructive} ${THEME_COLORS.destructiveForeground} text-[11px] leading-[18px] text-center`}
                      aria-label={`มีคำร้องรอดำเนินการ ${pendingReports} รายการ`}
                    >
                      {pendingReports > 99 ? '99+' : pendingReports}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <div className="px-4 py-2 border-b">
                  <h3 className="font-semibold text-sm">คำร้องใหม่</h3>
                  <p className="text-xs text-muted-foreground">
                    มีคำร้องรอดำเนินการ {pendingReports} รายการ
                  </p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {recentReports.length > 0 ? (
                    recentReports.slice(0, 5).map((report) => (
                      <DropdownMenuItem
                        key={report.report_id}
                        className="px-4 py-3 cursor-pointer"
                        onClick={() => {
                          window.location.href = `/admin/request/${report.report_id}/edit`
                          setIsNotificationsOpen(false)
                        }}
                      >
                        <div className="flex flex-col gap-1 w-full">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">#{report.report_id}</span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(report.submitted_at).toLocaleDateString('th-TH')}
                            </span>
                          </div>
                          <div className="text-sm">{report.full_name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {report.request_type} • {report.incident_location}
                          </div>
                        </div>
                      </DropdownMenuItem>
                    ))
                  ) : (
                    <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                      ไม่มีคำร้องใหม่
                    </div>
                  )}
                </div>
                {pendingReports > 5 && (
                  <div className="px-4 py-2 border-t">
                    <p className="text-xs text-muted-foreground text-center">
                      และอีก {pendingReports - 5} รายการ...
                    </p>
                  </div>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="px-4 py-2 cursor-pointer justify-center"
                  onClick={() => {
                    window.location.href = '/admin/request'
                    setIsNotificationsOpen(false)
                  }}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  ดูคำร้องทั้งหมด
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`h-9 px-2 ${THEME_COLORS.mutedForeground} hover:${THEME_COLORS.foreground} hover:bg-[var(--accent)]/20`}
                  aria-label="เมนูผู้ใช้"
                >
                  <div className={`h-7 w-7 ${THEME_COLORS.muted} ${THEME_COLORS.border} rounded-full flex items-center justify-center`}>
                    <User className={`h-4 w-4 ${THEME_COLORS.mutedForeground}`} />
                  </div>
                  <span className="hidden md:block ml-2">Admin</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem>
                  <User className="h-4 w-4 mr-2" />
                  โปรไฟล์
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="h-4 w-4 mr-2" />
                  ตั้งค่าบัญชี
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/">
                    <Home className="h-4 w-4 mr-2" />
                    กลับหน้าหลัก
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={`${THEME_COLORS.destructiveForeground} cursor-pointer`}
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  ออกจากระบบ
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile toggle */}
            <Button
              variant="ghost"
              size="sm"
              className={`lg:hidden h-9 w-9 p-0 ${THEME_COLORS.mutedForeground} hover:${THEME_COLORS.foreground} hover:bg-[var(--accent)]/20`}
              onClick={() => setIsMenuOpen((v) => !v)}
              aria-label="สลับเมนู"
              aria-expanded={isMenuOpen}
              aria-controls="admin-mobile-menu"
            >
              {isMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div id="admin-mobile-menu" className={`lg:hidden border-t ${THEME_COLORS.border} py-2`}>
            <div className="space-y-1">
              {adminMenuItems.map(({ href, label, description, icon: Icon }) => {
                const active = isActive(href)
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setIsMenuOpen(false)}
                    aria-current={active ? 'page' : undefined}
                  >
                    <div
                      className={`flex items-start gap-3 px-3 py-2 rounded-md ${
                        active ? `${THEME_COLORS.muted} ${THEME_COLORS.border}` : 'hover:bg-[var(--accent)]/10'
                      }`}
                    >
                      <Icon className={`h-4 w-4 mt-0.5 ${THEME_COLORS.mutedForeground}`} />
                      <div>
                        <div className={`font-medium ${THEME_COLORS.foreground}`}>{label}</div>
                        <div className={`text-xs ${THEME_COLORS.mutedForeground}`}>{description}</div>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
