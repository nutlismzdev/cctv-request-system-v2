// app/admin/camera-issues/new/page.tsx
'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
// Import Leaflet CSS statically for Next.js 15 compatibility
import 'leaflet/dist/leaflet.css'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'

import { checkAuth as verifyAuth } from '@/lib/auth'
import {
  Search, MapPin, Network, Info, Save, AlertTriangle, Clock, History, FileText, RefreshCw,
} from 'lucide-react'

// ใช้เฉพาะ type ของ Leaflet (ปลอดภัยกับ SSR)
import type * as Leaflet from 'leaflet'

/* =========================
 * Types
 * =======================*/
type Camera = {
  id: number
  camera_name: string
  area: string
  lat?: number | null
  lng?: number | null
  ip_address?: string | null
  status?: 'active' | 'unactive' | null
  isOnline?: boolean
  ok?: boolean
}

type IssueType = 'no_signal' | 'offline' | 'broken' | 'missing' | 'other'

const ISSUE_META: Record<IssueType, { label: string; hint: string }> = {
  no_signal: { label: 'ไม่มีสัญญาณ/ดูไม่ได้', hint: 'ภาพหาย/เล่นย้อนหลังไม่ได้' },
  offline:   { label: 'ออฟไลน์/เชื่อมต่อไม่ได้', hint: 'เครือข่าย/เครื่องบันทึก' },
  broken:    { label: 'อุปกรณ์เสีย/ภาพเพี้ยน', hint: 'ฮาร์ดแวร์/เลนส์/สาย' },
  missing:   { label: 'ไม่มีจุดกล้องตามที่ร้องขอ', hint: 'ตำแหน่งไม่มีกล้อง/ยังไม่ได้ติดตั้ง' },
  other:     { label: 'อื่น ๆ', hint: 'อธิบายเพิ่มเติม' },
}

const QUICK_TEMPLATES = [
  'สัญญาณขาดหาย',
  'ย้อนดูช่วงเวลาที่ร้องขอไม่ได้ (บันทึกทับ)',
  'กล้องออฟไลน์',
  'เลนส์มัว/ภาพเบลอ',
  'มุมกล้องถูกสิ่งกีดขวางบัง',
] as const

const RECENT_KEY = 'recent_cameras_v1'

type ReportLite = {
  report_id: number
  created_at?: string | null
  status?: string | null
  request_type?: string | null
  incident_location?: string | null
  full_name?: string | null
}

type IssueHistory = {
  issue_id: number
  issue_type: IssueType
  description?: string | null
  occurred_at?: string | null
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  created_at?: string | null
  related_report_id?: number | null
}

/* =========================
 * Helpers
 * =======================*/
function toIsoLike(s?: string | null) {
  if (!s) return null
  const t = s.includes('T') ? s : s.replace(' ', 'T')
  const d = new Date(t)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

type ApiOk<T> = { success: true; data: T }
type ApiFail = { success: false; message?: string }
type ApiResp<T> = ApiOk<T> | ApiFail

/* =========================
 * Leaflet MiniMap (client only)
 * =======================*/
function LeafletMiniMap({
  lat, lng, title, ip,
}: { lat: number; lng: number; title: string; ip?: string | null }) {
  const mapRef = useRef<Leaflet.Map | null>(null)
  const markerRef = useRef<Leaflet.Marker | null>(null)
  const tileRef = useRef<Leaflet.TileLayer | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  const [L, setL] = useState<typeof import('leaflet') | null>(null)

  // โหลด Leaflet เฉพาะ client
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const mod = await import('leaflet')
        if (!mounted) return
        setL(mod)
        mod.Icon.Default.mergeOptions({
          iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        })
      } catch {
        // noop
      }
    })()
    return () => { mounted = false }
  }, [])

  // init แผนที่
  useEffect(() => {
    if (!L || !containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 17,
      zoomControl: true,
      attributionControl: true,
      scrollWheelZoom: false,
    })
    mapRef.current = map

    const tile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    })
    tile.addTo(map)
    tileRef.current = tile

    const marker = L.marker([lat, lng]).addTo(map)
    markerRef.current = marker
    marker.bindPopup(
      `<div style="font-size:12px"><b>${title}</b><br/>IP: ${ip ?? '—'}</div>`
    )
  }, [L, lat, lng, title, ip])

  // update center/marker
  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return
    marker.setLatLng([lat, lng])
    map.setView([lat, lng], 17, { animate: true })
  }, [lat, lng])

  // cleanup
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      markerRef.current = null
      tileRef.current = null
    }
  }, [])

  if (!L) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-slate-500 px-3">
        กำลังโหลดแผนที่…
      </div>
    )
  }

  return <div ref={containerRef} style={{ height: 280, width: '100%' }} />
}

/* =========================
 * Page
 * =======================*/
export default function NewCameraIssuePage() {
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)

  // Cameras search & filters
  const [cameraQuery, setCameraQuery] = useState('')
  const [cameraOptions, setCameraOptions] = useState<Camera[]>([])
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null)
  const [searching, setSearching] = useState(false)

  const [areas, setAreas] = useState<string[] | null>(null)
  const [areaFilter, setAreaFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'unactive'>('all')
  const [onlyOnline, setOnlyOnline] = useState<boolean>(false)

  const [recent, setRecent] = useState<Camera[]>([])
  const [highlightIdx, setHighlightIdx] = useState<number>(-1)

  // Form
  const [issueType, setIssueType] = useState<IssueType>('no_signal')
  const [description, setDescription] = useState('')

  // Reports
  const [selectedReport, setSelectedReport] = useState<ReportLite | null>(null)
  const [reportQuery, setReportQuery] = useState<string>('')
  const [reportOptions, setReportOptions] = useState<ReportLite[]>([])
  const [searchingReport, setSearchingReport] = useState<boolean>(false)
  const reportListRef = useRef<HTMLDivElement>(null)
  const [rHighlightIdx, setRHighlightIdx] = useState<number>(-1)

  // datetime default now (local)
  const [occurredAt, setOccurredAt] = useState<string>(() =>
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  )
  const [saving, setSaving] = useState(false)

  // Issue history
  const [history, setHistory] = useState<IssueHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyScopeAll, setHistoryScopeAll] = useState(true) // true=ล่าสุดทั้งหมด, false=เฉพาะกล้องที่เลือก

  // Auth
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

  // areas
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/admin/cameras/areas')
        if (!res.ok) return
        const js = (await res.json()) as ApiResp<{ area: string }[]>
        if (js.success && Array.isArray(js.data)) {
          const uniq = Array.from(new Set(js.data.map((r) => r.area).filter(Boolean))).sort()
          setAreas(uniq)
        }
      } catch {
        // ignore
      }
    })()
  }, [])

  // recent
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY)
      if (raw) setRecent(JSON.parse(raw) as Camera[])
    } catch {
      // ignore
    }
  }, [])

  const pushRecent = (cam: Camera) => {
    const next = [cam, ...recent.filter((c) => c.id !== cam.id)].slice(0, 5)
    setRecent(next)
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }

  // camera search
  useEffect(() => {
    const doSearch = async () => {
      const q = cameraQuery.trim()
      if (!q || q.length < 2) {
        setCameraOptions([])
        setHighlightIdx(-1)
        return
      }
      setSearching(true)
      try {
        const url = new URL('/api/admin/cameras/search', window.location.origin)
        url.searchParams.set('q', q)
        if (areaFilter && areaFilter !== 'all') url.searchParams.set('area', areaFilter)
        if (statusFilter !== 'all') url.searchParams.set('status', statusFilter)
        url.searchParams.set('live', '1')

        const res = await fetch(url.toString(), { cache: 'no-store' })
        const js = (await res.json()) as ApiResp<Camera[]>
        if (js.success) {
          let rows: Camera[] = js.data || []
          if (onlyOnline) {
            rows = rows.filter((r) => (typeof r.isOnline === 'boolean' ? r.isOnline : r.status !== 'unactive'))
          }
          setCameraOptions(rows)
          setHighlightIdx(rows.length > 0 ? 0 : -1)
        }
      } catch {
        // ignore
      } finally {
        setSearching(false)
      }
    }
    const t = setTimeout(doSearch, 250)
    return () => clearTimeout(t)
  }, [cameraQuery, areaFilter, statusFilter, onlyOnline])

  // camera results keyboard
  const listRef = useRef<HTMLDivElement>(null)

  const scrollHighlightIntoView = (idx: number) => {
    const container = listRef.current
    if (!container) return
    const item = container.querySelector<HTMLButtonElement>(`[data-idx="${idx}"]`)
    if (!item) return
    const cTop = container.scrollTop
    const cBottom = cTop + container.clientHeight
    const iTop = item.offsetTop
    const iBottom = iTop + item.offsetHeight
    if (iTop < cTop) container.scrollTop = iTop
    else if (iBottom > cBottom) container.scrollTop = iBottom - container.clientHeight
  }

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (cameraOptions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const n = Math.min(highlightIdx + 1, cameraOptions.length - 1)
      setHighlightIdx(n)
      scrollHighlightIntoView(n)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      const n = Math.max(highlightIdx - 1, 0)
      setHighlightIdx(n)
      scrollHighlightIntoView(n)
    } else if (e.key === 'Enter' && highlightIdx >= 0) {
      e.preventDefault()
      selectCamera(cameraOptions[highlightIdx])
    }
  }

  const selectCamera = (c: Camera) => {
    setSelectedCamera(c)
    setCameraOptions([])
    setCameraQuery(`${c.area} • ${c.camera_name}`)
    setHistoryScopeAll(false)
    pushRecent(c)
  }

  // reports search
  useEffect(() => {
    const doSearchReports = async () => {
      const q = reportQuery.trim()
      if (!q) {
        setReportOptions([])
        setRHighlightIdx(-1)
        return
      }
      setSearchingReport(true)
      try {
        const url = new URL('/api/admin/reports/search', window.location.origin)
        url.searchParams.set('q', q)
        const res = await fetch(url.toString(), { cache: 'no-store' })
        const js = (await res.json()) as ApiResp<ReportLite[]>
        if (js.success) {
          const rows: ReportLite[] = js.data || []
          setReportOptions(rows)
          setRHighlightIdx(rows.length > 0 ? 0 : -1)
        }
      } catch {
        // ignore
      } finally {
        setSearchingReport(false)
      }
    }
    const t = setTimeout(doSearchReports, 250)
    return () => clearTimeout(t)
  }, [reportQuery])

  const onReportKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (reportOptions.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setRHighlightIdx((i) => Math.min(i + 1, reportOptions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setRHighlightIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && rHighlightIdx >= 0) {
      e.preventDefault()
      selectReport(reportOptions[rHighlightIdx])
    }
  }

  const selectReport = (r: ReportLite) => {
    setSelectedReport(r)
    setReportOptions([])
    setReportQuery(String(r.report_id))
  }

  // submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!occurredAt) return toast.error('กรุณาระบุวันเวลาที่พบปัญหา')
    if (!selectedCamera && issueType !== 'missing') {
      return toast.error('กรุณาเลือกจุดกล้องก่อน (ยกเว้นกรณี &quot;ไม่มีจุดกล้องตามที่ร้องขอ&quot;)')
    }

    const related_report_id = selectedReport?.report_id || undefined
    setSaving(true)
    try {
      const res = await fetch('/api/admin/camera-issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cctv_id: selectedCamera?.id ?? null,
          related_report_id,
          issue_type: issueType,
          description: description || undefined,
          occurred_at: occurredAt,
        }),
      })
      const js = (await res.json()) as ApiResp<unknown>
      if ('success' in js && js.success) {
        toast.success('บันทึกปัญหากล้องสำเร็จ')
        await fetchHistory()
        setIssueType('no_signal')
        setDescription('')
        setSelectedReport(null)
        setReportQuery('')
      } else {
        toast.error((js as ApiFail).message || 'บันทึกล้มเหลว')
      }
    } catch {
      toast.error('ไม่สามารถบันทึกข้อมูลได้')
    } finally {
      setSaving(false)
    }
  }

  // history loader (useCallback เพื่อใส่ใน deps ของ useEffect)
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true)
    try {
      const url = new URL('/api/admin/camera-issues', window.location.origin)
      if (selectedCamera && !historyScopeAll) {
        url.searchParams.set('cctv_id', String(selectedCamera.id))
      }
      url.searchParams.set('limit', '5')

      const res = await fetch(url.toString(), { cache: 'no-store' })
      if (!res.ok) {
        console.error('GET /api/admin/camera-issues failed', res.status, await res.text())
        toast.error('ดึงประวัติไม่สำเร็จ')
        setHistory([])
        return
      }
      const js = (await res.json()) as ApiResp<Array<Record<string, unknown>>>
      if (!js.success || !Array.isArray(js.data)) {
        setHistory([])
        return
      }
      const mapped: IssueHistory[] = js.data.map((r) => ({
        issue_id: Number(r.issue_id),
        issue_type: String(r.issue_type) as IssueType,
        description: (r.description as string | null) ?? null,
        occurred_at: toIsoLike(r.occurred_at as string | null),
        status: String(r.status) as IssueHistory['status'],
        created_at: toIsoLike(r.created_at as string | null),
        related_report_id: (r.related_report_id as number | null) ?? null,
      }))
      setHistory(mapped)
    } catch (e) {
      console.error(e)
      setHistory([])
    } finally {
      setLoadingHistory(false)
    }
  }, [selectedCamera, historyScopeAll])

  // โหลด “ล่าสุดทั้งหมด” ตั้งแต่เปิดหน้า
  useEffect(() => {
    if (authChecked) {
      setHistoryScopeAll(true)
      fetchHistory()
    }
  }, [authChecked, fetchHistory])

  // เมื่อเลือกกล้อง → scope เฉพาะกล้อง
  useEffect(() => {
    if (selectedCamera?.id != null) {
      setHistoryScopeAll(false)
      fetchHistory()
    }
  }, [selectedCamera?.id, fetchHistory])

  // badges
  const statusBadge = (row: Camera | null | undefined) => {
    if (!row) return <Badge className="bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]">ไม่ทราบ</Badge>
    if (row.isOnline === true) return <Badge className="bg-green-100 text-green-800 border-green-300 font-medium">ออนไลน์ (สด)</Badge>
    if (row.isOnline === false) return <Badge className="bg-red-100 text-red-800 border-red-300 font-medium">ออฟไลน์ (สด)</Badge>
    if (row.status === 'active') return <Badge className="bg-green-100 text-green-800 border-green-300 font-medium">ออนไลน์</Badge>
    if (row.status === 'unactive') return <Badge className="bg-red-100 text-red-800 border-red-300 font-medium">ออฟไลน์</Badge>
    return <Badge className="bg-[var(--muted)] text-[var(--muted-foreground)] border-[var(--border)]">ไม่ทราบ</Badge>
  }

  const hasCoord = useMemo(() => selectedCamera?.lat != null && selectedCamera?.lng != null, [selectedCamera?.lat, selectedCamera?.lng])

  // UI
  if (!authChecked) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-40 mb-4" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[15px] md:text-base leading-relaxed">
      {/* Header */}
      <div className="w-full border-b bg-[var(--card)]/90 backdrop-blur supports-[backdrop-filter]:bg-[var(--card)]/70">
        <div className="px-4 lg:px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--primary)] border border-[var(--primary)]/20">
              <AlertTriangle className="h-7 w-7 text-[var(--primary-foreground)]" aria-hidden />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-[var(--foreground)]">
                บันทึกเหตุขัดข้อง/ใช้งานไม่ได้ของกล้อง
              </h1>
              <p className="text-sm mt-1 text-[var(--muted-foreground)]">
                ค้นหากล้อง (ไม่บังคับสำหรับ &quot;ไม่มีจุดกล้องฯ&quot;) → ตรวจสอบข้อมูล → กรอกสาเหตุ → บันทึก
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* LEFT: Search & list */}
        <Card className="xl:col-span-2 shadow-sm border border-[var(--border)] bg-[var(--card)]">
          <CardHeader className="pb-4 bg-[var(--muted)]/30 border-b border-[var(--border)]">
            <CardTitle className="text-lg font-semibold text-[var(--foreground)]">ค้นหาและเลือกจุดกล้อง</CardTitle>
            <p className="text-xs text-[var(--muted-foreground)] mt-1">(ไม่บังคับสำหรับ &quot;ไม่มีจุดกล้องฯ&quot;)</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div className="relative">
                <Label htmlFor="camera" className="text-[var(--foreground)]">พิมพ์ชื่อกล้อง/พื้นที่/IP</Label>
                <div className="mt-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                  <Input
                    id="camera"
                    className="pl-9"
                    placeholder="อย่างน้อย 2 ตัวอักษร…"
                    value={selectedCamera ? `${selectedCamera.area} • ${selectedCamera.camera_name}` : cameraQuery}
                    onChange={(e) => {
                      setSelectedCamera(null)
                      setCameraQuery(e.target.value)
                    }}
                    onKeyDown={onSearchKeyDown}
                    autoComplete="off"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[var(--foreground)]">สถานะกล้อง (จากฐาน)</Label>
                  <Select value={statusFilter} onValueChange={(v: 'all' | 'active' | 'unactive') => setStatusFilter(v)}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">ทั้งหมด</SelectItem>
                      <SelectItem value="active">ออนไลน์</SelectItem>
                      <SelectItem value="unactive">ออฟไลน์</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {areas && areas.length > 0 && (
                  <div>
                    <Label className="text-[var(--foreground)]">พื้นที่ (Area)</Label>
                    <Select value={areaFilter} onValueChange={(v: string) => setAreaFilter(v)}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">ทั้งหมด</SelectItem>
                        {areas.map((a) => (
                          <SelectItem key={a} value={a}>{a}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch id="only-online" checked={onlyOnline} onCheckedChange={setOnlyOnline} />
                <Label htmlFor="only-online" className="text-sm text-[var(--foreground)]">
                  ซ่อนกล้องออฟไลน์ (อิงสถานะสดถ้ามี)
                </Label>
              </div>
            </div>

            {/* Map */}
            <div className="rounded-lg border border-[var(--border)] overflow-hidden shadow-sm bg-[var(--card)]">
              <div className="px-4 py-3 border-b bg-[var(--muted)]/30 border-[var(--border)] text-sm font-semibold text-[var(--foreground)]">
                ตำแหน่งกล้องบนแผนที่
              </div>
              <div style={{ height: 280 }}>
                {selectedCamera && hasCoord ? (
                  <LeafletMiniMap
                    lat={selectedCamera.lat as number}
                    lng={selectedCamera.lng as number}
                    title={`${selectedCamera.area} • ${selectedCamera.camera_name}`}
                    ip={selectedCamera.ip_address}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-sm text-[var(--muted-foreground)] px-4 bg-[var(--muted)]/10">
                    {!selectedCamera
                      ? 'ยังไม่ได้เลือกกล้อง'
                      : 'กล้องนี้ยังไม่มีพิกัด (lat/lng) ในฐานข้อมูล'}
                  </div>
                )}
              </div>
            </div>

            {/* Recent */}
            {recent.length > 0 && (
              <div className="rounded-lg border border-[var(--border)] p-4 bg-[var(--muted)]/20 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                  <History className="h-5 w-5 text-[var(--primary)]" />
                  <div className="text-base font-semibold text-[var(--foreground)]">กล้องที่ใช้งานล่าสุด</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recent.map((c) => (
                    <Button
                      key={c.id}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:border-[var(--accent-foreground)] transition-colors"
                      onClick={() => selectCamera(c)}
                    >
                      {c.area} • {c.camera_name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Results */}
            <div ref={listRef} className="border border-[var(--border)] rounded-lg max-h-80 overflow-auto bg-[var(--card)] shadow-sm">
              {searching && cameraOptions.length === 0 && (
                <div className="px-4 py-3 text-sm text-[var(--primary)] bg-[var(--primary)]/5">กำลังค้นหา…</div>
              )}
              {!searching && cameraOptions.length === 0 && (
                <div className="px-4 py-3 text-sm text-[var(--muted-foreground)] bg-[var(--muted)]/10">พิมพ์อย่างน้อย 2 ตัวอักษรเพื่อค้นหา</div>
              )}
              {cameraOptions.map((c, idx) => (
                <button
                  key={c.id}
                  data-idx={idx}
                  type="button"
                  className={`w-full text-left px-4 py-3 border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--accent)] transition-colors ${idx === highlightIdx ? 'bg-[var(--accent)]/80 border-[var(--accent-foreground)]' : ''}`}
                  onClick={() => selectCamera(c)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-[var(--foreground)]">{c.area} • {c.camera_name}</div>
                    <div>{statusBadge(c)}</div>
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)] flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Network className="h-3 w-3 text-[var(--muted-foreground)]" />
                      {c.ip_address || '—'}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-[var(--muted-foreground)]" />
                      {(c.lat ?? '—')}, {(c.lng ?? '—')}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: Details & form + history */}
        <Card className="xl:col-span-3 shadow-sm border border-[var(--border)] bg-[var(--card)]">
          <CardHeader className="pb-4 bg-[var(--muted)]/30 border-b border-[var(--border)]">
            <CardTitle className="text-lg font-semibold text-[var(--foreground)]">รายละเอียด & บันทึกเหตุขัดข้อง</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Camera details */}
            <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)]/20 p-4 mb-6">
              <div className="text-base font-semibold mb-3 text-[var(--foreground)]">รายละเอียดจุดกล้อง</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between items-center py-1">
                  <span className="text-[var(--muted-foreground)]">พื้นที่:</span>
                  <span className="font-medium text-[var(--foreground)]">{selectedCamera?.area ?? '—'}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[var(--muted-foreground)]">ชื่อกล้อง:</span>
                  <span className="font-medium text-[var(--foreground)]">{selectedCamera?.camera_name ?? '—'}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[var(--muted-foreground)]">IP:</span>
                  <span className="font-medium text-[var(--foreground)]">{selectedCamera?.ip_address || '—'}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-[var(--muted-foreground)]">พิกัด:</span>
                  <span className="font-medium text-[var(--foreground)]">{selectedCamera?.lat ?? '—'}, {selectedCamera?.lng ?? '—'}</span>
                </div>
                <div className="flex justify-between items-center py-1 md:col-span-2">
                  <span className="text-[var(--muted-foreground)]">สถานะระบบ:</span>
                  <span className="align-middle">{statusBadge(selectedCamera)}</span>
                </div>
              </div>
              {!selectedCamera && (
                <p className="text-xs text-amber-800 mt-3 bg-amber-50 p-2 rounded border border-amber-200">
                  หากเป็นกรณี &quot;ไม่มีจุดกล้องตามที่ร้องขอ&quot; สามารถบันทึกได้โดยไม่ต้องเลือกกล้อง
                </p>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-1">
                  <Label className="text-[var(--foreground)]">ประเภทปัญหา</Label>
                  <Select value={issueType} onValueChange={(v: IssueType) => setIssueType(v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="เลือกประเภทปัญหา" /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(ISSUE_META).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-1">
                  <Label htmlFor="occurred_at" className="text-[var(--foreground)]">วันที่พบปัญหา</Label>
                  <Input
                    id="occurred_at"
                    type="datetime-local"
                    className="mt-1"
                    value={occurredAt}
                    onChange={(e) => setOccurredAt(e.target.value)}
                  />
                </div>
              </div>

              {/* Quick templates */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Info className="h-4 w-4 text-[var(--primary)]" />
                  <span className="text-sm font-medium text-[var(--foreground)]">ปุ่มลัดเติมรายละเอียด</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_TEMPLATES.map((t) => (
                    <Button
                      key={t}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)] hover:border-[var(--accent-foreground)] transition-colors"
                      onClick={() => setDescription((d) => (d ? `${d}\n- ${t}` : `- ${t}`))}
                    >
                      {t}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Report link */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-3">
                  <Label htmlFor="report_id" className="text-[var(--foreground)]">เชื่อมกับคำร้องเลขที่ (ถ้ามี)</Label>
                  <div className="mt-1 relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" />
                    <Input
                      id="report_id"
                      className="pl-9"
                      placeholder="พิมพ์เลขคำร้อง หรือชื่อสถานที่/ประเภทคำร้อง"
                      value={selectedReport ? String(selectedReport.report_id) : reportQuery}
                      onChange={(e) => {
                        setSelectedReport(null)
                        setReportQuery(e.target.value)
                      }}
                      onKeyDown={onReportKeyDown}
                      autoComplete="off"
                    />
                    {(!selectedReport && reportOptions.length > 0) && (
                      <div
                        ref={reportListRef}
                        className="absolute z-10 mt-2 w-full border border-[var(--border)] rounded-md bg-[var(--popover)] max-h-64 overflow-auto shadow-lg"
                      >
                        {reportOptions.map((r, idx) => (
                          <button
                            key={r.report_id}
                            type="button"
                            className={`w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-[var(--accent)] ${idx === rHighlightIdx ? 'bg-[var(--accent)]/80' : ''}`}
                            onClick={() => selectReport(r)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-medium text-[var(--foreground)]">
                                คำร้อง #{r.report_id}{r.full_name ? ` • ${r.full_name}` : ''}
                              </div>
                              <div className="text-xs text-[var(--muted-foreground)]">{r.created_at ?? ''}</div>
                            </div>
                            <div className="text-xs text-[var(--muted-foreground)] flex gap-2 mt-1">
                              {r.status && <span>สถานะ: {r.status}</span>}
                              {r.request_type && <span>ประเภท: {r.request_type}</span>}
                              {r.incident_location && <span className="truncate max-w-[40%]">พื้นที่: {r.incident_location}</span>}
                            </div>
                          </button>
                        ))}
                        {searchingReport && <div className="px-3 py-2 text-sm text-[var(--muted-foreground)]">กำลังค้นหา…</div>}
                      </div>
                    )}
                  </div>

                  {selectedReport && (
                    <div className="mt-2 text-xs text-[var(--muted-foreground)]">
                      เชื่อมกับคำร้อง #{selectedReport.report_id}
                      {selectedReport.full_name ? ` • ผู้ยื่น: ${selectedReport.full_name}` : ''}
                      {selectedReport.status ? ` • สถานะ: ${selectedReport.status}` : ''}
                      {selectedReport.request_type ? ` • ประเภท: ${selectedReport.request_type}` : ''}
                      {selectedReport.incident_location ? ` • พื้นที่: ${selectedReport.incident_location}` : ''}
                      <Button
                        variant="link"
                        className="px-1 text-[var(--primary)]"
                        onClick={() => { setSelectedReport(null); setReportQuery('') }}
                      >
                        ล้างการเลือก
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="description" className="text-[var(--foreground)]">รายละเอียดเพิ่มเติม</Label>
                <Textarea
                  id="description"
                  rows={4}
                  className="mt-1"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={ISSUE_META[issueType].hint}
                />
              </div>

              <Separator />

              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs text-[var(--muted-foreground)] bg-[var(--muted)]/20 px-3 py-2 rounded-md border border-[var(--border)]">
                  หมายเหตุ: บันทึกได้โดยไม่เลือกกล้อง หากเลือกประเภท &quot;ไม่มีจุดกล้องตามที่ร้องขอ&quot;
                </div>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]"
                    onClick={() => router.back()}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving || (!selectedCamera && issueType !== 'missing')}
                    className="bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    <span className="ml-2">{saving ? 'กำลังบันทึก…' : 'บันทึกปัญหา'}</span>
                  </Button>
                </div>
              </div>
            </form>

            {/* History */}
            <div className="mt-8 rounded-lg border border-[var(--border)] bg-[var(--card)] shadow-sm">
              <div className="px-4 py-3 flex items-center justify-between border-b bg-[var(--muted)]/30 border-[var(--border)]">
                <div className="text-base font-semibold text-[var(--foreground)]">
                  {historyScopeAll ? 'ประวัติปัญหาล่าสุด (ทั้งหมด)' : 'ประวัติปัญหาล่าสุดของกล้องนี้'}
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]"
                    onClick={() => { setHistoryScopeAll(!historyScopeAll); fetchHistory() }}
                  >
                    {historyScopeAll ? 'ดูเฉพาะกล้องที่เลือก' : 'ดูทั้งหมด'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--accent)]"
                    onClick={fetchHistory}
                    disabled={loadingHistory}
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingHistory ? 'animate-spin' : ''}`} />
                    <span className="ml-2">รีเฟรช</span>
                  </Button>
                </div>
              </div>
              <div className="p-3">
                {loadingHistory && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-[var(--border)] p-4 bg-[var(--muted)]/20">
                      <div className="flex items-center justify-between mb-3">
                        <Skeleton className="h-5 w-48" />
                        <Skeleton className="h-6 w-32" />
                      </div>
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-3/4" />
                      <div className="mt-3">
                        <Skeleton className="h-4 w-24" />
                      </div>
                    </div>
                    <div className="rounded-lg border border-[var(--border)] p-4 bg-[var(--muted)]/20">
                      <div className="flex items-center justify-between mb-3">
                        <Skeleton className="h-5 w-40" />
                        <Skeleton className="h-6 w-28" />
                      </div>
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-2/3" />
                      <div className="mt-3">
                        <Skeleton className="h-4 w-20" />
                      </div>
                    </div>
                  </div>
                )}

                {!loadingHistory && history.length === 0 && (
                  <div className="text-center py-8">
                    <div className="text-[var(--muted-foreground)] mb-2">
                      <AlertTriangle className="h-12 w-12 mx-auto" />
                    </div>
                    <div className="text-lg font-medium text-[var(--foreground)] mb-1">ยังไม่มีข้อมูล</div>
                    <div className="text-sm text-[var(--muted-foreground)]">ยังไม่มีประวัติปัญหากล้องในระบบ</div>
                  </div>
                )}

                {!loadingHistory && history.length > 0 && (
                  <div className="space-y-4">
                    {history.map((h) => (
                      <div
                        key={h.issue_id}
                        className="rounded-lg border border-[var(--border)] p-4 bg-[var(--card)] hover:shadow-md transition-shadow"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="text-base font-semibold text-[var(--foreground)]">
                            #{h.issue_id} • {ISSUE_META[h.issue_type]?.label || h.issue_type}
                          </div>
                          <Badge variant="outline" className="flex items-center gap-1 bg-[var(--muted)]/30 border-[var(--border)] text-[var(--foreground)]">
                            <Clock className="h-3 w-3" />
                            {h.occurred_at ? new Date(h.occurred_at).toLocaleString('th-TH') : '—'}
                          </Badge>
                        </div>

                        {h.description ? (
                          <div className="mt-3 text-sm text-[var(--foreground)] whitespace-pre-wrap bg-[var(--muted)]/10 p-3 rounded border border-[var(--border)]">
                            {h.description}
                          </div>
                        ) : (
                          <div className="mt-3 text-sm text-[var(--muted-foreground)] italic bg-[var(--muted)]/20 p-3 rounded border border-[var(--border)]">
                            ไม่มีรายละเอียดเพิ่มเติม
                          </div>
                        )}

                        <div className="mt-2 text-xs text-[var(--muted-foreground)]">
                          สถานะ: {(
                            h.status === 'open' ? 'เปิด' :
                            h.status === 'in_progress' ? 'กำลังดำเนินการ' :
                            h.status === 'resolved' ? 'แก้ไขแล้ว' :
                            h.status === 'closed' ? 'ปิด' : h.status
                          )}
                          {h.related_report_id != null ? ` • เชื่อมคำร้อง #${h.related_report_id}` : ''}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  )
}
