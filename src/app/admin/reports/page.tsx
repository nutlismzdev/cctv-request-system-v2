'use client'

import React, { useState, useEffect, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  BarChart3,
  TrendingUp,
  FileText,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Printer,
  Download,
  Info
} from 'lucide-react'
// ✅ Dynamic import recharts to avoid loading ~300KB in initial bundle (bundle-dynamic-imports)
const ResponsiveContainer = dynamic(
  () => import('recharts').then(m => {
    // Re-export as default for dynamic()
    const C = m.ResponsiveContainer
    return { default: C }
  }),
  { ssr: false }
)
const PieChart = dynamic(() => import('recharts').then(m => ({ default: m.PieChart })), { ssr: false })
const Pie = dynamic(() => import('recharts').then(m => ({ default: m.Pie })), { ssr: false })
const Cell = dynamic(() => import('recharts').then(m => ({ default: m.Cell })), { ssr: false })
const AreaChart = dynamic(() => import('recharts').then(m => ({ default: m.AreaChart })), { ssr: false })
const CartesianGrid = dynamic(() => import('recharts').then(m => ({ default: m.CartesianGrid })), { ssr: false })
const XAxis = dynamic(() => import('recharts').then(m => ({ default: m.XAxis })), { ssr: false })
const YAxis = dynamic(() => import('recharts').then(m => ({ default: m.YAxis })), { ssr: false })
const Area = dynamic(() => import('recharts').then(m => ({ default: m.Area })), { ssr: false })
const BarChart = dynamic(() => import('recharts').then(m => ({ default: m.BarChart })), { ssr: false })
const Bar = dynamic(() => import('recharts').then(m => ({ default: m.Bar })), { ssr: false })
const ReTooltip = dynamic(() => import('recharts').then(m => ({ default: m.Tooltip })), { ssr: false })

import { isAuthenticated } from '@/lib/auth'

/* =============================================================================
 * Types
 * ========================================================================== */
interface StatisticsData {
  total_reports: number
  status_breakdown: { status: string; count: number; percentage: number }[]
  request_type_breakdown: { type: string; count: number; percentage: number }[]
  monthly_trend: { month: string; year: number; count: number }[]
  category_breakdown: { category_name: string; count: number; percentage: number }[]
  recent_activity: { date: string; reports_created: number; reports_completed: number }[]
  top_locations: { location: string; count: number }[]
  processing_time_avg: number | null
  /** เฉลี่ยเวลาจาก "รอเอกสารอนุมัติ" -> "เอกสารอนุมัติเรียบร้อย" (นาที) */
  processing_time_doc_avg_minutes?: number | null
}

/* =============================================================================
 * Utilities (ไทย)
 * ========================================================================== */
const formatThaiNumber = (n: number) => n.toLocaleString('th-TH')
const monthLabel = (m: string, y: number) => `${m} ${y}`

function formatDurationThaiFromMinutes(mins: number) {
  if (!Number.isFinite(mins) || mins < 0) return '—'
  const m = Math.round(mins)
  const days = Math.floor(m / 1440)
  const hours = Math.floor((m % 1440) / 60)
  const minutes = m % 60
  const parts: string[] = []
  if (days) parts.push(`${formatThaiNumber(days)} วัน`)
  if (hours) parts.push(`${formatThaiNumber(hours)} ชม.`)
  if (minutes || parts.length === 0) parts.push(`${formatThaiNumber(minutes)} นาที`)
  return parts.join(' ')
}

/* =============================================================================
 * สี/ธีมสำหรับงานราชการ (อ่านง่าย/รองรับ CVD)
 * ========================================================================== */
const COLORS = {
  primary: '#1e40af',      // น้ำเงินเข้ม (blue-800)
  accent: '#3b82f6',       // น้ำเงินกลาง (blue-500)
  success: '#059669',      // เขียวเข้ม (emerald-600)
  warning: '#d97706',      // เหลืองน้ำตาล (amber-600)
  danger:  '#dc2626',      // แดง (red-600)
  purple:  '#7c3aed',      // ม่วงเข้ม (violet-600)
  orange:  '#ea580c',      // ส้มเข้ม (orange-600)
  grid:    '#e5e7eb',      // เทา (gray-200)
}

const STATUS_COLOR_MAP: Record<string, string> = {
  'เอกสารอนุมัติเรียบร้อย': COLORS.success,
  'รอเอกสารอนุมัติ': COLORS.primary,
  'รอยื่นเอกสาร': COLORS.purple,
  'ปฏิเสธคำร้อง': COLORS.danger,
}

/* สีสำหรับกราฟ bar แสดงความสำคัญตามลำดับ (Top 10) */
const LOCATION_BAR_COLORS = [
  '#ea580c', // ส้มเข้ม (อันดับ 1 - สำคัญที่สุด)
  '#fb923c', // ส้มกลาง (อันดับ 2)
  '#fdba74', // ส้มอ่อน (อันดับ 3)
  '#fed7aa', // ส้มจาง (อันดับ 4)
  '#7c3aed', // ม่วงเข้ม (อันดับ 5)
  '#8b5cf6', // ม่วงกลาง (อันดับ 6)
  '#a78bfa', // ม่วงอ่อน (อันดับ 7)
  '#c4b5fd', // ม่วงจาง (อันดับ 8)
  '#059669', // เขียวเข้ม (อันดับ 9)
  '#10b981'  // เขียวกลาง (อันดับ 10)
]

/* =============================================================================
 * Small Building Blocks
 * ========================================================================== */
function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  tone = 'primary',
}: {
  title: string
  value: string | number
  description?: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  trend?: { value: number; label: string }
  tone?: 'primary' | 'success' | 'warning' | 'danger'
}) {
  const toneClass =
    tone === 'success'
      ? 'text-green-700'
      : tone === 'warning'
      ? 'text-amber-700'
      : tone === 'danger'
      ? 'text-red-700'
      : 'text-[var(--primary)]'

  const numberClass =
    tone === 'success'
      ? 'text-green-800'
      : tone === 'warning'
      ? 'text-amber-800'
      : tone === 'danger'
      ? 'text-red-800'
      : 'text-blue-900'

  return (
    <Card className="relative overflow-hidden print:border print:shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-[13px] md:text-sm font-medium text-[var(--muted-foreground)]">
          {title}
        </CardTitle>
        <Icon aria-hidden className={`h-4 w-4 ${toneClass}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-3xl md:text-[28px] font-bold tracking-tight ${numberClass}`}>
          {typeof value === 'number' ? formatThaiNumber(value) : value}
        </div>
        {description && (
          <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{description}</p>
        )}
        {trend && (
          <div
            className={`flex items-center text-xs mt-1 ${
              trend.value > 0 ? 'text-green-700' : trend.value < 0 ? 'text-red-700' : 'text-[var(--muted-foreground)]'
            }`}
            aria-live="polite"
          >
            <TrendingUp className={`h-3 w-3 mr-1 ${trend.value < 0 ? 'rotate-180' : ''}`} />
            {trend.value > 0 ? '+' : ''}
            {formatThaiNumber(trend.value)}% {trend.label}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/* =============================================================================
 * Main Page
 * ========================================================================== */
/* =============================================================================
 * Thai months (for PDF export selector)
 * ========================================================================== */
const THAI_MONTHS_SELECT = [
  { value: '1', label: 'มกราคม' },
  { value: '2', label: 'กุมภาพันธ์' },
  { value: '3', label: 'มีนาคม' },
  { value: '4', label: 'เมษายน' },
  { value: '5', label: 'พฤษภาคม' },
  { value: '6', label: 'มิถุนายน' },
  { value: '7', label: 'กรกฎาคม' },
  { value: '8', label: 'สิงหาคม' },
  { value: '9', label: 'กันยายน' },
  { value: '10', label: 'ตุลาคม' },
  { value: '11', label: 'พฤศจิกายน' },
  { value: '12', label: 'ธันวาคม' },
] as const

function getDefaultPdfMonth() {
  return String(new Date().getMonth() + 1)
}

function getDefaultPdfYear() {
  return String(new Date().getFullYear() + 543)
}

function getPdfYearOptions() {
  const currentYearBE = new Date().getFullYear() + 543
  return Array.from({ length: 4 }, (_, i) => {
    const yr = currentYearBE - i
    return { value: String(yr), label: `พ.ศ. ${formatThaiNumber(yr)}` }
  })
}

export default function AdminReportsPage() {
  const router = useRouter()
  const [statistics, setStatistics] = useState<StatisticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const [timeRange, setTimeRange] = useState('30')
  const [pdfMonth, setPdfMonth] = useState(getDefaultPdfMonth)
  const [pdfYear, setPdfYear] = useState(getDefaultPdfYear)

  // ตรวจสิทธิ์เข้าใช้งาน (ให้ประสบการณ์ลื่นไหล)
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
    setAuthChecked(true)
  }, [router])

  // ดึงข้อมูลสถิติ
  const fetchStatistics = async (days: string = '30') => {
    if (!authChecked) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/reports?days=${days}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Bad response')
      const data = await res.json()
      if (data?.success) setStatistics(data.data as StatisticsData)
      else toast.error(data?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ')
    } catch {
      toast.error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authChecked) fetchStatistics(timeRange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, timeRange])

  // อนุมานค่าเพื่อแสดงผล
  const sparkline = (statistics?.monthly_trend || []).map((m) => m.count)
  const latest = sparkline.at(-1) ?? 0
  const prev = sparkline.at(-2) ?? 0
  const deltaPct = prev === 0 ? (latest > 0 ? 100 : 0) : Math.round(((latest - prev) / prev) * 100)

  // สร้าง CSV (สำหรับผู้บริหารดาวน์โหลด/แนบอีเมล)
  const csvBlobUrl = useMemo(() => {
    if (!statistics) return null
    const lines: string[] = []
    lines.push('หัวข้อ,ค่า')
    lines.push(`จำนวนคำร้องทั้งหมด,${statistics.total_reports}`)
    const done = statistics.status_breakdown.find(s => s.status === 'เอกสารอนุมัติเรียบร้อย')?.count || 0
    const pendingDocs = statistics.status_breakdown.find(s => s.status === 'รอยื่นเอกสาร')?.count || 0
    const pending = statistics.status_breakdown.find(s => s.status === 'รอเอกสารอนุมัติ')?.count || 0
    const denied = statistics.status_breakdown.find(s => s.status === 'ปฏิเสธคำร้อง')?.count || 0
    lines.push(`คำร้องที่แล้วเสร็จ,${done}`)
    lines.push(`คำร้องที่รอยื่นเอกสาร,${pendingDocs}`)
    lines.push(`คำร้องที่อยู่ระหว่างดำเนินการ,${pending}`)
    lines.push(`คำร้องที่ถูกปฏิเสธ,${denied}`)
    if (typeof statistics.processing_time_avg === 'number') {
      lines.push(`เวลาเฉลี่ยตั้งแต่ยื่นถึงอนุมัติ(วัน),${statistics.processing_time_avg}`)
    }
    if (typeof statistics.processing_time_doc_avg_minutes === 'number') {
      lines.push(`เวลาเฉลี่ยช่วงรอเอกสาร→อนุมัติ(นาที),${statistics.processing_time_doc_avg_minutes}`)
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    return URL.createObjectURL(blob)
  }, [statistics])

  const handlePrint = () => {
    window.print()
  }

  // ---------- Loading: ตรวจสิทธิ์ ----------
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center" aria-live="polite">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
          <p className="text-[var(--muted-foreground)]">กำลังตรวจสอบสิทธิ์...</p>
        </div>
      </div>
    )
  }

  // ---------- Page ----------
  return (
    <div className="min-h-screen bg-[var(--background)] text-[15px] md:text-base leading-relaxed print:bg-white">
      {/* แถบหัวรายงาน (ราชการไทย:ชื่อหน่วยงาน+ช่วงเวลา+ปุ่มการกระทำ) */}
      <div className="w-full border-b bg-[var(--card)]/90 backdrop-blur supports-[backdrop-filter]:bg-[var(--card)]/70 print:hidden">
        <div className="px-4 lg:px-6 py-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary)]/10 border">
              <BarChart3 className="h-5 w-5 text-[var(--primary)]" aria-hidden />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-[var(--foreground)]">
                รายงานสรุปคำร้องขอดูภาพจากกล้อง CCTV
              </h1>
              <p className="text-xs md:text-sm text-[var(--muted-foreground)]">
                เทศบาลนครหัวหิน • แดชบอร์ดเพื่อการบริหารและติดตามผล
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="h-9 w-40" aria-label="ช่วงเวลา">
                <SelectValue placeholder="เลือกช่วงเวลา" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 วันย้อนหลัง</SelectItem>
                <SelectItem value="30">30 วันย้อนหลัง</SelectItem>
                <SelectItem value="90">90 วันย้อนหลัง</SelectItem>
                <SelectItem value="365">12 เดือนย้อนหลัง</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={() => fetchStatistics(timeRange)} disabled={loading} className="h-9">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="ml-2">รีเฟรช</span>
            </Button>

            <Button variant="outline" size="sm" onClick={handlePrint} className="h-9">
              <Printer className="h-4 w-4" />
              <span className="ml-2">พิมพ์รายงาน</span>
            </Button>

            {csvBlobUrl && (
              <a
                href={csvBlobUrl}
                download={`cctv-report-summary-${timeRange}d.csv`}
                className="inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm hover:bg-muted"
              >
                <Download className="h-4 w-4" />
                ส่งออก CSV
              </a>
            )}
          </div>
        </div>

        {/* แถบออกรายงาน PDF ประจำเดือน */}
        <div className="px-4 lg:px-6 py-3 border-t flex flex-wrap items-center gap-3 bg-blue-50/50">
          <span className="text-sm font-medium text-[var(--foreground)]">ออกรายงาน PDF ประจำเดือน:</span>
          <Select value={pdfMonth} onValueChange={setPdfMonth}>
            <SelectTrigger className="h-9 w-36" aria-label="เดือน">
              <SelectValue placeholder="เลือกเดือน" />
            </SelectTrigger>
            <SelectContent>
              {THAI_MONTHS_SELECT.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={pdfYear} onValueChange={setPdfYear}>
            <SelectTrigger className="h-9 w-36" aria-label="ปี พ.ศ.">
              <SelectValue placeholder="เลือกปี" />
            </SelectTrigger>
            <SelectContent>
              {getPdfYearOptions().map((yr) => (
                <SelectItem key={yr.value} value={yr.value}>{yr.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="default"
            size="sm"
            className="h-9"
            onClick={() => {
              window.open(`/api/admin/reports/monthly-pdf?month=${pdfMonth}&year=${pdfYear}`, '_blank')
            }}
          >
            <FileText className="h-4 w-4" />
            <span className="ml-2">ออกรายงาน PDF ประจำเดือน</span>
          </Button>
        </div>
      </div>

      {/* บล็อกแนะนำผู้ใช้งาน (คำอธิบายข้อมูล) */}
      <div className="px-4 lg:px-6 print:px-6 pt-4">
        <div className="mb-4 flex items-start gap-2 text-[13px] text-[var(--muted-foreground)] print:hidden">
          <Info className="h-4 w-4 mt-0.5" />
          <p>
            ข้อมูลสรุปนี้จัดทำเพื่อการตัดสินใจเชิงบริหาร: ใช้ตัวเลขรวม, สัดส่วนสถานะ, แนวโน้มรายเดือน
            และตัวชี้วัดเวลาเฉลี่ย (SLA) รวมถึงช่วง “รอเอกสารอนุมัติ → อนุมัติเรียบร้อย”
          </p>
        </div>
      </div>

      {/* เนื้อหา */}
      <div className="px-4 lg:px-6 py-6 space-y-6 print:px-6">
        {loading ? (
          <>
            {/* แถว KPI โครงกระดูก */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} aria-hidden className="print:hidden">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-4" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-24 mb-2" />
                    <Skeleton className="h-3 w-28" />
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* กราฟ โครงกระดูก */}
            <div className="grid gap-6 xl:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Card key={i} aria-hidden className="print:hidden">
                  <CardHeader>
                    <Skeleton className="h-5 w-40" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <div key={j} className="space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-2 w-3/4" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        ) : statistics ? (
          <>
            {/* 1) แถว KPI */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard
                title="จำนวนคำร้องทั้งหมด"
                value={statistics.total_reports}
                description={`ช่วงเวลารายงาน: ${timeRange} วันย้อนหลัง`}
                icon={FileText}
                tone="primary"
                trend={{ value: deltaPct, label: 'เทียบเดือนก่อน' }}
              />
              <StatCard
                title="คำร้องที่แล้วเสร็จ (อนุมัติ)"
                value={statistics.status_breakdown.find((s) => s.status === 'เอกสารอนุมัติเรียบร้อย')?.count || 0}
                description="ผลการอนุมัติสำเร็จ"
                icon={CheckCircle}
                tone="success"
              />
              <StatCard
                title="คำร้องระหว่างดำเนินการ"
                value={statistics.status_breakdown.find((s) => s.status === 'รอเอกสารอนุมัติ')?.count || 0}
                description="อยู่ระหว่างพิจารณา/รอเอกสารเพิ่มเติม"
                icon={Clock}
                tone="warning"
              />
              <StatCard
                title="คำร้องรอยื่นเอกสาร"
                value={statistics.status_breakdown.find((s) => s.status === 'รอยื่นเอกสาร')?.count || 0}
                description="รอประชาชนยื่นเอกสารเพิ่มเติม"
                icon={FileText}
                tone="warning"
              />
              <StatCard
                title="คำร้องที่ถูกปฏิเสธ"
                value={statistics.status_breakdown.find((s) => s.status === 'ปฏิเสธคำร้อง')?.count || 0}
                description="ไม่ผ่านเงื่อนไข/เอกสารไม่ครบ"
                icon={XCircle}
                tone="danger"
              />
            </div>

            {/* 1.1) ตารางสรุปสถานะ (อ่านบนกระดาษ/ผู้บริหาร) */}
            <Card className="print:break-inside-avoid">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">ตารางสรุปสถานะคำร้อง</CardTitle>
                <CardDescription>สัดส่วน (%) คำนวณเทียบกับจำนวนคำร้องทั้งหมดในช่วงเวลาที่เลือก</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left">สถานะ</th>
                        <th className="px-3 py-2 text-right">จำนวน (เรื่อง)</th>
                        <th className="px-3 py-2 text-right">ร้อยละ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statistics.status_breakdown.map((s) => (
                        <tr key={s.status} className="odd:bg-muted/30">
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: STATUS_COLOR_MAP[s.status] ?? COLORS.primary }}
                                aria-hidden
                              />
                              {s.status}
                            </div>
                          </td>
                          <td className={`px-3 py-2 text-right font-semibold ${
                            s.status === 'เอกสารอนุมัติเรียบร้อย' ? 'text-green-800' :
                            s.status === 'รอเอกสารอนุมัติ' ? 'text-blue-800' :
                            s.status === 'รอยื่นเอกสาร' ? 'text-violet-800' :
                            s.status === 'ปฏิเสธคำร้อง' ? 'text-red-800' :
                            'text-blue-900'
                          }`}>{formatThaiNumber(s.count)}</td>
                          <td className={`px-3 py-2 text-right font-semibold ${
                            s.status === 'เอกสารอนุมัติเรียบร้อย' ? 'text-green-800' :
                            s.status === 'รอเอกสารอนุมัติ' ? 'text-blue-800' :
                            s.status === 'รอยื่นเอกสาร' ? 'text-violet-800' :
                            s.status === 'ปฏิเสธคำร้อง' ? 'text-red-800' :
                            'text-blue-900'
                          }`}>{formatThaiNumber(Math.round(s.percentage * 100) / 100)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* 2) กราฟภาพรวม */}
            <div className="grid gap-6 xl:grid-cols-3">
              <Card className="xl:col-span-1 print:break-inside-avoid">
                <CardHeader>
                  <CardTitle className="text-lg">สัดส่วนคำร้องตามสถานะ</CardTitle>
                  <CardDescription>มุมมองสรุป ณ ช่วงเวลาที่เลือก</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statistics.status_breakdown}
                          dataKey="count"
                          nameKey="status"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                        >
                          {statistics.status_breakdown.map((entry, idx) => {
                            const color =
                              entry.status === 'เอกสารอนุมัติเรียบร้อย' ? '#059669' :  // เขียวเข้ม
                              entry.status === 'รอเอกสารอนุมัติ' ? '#1e40af' :     // น้ำเงินเข้ม
                              entry.status === 'รอยื่นเอกสาร' ? '#7c3aed' :        // ม่วงเข้ม
                              entry.status === 'ปฏิเสธคำร้อง' ? '#dc2626' :        // แดงเข้ม
                              COLORS.primary
                            return <Cell key={`cell-${idx}`} fill={color} />
                          })}
                        </Pie>
                        <ReTooltip
                          formatter={(v, _n, d) => [
                            formatThaiNumber(Number(v)),
                            `${d?.payload?.status} (${formatThaiNumber(d?.payload?.percentage)}%)`,
                          ]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="xl:col-span-2 print:break-inside-avoid">
                <CardHeader>
                  <CardTitle className="text-lg">แนวโน้มจำนวนคำร้องรายเดือน</CardTitle>
                  <CardDescription>สะท้อนปริมาณคำร้องตามช่วงเวลาเพื่อการวางแผนกำลังคน/งบประมาณ</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={statistics.monthly_trend.map((m) => ({ name: monthLabel(m.month, m.year), count: m.count }))}
                        margin={{ left: 8, right: 8 }}
                      >
                        <defs>
                          <linearGradient id="areaPrimary" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.7} />
                            <stop offset="95%" stopColor="#93c5fd" stopOpacity={0.2} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis allowDecimals={false} width={40} tickFormatter={(v) => `${v}`} />
                        <ReTooltip formatter={(v) => formatThaiNumber(Number(v))} />
                        <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="url(#areaPrimary)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 3) หมวดหมู่เหตุ/สถานที่ยอดนิยม */}
            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="print:break-inside-avoid">
                <CardHeader>
                  <CardTitle className="text-lg">หมวดหมู่เหตุการณ์ที่ถูกร้องขอบ่อย</CardTitle>
                  <CardDescription>ใช้วางแผนมาตรการเชิงป้องกัน/จัดสรรทรัพยากร</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={statistics.category_breakdown.map((c) => ({ name: c.category_name, value: c.count }))}
                        margin={{ left: 16, right: 8 }}
                      >
                        <defs>
                          <linearGradient id="barPurple" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#a78bfa" stopOpacity={0.4} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} height={50} />
                        <YAxis allowDecimals={false} width={40} tickFormatter={(v) => `${v}`} />
                        <ReTooltip formatter={(v) => formatThaiNumber(Number(v))} />
                        <Bar dataKey="value" fill="url(#barPurple)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card className="print:break-inside-avoid">
                <CardHeader>
                  <CardTitle className="text-lg">พื้นที่/จุดเกิดเหตุที่ถูกร้องขอบ่อย</CardTitle>
                  <CardDescription>Top 10 เพื่อการจัดลำดับความสำคัญซ่อมบำรุง/ติดตั้งเพิ่ม</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-96">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={statistics.top_locations.slice(0, 10).map((t, index) => {
                          const originalName = t.location
                          // จัดการชื่อยาวสำหรับ display
                          let displayName = originalName
                          if (originalName.length > 18) {
                            // หาจุดตัดที่ดีที่สุด
                            let breakPoint = 15
                            for (let i = 15; i > 8; i--) {
                              if (originalName[i] === ' ') {
                                breakPoint = i
                                break
                              }
                            }
                            displayName = originalName.substring(0, breakPoint) + '...'
                          }

                          return {
                            name: displayName,
                            fullName: originalName,
                            value: t.count,
                            index: index,
                            rank: index + 1
                          }
                        })}
                        margin={{ left: 12, right: 12, top: 20, bottom: 80 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 10 }}
                          interval={0}
                          angle={-45}
                          textAnchor="end"
                          height={80}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fontSize: 12 }}
                          tickFormatter={(v) => formatThaiNumber(v)}
                        />
                        <ReTooltip
                          formatter={(v, _n, props) => [
                            formatThaiNumber(Number(v)),
                            props?.payload?.fullName || 'ไม่ระบุ'
                          ]}
                          labelFormatter={() => ''}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {statistics.top_locations.slice(0, 10).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={LOCATION_BAR_COLORS[index] || '#ea580c'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 4) เวลาดำเนินการเฉลี่ย (SLA) */}
            {typeof statistics.processing_time_avg === 'number' && (
              <Card className="print:break-inside-avoid">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" aria-hidden />
                    เวลาดำเนินการเฉลี่ย (SLA)
                  </CardTitle>
                  <CardDescription>นับจากวันที่ยื่นคำร้องถึงวันที่อนุมัติ</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-6 md:flex-row md:items-end">
                    <div>
                      <div className="text-3xl md:text-4xl font-bold text-blue-800">
                        {formatThaiNumber(Math.round((statistics.processing_time_avg || 0) * 10) / 10)} วัน
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)] mt-1">
                        * แนะนำบันทึกค่า P50/P75/P90 เพื่อสะท้อนประสบการณ์ส่วนใหญ่ของประชาชน
                      </p>
                    </div>

                    {typeof statistics.processing_time_doc_avg_minutes === 'number' && (
                      <div className="ml-auto grid grid-cols-1 md:grid-cols-2 gap-3 w-full md:w-auto">
                        <div className="px-3 py-3 rounded-lg bg-[var(--muted)]">
                          <div className="text-xs text-[var(--muted-foreground)]">เฉลี่ยช่วงตรวจเอกสาร → อนุมัติ</div>
                          <div className="text-lg font-semibold text-blue-800">
                            {formatDurationThaiFromMinutes(statistics.processing_time_doc_avg_minutes!)}
                          </div>
                        </div>
                        <div className="px-3 py-3 rounded-lg bg-[var(--muted)]">
                          <div className="text-xs text-[var(--muted-foreground)]">หน่วย (นาที)</div>
                          <div className="text-lg font-semibold text-blue-800">
                            {formatThaiNumber(Math.round(statistics.processing_time_doc_avg_minutes!))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* 5) หมายเหตุราชการ */}
            <Card className="print:break-inside-avoid">
              <CardHeader>
                <CardTitle className="text-base">ข้อเสนอแนะต่อผู้บริหาร</CardTitle>
                <CardDescription>หลักเกณฑ์เพื่อการตัดสินใจและติดตามปรับปรุงบริการ</CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-[var(--muted-foreground)] space-y-2">
                <p>• หากสัดส่วน “รอเอกสารอนุมัติ” &gt; 30% ต่อเนื่อง ควรทบทวนรายการเอกสาร/ขั้นตอนที่ใช้เวลา</p>
                <p>• จุดที่ถูกร้องขอบ่อยควรพิจารณาเพิ่ม/ย้ายมุมกล้อง หรือซ่อมบำรุงอุปกรณ์เพื่อเพิ่มคุณภาพหลักฐาน</p>
                <p>• ติดตามค่า SLA รายเดือนอย่างน้อย P90 เพื่อกำหนดเป้าหมายและสื่อสารต่อสาธารณะได้ชัดเจน</p>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <BarChart3 className="h-12 w-12 text-[var(--muted-foreground)] mx-auto mb-4" aria-hidden />
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">ไม่พบข้อมูลสถิติ</h3>
              <p className="text-sm text-[var(--muted-foreground)]">ไม่สามารถโหลดข้อมูลสถิติได้ในขณะนี้</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ✅ Print styles moved to globals.css */}
    </div>
  )
}
