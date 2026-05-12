'use client'

import React, { memo, useState, useEffect, useCallback, useRef } from 'react'

/* ======================= Helper Functions ======================= */
/** ฟังก์ชันสำหรับแปลง prefix เป็นภาษาที่เลือก */
function getLocalizedPrefix(prefix: string, language?: string): string {
  if (language !== 'en') {
    return prefix // คืนค่าเดิมถ้าไม่ใช่ภาษาอังกฤษ
  }

  const prefixMap: Record<string, string> = {
    'นาย': 'Mr.',
    'นาง': 'Mrs.',
    'นางสาว': 'Ms.'
  }

  return prefixMap[prefix] || prefix
}
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { checkAuth as verifyAuth } from '@/lib/auth'

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  FileText, Search, RefreshCw, ChevronLeft, ChevronRight, Edit, Trash2, Calendar, User, Phone, Copy, MessageSquare, AlertCircle, Loader2,
  Globe,
} from 'lucide-react'
import { getStatusStyle } from '@/lib/theme-colors'
import { getReportSource } from '@/lib/report-source'

/* -------------------- Types -------------------- */
interface Report {
  report_id: number
  submitted_at: string
  prefix: string
  full_name: string
  age?: number | null
  id_or_passport_number: string
  phone_number: string
  language?: string // เพิ่มฟิลด์ภาษา

  // ที่อยู่
  house_number?: string | null
  village_number?: string | null
  alley?: string | null
  road?: string | null
  sub_district?: string | null
  district?: string | null
  province?: string | null
  postal_code?: string | null

  // รายละเอียดคำร้อง/เหตุการณ์
  category_id?: number | null
  category_name: string
  request_type: string
  request_details?: string | null
  incident_date?: string | null
  incident_time?: string | null
  incident_location?: string | null

  // การเกี่ยวข้องกับเหตุการณ์
  involvement_role?: string | null
  involvement_explain?: string | null

  // สถานะ
  status: string
  priority: string
  status_updated_at?: string | null

  // เจ้าหน้าที่
  assigned_officer_id?: number | null

  // LINE Integration
  line_user_id?: string | null

  // บันทึก
  officer_comments?: string | null
  officer_decision?: string | null
  internal_notes?: string | null
  public_notes?: string | null
  rejection_reason?: string | null

  // Audit
  created_at: string
  updated_at: string
  created_by?: string | null
  updated_by?: string | null
}

interface ReportsResponse {
  success: boolean
  data: {
    items: Report[]
    total: number
    page: number
    limit: number
    pages: number
  }
}

/* -------------------- Quick-pick rejection reasons -------------------- */
const QUICK_REJECT_REASONS = [
  'เอกสารไม่ครบถ้วน',
  'ภาพย้อนหลังเกิน 30 วัน',
  'ผู้ร้องไม่ใช่ผู้เสียหาย',
  'ไม่พบกล้องในพื้นที่ที่ระบุ',
  'ข้อมูลไม่เพียงพอต่อการพิจารณา',
] as const

/* -------------------- Utilities: Thai date (พ.ศ.) -------------------- */
const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']

// ✅ Cache for formatThaiDateBE (js-cache-function-results)
const _dateCache = new Map<string, string>()

function formatThaiDateBE(input: string) {
  if (!input) return ''
  const cached = _dateCache.get(input)
  if (cached) return cached

  let result: string
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) {
    const d = new Date(input)
    if (isNaN(d.getTime())) return input
    const y = d.getFullYear() + 543
    const mo = d.getMonth()
    const day = d.getDate()
    result = `${day} ${THAI_MONTHS_SHORT[mo]} ${y}`
  } else {
    const y = parseInt(m[1], 10) + 543
    const mo = parseInt(m[2], 10) - 1
    const day = parseInt(m[3], 10)
    result = `${day} ${THAI_MONTHS_SHORT[mo]} ${y}`
  }

  _dateCache.set(input, result)
  return result
}

/* -------------------- Status styles using theme colors -------------------- */
const styleOf = (status: string) => getStatusStyle(status)

/* -------------------- Submission source badge -------------------- */
// แสดงเฉพาะกรณี "ยื่นออนไลน์" เท่านั้น — onsite/unknown ไม่แสดง badge (ลด noise ใน table)
// Memoized: ใน table 1 instance ต่อ row × parent re-render บ่อย (polling 30s, status update)
// props เป็น primitives → shallow equality ของ memo ทำงานได้ดี ข้าม re-render เมื่อ row data ไม่เปลี่ยน
const SourceBadge = memo(function SourceBadge({
  createdBy,
  compact = false,
}: { createdBy?: string | null; compact?: boolean }) {
  const info = getReportSource(createdBy)
  if (info.kind !== 'online') return null
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
      title={info.label}
    >
      <Globe className="h-3 w-3 text-emerald-600" aria-hidden="true" />
      {compact ? info.shortLabel : info.label}
    </span>
  )
})

/* -------------------- Skeleton -------------------- */
function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="grid grid-cols-12 gap-3 border rounded-md p-3">
          <Skeleton className="h-5 col-span-2" />
          <Skeleton className="h-5 col-span-3" />
          <Skeleton className="h-5 col-span-2" />
          <Skeleton className="h-5 col-span-2" />
          <Skeleton className="h-5 col-span-1" />
          <Skeleton className="h-5 col-span-2" />
        </div>
      ))}
    </div>
  )
}

/* -------------------- Component -------------------- */
export default function AdminRequestPage() {
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)

  // ✅ เริ่มต้น 10 แถว/หน้า และเพิ่มตัวเลือกให้เปลี่ยนได้
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 0 })

  // Filters
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [refreshing, setRefreshing] = useState(false)

  // For inline update status
  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null)

  // Reject-reason dialog
  const [rejectDialog, setRejectDialog] = useState<{ reportId: number; reason: string } | null>(null)
  const [rejectSubmitting, setRejectSubmitting] = useState(false)

  // Realtime updates
  const lastReportCountRef = useRef(0)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialLoad = useRef(true)

  // ทำให้ fetchReports มีเสถียรภาพ และเป็นผู้จัดการ loading ภายใน
  const fetchReports = useCallback(
    async (page = 1, searchQuery = '', status = 'all', limit = 10, silent = false, source = 'all') => {
      if (!silent) setLoading(true)
      try {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) })
        if (searchQuery) params.append('search', searchQuery)
        if (status && status !== 'all') params.append('status', status)
        if (source && source !== 'all') params.append('source', source)

        const res = await fetch(`/api/reports?${params}`)
        const data: ReportsResponse = await res.json()
        if (data.success) {
          setReports(data.data.items)
          setPagination({
            page: data.data.page,
            limit: data.data.limit,
            total: data.data.total,
            pages: data.data.pages,
          })

          // Track for realtime notifications
          const currentTotal = data.data.total
          const prevCount = lastReportCountRef.current
          if (!isInitialLoad.current && currentTotal > prevCount) {
            const newReports = currentTotal - prevCount
            toast.success(`มีคำร้องใหม่ ${newReports} รายการ`, {
              description: 'ตรวจสอบคำร้องที่เข้ามา',
              duration: 5000,
            })
          }
          lastReportCountRef.current = currentTotal
          isInitialLoad.current = false
        } else if (!silent) {
          toast.error('เกิดข้อผิดพลาดในการดึงข้อมูล')
        }
      } catch {
        if (!silent) toast.error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์')
      } finally {
        if (!silent) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [] // ลบ dependency เพื่อป้องกัน re-render
  )

  // Check authentication first
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

  // Note: search and searchInput are kept in sync manually in handleSearch

  // initial load (ใส่ dependency ให้ครบ)
  useEffect(() => {
    if (authChecked) {
      fetchReports(1, '', 'all', pagination.limit, false, 'all')
    }
  }, [fetchReports, pagination.limit, authChecked])

  // Realtime polling for new reports
  useEffect(() => {
    const startPolling = () => {
      pollingIntervalRef.current = setInterval(() => {
        // Silent update - check for new reports without changing current filters
        fetchReports(pagination.page, searchInput.trim(), statusFilter, pagination.limit, true, sourceFilter)
      }, 30000) // Poll every 30 seconds (reduced frequency)
    }

    const stopPolling = () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }

    // Start polling after initial load and authentication check
    if (authChecked && !loading && reports.length >= 0) {
      startPolling()
    }

    // Cleanup on unmount
    return () => {
      stopPolling()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authChecked]) // Only depend on authChecked to avoid re-renders - intentional

  const handleSearch = () => {
    const searchQuery = searchInput.trim()
    setSearch(searchQuery) // Update search state for consistency
    fetchReports(1, searchQuery, statusFilter, pagination.limit, false, sourceFilter)
  }

  const handleRefresh = () => {
    setRefreshing(true)
    fetchReports(pagination.page, searchInput.trim(), statusFilter, pagination.limit, false, sourceFilter)
  }

  const handlePageChange = (p: number) => {
    if (p >= 1 && p <= pagination.pages) {
      fetchReports(p, searchInput.trim(), statusFilter, pagination.limit, false, sourceFilter)
    }
  }

  const handleLimitChange = (newLimit: number) => {
    setPagination(prev => ({ ...prev, limit: newLimit }))
    // รีเฟรชจากหน้า 1 ด้วย limit ใหม่
    fetchReports(1, searchInput.trim(), statusFilter, newLimit, false, sourceFilter)
  }

  const handleViewPDF = (reportId: number) =>
    window.open(`/api/reports/${reportId}/pdf?mode=draw`, '_blank')

  const handleEdit = (reportId: number) => {
    router.push(`/admin/request/${reportId}/edit`)
  }

  const applyStatusUpdate = async (
    reportId: number,
    newStatus: string,
    extra?: { rejection_reason?: string },
  ) => {
    setUpdatingStatus(reportId)
    try {
      const body: Record<string, unknown> = { status: newStatus, ...extra }
      const res = await fetch(`/api/reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      if (data.success) {
        if (data.data) {
          const hasAddressData =
            data.data.house_number || data.data.sub_district || data.data.province
          const hasRequestDetails =
            data.data.category_id || data.data.request_details || data.data.involvement_role

          if (hasAddressData && hasRequestDetails) {
            setReports(prev => prev.map(r => (r.report_id === reportId ? { ...data.data } : r)))
          } else {
            setReports(prev => prev.map(r => (r.report_id === reportId ? { ...r, ...data.data } : r)))
          }
        } else {
          // Fallback: อัปเดตเฉพาะ status (+ rejection_reason เมื่อปฏิเสธ)
          setReports(prev => prev.map(r => (r.report_id === reportId
            ? { ...r, status: newStatus, ...(extra?.rejection_reason !== undefined ? { rejection_reason: extra.rejection_reason } : {}) }
            : r)))
        }
        toast.success('อัปเดตสถานะเรียบร้อยแล้ว')
        return true
      }
      toast.error(data.message || 'อัปเดตสถานะไม่สำเร็จ')
      return false
    } catch {
      toast.error('เกิดข้อผิดพลาดในการอัปเดตสถานะ')
      return false
    } finally {
      setUpdatingStatus(null)
    }
  }

  const handleStatusUpdate = (reportId: number, newStatus: string) => {
    if (newStatus === 'ปฏิเสธคำร้อง') {
      const current = reports.find(r => r.report_id === reportId)
      setRejectDialog({ reportId, reason: current?.rejection_reason ?? '' })
      return
    }
    void applyStatusUpdate(reportId, newStatus)
  }

  const confirmReject = async () => {
    if (!rejectDialog) return
    const reason = rejectDialog.reason.trim()
    if (!reason) {
      toast.error('กรุณาระบุเหตุผลในการปฏิเสธ')
      return
    }
    setRejectSubmitting(true)
    const ok = await applyStatusUpdate(rejectDialog.reportId, 'ปฏิเสธคำร้อง', {
      rejection_reason: reason,
    })
    setRejectSubmitting(false)
    if (ok) setRejectDialog(null)
  }

  const handleDelete = async (reportId: number) => {
    if (!confirm(`ยืนยันการลบคำร้อง #${reportId}`)) return
    try {
      const res = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        toast.success(`ลบคำร้อง #${reportId} แล้ว`)
        fetchReports(pagination.page, search, statusFilter, pagination.limit)
      } else {
        toast.error(data.message || 'ลบคำร้องไม่สำเร็จ')
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการลบคำร้อง')
    }
  }

  const copyId = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success('คัดลอกเลขบัตรแล้ว')
    } catch {
      toast.error('คัดลอกไม่สำเร็จ')
    }
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[15px] md:text-base leading-relaxed">
      {/* Toolbar */}
      <div className="w-full border-b bg-[var(--card)]/90 backdrop-blur supports-[backdrop-filter]:bg-[var(--card)]/70">
        <div className="px-4 lg:px-6 py-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <input
              type="text"
              placeholder="ค้นหา ชื่อ, เบอร์โทร หรือสถานที่"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="flex h-10 w-full md:w-96 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="ช่องค้นหา"
            />
            <Button onClick={handleSearch} className="h-10 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)]" aria-label="ค้นหา">
              <Search className="h-4 w-4" />
              <span className="ml-2">ค้นหา</span>
            </Button>
            {(searchInput || statusFilter !== 'all' || sourceFilter !== 'all') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchInput('')
                  setSearch('')
                  setStatusFilter('all')
                  setSourceFilter('all')
                  fetchReports(1, '', 'all', pagination.limit, false, 'all')
                }}
                className="h-10"
                aria-label="ล้างการค้นหา"
              >
                ล้าง
              </Button>
            )}
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value)
                // Auto search when status filter changes
                fetchReports(1, searchInput.trim(), value, pagination.limit, false, sourceFilter)
              }}
            >
              <SelectTrigger className="h-10 w-40 md:w-44" aria-label="ตัวกรองสถานะ">
                <SelectValue placeholder="ทุกสถานะ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกสถานะ</SelectItem>
                <SelectItem value="รอดำเนินการ">รอดำเนินการ</SelectItem>
                <SelectItem value="รอยื่นเอกสาร">รอยื่นเอกสาร</SelectItem>
                <SelectItem value="รอเอกสารอนุมัติ">รอเอกสารอนุมัติ</SelectItem>
                <SelectItem value="เอกสารอนุมัติเรียบร้อย">อนุมัติแล้ว</SelectItem>
                <SelectItem value="ปฏิเสธคำร้อง">ปฏิเสธ</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={sourceFilter}
              onValueChange={(value) => {
                setSourceFilter(value)
                fetchReports(1, searchInput.trim(), statusFilter, pagination.limit, false, value)
              }}
            >
              <SelectTrigger className="h-10 w-36 md:w-40" aria-label="ตัวกรองช่องทางยื่น">
                <SelectValue placeholder="ทุกช่องทาง" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุกช่องทาง</SelectItem>
                <SelectItem value="online">ยื่นออนไลน์</SelectItem>
                <SelectItem value="onsite">ยื่นหน้างาน</SelectItem>
              </SelectContent>
            </Select>

            {/* Rows per page */}
            <div className="hidden md:flex items-center gap-2 ml-2">
              <span className="text-sm text-slate-600">แสดงต่อหน้า</span>
              <Select value={String(pagination.limit)} onValueChange={(v) => handleLimitChange(Number(v))}>
                <SelectTrigger className="h-10 w-[90px]" aria-label="จำนวนต่อหน้า">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRefresh()}
            disabled={loading || refreshing}
            className="h-10"
            aria-label="รีเฟรชข้อมูล"
          >
            <RefreshCw className={`h-4 w-4 ${loading || refreshing ? 'animate-spin' : ''}`} />
            <span className="ml-2">รีเฟรช</span>
          </Button>
        </div>
      </div>

      {/* สรุปจำนวน */}
      <div className="px-4 lg:px-6 py-2 text-[var(--muted-foreground)] border-b bg-[var(--accent)]/20 border-[var(--border)]">
        แสดง {loading ? '-' : (reports?.length || 0)} จาก {(pagination.total || 0).toLocaleString()} รายการ 
      </div>

      {/* ===== Desktop Table (md+) ===== */}
      <div className="hidden md:block w-full overflow-auto">
        <div className="min-w-[1100px]">
          <Table className="w-full border-collapse text-base">
            <TableHeader className="sticky top-0 z-10 bg-[var(--muted)] text-[15px]">
              <TableRow className="hover:bg-transparent">
                <TableHead className="border border-[var(--border)] px-4 py-3.5 text-[var(--foreground)] whitespace-nowrap w-[160px]">
                  วันที่ยื่น
                </TableHead>
                <TableHead className="border border-[var(--border)] px-4 py-3.5 text-[var(--foreground)] whitespace-nowrap w-[220px]">
                  ชื่อ-นามสกุล
                </TableHead>
                <TableHead className="border border-[var(--border)] px-4 py-3.5 text-[var(--foreground)] whitespace-nowrap w-[220px]">
                  เลขบัตรประชาชน
                </TableHead>
                <TableHead className="border border-[var(--border)] px-4 py-3.5 text-[var(--foreground)] whitespace-nowrap w-[160px]">
                  เบอร์ติดต่อ
                </TableHead>
                <TableHead className="border border-[var(--border)] px-4 py-3.5 text-[var(--foreground)] whitespace-nowrap w-[220px]">
                  หมวดหมู่/เหตุการณ์
                </TableHead>
                <TableHead className="border border-[var(--border)] px-4 py-3.5 text-[var(--foreground)] text-center whitespace-nowrap w-[180px]">
                  สถานะ
                </TableHead>
                <TableHead className="border border-[var(--border)] px-4 py-3.5 text-[var(--foreground)] text-center whitespace-nowrap w-[120px]">
                  LINE
                </TableHead>
                <TableHead className="border border-[var(--border)] px-4 py-3.5 text-[var(--foreground)] text-center whitespace-nowrap w-[120px]">
                  PDF
                </TableHead>
                <TableHead className="border border-[var(--border)] px-4 py-3.5 text-[var(--foreground)] text-center whitespace-nowrap w-[120px]">
                  แก้ไข
                </TableHead>
                <TableHead className="border border-[var(--border)] px-4  py-3.5 text-[var(--foreground)] text-center whitespace-nowrap w-[120px]">
                  ลบ
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="border border-[var(--border)] px-0 py-0">
                    <TableSkeleton />
                  </TableCell>
                </TableRow>
              ) : (reports?.length || 0) === 0 ? (
                <TableRow className="bg-[var(--background)]">
                  <TableCell colSpan={10} className="border border-[var(--border)] text-center py-12 text-[var(--muted-foreground)]">
                    ไม่พบคำร้อง
                  </TableCell>
                </TableRow>
              ) : (
                (reports || []).map((r, idx) => {
                  const style = styleOf(r.status)
                  return (
                  <TableRow
                    key={r.report_id}
                      className={`${idx % 2 === 1 ? 'bg-[var(--muted)]/20' : 'bg-[var(--background)]'} hover:bg-[var(--accent)]/30 transition-colors`}
                  >
                    {/* วันที่ยื่น + ช่องทาง */}
                    <TableCell className="border border-[var(--border)] px-4 py-3.5 align-top text-[var(--foreground)]">
                      <div className="space-y-1.5">
                        <div>{formatThaiDateBE(r.submitted_at)}</div>
                        <SourceBadge createdBy={r.created_by} compact />
                      </div>
                    </TableCell>

                    {/* ชื่อ-นามสกุล */}
                    <TableCell className="border border-[var(--border)] px-4 py-3.5 align-top text-[var(--foreground)]">
                      <div className="truncate max-w-[220px]" title={`${getLocalizedPrefix(r.prefix, r.language)} ${r.full_name}`}>
                        {getLocalizedPrefix(r.prefix, r.language)} {r.full_name}
                      </div>
                    </TableCell>

                    {/* เลขบัตรประชาชน (คัดลอกได้) */}
                    <TableCell className="border border-[var(--border)] px-4 py-3.5 align-top">
                      <button
                        onClick={() => copyId(r.id_or_passport_number)}
                        className="inline-flex items-center gap-1 font-mono text-[15px] bg-[var(--muted)] border border-[var(--border)] rounded px-2 py-0.5 hover:bg-[var(--muted)]/80"
                        aria-label={`คัดลอกเลขบัตรของคำร้อง ${r.report_id}`}
                        title="คลิกเพื่อคัดลอก"
                      >
                        <Copy className="h-3.5 w-3.5 opacity-70" />
                        {r.id_or_passport_number}
                      </button>
                    </TableCell>

                    {/* เบอร์ติดต่อ (โทรได้) */}
                    <TableCell className="border border-[var(--border)] px-4 py-3.5 align-top">
                      <a href={`tel:${r.phone_number}`} className="text-[var(--foreground)] hover:underline" aria-label={`โทร ${r.phone_number}`}>
                        {r.phone_number}
                      </a>
                    </TableCell>

                    {/* หมวดหมู่ */}
                    <TableCell className="border border-[var(--border)] px-4 py-3.5 align-top">
                      <div className="space-y-1">
                        <Badge variant="outline" className="text-sm bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent-foreground)] font-medium">
                          {r.category_name || 'ไม่ระบุ'}
                        </Badge>
                        {r.request_details && (
                          <div className="text-xs text-[var(--muted-foreground)] pl-2 border-l-2 border-[var(--accent)]/50">
                            ({r.request_details})
                          </div>
                        )}
                      </div>
                    </TableCell>

                    {/* สถานะ (จุดสี + Select พื้นหลังตามสถานะ) */}
                    <TableCell className="border border-[var(--border)] px-4 py-3.5 align-top">
                      <div className="flex flex-col items-center gap-2">
                        <div className="flex items-center justify-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                          <Select
                            value={r.status}
                            onValueChange={(newStatus) => handleStatusUpdate(r.report_id, newStatus)}
                            disabled={updatingStatus === r.report_id}
                          >
                            <SelectTrigger
                              className={`h-8 w-44 text-xs font-medium border-2 ${style.bg} ${style.border} ${style.text}`}
                              aria-label={`เปลี่ยนสถานะคำร้อง #${r.report_id}`}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="รอดำเนินการ">รอดำเนินการ</SelectItem>
                              <SelectItem value="รอยื่นเอกสาร">รอยื่นเอกสาร</SelectItem>
                              <SelectItem value="รอเอกสารอนุมัติ">รอเอกสารอนุมัติ</SelectItem>
                              <SelectItem value="เอกสารอนุมัติเรียบร้อย">อนุมัติแล้ว</SelectItem>
                              <SelectItem value="ปฏิเสธคำร้อง">ปฏิเสธ</SelectItem>
                            </SelectContent>
                          </Select>
                          {updatingStatus === r.report_id && (
                            <div className="ml-1">
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-[var(--primary)] border-t-transparent" />
                            </div>
                          )}
                        </div>
                        {r.status === 'ปฏิเสธคำร้อง' && r.rejection_reason ? (
                          <button
                            type="button"
                            onClick={() => setRejectDialog({ reportId: r.report_id, reason: r.rejection_reason ?? '' })}
                            className="w-full max-w-[14rem] rounded-md border border-red-200 bg-red-50 px-2 py-1.5 text-left text-xs text-red-800 hover:bg-red-100 transition"
                            title="คลิกเพื่อแก้ไขเหตุผล"
                          >
                            <span className="font-medium">เหตุผล:</span> {r.rejection_reason}
                          </button>
                        ) : null}
                      </div>
                    </TableCell>

                    {/* LINE - แสดงสถานะการเชื่อมต่อ */}
                    <TableCell className="border border-[var(--border)] px-4 py-3.5 align-top text-center">
                      {r.line_user_id ? (
                        <div className="flex items-center justify-center gap-1">
                          <MessageSquare className="h-4 w-4 text-green-600" />
                          <span className="text-xs text-green-700 font-medium">เชื่อมต่อแล้ว</span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <MessageSquare className="h-4 w-4 text-gray-400" />
                          <span className="text-xs text-gray-500">ยังไม่เชื่อม</span>
                        </div>
                      )}
                    </TableCell>

                    {/* PDF = ปุ่มฟ้า (ไม่ใช่สีอันตราย) */}
                    <TableCell className="border border-[var(--border)] px-4 py-3.5 align-top text-center">
                      <Button
                        size="sm"
                        onClick={() => handleViewPDF(r.report_id)}
                        className="h-9 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)]"
                        aria-label={`เปิดเอกสาร PDF ของคำร้อง #${r.report_id}`}
                      >
                        <FileText className="h-4 w-4" />
                        <span className="ml-1.5">เอกสาร</span>
                      </Button>
                    </TableCell>

                    {/* แก้ไข */}
                    <TableCell className="border border-[var(--border)] px-4 py-3.5 align-top text-center">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(r.report_id)} className="h-9" aria-label={`แก้ไขคำร้อง #${r.report_id}`}>
                        <Edit className="h-4 w-4" />
                        <span className="ml-1.5">แก้ไข</span>
                      </Button>
                    </TableCell>

                    {/* ลบ */}
                    <TableCell className="border border-[var(--border)] px-4 py-3.5 align-top text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(r.report_id)}
                        className="h-9 text-[var(--destructive)] hover:text-[var(--destructive)] hover:bg-[var(--destructive)]/10 border-[var(--destructive)]/50"
                        aria-label={`ลบคำร้อง #${r.report_id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="ml-1.5">ลบ</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ===== Mobile Cards ( < md ) ===== */}
      <div className="md:hidden px-3 py-3 space-y-3">
        {loading ? (
          <TableSkeleton />
        ) : (reports?.length || 0) === 0 ? (
          <div className="text-center text-[var(--muted-foreground)] py-6">ไม่พบคำร้อง</div>
        ) : (
          (reports || []).map((r) => {
            const style = styleOf(r.status)
            return (
            <div key={r.report_id} className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center text-[var(--foreground)] font-medium">
                    <User className="h-4 w-4 mr-1.5 text-[var(--muted-foreground)]" />
                    {getLocalizedPrefix(r.prefix, r.language)} {r.full_name}
                  </div>
                  <div className="flex items-center text-[var(--muted-foreground)] text-sm gap-1.5 flex-wrap">
                    <Calendar className="h-4 w-4 text-[var(--muted-foreground)]" />
                    <span>{formatThaiDateBE(r.submitted_at)}</span>
                    <SourceBadge createdBy={r.created_by} compact />
                  </div>
                  <div className="flex items-center text-[var(--muted-foreground)] text-sm">
                    <Phone className="h-4 w-4 mr-1.5 text-[var(--muted-foreground)]" />
                    <a href={`tel:${r.phone_number}`} className="hover:underline">{r.phone_number}</a>
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    เลขบัตร:{' '}
                    <button onClick={() => copyId(r.id_or_passport_number)} className="underline underline-offset-2">
                      {r.id_or_passport_number}
                    </button>
                  </div>
                  <div className="text-xs">
                    <div className="flex items-center gap-1">
                      <span>หมวดหมู่:</span>
                      <Badge variant="outline" className="bg-[var(--accent)]/20 border-[var(--accent)] text-[var(--accent-foreground)] font-medium">
                        {r.category_name || 'ไม่ระบุ'}
                      </Badge>
                    </div>
                    {r.request_details && (
                      <div className="text-[var(--muted-foreground)] pl-4 border-l-2 border-[var(--accent)]/50 mt-1">
                        ({r.request_details})
                      </div>
                    )}
                    {/* LINE Connection Status */}
                    <div className="flex items-center gap-1 mt-1">
                      <MessageSquare className={`h-3 w-3 ${r.line_user_id ? 'text-green-600' : 'text-gray-400'}`} />
                      <span className={`text-xs ${r.line_user_id ? 'text-green-700' : 'text-gray-500'}`}>
                        {r.line_user_id ? 'เชื่อมต่อ LINE แล้ว' : 'ยังไม่เชื่อม LINE'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* สถานะ (จุดสี + Select) */}
                <div className="flex flex-col items-end gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
                    <Select
                      value={r.status}
                      onValueChange={(newStatus) => handleStatusUpdate(r.report_id, newStatus)}
                      disabled={updatingStatus === r.report_id}
                    >
                      <SelectTrigger className={`h-8 w-36 text-xs font-medium border-2 ${style.bg} ${style.border} ${style.text}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="รอดำเนินการ">รอดำเนินการ</SelectItem>
                        <SelectItem value="รอยื่นเอกสาร">รอยื่นเอกสาร</SelectItem>
                        <SelectItem value="รอเอกสารอนุมัติ">รอเอกสาร</SelectItem>
                        <SelectItem value="เอกสารอนุมัติเรียบร้อย">อนุมัติแล้ว</SelectItem>
                        <SelectItem value="ปฏิเสธคำร้อง">ปฏิเสธ</SelectItem>
                      </SelectContent>
                    </Select>
                    {updatingStatus === r.report_id && (
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-[var(--primary)] border-t-transparent" />
                    )}
                  </div>
                </div>
              </div>
              {r.status === 'ปฏิเสธคำร้อง' && r.rejection_reason ? (
                <button
                  type="button"
                  onClick={() => setRejectDialog({ reportId: r.report_id, reason: r.rejection_reason ?? '' })}
                  className="mt-2 w-full rounded-md border border-red-200 bg-red-50 px-3 py-2 text-left text-xs text-red-800 hover:bg-red-100 transition"
                >
                  <span className="font-medium">เหตุผลที่ปฏิเสธ:</span> {r.rejection_reason}
                </button>
              ) : null}

              <div className="mt-3 flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  onClick={() => handleViewPDF(r.report_id)}
                  className="h-8 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)]"
                  aria-label={`เปิด PDF #${r.report_id}`}
                >
                  <FileText className="h-4 w-4" />
                  <span className="ml-1">เอกสาร</span>
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleEdit(r.report_id)} className="h-8">
                  <Edit className="h-4 w-4" />
                  <span className="ml-1">แก้ไข</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleDelete(r.report_id)}
                  className="h-8 text-[var(--destructive)] hover:text-[var(--destructive)] hover:bg-[var(--destructive)]/10 border-[var(--destructive)]/50"
                >
                  <Trash2 className="h-4 w-4" />
                  <span className="ml-1">ลบ</span>
                </Button>
              </div>
            </div>
            )
          })
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="px-4 lg:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-[var(--border)]">
          <div className="text-[var(--muted-foreground)]">
            หน้า <span className="font-medium">{pagination.page}</span> จาก{' '}
            <span className="font-medium">{pagination.pages.toLocaleString()}</span> หน้า • หน้าละ {pagination.limit}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="h-9"
              aria-label="ก่อนหน้า"
            >
              <ChevronLeft className="h-4 w-4" />
              ก่อนหน้า
            </Button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(7, pagination.pages) }, (_, i) => {
                const p = Math.max(1, pagination.page - 3) + i
                if (p > pagination.pages) return null
                const active = p === pagination.page
                return (
                  <Button
                    key={p}
                    variant={active ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePageChange(p)}
                    className={`h-9 ${active ? 'bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)]' : 'hover:bg-[var(--accent)]/20'}`}
                    aria-label={`ไปหน้า ${p}`}
                  >
                    {p}
                  </Button>
                )
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
              className="h-9"
              aria-label="ถัดไป"
            >
              ถัดไป
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={rejectDialog !== null}
        onOpenChange={(open) => { if (!open && !rejectSubmitting) setRejectDialog(null) }}
      >
        <DialogContent
          className="
            p-0 gap-0 overflow-hidden border-0 shadow-2xl
            w-[calc(100%-1.5rem)] sm:w-full sm:max-w-md
            flex flex-col max-h-[calc(100dvh-2rem)]
          "
        >
          <div className="h-1.5 bg-gradient-to-r from-red-500 via-rose-500 to-red-600" aria-hidden />

          <div className="px-5 pt-5 pb-3 sm:px-6 sm:pt-6">
            <DialogHeader className="space-y-3 text-left">
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-red-50 ring-4 ring-red-100/60">
                  <AlertCircle className="h-5 w-5 text-red-600" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <DialogTitle className="text-base sm:text-lg font-semibold text-slate-900">
                    ปฏิเสธคำร้อง
                  </DialogTitle>
                  {rejectDialog ? (() => {
                    const r = reports.find(x => x.report_id === rejectDialog.reportId)
                    return (
                      <p className="truncate text-xs sm:text-sm text-slate-500">
                        #{rejectDialog.reportId}
                        {r?.full_name ? ` · ${getLocalizedPrefix(r.prefix, r.language)} ${r.full_name}` : ''}
                      </p>
                    )
                  })() : null}
                </div>
              </div>
              <DialogDescription className="text-sm text-slate-600 leading-relaxed">
                เหตุผลที่ระบุจะถูกบันทึกในระบบและแสดงในรายงาน PDF ประจำเดือน เพื่อให้ตรวจสอบย้อนหลังได้
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-5 sm:px-6 pb-4 space-y-4 flex-1 overflow-y-auto">
            <div className="space-y-2">
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">เหตุผลที่ใช้บ่อย</p>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_REJECT_REASONS.map((reason) => {
                  const active = rejectDialog?.reason.trim() === reason
                  return (
                    <button
                      key={reason}
                      type="button"
                      disabled={rejectSubmitting}
                      onClick={() => setRejectDialog((prev) => (prev ? { ...prev, reason } : prev))}
                      className={[
                        'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                        'active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed',
                        active
                          ? 'border-red-300 bg-red-50 text-red-700 shadow-inner'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-red-300 hover:bg-red-50 hover:text-red-700',
                      ].join(' ')}
                    >
                      {reason}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="reject-reason" className="text-sm font-medium text-slate-800">
                เหตุผลที่ปฏิเสธ <span className="text-red-500">*</span>
              </label>
              <Textarea
                id="reject-reason"
                rows={4}
                autoFocus
                placeholder="ระบุเหตุผลให้ชัดเจน หรือเลือกจากรายการด้านบน"
                value={rejectDialog?.reason ?? ''}
                onChange={(e) => setRejectDialog((prev) => (prev ? { ...prev, reason: e.target.value } : prev))}
                disabled={rejectSubmitting}
                maxLength={500}
                className="min-h-[112px] resize-none text-sm leading-relaxed focus-visible:border-red-300 focus-visible:ring-red-200/60"
              />
              <div className="flex items-center justify-end text-xs">
                <span
                  className={[
                    'tabular-nums',
                    (rejectDialog?.reason.length ?? 0) >= 480 ? 'text-amber-600 font-medium' : 'text-slate-400',
                  ].join(' ')}
                >
                  {(rejectDialog?.reason ?? '').length}/500
                </span>
              </div>
            </div>
          </div>

          <div className="px-5 sm:px-6 py-3.5 border-t border-slate-200 bg-slate-50/70 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setRejectDialog(null)}
              disabled={rejectSubmitting}
              className="w-full sm:w-auto h-10"
            >
              ยกเลิก
            </Button>
            <Button
              onClick={() => void confirmReject()}
              disabled={rejectSubmitting || !(rejectDialog?.reason ?? '').trim()}
              className="w-full sm:w-auto h-10 bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-600/20 disabled:bg-red-300 disabled:shadow-none"
            >
              {rejectSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  กำลังบันทึก…
                </span>
              ) : (
                'ยืนยันการปฏิเสธ'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
