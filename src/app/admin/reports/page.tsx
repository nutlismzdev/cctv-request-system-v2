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
  Info,
  Target,
  Gauge,
  ShieldCheck,
  Users,
  MapPin,
  CalendarRange,
} from 'lucide-react'
// ✅ Dynamic import recharts to avoid loading ~300KB in initial bundle (bundle-dynamic-imports)
// — webpack dedupe ทุก reference เข้า chunk เดียวกัน
const ResponsiveContainer = dynamic(
  () => import('recharts').then(m => ({ default: m.ResponsiveContainer })),
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

import { checkAuth as verifyAuth } from '@/lib/auth'

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

const THAI_MONTHS_FULL = [
  'มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน',
  'กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม',
] as const
const THAI_MONTHS_SHORT = [
  'ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
  'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.',
] as const

/** "January 2026" / "Jan 2026" / "1 2026" → "ม.ค. 2569" (พ.ศ.) */
function monthLabel(m: string, y: number): string {
  const yBE = y + 543
  const enFull = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const enShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const trimmed = (m || '').trim()
  let idx = enFull.findIndex(name => trimmed.toLowerCase().startsWith(name.toLowerCase()))
  if (idx < 0) idx = enShort.findIndex(name => trimmed.toLowerCase().startsWith(name.toLowerCase()))
  if (idx < 0) {
    const num = parseInt(trimmed, 10)
    if (!Number.isNaN(num) && num >= 1 && num <= 12) idx = num - 1
  }
  if (idx < 0) return `${trimmed} ${yBE}`
  return `${THAI_MONTHS_SHORT[idx]} ${yBE}`
}

/** "2026-01-15" → "15 มกราคม 2569" (วัน/เดือน/พ.ศ. แบบไทย) */
function formatThaiDate(input: string): string {
  if (!input) return ''
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return input
  const yBE = parseInt(m[1], 10) + 543
  const moIdx = Math.max(0, Math.min(11, parseInt(m[2], 10) - 1))
  const day = parseInt(m[3], 10)
  return `${day} ${THAI_MONTHS_FULL[moIdx]} ${yBE}`
}

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

function DateRangePicker({
  dateFrom,
  dateTo,
  appliedRange,
  loading,
  onDateFromChange,
  onDateToChange,
  onApply,
  onClear,
}: {
  dateFrom: string
  dateTo: string
  appliedRange: { from: string; to: string } | null
  loading: boolean
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  onApply: () => void
  onClear: () => void
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 lg:flex-row lg:items-center">
      <div className="inline-flex min-w-0 flex-col rounded-lg border bg-background shadow-xs sm:flex-row sm:items-center">
        <label className="flex min-w-0 items-center gap-2 border-b px-3 py-2 text-sm sm:border-b-0 sm:border-r">
          <span className="shrink-0 text-xs font-medium text-[var(--muted-foreground)]">ตั้งแต่</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            max={dateTo || undefined}
            className="h-8 min-w-0 bg-transparent text-sm outline-none"
            aria-label="วันที่เริ่มต้น"
          />
        </label>
        <label className="flex min-w-0 items-center gap-2 border-b px-3 py-2 text-sm sm:border-b-0 sm:border-r">
          <span className="shrink-0 text-xs font-medium text-[var(--muted-foreground)]">ถึง</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            min={dateFrom || undefined}
            className="h-8 min-w-0 bg-transparent text-sm outline-none"
            aria-label="วันที่สิ้นสุด"
          />
        </label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-10 rounded-none px-3 sm:h-12 sm:rounded-r-lg"
          onClick={onApply}
          disabled={loading || !dateFrom || !dateTo}
        >
          ใช้ช่วงวันที่
        </Button>
      </div>
      {appliedRange && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--primary)]/10 px-3 py-1 text-xs font-medium text-[var(--primary)]">
            {formatThaiDate(appliedRange.from)} → {formatThaiDate(appliedRange.to)}
          </span>
          <Button variant="outline" size="sm" className="h-8" onClick={onClear} disabled={loading}>
            ล้าง
          </Button>
        </div>
      )}
    </div>
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
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string } | null>(null)
  const [pdfMonth, setPdfMonth] = useState(getDefaultPdfMonth)
  const [pdfYear, setPdfYear] = useState(getDefaultPdfYear)

  // ตรวจสิทธิ์เข้าใช้งาน (ให้ประสบการณ์ลื่นไหล)
  useEffect(() => {
    let cancelled = false
    verifyAuth().then(user => {
      if (cancelled) return
      if (!user) {
        router.push('/login')
        return
      }
      setAuthChecked(true)
    })
    return () => { cancelled = true }
  }, [router])

  // ดึงข้อมูลสถิติ — รองรับทั้งโหมด days (preset) และโหมด from/to (กำหนดช่วงวันที่เอง)
  const fetchStatistics = async (opts: { days?: string; from?: string; to?: string } = {}) => {
    if (!authChecked) return
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (opts.from && opts.to) {
        qs.set('from', opts.from)
        qs.set('to', opts.to)
      } else {
        qs.set('days', opts.days || timeRange)
      }
      const res = await fetch(`/api/admin/reports?${qs.toString()}`, { cache: 'no-store' })
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
    if (!authChecked) return
    if (appliedRange) fetchStatistics({ from: appliedRange.from, to: appliedRange.to })
    else fetchStatistics({ days: timeRange })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked, timeRange, appliedRange])

  const applyDateRange = () => {
    if (!dateFrom || !dateTo) {
      toast.error('กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด')
      return
    }
    if (dateFrom > dateTo) {
      toast.error('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด')
      return
    }
    setAppliedRange({ from: dateFrom, to: dateTo })
  }

  const clearDateRange = () => {
    setDateFrom('')
    setDateTo('')
    setAppliedRange(null)
  }

  // อนุมานค่าเพื่อแสดงผล
  const sparkline = (statistics?.monthly_trend || []).map((m) => m.count)
  const latest = sparkline.at(-1) ?? 0
  const prev = sparkline.at(-2) ?? 0
  const deltaPct = prev === 0 ? (latest > 0 ? 100 : 0) : Math.round(((latest - prev) / prev) * 100)

  /* ---------- ตัวชี้วัดประสิทธิภาพการให้บริการ ---------- */
  const lpa = useMemo(() => {
    if (!statistics) return null
    const total = Number(statistics.total_reports || 0)
    const findCount = (s: string) => statistics.status_breakdown.find((x) => x.status === s)?.count || 0
    const done = findCount('เอกสารอนุมัติเรียบร้อย')
    const rejected = findCount('ปฏิเสธคำร้อง')
    const waitDoc = findCount('รอเอกสารอนุมัติ')
    const waitSubmit = findCount('รอยื่นเอกสาร')
    const inProgress = waitDoc + waitSubmit
    const avgDays = typeof statistics.processing_time_avg === 'number' ? statistics.processing_time_avg : null
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0) // 1 ตำแหน่งทศนิยม
    return {
      total,
      done,
      rejected,
      inProgress,
      waitDoc,
      waitSubmit,
      completionRate: pct(done),
      rejectionRate: pct(rejected),
      backlogRate: pct(inProgress),
      avgDays,
    }
  }, [statistics])

  // สร้าง CSV — โครงสร้างเตรียมพร้อมสำหรับการคัดลอกไปใช้ในรายงานราชการ
  const csvBlobUrl = useMemo(() => {
    if (!statistics || !lpa) return null
    const periodLabel = appliedRange ? `${formatThaiDate(appliedRange.from)} ถึง ${formatThaiDate(appliedRange.to)}` : `${timeRange} วันย้อนหลัง`
    const escape = (s: string) => `"${s.replace(/"/g, '""')}"`
    const lines: string[] = []
    lines.push('หัวข้อ,ค่า,หมายเหตุ')
    lines.push([escape('ช่วงเวลารายงาน'), escape(periodLabel), escape('สรุปข้อมูลผลการให้บริการ')].join(','))
    lines.push([escape('จำนวนคำร้องที่ให้บริการประชาชน'), lpa.total, escape('รวมทุกสถานะ')].join(','))
    lines.push([escape('อัตราการอนุมัติสำเร็จ (%)'), lpa.completionRate, escape(`อนุมัติ ${lpa.done} / ${lpa.total}`)].join(','))
    lines.push([escape('อัตราการปฏิเสธ (%)'), lpa.rejectionRate, escape(`ปฏิเสธ ${lpa.rejected} คำร้อง`)].join(','))
    lines.push([escape('คำร้องคงค้างระหว่างดำเนินการ'), lpa.inProgress, escape(`รอเอกสาร ${lpa.waitDoc} • รอยื่น ${lpa.waitSubmit}`)].join(','))
    if (typeof statistics.processing_time_avg === 'number') {
      lines.push([escape('ระยะเวลาดำเนินการเฉลี่ย (วัน)'), statistics.processing_time_avg, escape('SLA: ตั้งแต่วันยื่นถึงวันอนุมัติ')].join(','))
    }
    if (typeof statistics.processing_time_doc_avg_minutes === 'number') {
      lines.push([escape('เวลาตรวจเอกสาร → อนุมัติ (นาที)'), statistics.processing_time_doc_avg_minutes, escape('เฉลี่ยภายในกระบวนการพิจารณา')].join(','))
    }
    lines.push('')
    lines.push('อันดับ,พื้นที่/จุดเกิดเหตุ,จำนวน (เรื่อง)')
    statistics.top_locations.slice(0, 10).forEach((t, idx) => {
      lines.push([idx + 1, escape(t.location || 'ไม่ระบุ'), t.count].join(','))
    })
    // Add UTF-8 BOM so Excel reads Thai correctly
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    return URL.createObjectURL(blob)
  }, [statistics, lpa, appliedRange, timeRange])

  // revoke object URL เก่าเมื่อ value เปลี่ยนหรือ component unmount — กัน memory leak
  useEffect(() => {
    if (!csvBlobUrl) return
    return () => { URL.revokeObjectURL(csvBlobUrl) }
  }, [csvBlobUrl])

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
      {/* แถบหัวรายงาน (ราชการไทย:ชื่อหน่วยงาน+toolbar ควบคุมรายงาน) */}
      <div className="w-full border-b bg-[var(--card)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--card)]/80 print:hidden">
        <div className="px-4 py-5 lg:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg border bg-[var(--primary)]/10">
                <BarChart3 className="h-5 w-5 text-[var(--primary)]" aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="text-xl font-semibold tracking-tight text-[var(--foreground)] md:text-2xl">
                  รายงานสรุปคำร้องขอดูภาพจากกล้อง CCTV
                </h1>
              
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (appliedRange) fetchStatistics({ from: appliedRange.from, to: appliedRange.to })
                  else fetchStatistics({ days: timeRange })
                }}
                disabled={loading}
                className="h-9"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>รีเฟรช</span>
              </Button>

              <Button variant="outline" size="sm" onClick={handlePrint} className="h-9">
                <Printer className="h-4 w-4" />
                <span>พิมพ์</span>
              </Button>

              {csvBlobUrl && (
                <a
                  href={csvBlobUrl}
                  download={`cctv-report-summary-${appliedRange ? `${appliedRange.from}_to_${appliedRange.to}` : `${timeRange}d`}.csv`}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
                >
                  <Download className="h-4 w-4" />
                  CSV
                </a>
              )}
            </div>
          </div>

          <div className="mt-4 rounded-xl border bg-muted/25 p-3">
            <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
              <div className="flex min-w-0 flex-1 flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
                  <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                    <CalendarRange className="h-4 w-4 text-[var(--primary)]" aria-hidden />
                    ช่วงข้อมูล
                  </span>
                  <Select
                    value={timeRange}
                    onValueChange={(v) => {
                      setTimeRange(v)
                      setAppliedRange(null)
                      setDateFrom('')
                      setDateTo('')
                    }}
                    disabled={Boolean(appliedRange)}
                  >
                    <SelectTrigger className="h-10 w-full bg-background sm:w-44" aria-label="ช่วงเวลา">
                      <SelectValue placeholder="เลือกช่วงเวลา" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 วันย้อนหลัง</SelectItem>
                      <SelectItem value="30">30 วันย้อนหลัง</SelectItem>
                      <SelectItem value="90">90 วันย้อนหลัง</SelectItem>
                      <SelectItem value="365">12 เดือนย้อนหลัง</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <DateRangePicker
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  appliedRange={appliedRange}
                  loading={loading}
                  onDateFromChange={setDateFrom}
                  onDateToChange={setDateTo}
                  onApply={applyDateRange}
                  onClear={clearDateRange}
                />
              </div>

              <div className="h-px bg-border 2xl:h-10 2xl:w-px" />

              <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:justify-end">
                <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                  <FileText className="h-4 w-4 text-blue-700" aria-hidden />
                  PDF ประจำเดือน
                </span>
                <Select value={pdfMonth} onValueChange={setPdfMonth}>
                  <SelectTrigger className="h-10 w-full bg-background lg:w-36" aria-label="เดือน">
                    <SelectValue placeholder="เลือกเดือน" />
                  </SelectTrigger>
                  <SelectContent>
                    {THAI_MONTHS_SELECT.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={pdfYear} onValueChange={setPdfYear}>
                  <SelectTrigger className="h-10 w-full bg-background lg:w-36" aria-label="ปี พ.ศ.">
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
                  className="h-10"
                  onClick={() => {
                    window.open(`/api/admin/reports/monthly-pdf?month=${pdfMonth}&year=${pdfYear}`, '_blank')
                  }}
                >
                  <FileText className="h-4 w-4" />
                  <span>ออกรายงาน</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* บล็อกแนะนำผู้ใช้งาน + ใบหน้าปกสำหรับการพิมพ์ */}
      <div className="px-4 lg:px-6 print:px-6 pt-4">
        <div className="mb-4 flex items-start gap-2 text-[13px] text-[var(--muted-foreground)] print:hidden">
          <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>
            ข้อมูลสรุปการให้บริการประชาชน — ด้านประสิทธิผลของการให้บริการ,
            อัตราการอนุมัติ/ปฏิเสธ, ระยะเวลาดำเนินการเฉลี่ย และพื้นที่ที่ประชาชนร้องขอบ่อย
            
          </p>
        </div>

        {/* หัวกระดาษสำหรับการพิมพ์ */}
        <div className="hidden print:block mb-4">
          <div className="border-b-2 border-slate-900 pb-3">
            <h1 className="text-xl font-bold text-slate-900">
              รายงานสรุปคำร้องขอดูภาพจากกล้องโทรทัศน์วงจรปิด (CCTV)
            </h1>
            <p className="text-sm text-slate-700 mt-1">
              เทศบาลนครหัวหิน • รายงานสรุปการให้บริการประชาชน
            </p>
            <p className="text-xs text-slate-600 mt-1">
              ช่วงเวลารายงาน: {appliedRange ? `${formatThaiDate(appliedRange.from)} ถึง ${formatThaiDate(appliedRange.to)}` : `${timeRange} วันย้อนหลังจากวันที่พิมพ์`}
              {' • '}จัดพิมพ์เมื่อ: {new Date().toLocaleString('th-TH')}
            </p>
          </div>
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
        ) : statistics && lpa ? (
          <>
            {/* 1) ตัวชี้วัดประสิทธิภาพการให้บริการ — Primary KPIs */}
            <section aria-labelledby="service-indicators" className="space-y-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-blue-700" aria-hidden />
                <h2 id="service-indicators" className="text-base font-semibold text-[var(--foreground)]">
                  ตัวชี้วัดประสิทธิภาพการให้บริการ
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  title="จำนวนคำร้องที่ให้บริการ"
                  value={lpa.total}
                  description={appliedRange ? `${formatThaiDate(appliedRange.from)} → ${formatThaiDate(appliedRange.to)}` : `${timeRange} วันย้อนหลัง`}
                  icon={Users}
                  tone="primary"
                  trend={{ value: deltaPct, label: 'เทียบเดือนก่อน' }}
                />
                <StatCard
                  title="อัตราอนุมัติสำเร็จ"
                  value={`${formatThaiNumber(lpa.completionRate)}%`}
                  description={`อนุมัติแล้ว ${formatThaiNumber(lpa.done)} / ${formatThaiNumber(lpa.total)} คำร้อง`}
                  icon={Target}
                  tone="success"
                />
                <StatCard
                  title="ระยะเวลาดำเนินการเฉลี่ย"
                  value={lpa.avgDays != null ? `${formatThaiNumber(Math.round(lpa.avgDays * 10) / 10)} วัน` : '—'}
                  description="ตั้งแต่วันยื่นถึงวันอนุมัติ (SLA)"
                  icon={Gauge}
                  tone="primary"
                />
                <StatCard
                  title="คำร้องคงค้างระหว่างดำเนินการ"
                  value={lpa.inProgress}
                  description={`${formatThaiNumber(lpa.backlogRate)}% ของคำร้องทั้งหมด`}
                  icon={Clock}
                  tone={lpa.backlogRate > 30 ? 'warning' : 'primary'}
                />
              </div>
            </section>

            {/* 2) แถว KPI สถานะคำร้อง — รายละเอียดสนับสนุน */}
            <section aria-labelledby="status-overview" className="space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-slate-700" aria-hidden />
                <h2 id="status-overview" className="text-base font-semibold text-[var(--foreground)]">
                  ภาพรวมสถานะคำร้อง
                </h2>
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  title="คำร้องที่แล้วเสร็จ"
                  value={lpa.done}
                  description="ผลการอนุมัติสำเร็จ"
                  icon={CheckCircle}
                  tone="success"
                />
                <StatCard
                  title="รอเอกสารอนุมัติ"
                  value={lpa.waitDoc}
                  description="อยู่ระหว่างพิจารณาของเจ้าหน้าที่"
                  icon={Clock}
                  tone="warning"
                />
                <StatCard
                  title="รอยื่นเอกสาร"
                  value={lpa.waitSubmit}
                  description="รอประชาชนยื่นเอกสารเพิ่มเติม"
                  icon={FileText}
                  tone="warning"
                />
                <StatCard
                  title="คำร้องที่ถูกปฏิเสธ"
                  value={lpa.rejected}
                  description={`${formatThaiNumber(lpa.rejectionRate)}% ของคำร้องทั้งหมด`}
                  icon={XCircle}
                  tone="danger"
                />
              </div>
            </section>

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
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">สัดส่วนคำร้องตามสถานะ</CardTitle>
                  <CardDescription>มุมมองสรุป ณ ช่วงเวลาที่เลือก</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statistics.status_breakdown}
                          dataKey="count"
                          nameKey="status"
                          innerRadius={56}
                          outerRadius={86}
                          paddingAngle={2}
                          stroke="#fff"
                          strokeWidth={2}
                        >
                          {statistics.status_breakdown.map((entry, idx) => (
                            <Cell key={`cell-${idx}`} fill={STATUS_COLOR_MAP[entry.status] ?? COLORS.primary} />
                          ))}
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

                  {/* Legend แบบ list — ใช้สีเดียวกับ pie + ป้องกันการพึ่งสีอย่างเดียว */}
                  <ul className="mt-3 grid grid-cols-1 gap-1.5 text-xs">
                    {statistics.status_breakdown.map((s) => (
                      <li key={s.status} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
                            style={{ backgroundColor: STATUS_COLOR_MAP[s.status] ?? COLORS.primary }}
                            aria-hidden
                          />
                          <span className="truncate text-slate-700">{s.status}</span>
                        </div>
                        <span className="tabular-nums font-semibold text-slate-900">
                          {formatThaiNumber(s.count)}
                          <span className="ml-1 text-slate-500 font-normal">({formatThaiNumber(s.percentage)}%)</span>
                        </span>
                      </li>
                    ))}
                  </ul>
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
                        margin={{ left: 8, right: 12, top: 8, bottom: 8 }}
                      >
                        <defs>
                          <linearGradient id="areaPrimary" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.7} />
                            <stop offset="95%" stopColor="#93c5fd" stopOpacity={0.2} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                        <XAxis
                          dataKey="name"
                          tick={{ fontSize: 11 }}
                          interval="preserveStartEnd"
                          minTickGap={16}
                        />
                        <YAxis
                          allowDecimals={false}
                          width={40}
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => formatThaiNumber(Number(v))}
                        />
                        <ReTooltip
                          formatter={(v) => [formatThaiNumber(Number(v)), 'จำนวนคำร้อง']}
                          labelFormatter={(label) => `เดือน ${String(label)}`}
                        />
                        <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="url(#areaPrimary)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
                    หมายเหตุ: แสดงเดือนเป็นรูปแบบไทย (เช่น ม.ค. 2569)
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* 3) หมวดหมู่เหตุ/สถานที่ยอดนิยม */}
            <div className="grid gap-6 xl:grid-cols-2">
              <Card className="print:break-inside-avoid">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">หมวดหมู่เหตุการณ์ที่ถูกร้องขอบ่อย</CardTitle>
                  <CardDescription>ใช้วางแผนมาตรการเชิงป้องกัน/จัดสรรทรัพยากร</CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const data = statistics.category_breakdown.slice(0, 8).map((c) => ({
                      name: c.category_name || 'ไม่ระบุ',
                      value: c.count,
                      percentage: c.percentage,
                    }))
                    const maxVal = data[0]?.value || 1
                    const totalCat = data.reduce((sum, d) => sum + d.value, 0)
                    return (
                      <>
                        {/* Desktop/Tablet: horizontal bar — รองรับชื่อหมวดหมู่ยาวได้เต็ม */}
                        <div className="hidden md:block" style={{ height: Math.max(240, data.length * 38) }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              layout="vertical"
                              data={data}
                              margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
                            >
                              <defs>
                                <linearGradient id="barPurple" x1="0" y1="0" x2="1" y2="0">
                                  <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.85} />
                                  <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.55} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
                              <XAxis
                                type="number"
                                allowDecimals={false}
                                tick={{ fontSize: 11 }}
                                tickFormatter={(v) => formatThaiNumber(Number(v))}
                              />
                              <YAxis
                                type="category"
                                dataKey="name"
                                width={200}
                                tick={(props: { x: number; y: number; payload: { value: string } }) => {
                                  const { x, y, payload } = props
                                  const text = String(payload.value || '')
                                  const truncated = text.length > 26 ? `${text.slice(0, 24)}…` : text
                                  return (
                                    <g transform={`translate(${x},${y})`}>
                                      <title>{text}</title>
                                      <text x={-6} y={0} dy={4} textAnchor="end" fill="#475569" fontSize={11}>
                                        {truncated}
                                      </text>
                                    </g>
                                  )
                                }}
                                interval={0}
                              />
                              <ReTooltip
                                formatter={(v, _n, p) => [
                                  `${formatThaiNumber(Number(v))} (${formatThaiNumber(p?.payload?.percentage ?? 0)}%)`,
                                  'จำนวนคำร้อง',
                                ]}
                                labelFormatter={(label) => String(label)}
                              />
                              <Bar dataKey="value" fill="url(#barPurple)" radius={[0, 6, 6, 0]} barSize={20} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Mobile: list อันดับ — ชื่อหมวดหมู่แสดงครบ wrap ได้ */}
                        <ol className="md:hidden space-y-2 print:hidden">
                          {data.map((c, idx) => {
                            const pct = totalCat > 0 ? Math.round((c.value / maxVal) * 100) : 0
                            return (
                              <li key={`${c.name}-${idx}`} className="rounded-lg border bg-card p-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-2 min-w-0">
                                    <span
                                      className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                      style={{ backgroundColor: '#7c3aed' }}
                                    >
                                      {idx + 1}
                                    </span>
                                    <span className="text-sm text-slate-800 break-words">{c.name}</span>
                                  </div>
                                  <span className="text-sm font-semibold tabular-nums text-slate-900 flex-shrink-0">
                                    {formatThaiNumber(c.value)}
                                    <span className="ml-1 text-xs font-normal text-slate-500">
                                      ({formatThaiNumber(c.percentage)}%)
                                    </span>
                                  </span>
                                </div>
                                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                  <div className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-300" style={{ width: `${pct}%` }} />
                                </div>
                              </li>
                            )
                          })}
                        </ol>

                        {/* Print: ตารางครบรายการ */}
                        <table className="hidden print:table w-full text-xs mt-3 border-t">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="px-2 py-1 text-left w-10">#</th>
                              <th className="px-2 py-1 text-left">หมวดหมู่เหตุการณ์</th>
                              <th className="px-2 py-1 text-right w-24">จำนวน</th>
                              <th className="px-2 py-1 text-right w-20">ร้อยละ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.map((c, idx) => (
                              <tr key={`prow-${idx}`} className="border-b">
                                <td className="px-2 py-1 align-top">{idx + 1}</td>
                                <td className="px-2 py-1 align-top">{c.name}</td>
                                <td className="px-2 py-1 text-right align-top tabular-nums">{formatThaiNumber(c.value)}</td>
                                <td className="px-2 py-1 text-right align-top tabular-nums">{formatThaiNumber(c.percentage)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    )
                  })()}
                </CardContent>
              </Card>

              <Card className="print:break-inside-avoid">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-orange-600" aria-hidden />
                    พื้นที่/จุดเกิดเหตุที่ถูกร้องขอบ่อย
                  </CardTitle>
                  <CardDescription>Top 10 เพื่อการจัดลำดับความสำคัญซ่อมบำรุง/ติดตั้งเพิ่ม (วางแนวนอนเพื่อแสดงชื่อยาวเต็ม)</CardDescription>
                </CardHeader>
                <CardContent>
                  {/* แนวนอน — รองรับชื่อสถานที่ยาว ๆ โดยไม่ต้องตัดข้อความ */}
                  <div className="hidden md:block" style={{ height: Math.max(280, Math.min(10, statistics.top_locations.length) * 36) }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={statistics.top_locations.slice(0, 10).map((t, index) => ({
                          name: t.location || 'ไม่ระบุ',
                          value: t.count,
                          rank: index + 1,
                        }))}
                        margin={{ left: 8, right: 24, top: 8, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
                        <XAxis
                          type="number"
                          allowDecimals={false}
                          tick={{ fontSize: 12 }}
                          tickFormatter={(v) => formatThaiNumber(v)}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          tick={{ fontSize: 12 }}
                          width={220}
                          interval={0}
                        />
                        <ReTooltip
                          formatter={(v) => formatThaiNumber(Number(v))}
                          labelFormatter={(name) => String(name)}
                        />
                        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={22}>
                          {statistics.top_locations.slice(0, 10).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={LOCATION_BAR_COLORS[index] || '#ea580c'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* บนมือถือ — แสดงเป็นรายการอันดับ อ่านง่ายกว่ากราฟ */}
                  <ol className="md:hidden space-y-2 print:hidden">
                    {statistics.top_locations.slice(0, 10).map((t, idx) => {
                      const max = statistics.top_locations[0]?.count || 1
                      const pct = Math.round((t.count / max) * 100)
                      return (
                        <li key={`${t.location}-${idx}`} className="rounded-lg border bg-card p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2 min-w-0">
                              <span
                                className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                                style={{ backgroundColor: LOCATION_BAR_COLORS[idx] || '#ea580c' }}
                              >
                                {idx + 1}
                              </span>
                              <span className="text-sm text-slate-800 break-words">{t.location || 'ไม่ระบุ'}</span>
                            </div>
                            <span className="text-sm font-semibold tabular-nums text-slate-900">{formatThaiNumber(t.count)}</span>
                          </div>
                          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: LOCATION_BAR_COLORS[idx] || '#ea580c' }}
                            />
                          </div>
                        </li>
                      )
                    })}
                  </ol>

                  {/* รายการเต็มรูปแบบสำหรับการพิมพ์ — รับประกันชื่อสถานที่แสดงครบ */}
                  <table className="hidden print:table w-full text-xs mt-3 border-t">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-2 py-1 text-left w-10">#</th>
                        <th className="px-2 py-1 text-left">พื้นที่/จุดเกิดเหตุ</th>
                        <th className="px-2 py-1 text-right w-24">จำนวน (เรื่อง)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statistics.top_locations.slice(0, 10).map((t, idx) => (
                        <tr key={`row-${idx}`} className="border-b">
                          <td className="px-2 py-1 align-top">{idx + 1}</td>
                          <td className="px-2 py-1 align-top">{t.location || 'ไม่ระบุ'}</td>
                          <td className="px-2 py-1 text-right align-top">{formatThaiNumber(t.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

            {/* 5) ตารางสรุปข้อมูลผลการให้บริการ — Print-ready data table */}
            <Card className="print:break-before-page print:break-inside-avoid">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-5 w-5 text-blue-700" aria-hidden />
                  ตารางสรุปผลการให้บริการ
                </CardTitle>
                <CardDescription>
                  ข้อมูลที่จัดเรียงตามตัวชี้วัดประสิทธิภาพ — ใช้แนบประกอบรายงานหรือคัดลอกไปใช้ในเอกสารราชการได้
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/60">
                      <tr>
                        <th className="px-3 py-2 text-left w-1/2">รายการตัวชี้วัด</th>
                        <th className="px-3 py-2 text-right">ค่าที่วัดได้</th>
                        <th className="px-3 py-2 text-left">หมายเหตุ</th>
                      </tr>
                    </thead>
                    <tbody className="[&>tr:nth-child(odd)]:bg-muted/20">
                      <tr>
                        <td className="px-3 py-2">ช่วงเวลาที่ใช้ในการประเมิน</td>
                        <td className="px-3 py-2 text-right tabular-nums font-medium">
                          {appliedRange ? `${formatThaiDate(appliedRange.from)} → ${formatThaiDate(appliedRange.to)}` : `${timeRange} วันย้อนหลัง`}
                        </td>
                        <td className="px-3 py-2 text-[var(--muted-foreground)]">นับจากวันที่บันทึกคำร้อง</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">จำนวนคำร้องที่ให้บริการประชาชน</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatThaiNumber(lpa.total)} คำร้อง</td>
                        <td className="px-3 py-2 text-[var(--muted-foreground)]">รวมทุกสถานะในช่วงเวลา</td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">อัตราการอนุมัติสำเร็จ</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-green-800">
                          {formatThaiNumber(lpa.completionRate)}%
                        </td>
                        <td className="px-3 py-2 text-[var(--muted-foreground)]">
                          อนุมัติ {formatThaiNumber(lpa.done)} / {formatThaiNumber(lpa.total)} คำร้อง
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">อัตราการปฏิเสธ</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-red-800">
                          {formatThaiNumber(lpa.rejectionRate)}%
                        </td>
                        <td className="px-3 py-2 text-[var(--muted-foreground)]">
                          ปฏิเสธ {formatThaiNumber(lpa.rejected)} คำร้อง
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2">ระยะเวลาดำเนินการเฉลี่ย (SLA)</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold">
                          {lpa.avgDays != null ? `${formatThaiNumber(Math.round(lpa.avgDays * 10) / 10)} วัน` : 'ไม่มีข้อมูล'}
                        </td>
                        <td className="px-3 py-2 text-[var(--muted-foreground)]">นับจากวันยื่นถึงวันอนุมัติ</td>
                      </tr>
                      {typeof statistics.processing_time_doc_avg_minutes === 'number' && (
                        <tr>
                          <td className="px-3 py-2">เวลาตรวจเอกสาร → อนุมัติ (เฉลี่ย)</td>
                          <td className="px-3 py-2 text-right tabular-nums font-semibold">
                            {formatDurationThaiFromMinutes(statistics.processing_time_doc_avg_minutes!)}
                          </td>
                          <td className="px-3 py-2 text-[var(--muted-foreground)]">
                            ประมาณ {formatThaiNumber(Math.round(statistics.processing_time_doc_avg_minutes!))} นาที
                          </td>
                        </tr>
                      )}
                      <tr>
                        <td className="px-3 py-2">คำร้องคงค้างระหว่างดำเนินการ</td>
                        <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-800">
                          {formatThaiNumber(lpa.inProgress)} คำร้อง
                        </td>
                        <td className="px-3 py-2 text-[var(--muted-foreground)]">
                          รอเอกสาร {formatThaiNumber(lpa.waitDoc)} • รอยื่น {formatThaiNumber(lpa.waitSubmit)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

          
            {/* ลายเซ็นรับรองสำหรับการพิมพ์ */}
            <div className="hidden print:block pt-8">
              <div className="grid grid-cols-2 gap-12 text-sm">
                <div className="text-center">
                  <div className="border-t border-slate-900 pt-2 mt-16">ผู้จัดทำรายงาน</div>
                  <div className="mt-1 text-[var(--muted-foreground)]">(ลงชื่อ) ............................................</div>
                </div>
                <div className="text-center">
                  <div className="border-t border-slate-900 pt-2 mt-16">ผู้บริหาร</div>
                  <div className="mt-1 text-[var(--muted-foreground)]">(ลงชื่อ) ............................................</div>
                </div>
              </div>
            </div>
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
