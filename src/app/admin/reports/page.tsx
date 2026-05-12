'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { BarChart3 } from 'lucide-react'
import { checkAuth as verifyAuth } from '@/lib/auth'

/* =============================================================================
 * Types — UNCHANGED (data contract preserved)
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
  processing_time_doc_avg_minutes?: number | null
}

/* =============================================================================
 * Utilities (Thai)
 * ========================================================================== */
const formatThaiNumber = (n: number) => n.toLocaleString('th-TH')

const THAI_MONTHS_SHORT = [
  'ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.',
  'ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.',
] as const

/** "January 2026" / "1 2026" → "ม.ค. 69" (BE short, design format) */
function monthLabelShort(m: string, y: number): string {
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
  return `${THAI_MONTHS_SHORT[idx]} ${String(yBE).slice(-2)}`
}

/** "2026-01-15" → "15 ม.ค. 2569" */
function formatThaiDate(input: string): string {
  if (!input) return ''
  const m = input.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return input
  const yBE = parseInt(m[1], 10) + 543
  const moIdx = Math.max(0, Math.min(11, parseInt(m[2], 10) - 1))
  const day = parseInt(m[3], 10)
  return `${day} ${THAI_MONTHS_SHORT[moIdx]} ${yBE}`
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
  if (minutes || parts.length === 0) parts.push(`${formatThaiNumber(minutes)} น.`)
  return parts.join(' ')
}

const THAI_MONTHS_SELECT = [
  { value: '1',  label: 'มกราคม' },
  { value: '2',  label: 'กุมภาพันธ์' },
  { value: '3',  label: 'มีนาคม' },
  { value: '4',  label: 'เมษายน' },
  { value: '5',  label: 'พฤษภาคม' },
  { value: '6',  label: 'มิถุนายน' },
  { value: '7',  label: 'กรกฎาคม' },
  { value: '8',  label: 'สิงหาคม' },
  { value: '9',  label: 'กันยายน' },
  { value: '10', label: 'ตุลาคม' },
  { value: '11', label: 'พฤศจิกายน' },
  { value: '12', label: 'ธันวาคม' },
] as const

function getDefaultPdfMonth() { return String(new Date().getMonth() + 1) }
function getDefaultPdfYear()  { return String(new Date().getFullYear() + 543) }
function getPdfYearOptions() {
  const cur = new Date().getFullYear() + 543
  return Array.from({ length: 4 }, (_, i) => String(cur - i))
}

/* =============================================================================
 * Royal Navy tokens — status mapping for current data
 * Design palette: royal navy primary #002366 + bronze accent #92691F
 * ========================================================================== */
const STATUS_COLOR_MAP: Record<string, string> = {
  'เอกสารอนุมัติเรียบร้อย': '#1E8E5A', // done   — green
  'รอเอกสารอนุมัติ':         '#C68A14', // pending — amber
  'รอยื่นเอกสาร':           '#123E86', // wait    — royal navy
  'ปฏิเสธคำร้อง':           '#B43A3A', // reject  — red
}

/** Top 10 location bars: bronze 1–5, navy 6–10 */
const LOCATION_COLORS = [
  '#92691F', '#A87827', '#B98A2E', '#CB9A38', '#D9A347',
  '#002366', '#123E86', '#2D5798', '#5475AD', '#7E99C6',
]

/** Category bar: 4 levels of bronze gradient by rank */
function categoryGradient(idx: number): string {
  if (idx < 2) return 'linear-gradient(90deg, #92691F, #B98A2E)'
  if (idx < 4) return 'linear-gradient(90deg, #B98A2E, #D9A347)'
  if (idx < 6) return 'linear-gradient(90deg, #D9A347, #E6C079)'
  return 'linear-gradient(90deg, #E6C079, #F2DDB8)'
}

/* =============================================================================
 * Page
 * ========================================================================== */
export default function AdminReportsPage() {
  const router = useRouter()

  // ---------- state (UNCHANGED — preserves data fetching contract) ----------
  const [statistics, setStatistics] = useState<StatisticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)
  const [timeRange, setTimeRange] = useState('30')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string } | null>(null)
  const [pdfMonth, setPdfMonth] = useState(getDefaultPdfMonth)
  const [pdfYear, setPdfYear] = useState(getDefaultPdfYear)
  const [refreshSpin, setRefreshSpin] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  // ---------- auth (UNCHANGED) ----------
  useEffect(() => {
    let cancelled = false
    verifyAuth().then(user => {
      if (cancelled) return
      if (!user) { router.push('/login'); return }
      setAuthChecked(true)
    })
    return () => { cancelled = true }
  }, [router])

  // ---------- fetchStatistics (UNCHANGED) ----------
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
      if (data?.success) {
        setStatistics(data.data as StatisticsData)
        const now = new Date()
        setLastUpdated(`${now.getDate()} ${THAI_MONTHS_SHORT[now.getMonth()]} ${now.getFullYear()+543} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')} น.`)
      } else {
        toast.error(data?.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ')
      }
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
    if (!dateFrom || !dateTo) { toast.error('กรุณาเลือกวันที่เริ่มต้นและสิ้นสุด'); return }
    if (dateFrom > dateTo)    { toast.error('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด'); return }
    setAppliedRange({ from: dateFrom, to: dateTo })
  }

  const clearDateRange = () => {
    setDateFrom(''); setDateTo(''); setAppliedRange(null)
  }

  const handleRefresh = () => {
    setRefreshSpin(true)
    if (appliedRange) fetchStatistics({ from: appliedRange.from, to: appliedRange.to })
    else fetchStatistics({ days: timeRange })
    setTimeout(() => setRefreshSpin(false), 800)
  }

  const handlePrint = () => { window.print() }

  // ---------- derived (UNCHANGED logic) ----------
  const sparklineValues = (statistics?.monthly_trend || []).map(m => m.count)
  const latest = sparklineValues.at(-1) ?? 0
  const prev = sparklineValues.at(-2) ?? 0
  const deltaPct = prev === 0 ? (latest > 0 ? 100 : 0) : Math.round(((latest - prev) / prev) * 1000) / 10

  const lpa = useMemo(() => {
    if (!statistics) return null
    const total = Number(statistics.total_reports || 0)
    const findCount = (s: string) => statistics.status_breakdown.find(x => x.status === s)?.count || 0
    const done = findCount('เอกสารอนุมัติเรียบร้อย')
    const rejected = findCount('ปฏิเสธคำร้อง')
    const waitDoc = findCount('รอเอกสารอนุมัติ')
    const waitSubmit = findCount('รอยื่นเอกสาร')
    const inProgress = waitDoc + waitSubmit
    const avgDays = typeof statistics.processing_time_avg === 'number' ? statistics.processing_time_avg : null
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0)
    return {
      total, done, rejected, inProgress, waitDoc, waitSubmit,
      completionRate: pct(done),
      rejectionRate: pct(rejected),
      backlogRate: pct(inProgress),
      waitDocRate: pct(waitDoc),
      waitSubmitRate: pct(waitSubmit),
      avgDays,
    }
  }, [statistics])

  const csvBlobUrl = useMemo(() => {
    if (!statistics || !lpa) return null
    const periodLabel = appliedRange
      ? `${formatThaiDate(appliedRange.from)} ถึง ${formatThaiDate(appliedRange.to)}`
      : `${timeRange} วันย้อนหลัง`
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
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    return URL.createObjectURL(blob)
  }, [statistics, lpa, appliedRange, timeRange])

  useEffect(() => {
    if (!csvBlobUrl) return
    return () => { URL.revokeObjectURL(csvBlobUrl) }
  }, [csvBlobUrl])

  // ---------- chart data prep ----------
  const monthlyData = (statistics?.monthly_trend || []).map(m => ({
    name: monthLabelShort(m.month, m.year),
    v: m.count,
  }))

  // ---------- Auth-checking loader ----------
  if (!authChecked) {
    return (
      <div className="mb-app-loader">
        <div className="spinner" />
        <p>กำลังตรวจสอบสิทธิ์...</p>
        <style dangerouslySetInnerHTML={{ __html: `
          .mb-app-loader { min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: #F4F6FA; font-family: inherit; color: #5A657A; font-size: 14px; }
          .mb-app-loader .spinner { width: 36px; height: 36px; border: 3px solid #DCE7F7; border-top-color: #002366; border-radius: 50%; animation: mb-spin .8s linear infinite; }
          @keyframes mb-spin { to { transform: rotate(360deg); } }
        ` }} />
      </div>
    )
  }

  // ---------- Page ----------
  const periodLabel = appliedRange
    ? `${formatThaiDate(appliedRange.from)} – ${formatThaiDate(appliedRange.to)}`
    : `ช่วง ${timeRange} วันย้อนหลัง`

  return (
    <div className="mb-root">
      {/* Modern Blue scoped CSS */}
      <style dangerouslySetInnerHTML={{ __html: MODERN_BLUE_CSS }} />

      <div className="mb-app">
        {/* ---------- Print-only cover ---------- */}
        <div className="print-only print-cover">
          <div className="kicker">รายงานสรุปคำร้องขอดูภาพจากกล้อง CCTV</div>
          <h1>เทศบาลนครหัวหิน • รายงานสรุปการให้บริการประชาชน</h1>
          <div className="range">ช่วงข้อมูล: {periodLabel}</div>
          <div className="print-date">วันที่จัดพิมพ์: {lastUpdated || '—'}</div>
        </div>

        {/* ---------- Topbar ---------- */}
        <header className="topbar no-print">
          <div className="brand">
            <div className="brand-mark" aria-hidden>
              <BarChart3 className="brand-icon" strokeWidth={2.2} />
            </div>
            <div className="brand-text">
              <h1>รายงานสรุปคำร้องขอดูภาพจากกล้อง CCTV</h1>
              <div className="sub">เทศบาลนครหัวหิน • รายงานสรุปการให้บริการประชาชน</div>
            </div>
          </div>
         
        </header>

        {/* ---------- Action bar ---------- */}
        <section className="actions no-print" aria-label="ตัวกรองและการดำเนินการ">
          <div className="group" aria-label="ช่วงข้อมูลด่วน">
            <span className="label">ช่วงข้อมูล</span>
            <div className="preset" role="tablist">
              {[['7','7 วัน'],['30','30 วัน'],['90','90 วัน'],['365','365 วัน']].map(([v, lbl]) => (
                <button
                  key={v}
                  type="button"
                  role="tab"
                  className={!appliedRange && timeRange === v ? 'is-active' : ''}
                  onClick={() => { setTimeRange(v); setAppliedRange(null); setDateFrom(''); setDateTo('') }}
                  disabled={loading}
                >{lbl}</button>
              ))}
            </div>
          </div>

          <div className="group" aria-label="กำหนดช่วงวันที่เอง">
            <span className="label">กำหนดเอง</span>
            <span className="date-input">
              <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" style={{ color: '#7E899E' }}>
                <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/>
              </svg>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} max={dateTo || undefined} aria-label="วันที่เริ่มต้น" />
              <span className="arrow">→</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} min={dateFrom || undefined} aria-label="วันที่สิ้นสุด" />
            </span>
            <button className="btn btn-primary" onClick={applyDateRange} disabled={loading || !dateFrom || !dateTo}>ใช้ช่วงวันที่</button>
            <button className="btn btn-ghost" onClick={clearDateRange} disabled={loading || (!appliedRange && !dateFrom && !dateTo)}>ล้าง</button>
          </div>

          <div className="spacer" />

          <div className="group">
            <button className="btn" onClick={handleRefresh} disabled={loading}>
              <svg className={`ico ${refreshSpin || loading ? 'spinning' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5"/></svg>
              รีเฟรช
            </button>
            <button className="btn" onClick={handlePrint}>
              <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z"/></svg>
              พิมพ์
            </button>
            {csvBlobUrl && (
              <a className="btn" href={csvBlobUrl} download={`cctv-report-summary-${appliedRange ? `${appliedRange.from}_to_${appliedRange.to}` : `${timeRange}d`}.csv`}>
                <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>
                CSV Export
              </a>
            )}
          </div>

          <div className="group">
            <span className="label">PDF ประจำเดือน</span>
            <span className="month-select">
              <select value={pdfMonth} onChange={e => setPdfMonth(e.target.value)} aria-label="เดือน">
                {THAI_MONTHS_SELECT.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select value={pdfYear} onChange={e => setPdfYear(e.target.value)} aria-label="ปี พ.ศ.">
                {getPdfYearOptions().map(yr => <option key={yr} value={yr}>{yr}</option>)}
              </select>
              <button className="btn btn-primary" onClick={() => window.open(`/api/admin/reports/monthly-pdf?month=${pdfMonth}&year=${pdfYear}`, '_blank')}>
                <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>
                ออกรายงาน
              </button>
            </span>
          </div>
        </section>

        {/* ---------- Range chip ---------- */}
        <div className="chip-row no-print">
          <span className="range-chip">
            <span className="pip">{appliedRange ? 'กำหนดเอง' : `${timeRange} วัน`}</span>
            <span>
              {periodLabel}
              {statistics && ` · ทั้งหมด ${formatThaiNumber(statistics.total_reports)} คำร้อง`}
            </span>
          </span>
          {lastUpdated && <span className="updated">อัปเดตล่าสุด <span>{lastUpdated}</span></span>}
        </div>

        {/* ---------- Body ---------- */}
        {loading && !statistics ? (
          <LoadingSkeleton />
        ) : statistics && lpa ? (
          <>
            {/* 1. Primary KPIs */}
            <div className="section-head">
              <h2>ตัวชี้วัดประสิทธิภาพการให้บริการ</h2>
              <span className="meta">{periodLabel}</span>
            </div>
            <div className="grid-4">
              <PrimaryKpi
                name="คำร้องที่ให้บริการ"
                value={formatThaiNumber(lpa.total)}
                unit="คำร้อง"
                spark={sparklineValues.length >= 2 ? sparklineValues : undefined}
                trend={sparklineValues.length >= 2 ? { kind: deltaPct > 0 ? 'up' : deltaPct < 0 ? 'down' : 'flat', text: `${deltaPct > 0 ? '↑' : deltaPct < 0 ? '↓' : '·'} ${Math.abs(deltaPct).toFixed(1)}%` } : undefined}
                note="เทียบเดือนก่อน"
                glyphPath={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></>}
              />
              <PrimaryKpi
                name="อัตราอนุมัติสำเร็จ"
                value={formatThaiNumber(lpa.completionRate)}
                unit="%"
                progressPct={lpa.completionRate}
                progressColor="#1E8E5A"
                note={`อนุมัติ ${formatThaiNumber(lpa.done)} / ${formatThaiNumber(lpa.total)}`}
                glyphPath={<><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/></>}
              />
              <PrimaryKpi
                name="ระยะเวลาดำเนินการเฉลี่ย"
                value={lpa.avgDays != null ? formatThaiNumber(Math.round(lpa.avgDays * 10) / 10) : '—'}
                unit="วัน"
                note="ตั้งแต่วันยื่นถึงวันอนุมัติ (SLA)"
                glyphPath={<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}
              />
              <PrimaryKpi
                name="คำร้องคงค้างระหว่างดำเนินการ"
                value={formatThaiNumber(lpa.inProgress)}
                unit="คำร้อง"
                note={`${formatThaiNumber(lpa.backlogRate)}% ของคำร้องทั้งหมด`}
                tone={lpa.backlogRate > 30 ? 'warn' : 'default'}
                glyphPath={<><circle cx="12" cy="12" r="9"/><path d="M12 8v5l3 2"/></>}
              />
            </div>

            {/* 2. Supporting KPIs */}
            <div className="section-head">
              <h2>ภาพรวมสถานะคำร้อง</h2>
              <span className="meta">รวม {formatThaiNumber(lpa.total)} คำร้อง</span>
            </div>
            <div className="grid-4">
              <SupportKpi name="คำร้องที่แล้วเสร็จ" value={lpa.done} pct={lpa.completionRate} status="done" glyphPath={<path d="M5 13l4 4L19 7"/>} />
              <SupportKpi name="รอเอกสารอนุมัติ" value={lpa.waitDoc} pct={lpa.waitDocRate} status="pending" glyphPath={<><path d="M12 8v5l3 2"/><circle cx="12" cy="12" r="9"/></>} />
              <SupportKpi name="รอยื่นเอกสาร" value={lpa.waitSubmit} pct={lpa.waitSubmitRate} status="wait" glyphPath={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>} />
              <SupportKpi name="คำร้องที่ถูกปฏิเสธ" value={lpa.rejected} pct={lpa.rejectionRate} status="reject" glyphPath={<><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></>} />
            </div>

            {/* 3. Status table + Pie */}
            <div className="section-head">
              <h2>สรุปสถานะและแนวโน้ม</h2>
              <span className="meta">ตาราง · กราฟวงกลม · แนวโน้มรายเดือน</span>
            </div>
            <div className="row-2">
              <div className="card">
                <div className="card-title">
                  <h3>ตารางสรุปสถานะ</h3>
                  <span className="hint">ทั้งหมด {formatThaiNumber(lpa.total)} คำร้อง</span>
                </div>
                <table className="table-status">
                  <thead>
                    <tr>
                      <th>สถานะ</th>
                      <th className="bar-cell">สัดส่วน</th>
                      <th style={{ textAlign: 'right' }}>จำนวน</th>
                      <th style={{ textAlign: 'right' }}>ร้อยละ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statistics.status_breakdown.map(s => {
                      const color = STATUS_COLOR_MAP[s.status] ?? '#2563B6'
                      return (
                        <tr key={s.status}>
                          <td><div className="status-cell"><span className="swatch" style={{ background: color }} /><span>{s.status}</span></div></td>
                          <td className="bar-cell"><div className="mini-bar"><div style={{ width: `${s.percentage}%`, background: color }} /></div></td>
                          <td className="num">{formatThaiNumber(s.count)}</td>
                          <td className="pct" style={{ color }}>{formatThaiNumber(Math.round(s.percentage * 10) / 10)}%</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="card">
                <div className="card-title">
                  <h3>สัดส่วนคำร้องตามสถานะ</h3>
                  <span className="hint">ข้อมูลช่วงปัจจุบัน</span>
                </div>
                <div className="pie-wrap">
                  <PieSvg data={statistics.status_breakdown} total={lpa.total} />
                  <div className="legend">
                    {statistics.status_breakdown.map(s => {
                      const color = STATUS_COLOR_MAP[s.status] ?? '#2563B6'
                      return (
                        <div key={s.status} className="legend-row">
                          <span className="swatch" style={{ background: color }} />
                          <span className="name">{s.status}</span>
                          <span className="val">{formatThaiNumber(s.count)}</span>
                          <span className="pct">{formatThaiNumber(Math.round(s.percentage * 10) / 10)}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Area chart */}
            <div className="card spacer-y">
              <div className="card-title">
                <h3>แนวโน้มจำนวนคำร้องรายเดือน</h3>
                <span className="hint">{monthlyData.length > 0 ? `${monthlyData[0].name} – ${monthlyData.at(-1)?.name}` : '—'}</span>
              </div>
              <AreaSvg data={monthlyData} />
            </div>

            {/* 5. Categories + Locations */}
            <div className="section-head">
              <h2>หมวดหมู่และพื้นที่ยอดนิยม</h2>
              <span className="meta">หมวดหมู่ Top 8 · พื้นที่ Top 10</span>
            </div>
            <div className="row-bars">
              <div className="card">
                <div className="card-title">
                  <h3>หมวดหมู่เหตุการณ์ที่ถูกร้องขอบ่อย</h3>
                  <span className="hint">Bronze gradient · Top 8</span>
                </div>
                <div className="bars">
                  {statistics.category_breakdown.slice(0, 8).map((c, i) => {
                    const max = statistics.category_breakdown[0]?.count || 1
                    const w = (c.count / max) * 100
                    return (
                      <div className="bar-row" key={`${c.category_name}-${i}`}>
                        <span className="rank">{i + 1}</span>
                        <div className="label-track">
                          <div className="bar-fill" style={{ width: `${w}%`, backgroundImage: categoryGradient(i) }} />
                          <span className="label-text" title={c.category_name}>{c.category_name || 'ไม่ระบุ'}</span>
                        </div>
                        <span className="bar-num">{formatThaiNumber(c.count)}</span>
                      </div>
                    )
                  })}
                  {statistics.category_breakdown.length === 0 && <div className="bar-empty">ไม่มีข้อมูลหมวดหมู่</div>}
                </div>
              </div>
              <div className="card">
                <div className="card-title">
                  <h3>พื้นที่/จุดเกิดเหตุยอดนิยม</h3>
                  <span className="hint">Bronze 1–5 · Navy 6–10</span>
                </div>
                <div className="bars">
                  {statistics.top_locations.slice(0, 10).map((l, i) => {
                    const max = statistics.top_locations[0]?.count || 1
                    const w = (l.count / max) * 100
                    const color = LOCATION_COLORS[i] ?? '#7BA6DB'
                    return (
                      <div className="bar-row" key={`${l.location}-${i}`}>
                        <span className="rank">{i + 1}</span>
                        <div className="label-track">
                          <div className="bar-fill" style={{ width: `${w}%`, background: color }} />
                          <span className="label-text" style={{ color: w > 55 ? '#fff' : '#0B1220' }} title={l.location}>{l.location || 'ไม่ระบุ'}</span>
                        </div>
                        <span className="bar-num">{formatThaiNumber(l.count)}</span>
                      </div>
                    )
                  })}
                  {statistics.top_locations.length === 0 && <div className="bar-empty">ไม่มีข้อมูลพื้นที่</div>}
                </div>
              </div>
            </div>

            {/* 6. SLA Panel */}
            {(typeof statistics.processing_time_avg === 'number' || typeof statistics.processing_time_doc_avg_minutes === 'number') && (
              <>
                <div className="section-head">
                  <h2>เวลาดำเนินการเฉลี่ย (SLA)</h2>
                  <span className="meta">มาตรฐาน 7 วันทำการ</span>
                </div>
                <div className="card spacer-y">
                  <div className="sla-grid">
                    <div className="sla-cell primary">
                      <div className="lbl">ค่าเฉลี่ยเวลาดำเนินการรวม</div>
                      <div className="big">
                        {lpa.avgDays != null ? formatThaiNumber(Math.round(lpa.avgDays * 10) / 10) : '—'}
                        <span style={{ fontSize: 18, color: '#5A657A', fontWeight: 500, marginLeft: 6 }}>วัน</span>
                      </div>
                      <div className="unit-line">นับจากวันยื่นถึงวันอนุมัติ (SLA)</div>
                    </div>
                    {typeof statistics.processing_time_doc_avg_minutes === 'number' && (
                      <div className="sla-cell bronze">
                        <div className="lbl">เวลาตรวจเอกสาร → อนุมัติ</div>
                        <div className="big">{formatDurationThaiFromMinutes(statistics.processing_time_doc_avg_minutes)}</div>
                        <div className="unit-line">เฉลี่ยภายในกระบวนการพิจารณา</div>
                      </div>
                    )}
                    {typeof statistics.processing_time_doc_avg_minutes === 'number' && (
                      <div className="sla-cell navy">
                        <div className="lbl">หน่วยนาที (เฉลี่ย)</div>
                        <div className="big">
                          {formatThaiNumber(Math.round(statistics.processing_time_doc_avg_minutes))}
                          <span style={{ fontSize: 14, marginLeft: 4 }}>นาที</span>
                        </div>
                        <div className="unit-line">≈ {formatThaiNumber(Math.round((statistics.processing_time_doc_avg_minutes / 60) * 10) / 10)} ชั่วโมง</div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* 7. Summary table */}
            <div className="section-head">
              <h2>ตารางสรุปผลการให้บริการ</h2>
              <span className="meta">เหมาะคัดลอกเข้าเอกสารราชการ</span>
            </div>
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="table-summary">
                <thead>
                  <tr>
                    <th>รายการตัวชี้วัด</th>
                    <th style={{ textAlign: 'right' }}>ค่าที่วัดได้</th>
                    <th>หมายเหตุ</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>ช่วงเวลาที่ใช้ในการประเมิน</td><td style={{ textAlign: 'right' }}>{periodLabel}</td><td>นับจากวันที่บันทึกคำร้อง</td></tr>
                  <tr><td>จำนวนคำร้องที่ให้บริการประชาชน</td><td style={{ textAlign: 'right' }}>{formatThaiNumber(lpa.total)} คำร้อง</td><td>รวมทุกสถานะในช่วงเวลา</td></tr>
                  <tr><td>อัตราการอนุมัติสำเร็จ</td><td className="num-good" style={{ textAlign: 'right' }}>{formatThaiNumber(lpa.completionRate)}%</td><td>อนุมัติ {formatThaiNumber(lpa.done)} / {formatThaiNumber(lpa.total)} คำร้อง</td></tr>
                  <tr><td>อัตราการปฏิเสธ</td><td className="num-bad" style={{ textAlign: 'right' }}>{formatThaiNumber(lpa.rejectionRate)}%</td><td>ปฏิเสธ {formatThaiNumber(lpa.rejected)} คำร้อง</td></tr>
                  <tr><td>ระยะเวลาดำเนินการเฉลี่ย (SLA)</td><td style={{ textAlign: 'right' }}>{lpa.avgDays != null ? `${formatThaiNumber(Math.round(lpa.avgDays * 10) / 10)} วัน` : '—'}</td><td>นับจากวันยื่นถึงวันอนุมัติ</td></tr>
                  {typeof statistics.processing_time_doc_avg_minutes === 'number' && (
                    <tr><td>เวลาตรวจเอกสาร → อนุมัติ</td><td style={{ textAlign: 'right' }}>{formatDurationThaiFromMinutes(statistics.processing_time_doc_avg_minutes)}</td><td>≈ {formatThaiNumber(Math.round(statistics.processing_time_doc_avg_minutes))} นาที</td></tr>
                  )}
                  <tr><td>คำร้องคงค้างระหว่างดำเนินการ</td><td className="num-warn" style={{ textAlign: 'right' }}>{formatThaiNumber(lpa.inProgress)} คำร้อง</td><td>รอเอกสาร {formatThaiNumber(lpa.waitDoc)} • รอยื่น {formatThaiNumber(lpa.waitSubmit)}</td></tr>
                </tbody>
              </table>
            </div>

           
          </>
        ) : (
          <div className="card empty-state">
            <p>ไม่พบข้อมูลสถิติในช่วงเวลาที่เลือก</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================================================================
 * Sub-components
 * ========================================================================== */
function PrimaryKpi({
  name, value, unit, spark, trend, note, glyphPath, progressPct, progressColor, tone = 'default',
}: {
  name: string
  value: string
  unit: string
  spark?: number[]
  trend?: { kind: 'up' | 'down' | 'flat'; text: string }
  note?: string
  glyphPath: React.ReactNode
  progressPct?: number
  progressColor?: string
  tone?: 'default' | 'warn'
}) {
  return (
    <div className={`card kpi primary ${tone === 'warn' ? 'tone-warn' : ''}`}>
      <div className="top">
        <div className="name">{name}</div>
        <div className="glyph">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{glyphPath}</svg>
        </div>
      </div>
      <div className="value">{value}<span className="unit">{unit}</span></div>
      {spark && spark.length >= 2 ? <Sparkline values={spark} /> : null}
      {progressPct != null && (
        <div className="kpi-progress" aria-hidden>
          <div style={{ width: `${Math.min(100, Math.max(0, progressPct))}%`, background: progressColor || '#002366' }} />
        </div>
      )}
      <div className="foot">
        {trend ? <span className={`trend ${trend.kind}`}>{trend.text}</span> : <span />}
        {note && <span className="note">{note}</span>}
      </div>
    </div>
  )
}

function SupportKpi({
  name, value, pct, status, glyphPath,
}: {
  name: string
  value: number
  pct: number
  status: 'done' | 'pending' | 'wait' | 'reject'
  glyphPath: React.ReactNode
}) {
  return (
    <div className="card kpi kpi-sm" data-status={status}>
      <div className="top">
        <div className="name">{name}</div>
        <div className="glyph">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">{glyphPath}</svg>
        </div>
      </div>
      <div className="value">{formatThaiNumber(value)}<span className="unit">คำร้อง</span></div>
      <div className="strip"><span style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} /></div>
      <div className="foot"><span>คิดเป็น <strong>{formatThaiNumber(pct)}%</strong> ของทั้งหมด</span></div>
    </div>
  )
}

function Sparkline({ values }: { values: number[] }) {
  const w = 220, h = 28, pad = 2
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const step = (w - pad * 2) / (values.length - 1)
  const pts = values.map((v, i) => `${pad + i * step},${(h - pad - ((v - min) / range) * (h - pad * 2)).toFixed(2)}`).join(' ')
  const areaPath = `M${pad},${h} L${pts.split(' ').join(' L')} L${w - pad},${h} Z`
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <path d={areaPath} fill="rgba(0,35,102,.10)" />
      <polyline points={pts} fill="none" stroke="#002366" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function PieSvg({ data, total }: { data: { status: string; count: number; percentage: number }[]; total: number }) {
  const cx = 60, cy = 60, r = 50
  const sum = data.reduce((s, x) => s + x.count, 0) || 1
  let acc = 0
  const arcs = data.map(s => {
    const start = (acc / sum) * Math.PI * 2 - Math.PI / 2
    acc += s.count
    const end = (acc / sum) * Math.PI * 2 - Math.PI / 2
    const large = (end - start) > Math.PI ? 1 : 0
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start)
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end)
    const color = STATUS_COLOR_MAP[s.status] ?? '#123E86'
    return <path key={s.status} d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`} fill={color} stroke="#fff" strokeWidth={1} />
  })
  return (
    <svg className="pie-svg" viewBox="0 0 120 120" aria-label="กราฟวงกลมสัดส่วนสถานะ">
      {arcs}
      <circle cx={cx} cy={cy} r={32} fill="#fff" />
      <text className="center-num" x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">{formatThaiNumber(total)}</text>
      <text className="center-lbl" x={cx} y={cy + 14} textAnchor="middle">คำร้อง</text>
    </svg>
  )
}

function AreaSvg({ data }: { data: { name: string; v: number }[] }) {
  if (data.length === 0) {
    return <div className="area-empty">ไม่มีข้อมูลแนวโน้ม</div>
  }
  const W = 800, H = 240, padL = 48, padR = 18, padT = 16, padB = 38
  const maxRaw = Math.max(...data.map(d => d.v), 1)
  const max = Math.ceil(maxRaw / 5) * 5 || 5
  const xStep = data.length > 1 ? (W - padL - padR) / (data.length - 1) : 0
  const yScale = (v: number) => padT + (1 - v / max) * (H - padT - padB)
  const pts = data.map((d, i) => `${padL + i * xStep},${yScale(d.v).toFixed(2)}`).join(' ')
  const areaPath = data.length > 1
    ? `M${padL},${H - padB} L${pts.split(' ').join(' L')} L${W - padR},${H - padB} Z`
    : ''

  const grid: React.ReactNode[] = []
  for (let i = 0; i <= 4; i++) {
    const y = padT + (i * (H - padT - padB)) / 4
    const val = max - i * (max / 4)
    grid.push(
      <g key={`g-${i}`}>
        <line x1={padL} y1={y} x2={W - padR} y2={y} stroke={i === 4 ? '#CBD3E0' : '#E3E8F0'} strokeWidth={1} strokeDasharray={i === 4 ? '0' : '2 4'} />
        <text className="area-tick" x={padL - 8} y={y + 3} textAnchor="end">{formatThaiNumber(Math.round(val))}</text>
      </g>
    )
  }

  const labelInterval = data.length <= 12 ? 1 : Math.ceil(data.length / 12)
  const xLabels = data.map((d, i) => i % labelInterval === 0
    ? <text key={`x-${i}`} className="area-axis-label" x={padL + i * xStep} y={H - padB + 18} textAnchor="middle">{d.name}</text>
    : null
  )

  const dots = data.map((d, i) => {
    const cx = padL + i * xStep
    const cy = yScale(d.v)
    if (i === data.length - 1) {
      return (
        <g key={`d-${i}`}>
          <circle cx={cx} cy={cy} r={9} fill="rgba(0,35,102,.15)" />
          <circle cx={cx} cy={cy} r={5} fill="#002366" stroke="#fff" strokeWidth={2} />
          <text x={cx} y={cy - 14} textAnchor="middle" fontFamily="var(--mb-font-num)" fontSize={11.5} fontWeight={600} fill="#001A4D">{formatThaiNumber(d.v)}</text>
        </g>
      )
    }
    return <circle key={`d-${i}`} cx={cx} cy={cy} r={3} fill="#fff" stroke="#002366" strokeWidth={1.5} />
  })

  return (
    <svg className="area-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-label="กราฟแนวโน้มรายเดือน">
      <defs>
        <linearGradient id="mb-area-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#002366" stopOpacity={0.28} />
          <stop offset="100%" stopColor="#002366" stopOpacity={0} />
        </linearGradient>
      </defs>
      {grid}
      {areaPath && <path d={areaPath} fill="url(#mb-area-grad)" />}
      <polyline points={pts} fill="none" stroke="#002366" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {dots}
      {xLabels}
    </svg>
  )
}

function LoadingSkeleton() {
  return (
    <div className="loading-wrap">
      <div className="grid-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card kpi skel" />)}
      </div>
      <div className="grid-4" style={{ marginTop: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="card kpi-sm skel" />)}
      </div>
      <div className="row-2" style={{ marginTop: 16 }}>
        <div className="card skel-tall" />
        <div className="card skel-tall" />
      </div>
    </div>
  )
}

/* ============================================================================
 * Modern Blue scoped CSS — all rules under .mb-root
 * ========================================================================== */
const MODERN_BLUE_CSS = `
.mb-root {
  /* tokens */
  --mb-navy-50:#EEF4FC; --mb-navy-100:#DCE7F7; --mb-navy-200:#B9CDED; --mb-navy-300:#7E99C6;
  --mb-navy-400:#2D5798; --mb-navy-500:#002366; --mb-navy-600:#001A4D; --mb-navy-700:#00163F;
  --mb-navy-800:#001236; --mb-navy-900:#071936;
  --mb-bronze-50:#FBF3E8; --mb-bronze-100:#F2DDB8; --mb-bronze-200:#E6C079;
  --mb-bronze-300:#D9A347; --mb-bronze-400:#B98A2E; --mb-bronze-500:#92691F;
  --mb-status-done:#1E8E5A; --mb-status-pending:#C68A14; --mb-status-wait:#123E86; --mb-status-reject:#B43A3A;
  --mb-bg:#F4F6FA; --mb-surface:#FFFFFF; --mb-surface-2:#F8FAFD;
  --mb-line:#E3E8F0; --mb-line-strong:#CBD3E0;
  --mb-ink-900:#0B1220; --mb-ink-700:#2A3447; --mb-ink-500:#5A657A; --mb-ink-400:#7E899E; --mb-ink-300:#A6AFC0;
  --mb-shadow-sm:0 1px 2px rgba(8,30,61,.05),0 1px 1px rgba(8,30,61,.04);
  --mb-shadow-md:0 4px 14px rgba(8,30,61,.07),0 2px 4px rgba(8,30,61,.04);
  --mb-radius-sm:6px; --mb-radius:10px; --mb-radius-lg:14px;
  --mb-font-thai:inherit;
  --mb-font-num:inherit;
  --mb-font-mono:var(--font-mono);

  font-family:inherit;
  background:var(--mb-bg);
  color:var(--mb-ink-900);
  min-height:100vh;
  -webkit-font-smoothing:antialiased;
  text-rendering:optimizeLegibility;
  line-height:1.5;
}
.mb-root *,.mb-root *::before,.mb-root *::after { box-sizing:border-box; }
.mb-root button { font-family:inherit; cursor:pointer; }
.mb-root table { border-collapse:collapse; }

.mb-root .mb-app { max-width:1440px; margin:0 auto; padding:28px 32px 80px; }

/* Topbar */
.mb-root .topbar {
  display:flex; align-items:flex-start; justify-content:space-between; gap:24px; margin-bottom:24px;
}
.mb-root .brand { display:flex; gap:14px; align-items:center; }
.mb-root .brand-mark {
  width:44px; height:44px; border-radius:10px;
  background:linear-gradient(135deg,var(--mb-navy-500),var(--mb-navy-700));
  color:#fff; display:grid; place-items:center; position:relative;
  box-shadow:0 2px 8px rgba(0,35,102,.25);
}
.mb-root .brand-icon { width:24px; height:24px; }
.mb-root .brand-text .eyebrow {
  font-size:11.5px; color:var(--mb-ink-500); letter-spacing:.08em; text-transform:uppercase; font-weight:500;
}
.mb-root .brand-text h1 {
  margin:2px 0 0; font-size:22px; font-weight:600; color:var(--mb-ink-900); letter-spacing:-.01em;
}
.mb-root .brand-text .sub { font-size:13px; color:var(--mb-ink-500); margin-top:1px; }

.mb-root .session { display:flex; align-items:center; gap:10px; color:var(--mb-ink-500); font-size:13px; }
.mb-root .session .dot {
  width:7px; height:7px; border-radius:50%; background:var(--mb-status-done);
  box-shadow:0 0 0 3px rgba(30,142,90,.18);
}

/* Action bar */
.mb-root .actions {
  display:flex; flex-wrap:wrap; gap:10px; align-items:center;
  padding:14px; background:var(--mb-surface); border:1px solid var(--mb-line);
  border-radius:var(--mb-radius-lg); box-shadow:var(--mb-shadow-sm); margin-bottom:14px;
}
.mb-root .actions .group { display:flex; align-items:center; gap:8px; }
.mb-root .actions .group + .group { border-left:1px solid var(--mb-line); padding-left:12px; margin-left:2px; }
.mb-root .label { font-size:12px; color:var(--mb-ink-500); font-weight:500; }
.mb-root .preset {
  display:inline-flex; gap:0; border:1px solid var(--mb-line); border-radius:8px; overflow:hidden; background:var(--mb-surface-2);
}
.mb-root .preset button {
  border:0; background:transparent; padding:8px 14px; font-size:13px; color:var(--mb-ink-700); font-weight:500;
  border-right:1px solid var(--mb-line); transition:background .15s,color .15s;
}
.mb-root .preset button:last-child { border-right:0; }
.mb-root .preset button:hover:not(:disabled) { background:var(--mb-navy-50); color:var(--mb-navy-700); }
.mb-root .preset button.is-active { background:var(--mb-navy-500); color:#fff; }
.mb-root .preset button:disabled { opacity:.6; cursor:not-allowed; }
.mb-root .date-input {
  display:inline-flex; align-items:center; gap:6px; padding:7px 10px;
  background:var(--mb-surface-2); border:1px solid var(--mb-line); border-radius:8px;
  font-size:13px; color:var(--mb-ink-700);
}
.mb-root .date-input input {
  border:0; background:transparent; font-family:var(--mb-font-num); font-size:13px;
  color:var(--mb-ink-900); outline:none; width:128px;
}
.mb-root .arrow { color:var(--mb-ink-400); font-size:13px; }
.mb-root .btn {
  display:inline-flex; align-items:center; gap:6px; padding:8px 13px; font-size:13px;
  border-radius:8px; border:1px solid var(--mb-line); background:var(--mb-surface);
  color:var(--mb-ink-700); font-weight:500; transition:all .15s; text-decoration:none;
}
.mb-root .btn:hover:not(:disabled) { border-color:var(--mb-navy-300); color:var(--mb-navy-700); background:var(--mb-navy-50); }
.mb-root .btn:disabled { opacity:.55; cursor:not-allowed; }
.mb-root .btn-primary { background:var(--mb-navy-500); color:#fff; border-color:var(--mb-navy-500); }
.mb-root .btn-primary:hover:not(:disabled) { background:var(--mb-navy-600); border-color:var(--mb-navy-600); color:#fff; }
.mb-root .btn-ghost { background:transparent; border-color:transparent; color:var(--mb-ink-500); }
.mb-root .btn-ghost:hover:not(:disabled) { background:var(--mb-navy-50); color:var(--mb-navy-700); border-color:transparent; }
.mb-root .btn .ico { width:14px; height:14px; flex:none; }
.mb-root .spacer { flex:1; }
.mb-root .month-select { display:inline-flex; gap:6px; align-items:center; }
.mb-root select {
  font-family:var(--mb-font-thai); border:1px solid var(--mb-line); background:var(--mb-surface-2);
  padding:7px 30px 7px 10px; border-radius:8px; font-size:13px; color:var(--mb-ink-700);
  appearance:none;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%235A657A' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>");
  background-repeat:no-repeat; background-position:right 10px center;
}

/* Range chip */
.mb-root .chip-row { display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-bottom:8px; }
.mb-root .range-chip {
  display:inline-flex; align-items:center; gap:8px; padding:5px 12px 5px 5px;
  background:var(--mb-navy-50); border:1px solid var(--mb-navy-100); color:var(--mb-navy-700);
  border-radius:999px; font-size:12.5px; font-weight:500;
}
.mb-root .range-chip .pip {
  background:var(--mb-navy-500); color:#fff; padding:3px 10px; border-radius:999px;
  font-size:11px; font-family:var(--mb-font-num); font-weight:600;
}
.mb-root .updated { color:var(--mb-ink-400); font-size:12.5px; }

/* Section heads */
.mb-root .section-head {
  display:flex; align-items:baseline; justify-content:space-between; margin:28px 0 12px; flex-wrap:wrap; gap:8px;
}
.mb-root .section-head h2 {
  margin:0; font-size:13px; font-weight:600; color:var(--mb-ink-700);
  letter-spacing:.14em; text-transform:uppercase; display:flex; align-items:center; gap:10px;
}
.mb-root .section-head h2::before {
  content:""; width:4px; height:14px; background:var(--mb-navy-500); border-radius:2px;
}
.mb-root .section-head .meta { font-size:12px; color:var(--mb-ink-400); }

/* Cards/grids */
.mb-root .grid-4 { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
.mb-root .row-2 { display:grid; grid-template-columns:1fr 1.4fr; gap:16px; }
.mb-root .row-bars { display:grid; grid-template-columns:1fr 1fr; gap:16px; }
.mb-root .card {
  background:var(--mb-surface); border:1px solid var(--mb-line);
  border-radius:var(--mb-radius-lg); padding:18px 20px; box-shadow:var(--mb-shadow-sm); position:relative;
}
.mb-root .card-title {
  display:flex; justify-content:space-between; align-items:baseline; gap:12px; margin-bottom:14px;
}
.mb-root .card-title h3 { margin:0; font-size:15px; font-weight:600; color:var(--mb-ink-900); }
.mb-root .card-title .hint { font-size:12px; color:var(--mb-ink-400); }
.mb-root .spacer-y { margin-bottom:16px; }

/* KPI primary */
.mb-root .kpi { display:flex; flex-direction:column; gap:8px; min-height:148px; }
.mb-root .kpi .top { display:flex; align-items:center; justify-content:space-between; gap:8px; }
.mb-root .kpi .name { font-size:13px; color:var(--mb-ink-500); font-weight:500; }
.mb-root .kpi .glyph {
  width:32px; height:32px; border-radius:8px;
  background:var(--mb-navy-50); color:var(--mb-navy-600);
  display:grid; place-items:center; flex:none;
}
.mb-root .kpi.primary { border-left:3px solid var(--mb-navy-500); }
.mb-root .kpi.primary.tone-warn { border-left-color:var(--mb-status-pending); }
.mb-root .kpi.primary.tone-warn .glyph { background:rgba(198,138,20,.12); color:var(--mb-status-pending); }
.mb-root .kpi .value {
  font-family:var(--mb-font-num); font-size:32px; font-weight:600; letter-spacing:-.02em;
  color:var(--mb-ink-900); line-height:1.05; font-variant-numeric:tabular-nums;
}
.mb-root .kpi .value .unit { font-size:14px; color:var(--mb-ink-500); font-weight:500; margin-left:4px; }
.mb-root .kpi .foot {
  display:flex; justify-content:space-between; align-items:center; gap:8px;
  font-size:12.5px; color:var(--mb-ink-500); margin-top:auto;
}
.mb-root .kpi .foot .note { text-align:right; }
.mb-root .kpi-progress {
  height:6px; border-radius:4px; background:var(--mb-line); overflow:hidden;
}
.mb-root .kpi-progress > div { height:100%; border-radius:4px; transition:width .6s cubic-bezier(.2,.7,.2,1); }
.mb-root .trend {
  display:inline-flex; gap:4px; align-items:center; padding:3px 8px; border-radius:999px;
  font-family:var(--mb-font-num); font-size:12px; font-weight:600; font-variant-numeric:tabular-nums;
}
.mb-root .trend.up { background:rgba(30,142,90,.10); color:var(--mb-status-done); }
.mb-root .trend.down { background:rgba(180,58,58,.10); color:var(--mb-status-reject); }
.mb-root .trend.flat { background:var(--mb-navy-50); color:var(--mb-navy-700); }
.mb-root .spark { width:100%; height:28px; display:block; }

/* KPI supporting */
.mb-root .kpi-sm { min-height:112px; }
.mb-root .kpi-sm .value { font-size:24px; }
.mb-root .kpi-sm .strip {
  display:flex; gap:2px; height:4px; border-radius:4px; overflow:hidden; background:var(--mb-line);
}
.mb-root .kpi-sm .strip span { display:block; height:100%; transition:width .6s; }
.mb-root .kpi-sm[data-status="done"] .glyph { background:rgba(30,142,90,.10); color:var(--mb-status-done); }
.mb-root .kpi-sm[data-status="pending"] .glyph { background:rgba(198,138,20,.10); color:var(--mb-status-pending); }
.mb-root .kpi-sm[data-status="wait"] .glyph { background:rgba(37,99,182,.10); color:var(--mb-status-wait); }
.mb-root .kpi-sm[data-status="reject"] .glyph { background:rgba(180,58,58,.10); color:var(--mb-status-reject); }
.mb-root .kpi-sm[data-status="done"] .strip span:first-child { background:var(--mb-status-done); }
.mb-root .kpi-sm[data-status="pending"] .strip span:first-child { background:var(--mb-status-pending); }
.mb-root .kpi-sm[data-status="wait"] .strip span:first-child { background:var(--mb-status-wait); }
.mb-root .kpi-sm[data-status="reject"] .strip span:first-child { background:var(--mb-status-reject); }
.mb-root .kpi-sm .foot strong {
  color:var(--mb-ink-900); font-family:var(--mb-font-num); font-weight:600;
}

/* Status table */
.mb-root .table-status { width:100%; font-size:13.5px; }
.mb-root .table-status th {
  text-align:left; font-weight:500; color:var(--mb-ink-500); font-size:12px;
  text-transform:uppercase; letter-spacing:.08em; padding:8px 12px; border-bottom:1px solid var(--mb-line);
}
.mb-root .table-status td { padding:12px; border-bottom:1px solid var(--mb-line); vertical-align:middle; }
.mb-root .table-status tr:last-child td { border-bottom:0; }
.mb-root .table-status .status-cell { display:flex; align-items:center; gap:10px; }
.mb-root .table-status .swatch { width:10px; height:10px; border-radius:3px; flex:none; }
.mb-root .table-status .num,
.mb-root .table-status .pct {
  font-family:var(--mb-font-num); font-variant-numeric:tabular-nums; font-weight:600; text-align:right;
}
.mb-root .table-status .bar-cell { width:28%; }
.mb-root .table-status .mini-bar {
  height:6px; background:var(--mb-line); border-radius:4px; overflow:hidden;
}
.mb-root .table-status .mini-bar > div { height:100%; border-radius:4px; transition:width .6s; }

/* Pie */
.mb-root .pie-wrap {
  display:grid; grid-template-columns:180px 1fr; gap:24px; align-items:center;
}
.mb-root .pie-svg { width:180px; height:180px; }
.mb-root .pie-svg .center-num {
  font-family:var(--mb-font-num); font-size:18px; font-weight:600;
  fill:var(--mb-ink-900); font-variant-numeric:tabular-nums;
}
.mb-root .pie-svg .center-lbl {
  font-size:7px; fill:var(--mb-ink-500); letter-spacing:.12em; text-transform:uppercase;
}
.mb-root .legend { display:flex; flex-direction:column; gap:10px; }
.mb-root .legend-row { display:flex; align-items:center; gap:10px; font-size:13px; }
.mb-root .legend-row .swatch { width:12px; height:12px; border-radius:3px; flex:none; }
.mb-root .legend-row .name { flex:1; color:var(--mb-ink-700); }
.mb-root .legend-row .val { font-family:var(--mb-font-num); font-variant-numeric:tabular-nums; font-weight:600; color:var(--mb-ink-900); }
.mb-root .legend-row .pct { font-family:var(--mb-font-num); color:var(--mb-ink-500); font-size:12px; width:54px; text-align:right; }

/* Area */
.mb-root .area-svg { width:100%; height:240px; display:block; }
.mb-root .area-tick { font-family:var(--mb-font-num); font-size:10.5px; fill:var(--mb-ink-400); }
.mb-root .area-axis-label { font-family:var(--mb-font-thai); font-size:11px; fill:var(--mb-ink-500); }
.mb-root .area-empty {
  height:200px; display:grid; place-items:center; color:var(--mb-ink-400); font-size:13px;
  background:var(--mb-surface-2); border-radius:var(--mb-radius); border:1px dashed var(--mb-line);
}

/* Bars */
.mb-root .bars { display:flex; flex-direction:column; gap:10px; }
.mb-root .bar-row {
  display:grid; grid-template-columns:28px 1fr 70px; gap:12px; align-items:center; font-size:13px;
}
.mb-root .bar-row .rank {
  font-family:var(--mb-font-num); font-weight:600; color:var(--mb-ink-400); text-align:center;
  font-size:12px; font-variant-numeric:tabular-nums;
}
.mb-root .bar-row .label-track {
  position:relative; background:var(--mb-surface-2); border-radius:6px; height:30px; overflow:hidden;
}
.mb-root .bar-row .bar-fill {
  position:absolute; inset:0 auto 0 0; height:100%; border-radius:6px;
  transition:width .8s cubic-bezier(.2,.7,.2,1);
}
.mb-root .bar-row .label-text {
  position:absolute; inset:0; display:flex; align-items:center; padding:0 12px;
  color:var(--mb-ink-900); font-weight:500; z-index:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
}
.mb-root .bar-row .bar-num {
  font-family:var(--mb-font-num); font-variant-numeric:tabular-nums; font-weight:600;
  color:var(--mb-ink-700); text-align:right;
}
.mb-root .bar-empty { padding:24px 12px; color:var(--mb-ink-400); font-size:13px; text-align:center; }

/* SLA panel */
.mb-root .sla-grid { display:grid; grid-template-columns:1.4fr 1fr 1fr; gap:12px; }
.mb-root .sla-cell { border-radius:12px; padding:18px 20px; border:1px solid var(--mb-line); }
.mb-root .sla-cell.primary { background:linear-gradient(180deg,var(--mb-navy-50),#fff 80%); border-color:var(--mb-navy-100); }
.mb-root .sla-cell.bronze { background:linear-gradient(180deg,var(--mb-bronze-50),#fff 80%); border-color:var(--mb-bronze-100); }
.mb-root .sla-cell.navy { background:linear-gradient(180deg,var(--mb-navy-700),var(--mb-navy-800)); border:0; color:#fff; }
.mb-root .sla-cell .lbl { font-size:12.5px; color:var(--mb-ink-500); font-weight:500; }
.mb-root .sla-cell.navy .lbl { color:#B6CBE6; }
.mb-root .sla-cell .big {
  font-family:var(--mb-font-num); font-size:36px; font-weight:600; letter-spacing:-.02em;
  line-height:1; color:var(--mb-navy-700); font-variant-numeric:tabular-nums; margin-top:6px;
}
.mb-root .sla-cell.navy .big { color:#fff; font-size:32px; }
.mb-root .sla-cell.bronze .big { color:var(--mb-bronze-500); font-size:24px; }
.mb-root .sla-cell .unit-line { margin-top:8px; font-size:12.5px; color:var(--mb-ink-500); }
.mb-root .sla-cell.navy .unit-line { color:#B6CBE6; }

/* Summary table */
.mb-root .table-summary { width:100%; font-size:13px; }
.mb-root .table-summary thead th {
  background:var(--mb-navy-700); color:#fff; font-weight:500; text-align:left;
  padding:10px 14px; font-size:12px; letter-spacing:.04em;
}
.mb-root .table-summary tbody td {
  padding:11px 14px; border-bottom:1px solid var(--mb-line);
  font-family:var(--mb-font-num); font-variant-numeric:tabular-nums;
}
.mb-root .table-summary tbody td:first-child { font-family:var(--mb-font-thai); color:var(--mb-ink-700); }
.mb-root .table-summary tbody td:last-child { font-family:var(--mb-font-thai); color:var(--mb-ink-500); font-size:12.5px; }
.mb-root .table-summary tbody tr:last-child td { border-bottom:0; }
.mb-root .table-summary tbody tr:nth-child(even) { background:var(--mb-surface-2); }
.mb-root .table-summary .num-good { color:var(--mb-status-done); font-weight:600; }
.mb-root .table-summary .num-bad  { color:var(--mb-status-reject); font-weight:600; }
.mb-root .table-summary .num-warn { color:var(--mb-status-pending); font-weight:600; }

/* Print cover + signatures */
.mb-root .print-only { display:none; }
.mb-root .print-cover { text-align:center; padding:40px 20px; }
.mb-root .print-cover .kicker {
  font-size:14px; letter-spacing:.16em; color:var(--mb-ink-500); text-transform:uppercase;
}
.mb-root .print-cover h1 { font-size:28px; margin:18px 0 6px; color:var(--mb-ink-900); }
.mb-root .print-cover .range { font-size:15px; color:var(--mb-ink-700); }
.mb-root .print-cover .print-date { font-size:13px; color:var(--mb-ink-500); margin-top:10px; }
.mb-root .signatures {
  display:grid; grid-template-columns:1fr 1fr; gap:60px; margin-top:70px; padding:0 60px;
}
.mb-root .sig {
  text-align:center; border-top:1px solid var(--mb-ink-700); padding-top:8px;
  font-size:13px; color:var(--mb-ink-700);
}

/* Empty state */
.mb-root .empty-state { text-align:center; padding:60px 20px; color:var(--mb-ink-500); }

/* Loading skeleton */
.mb-root .loading-wrap .skel { min-height:148px; background:linear-gradient(90deg,var(--mb-surface-2),#EFF3F8,var(--mb-surface-2)); background-size:200% 100%; animation:mb-shimmer 1.5s ease-in-out infinite; border:1px solid var(--mb-line); }
.mb-root .loading-wrap .skel-tall { min-height:280px; background:linear-gradient(90deg,var(--mb-surface-2),#EFF3F8,var(--mb-surface-2)); background-size:200% 100%; animation:mb-shimmer 1.5s ease-in-out infinite; border:1px solid var(--mb-line); }
@keyframes mb-shimmer { 0%{background-position:0 0;} 100%{background-position:-200% 0;} }

/* Refresh spin */
@keyframes mb-spin { to { transform:rotate(360deg); } }
.mb-root .spinning { animation:mb-spin .8s linear infinite; }

/* Responsive */
@media (max-width:980px) {
  .mb-root .grid-4 { grid-template-columns:repeat(2,1fr); }
  .mb-root .row-2,.mb-root .row-bars { grid-template-columns:1fr; }
  .mb-root .pie-wrap { grid-template-columns:1fr; justify-items:center; }
  .mb-root .sla-grid { grid-template-columns:1fr; }
  .mb-root .mb-app { padding:18px; }
  .mb-root .topbar { flex-direction:column; align-items:flex-start; }
}
@media (max-width:640px) {
  .mb-root .grid-4 { grid-template-columns:1fr; }
  .mb-root .actions .group + .group { border-left:0; padding-left:0; }
  .mb-root .actions { flex-direction:column; align-items:stretch; }
  .mb-root .actions .group { flex-wrap:wrap; }
}

/* Print */
@media print {
  .mb-root { background:#fff !important; }
  .mb-root .no-print { display:none !important; }
  .mb-root .print-only { display:block !important; }
  .mb-root .mb-app { max-width:100%; padding:0; }
  .mb-root .card { box-shadow:none; break-inside:avoid; }
  .mb-root .section-head { break-after:avoid; }
  .mb-root .row-2,.mb-root .row-bars { break-inside:avoid; }
  .mb-root .signatures { break-before:page; }
  @page { size:A4; margin:18mm 14mm; }
}
`
