'use client'

import { useEffect, useRef, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import {
  FileText,
  Image as ImageIcon,
  AlertCircle,
  ArrowLeft,
  Download,
  ExternalLink,
  Clock,
  MapPin,
  User,
  Calendar,
  FileCheck,
  Play,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations, useLocale } from 'next-intl'

/* =================== Types =================== */
interface ReportData {
  report_id: number
  submitted_at: string
  full_name: string
  status: string
  request_details: string
  incident_date: string
  incident_time: string
  incident_location: string
  request_type: string
  pdf_url?: string
  public_notes?: string
  rejection_reason?: string
  approved_at?: string
  images: Array<{
    image_id: number
    file_name: string
    file_path: string
    camera_location?: string
    captured_at?: string
    description?: string
  }>
  videos: Array<{
    video_id: number
    file_name: string
    file_path: string
    camera_location?: string
    recording_start?: string
    recording_end?: string
    description?: string
    mime_type?: string
    duration_seconds?: number
  }>
}

interface UserReportSummary {
  report_id: number
  submitted_at: string
  status: string
  request_type: string
  incident_date: string
  incident_location: string
}

/* =================== Helpers =================== */
/** ฟังก์ชันสำหรับแปลง status เป็นภาษาที่เลือก */
function getLocalizedStatus(status: string, t: ReturnType<typeof useTranslations>): string {
  const statusMap: Record<string, string> = {
    'รอดำเนินการ': 'pending',
    'รอยื่นเอกสาร': 'waitingForDocuments',
    'รอเอกสารอนุมัติ': 'waitingForApproval',
    'เอกสารอนุมัติเรียบร้อย': 'approved',
    'ปฏิเสธคำร้อง': 'rejected',
    'ด่วน': 'urgent',
  }

  const statusKey = statusMap[status] || 'pending'
  return t(`status.${statusKey}`)
}

/** map สถานะภาษาไทย → cctv-status class (สี) */
function getStatusPillClass(status: string): string {
  if (status === 'เอกสารอนุมัติเรียบร้อย') return 'cctv-status-success'
  if (status === 'ปฏิเสธคำร้อง') return 'cctv-status-danger'
  if (status === 'ด่วน') return 'cctv-status-warn'
  return 'cctv-status-info'
}

type NavigatorWithTouch = Navigator & { maxTouchPoints?: number }
type NavigatorWithShare = Navigator & {
  canShare?: (data?: ShareData) => boolean
  share?: (data?: ShareData) => Promise<void>
}

const getUA = () => (typeof navigator !== 'undefined' ? navigator.userAgent : '') || ''
const isiPadOS13Plus =
  typeof navigator !== 'undefined' &&
  navigator.platform === 'MacIntel' &&
  (((navigator as NavigatorWithTouch).maxTouchPoints ?? 0) > 1)
const isIOS = () => /iPad|iPhone|iPod/.test(getUA()) || isiPadOS13Plus

function mediaUrlFromPath(filePath: string, fallbackName?: string) {
  const raw = (filePath || fallbackName || '').replace(/^\/+/, '')
  const encoded = raw.split('/').filter(Boolean).map(encodeURIComponent).join('/')
  return `/api/files/cctv/${encoded}`
}

function openInNewTab(url: string) {
  const w = window.open(url, '_blank', 'noopener,noreferrer')
  if (w) w.opener = null
}

async function fetchBlobThenShareImage(url: string, filename: string) {
  try {
    const res = await fetch(url, { credentials: 'same-origin' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const mime = blob.type || 'image/jpeg'
    const file = new File([blob], filename, { type: mime })

    const nav = navigator as NavigatorWithShare
    if (nav?.canShare && nav.canShare({ files: [file] })) {
      await nav.share?.({
        files: [file],
        title: filename,
        text: 'Share/Save image from CCTV system',
      })
    } else {
      const objUrl = URL.createObjectURL(file)
      openInNewTab(objUrl)
      setTimeout(() => URL.revokeObjectURL(objUrl), 30_000)
    }
  } catch {
    openInNewTab(url)
  }
}

async function fetchBlobThenDownload(url: string, filename: string) {
  try {
    const res = await fetch(url, { credentials: 'same-origin' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()

    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename || 'download'
    a.rel = 'noopener'
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000)
  } catch {
    openInNewTab(url)
  }
}

const isLineInApp = (ua: string) =>
  /Line\//i.test(ua) || /Line\([^)]+\)/i.test(ua) || ua.includes('Line/') || /LINE/i.test(ua)

const androidIntent = (httpsUrl: string) => {
  try {
    const u = new URL(httpsUrl)
    const path = `${u.host}${u.pathname}${u.search}${u.hash}`
    return `intent://${path}#Intent;scheme=${u.protocol.replace(':', '')};package=com.android.chrome;end`
  } catch {
    return httpsUrl
  }
}

const toChromeIOS = (httpsUrl: string) => {
  try {
    const u = new URL(httpsUrl)
    return `googlechrome://${u.host}${u.pathname}${u.search}${u.hash}`
  } catch {
    return httpsUrl
  }
}

/* Date locale helper */
function useDateLocale() {
  const locale = useLocale()
  return locale === 'th' ? 'th-TH' : 'en-US'
}

/* =================== Simple Video Player =================== */
function SimpleVideoPlayer({
  src,
  className = '',
  poster,
}: {
  src: string
  className?: string
  poster?: string
}) {
  const vref = useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [hover, setHover] = useState(false)
  const [error, setError] = useState<string>('')
  const triedRef = useRef(false)
  const t = useTranslations('StatusResult')

  const showOverlay = !playing && !error
  const showControls = hover || playing

  const handleError = () => {
    if (!triedRef.current && vref.current) {
      triedRef.current = true
      try {
        const u = new URL(vref.current.src)
        u.searchParams.set('r', Date.now().toString())
        vref.current.src = u.toString()
      } catch {
        vref.current.src = `${vref.current.src}${vref.current.src.includes('?') ? '&' : '?'}r=${Date.now()}`
      }
      vref.current.load()
      return
    }
    setError(t('video.error'))
  }

  return (
    <div
      className={`relative aspect-video bg-black rounded-lg overflow-hidden ${className}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <video
        ref={vref}
        className="absolute inset-0 h-full w-full object-cover"
        playsInline
        preload="metadata"
        controls={showControls}
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        poster={poster}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={handleError}
        src={src}
      />
      {showOverlay && (
        <button
          type="button"
          aria-label={t('video.play')}
          className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/35 via-black/15 to-transparent"
          onClick={() => vref.current?.play()}
        >
          <span className="inline-flex items-center justify-center rounded-full w-16 h-16 md:w-20 md:h-20 bg-white/95 shadow-xl ring-1 ring-black/10">
            <Play className="w-7 h-7 md:w-8 md:h-8 translate-x-[1px] text-[var(--primary)]" aria-hidden="true" />
          </span>
        </button>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <p className="text-white text-sm">{error}</p>
        </div>
      )}
    </div>
  )
}

/* =================== Reusable: Official header =================== */
function OfficialHeader() {
  return (
    <div className="cctv-official">
      <div className="seal" aria-hidden />
      <div className="flex flex-col min-w-0">
        <span className="org-line1">เทศบาลนครหัวหิน · Hua Hin Municipality</span>
        <span className="org-line2">ระบบยื่นคำร้องขอภาพจากกล้อง CCTV</span>
      </div>
    </div>
  )
}

/* =================== Content Component =================== */
function StatusResultContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('StatusResult')
  const dateLocale = useDateLocale()

  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [allUserReports, setAllUserReports] = useState<UserReportSummary[]>([])
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [mediaTab, setMediaTab] = useState<'all' | 'images' | 'videos'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 3
  const [showExternalBrowserModal, setShowExternalBrowserModal] = useState(false)

  const reportId = searchParams.get('id')
  const token = searchParams.get('token')
  const external = searchParams.get('external')

  useEffect(() => {
    if (external === '1' && typeof window !== 'undefined') {
      const ua = navigator.userAgent
      if (isLineInApp(ua)) {
        const cleanUrl = (() => {
          const clean = new URL(window.location.href)
          clean.searchParams.delete('external')
          return clean.toString()
        })()

        const isAndroid = /Android/i.test(ua)
        const isiOS = /iPhone|iPad|iPod/i.test(ua) || isiPadOS13Plus

        const fallbackTimeout = setTimeout(() => {
          if (document.visibilityState === 'visible' && !document.hidden) {
            setShowExternalBrowserModal(true)
          }
        }, 2000)

        try {
          if (isAndroid) {
            window.location.href = androidIntent(cleanUrl)
          } else if (isiOS) {
            window.location.href = toChromeIOS(cleanUrl)
          }
        } catch {}

        return () => clearTimeout(fallbackTimeout)
      }
    }
  }, [external])

  useEffect(() => {
    const fetchReportData = async () => {
      try {
        if (!token) {
          setError(t('errors.notFound'))
          return
        }

        const params = new URLSearchParams()
        params.append('token', token)
        if (reportId) params.append('id', reportId)

        const url = `/api/status/result?${params.toString()}`
        const response = await fetch(url, { cache: 'no-store' })
        const result = await response.json()
        if (!response.ok) throw new Error(result?.error || t('errors.notFound'))
        setReportData(result.report as ReportData)
        setAllUserReports(Array.isArray(result.all_user_reports) ? result.all_user_reports : [])
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errors.loadFailed'))
      } finally {
        setIsLoading(false)
      }
    }

    fetchReportData()
  }, [reportId, token, t])

  useEffect(() => {
    if (selectedReportId && selectedReportId !== parseInt(reportId || '0', 10)) {
      setReportData(null)
      setAllUserReports([])
      setCurrentPage(1)
      setIsLoading(true)
      setError('')
      const qs = new URLSearchParams({ id: String(selectedReportId) })
      if (token) qs.append('token', token)
      router.push(`/request/status/result?${qs.toString()}`)
    }
  }, [selectedReportId, reportId, token, router])

  const totalReports = allUserReports.length
  const totalPages = Math.ceil(totalReports / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentReports = allUserReports.slice(startIndex, endIndex)

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page)
  }

  const copyUrlToClipboard = useCallback(async () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('external')
    const cleanUrl = url.toString()

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(cleanUrl)
        alert(t('external.copyDone'))
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = cleanUrl
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
        alert(t('external.copy.done'))
      }
    } catch {
      prompt(t('external.copyManual'), cleanUrl)
    }
  }, [t])

  const getLocalizedStatusText = (status: string) => getLocalizedStatus(status, t)

  if (isLoading) {
    return (
      <main className="cctv-bg-dot min-h-screen">
        <OfficialHeader />
        <div className="min-h-[60vh] grid place-items-center" role="status" aria-live="polite">
          <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
            <div className="h-4 w-4 rounded-full border-2 border-[var(--border)] border-r-transparent animate-spin" aria-hidden="true" />
            {t('loading')}
          </div>
        </div>
      </main>
    )
  }

  if (error || !reportData) {
    return (
      <main className="cctv-bg-dot min-h-screen">
        <OfficialHeader />
        <div className="relative mx-auto max-w-md px-4 pt-10 pb-10 sm:px-6 lg:px-8">
          <div className="cctv-card">
            <div className="cctv-card-body text-center py-10">
              <AlertCircle className="h-12 w-12 text-[var(--destructive)] mx-auto mb-4" aria-hidden="true" />
              <h3 className="text-lg font-bold text-[var(--foreground)] mb-2">{t('notfound.title')}</h3>
              <p className="text-sm text-[var(--muted-foreground)] mb-4">
                {error || t('errors.invalidOrExpired')}
              </p>

              <div className="bg-[var(--cctv-bg-muted,var(--muted))] border border-[var(--border)] rounded-lg p-4 mb-6 text-left">
                <h4 className="text-sm font-semibold text-[var(--foreground)] mb-2">
                  {t('notfound.reasonsTitle')}
                </h4>
                <ul className="text-xs text-[var(--muted-foreground)] space-y-1 list-disc list-inside">
                  <li>{t('notfound.r1')}</li>
                  <li>{t('notfound.r2')}</li>
                  <li>{t('notfound.r3')}</li>
                  <li>{t('notfound.r4')}</li>
                </ul>
                <p className="text-xs text-[var(--muted-foreground)] mt-3 pt-2 border-t border-[var(--border)]">
                  {t('notfound.hint')}
                </p>
              </div>

              <Link href="/request/status">
                <Button variant="outline" className="border-[1.5px]">
                  <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
                  {t('back')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  const totalImages = reportData.images?.length || 0
  const totalVideos = reportData.videos?.length || 0
  const mediaEmpty = totalImages === 0 && totalVideos === 0
  const pillClass = getStatusPillClass(reportData.status)

  return (
    <main className="cctv-bg-dot min-h-screen">
      <OfficialHeader />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 pb-16">
        {/* Back link */}
        <div className="mb-4">
          <Link
            href="/request/status"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--primary)] transition-colors focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2 rounded"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            {t('back')}
          </Link>
        </div>

        {/* Hero header — eyebrow + title + status pill */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
          <div className="min-w-0 flex-1">
            <div className="cctv-eyebrow mb-1">
              คำร้องเลขที่ #HH-{String(reportData.report_id).padStart(6, '0')}
            </div>
            <h1 className="m-0 text-[1.5rem] sm:text-[1.75rem] lg:text-[2rem] font-bold leading-tight tracking-tight text-[var(--foreground)] [text-wrap:balance]">
              {reportData.request_type || t('na')}
              {reportData.incident_location && (
                <>
                  {' '}
                  <span className="text-[var(--muted-foreground)] font-medium">·</span>{' '}
                  <span className="text-[var(--muted-foreground)] font-medium">
                    {reportData.incident_location}
                  </span>
                </>
              )}
            </h1>
            <p className="cctv-subtle mt-1">
              {t('submittedAtPrefix', {
                date: reportData.submitted_at
                  ? new Date(reportData.submitted_at).toLocaleString(dateLocale)
                  : t('na'),
              })}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className={`cctv-status ${pillClass}`} title={getLocalizedStatusText(reportData.status)}>
              <span className="dot" />
              {getLocalizedStatusText(reportData.status)}
            </div>
            {reportData.status === 'เอกสารอนุมัติเรียบร้อย' && reportData.approved_at && (
              <span className="text-[10px] text-[var(--muted-foreground)]">
                {t('approvedAt', { date: new Date(reportData.approved_at).toLocaleString(dateLocale) })}
              </span>
            )}
          </div>
        </div>

        {/* Reports List (เลือกคำร้อง) */}
        {allUserReports.length > 1 && (
          <div className="cctv-card mb-6">
            <div className="cctv-card-head">
              <FileCheck className="w-4 h-4 text-[var(--primary)]" aria-hidden="true" />
              <div className="text-sm font-bold text-[var(--foreground)]">
                {t('reports.all', { count: allUserReports.length })}
              </div>
            </div>
            <div className="cctv-card-body">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {currentReports
                  .map((report) => {
                    if (!report?.report_id) return null
                    const isActive = report.report_id === parseInt(reportId || '0', 10)
                    const pCls = getStatusPillClass(report.status || 'รอดำเนินการ')
                    return (
                      <button
                        key={report.report_id}
                        type="button"
                        className={`w-full text-left p-3 rounded-lg border-[1.5px] cursor-pointer transition ${
                          isActive
                            ? 'border-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_5%,var(--card))]'
                            : 'border-[var(--border)] bg-[var(--card)] hover:border-[color-mix(in_oklch,var(--primary)_45%,var(--border))]'
                        }`}
                        onClick={() => setSelectedReportId(report.report_id)}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className={`cctv-status ${pCls} text-[10px]`}>
                            <span className="dot" />
                            {getLocalizedStatusText(report.status || 'รอดำเนินการ')}
                          </div>
                          <div className="text-xs text-[var(--muted-foreground)]">
                            {report.submitted_at
                              ? new Date(report.submitted_at).toLocaleDateString(dateLocale)
                              : t('na')}
                          </div>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                            <Calendar className="w-3 h-3 text-[var(--muted-foreground)]" aria-hidden="true" />
                            {report.incident_date
                              ? new Date(report.incident_date).toLocaleDateString(dateLocale)
                              : t('na')}
                          </div>
                          <div className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
                            <MapPin className="w-3 h-3 mt-0.5 shrink-0" aria-hidden="true" />
                            <span className="line-clamp-2">{report.incident_location || t('na')}</span>
                          </div>
                        </div>
                      </button>
                    )
                  })
                  .filter(Boolean)}
              </div>
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                tns={t}
              />
            </div>
          </div>
        )}

        {/* Status timeline preview (decorative — uses status text only) */}
        <div className="cctv-card mb-6">
          <div className="cctv-card-body">
            <div className="cctv-timeline">
              <div className="cctv-timeline-item done">
                <div className="text-sm font-semibold">รับคำร้อง</div>
                <div className="cctv-subtle">
                  {reportData.submitted_at
                    ? new Date(reportData.submitted_at).toLocaleString(dateLocale)
                    : t('na')}
                </div>
              </div>
              <div
                className={`cctv-timeline-item ${
                  reportData.status === 'เอกสารอนุมัติเรียบร้อย'
                    ? 'done'
                    : reportData.status === 'ปฏิเสธคำร้อง'
                    ? 'done'
                    : 'cur'
                }`}
              >
                <div className="text-sm font-semibold">
                  {reportData.status === 'เอกสารอนุมัติเรียบร้อย'
                    ? 'อนุมัติคำร้อง'
                    : reportData.status === 'ปฏิเสธคำร้อง'
                    ? 'ปฏิเสธคำร้อง'
                    : 'เจ้าหน้าที่กำลังพิจารณา'}
                </div>
                <div className="cctv-subtle">{getLocalizedStatusText(reportData.status)}</div>
              </div>
              {(totalImages > 0 || totalVideos > 0) ? (
                <div className="cctv-timeline-item done">
                  <div className="text-sm font-semibold">พร้อมรับไฟล์</div>
                  <div className="cctv-subtle">
                    {totalImages} ภาพ · {totalVideos} วิดีโอ
                  </div>
                </div>
              ) : (
                <div className="cctv-timeline-item">
                  <div className="text-sm font-semibold text-[var(--muted-foreground)]">
                    ส่งไฟล์ผ่าน LINE
                  </div>
                  <div className="cctv-subtle">
                    ระบบจะส่งวิดีโอให้ท่านอัตโนมัติเมื่อเอกสารผ่านการอนุมัติ
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Media */}
          <section className="lg:col-span-8 space-y-6">
            <div className="cctv-card">
              <div className="cctv-card-head">
                <ImageIcon className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
                <div className="text-sm font-bold text-[var(--foreground)]">{t('media.title')}</div>
                <div className="ml-auto flex items-center gap-2">
                  <TabButton active={mediaTab === 'all'} onClick={() => setMediaTab('all')}>
                    {t('tabs.all', { total: totalImages + totalVideos })}
                  </TabButton>
                  <TabButton active={mediaTab === 'images'} onClick={() => setMediaTab('images')}>
                    {t('tabs.images', { count: totalImages })}
                  </TabButton>
                  <TabButton active={mediaTab === 'videos'} onClick={() => setMediaTab('videos')}>
                    {t('tabs.videos', { count: totalVideos })}
                  </TabButton>
                </div>
              </div>
              {isIOS() && totalVideos > 0 && (
                <div className="px-5 pt-3 -mb-2 text-xs text-[var(--muted-foreground)]">
                  {t('ios.saveHintLong')}
                </div>
              )}
              <div className="cctv-card-body">
                {mediaEmpty ? (
                  <EmptyMedia tns={t} />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {reportData.images &&
                      (mediaTab === 'all' || mediaTab === 'images') &&
                      reportData.images.map((img) => {
                        const url = mediaUrlFromPath(img.file_path, img.file_name)
                        const filename = img.file_name || img.file_path.split('/').pop() || 'image.jpg'
                        return (
                          <div key={`img-${img.image_id}`} className="space-y-2">
                            <div className="aspect-video relative rounded-lg border border-[var(--border)] bg-[var(--cctv-bg-muted,var(--muted))] overflow-hidden">
                              <Image
                                src={url}
                                alt={img.description || img.file_name || t('img.alt')}
                                fill
                                className="object-cover"
                                sizes="(max-width: 640px) 100vw, 50vw"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.style.display = 'none'
                                  const container = target.parentElement?.parentElement
                                  if (container) {
                                    const errorMsg = document.createElement('div')
                                    errorMsg.className =
                                      'absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500 text-sm'
                                    errorMsg.textContent = t('img.loadError')
                                    container.appendChild(errorMsg)
                                  }
                                }}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                className="h-9 bg-[var(--primary)] hover:bg-[color-mix(in_oklch,var(--primary)_85%,black)] text-[var(--primary-foreground)] text-sm"
                                onClick={() => fetchBlobThenShareImage(url, filename)}
                                aria-label={t('btn.downloadImage')}
                              >
                                <Download className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                                <span className="truncate">{t('btn.download')}</span>
                              </Button>
                              <Button
                                variant="outline"
                                className="h-9 border-[1.5px] border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] text-sm"
                                onClick={() => openInNewTab(url)}
                                aria-label={t('btn.openImage')}
                              >
                                <ExternalLink className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                                <span className="truncate">{t('btn.open')}</span>
                              </Button>
                            </div>
                          </div>
                        )
                      })}

                    {reportData.videos &&
                      (mediaTab === 'all' || mediaTab === 'videos') &&
                      reportData.videos.map((v) => {
                        const url = mediaUrlFromPath(v.file_path, v.file_name)
                        const filename =
                          v.file_name && v.file_name.endsWith('.mp4')
                            ? v.file_name
                            : `${v.file_name || v.video_id}.mp4`
                        const duration =
                          typeof v.duration_seconds === 'number'
                            ? `${Math.floor(v.duration_seconds / 60)}:${(v.duration_seconds % 60)
                                .toString()
                                .padStart(2, '0')}`
                            : null

                        return (
                          <div key={`vid-${v.video_id}`} className="space-y-2">
                            <div className="relative rounded-lg border border-[var(--border)] bg-black overflow-hidden">
                              <SimpleVideoPlayer src={url} />
                              {duration && (
                                <div className="absolute bottom-2 right-2 rounded px-2 py-0.5 text-xs bg-black/70 text-white">
                                  {duration}
                                </div>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Button
                                className="h-9 bg-[var(--primary)] hover:bg-[color-mix(in_oklch,var(--primary)_85%,black)] text-[var(--primary-foreground)] text-sm"
                                onClick={() => fetchBlobThenDownload(url, filename)}
                                aria-label={t('btn.downloadVideo')}
                              >
                                <Download className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                                <span className="truncate">{t('btn.download')}</span>
                              </Button>
                              <Button
                                variant="outline"
                                className="h-9 border-[1.5px] border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)] text-sm"
                                onClick={() => openInNewTab(url)}
                                aria-label={t('btn.openVideo')}
                              >
                                <ExternalLink className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                                <span className="truncate">{t('btn.open')}</span>
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Details */}
          <aside className="lg:col-span-4 space-y-4">
            <div className="cctv-card lg:sticky lg:top-24">
              <div className="cctv-card-head">
                <span className="cctv-num">i</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-[var(--foreground)]">
                    {t('details.title')}
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">
                    รายละเอียดเพิ่มเติมของคำร้อง
                  </div>
                </div>
              </div>
              <div className="cctv-card-body space-y-4">
                <KV label={t('details.fullName')} icon={<User className="w-3.5 h-3.5" aria-hidden="true" />}>
                  {reportData.full_name || t('na')}
                </KV>
                <KV label={t('details.requestType')} icon={<FileCheck className="w-3.5 h-3.5" aria-hidden="true" />}>
                  {reportData.request_type || t('na')}
                </KV>
                <KV label={t('details.incidentDate')} icon={<Calendar className="w-3.5 h-3.5" aria-hidden="true" />}>
                  {reportData.incident_date
                    ? new Date(reportData.incident_date).toLocaleDateString(dateLocale)
                    : t('na')}
                </KV>
                <KV label={t('details.incidentTime')} icon={<Clock className="w-3.5 h-3.5" aria-hidden="true" />}>
                  {reportData.incident_time || t('na')}
                </KV>
                <KV label={t('details.incidentLocation')} icon={<MapPin className="w-3.5 h-3.5" aria-hidden="true" />}>
                  {reportData.incident_location || t('na')}
                </KV>
                <KV label={t('details.requestDetails')} icon={<FileText className="w-3.5 h-3.5" aria-hidden="true" />}>
                  <span className="leading-relaxed whitespace-pre-line">
                    {reportData.request_details || t('na')}
                  </span>
                </KV>

                {reportData.public_notes && (
                  <div className="space-y-1.5 pt-2 border-t border-dashed border-[var(--border)]">
                    <div className="text-xs font-semibold text-[var(--foreground)]">
                      {t('details.officerNote')}
                    </div>
                    <div className="text-sm bg-[var(--cctv-bg-muted,var(--muted))] border border-[var(--border)] rounded-lg p-3 leading-relaxed">
                      {reportData.public_notes}
                    </div>
                  </div>
                )}

                {reportData.rejection_reason && (
                  <div className="space-y-1.5 pt-2 border-t border-dashed border-[var(--border)]">
                    <div className="text-xs font-semibold text-[var(--destructive)]">
                      {t('details.rejectionReason')}
                    </div>
                    <div
                      className="text-sm rounded-lg p-3 leading-relaxed text-[var(--destructive)] border"
                      style={{
                        background: 'color-mix(in oklch, var(--destructive) 8%, transparent)',
                        borderColor: 'color-mix(in oklch, var(--destructive) 25%, transparent)',
                      }}
                    >
                      {reportData.rejection_reason}
                    </div>
                  </div>
                )}

                {reportData.pdf_url && (
                  <div className="pt-3 border-t border-[var(--border)]">
                    <div className="text-xs font-semibold text-[var(--foreground)] mb-2">
                      {t('pdf.title')}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="h-9 border-[1.5px] border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] text-sm"
                        onClick={() => {
                          if (reportData.pdf_url) openInNewTab(reportData.pdf_url)
                        }}
                      >
                        <ExternalLink className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                        {t('pdf.open')}
                      </Button>
                      <Button
                        variant="outline"
                        className="h-9 border-[1.5px] border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-[var(--primary-foreground)] text-sm"
                        onClick={() => {
                          if (!reportData.pdf_url || !reportData.report_id) return
                          const link = document.createElement('a')
                          link.href = reportData.pdf_url
                          link.download = `report_${reportData.report_id}.pdf`
                          link.style.display = 'none'
                          document.body.appendChild(link)
                          link.click()
                          document.body.removeChild(link)
                        }}
                      >
                        <Download className="w-3.5 h-3.5 mr-1" aria-hidden="true" />
                        {t('pdf.download')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* External Browser Modal */}
      {showExternalBrowserModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="cctv-card-elev bg-[var(--card)] max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] rounded-full flex items-center justify-center mr-4">
                  <ExternalLink className="w-6 h-6 text-[var(--primary)]" aria-hidden="true" />
                </div>
                <h3 className="text-lg font-bold text-[var(--foreground)]">
                  {t('external.title')}
                </h3>
              </div>

              <p className="text-[var(--muted-foreground)] mb-4 text-sm leading-relaxed">
                {t('external.desc')}
              </p>

              <div className="mb-4">
                <div className="flex items-center gap-2 p-3 bg-[var(--cctv-bg-muted,var(--muted))] rounded-lg border border-[var(--border)]">
                  <code className="flex-1 text-xs text-[var(--foreground)] break-all">
                    {(() => {
                      const url = new URL(window.location.href)
                      url.searchParams.delete('external')
                      return url.toString()
                    })()}
                  </code>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={copyUrlToClipboard}
                  className="flex-1 bg-[var(--primary)] hover:bg-[color-mix(in_oklch,var(--primary)_85%,black)] text-[var(--primary-foreground)]"
                >
                  📋 {t('external.copy')}
                </Button>
                <Button
                  onClick={() => setShowExternalBrowserModal(false)}
                  variant="outline"
                  className="flex-1 border-[1.5px]"
                >
                  {t('external.close')}
                </Button>
              </div>

              <div className="mt-4 p-3 bg-[color-mix(in_oklch,var(--primary)_5%,transparent)] rounded-lg border border-[color-mix(in_oklch,var(--primary)_20%,transparent)]">
                <p className="text-xs text-[var(--primary)] leading-relaxed">
                  {t('external.howto')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

/* ---------- Pagination Controls ---------- */
function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  tns,
}: {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  tns: ReturnType<typeof useTranslations>
}) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className="px-3 py-1 h-8 border-[1.5px] border-[var(--border)] text-xs"
      >
        {tns('pager.prev')}
      </Button>

      <div className="flex items-center gap-1">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
          <Button
            key={page}
            variant={page === currentPage ? 'default' : 'outline'}
            size="sm"
            onClick={() => onPageChange(page)}
            className={`px-3 py-1 h-8 text-xs min-w-[32px] ${
              page === currentPage
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]'
                : 'border-[1.5px] border-[var(--border)] hover:bg-[var(--accent)]'
            }`}
          >
            {page}
          </Button>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className="px-3 py-1 h-8 border-[1.5px] border-[var(--border)] text-xs"
      >
        {tns('pager.next')}
      </Button>
    </div>
  )
}

/* ---------- Small UI parts ---------- */
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md border-[1.5px] text-[11px] whitespace-nowrap font-semibold
        focus:outline-none focus:ring-2 focus:ring-[color-mix(in_oklch,var(--primary)_25%,transparent)]
        ${
          active
            ? 'bg-[color-mix(in_oklch,var(--primary)_12%,transparent)] text-[var(--primary)] border-[var(--primary)]'
            : 'border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]'
        }
      `}
      aria-pressed={active}
    >
      {children}
    </button>
  )
}

function EmptyMedia({ tns }: { tns: ReturnType<typeof useTranslations> }) {
  return (
    <div className="text-center py-10 col-span-full">
      <div className="w-14 h-14 bg-[var(--cctv-bg-muted,var(--muted))] rounded-xl border border-[var(--border)] flex items-center justify-center mx-auto mb-3" aria-hidden="true">
        <AlertCircle className="h-6 w-6 text-[var(--muted-foreground)]" />
      </div>
      <h3 className="text-base font-semibold text-[var(--foreground)] mb-1">
        {tns('media.emptyTitle')}
      </h3>
      <p className="text-xs text-[var(--muted-foreground)] max-w-md mx-auto">
        {tns('media.emptyDesc')}
      </p>
    </div>
  )
}

function KV({
  label,
  children,
  icon,
}: {
  label: string
  children: React.ReactNode
  icon: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="w-3.5 h-3.5 text-[var(--primary)] mt-1 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-0.5">
          {label}
        </div>
        <div className="text-[13.5px] text-[var(--foreground)] font-medium break-words">
          {children}
        </div>
      </div>
    </div>
  )
}

/* =================== Page with Suspense =================== */
function FallbackLoader() {
  const t = useTranslations('StatusResult')
  return (
    <main className="cctv-bg-dot min-h-screen">
      <OfficialHeader />
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
          <p className="text-[var(--muted-foreground)]">{t('loadingGeneric')}</p>
        </div>
      </div>
    </main>
  )
}

export default function StatusResultPage() {
  return (
    <Suspense fallback={<FallbackLoader />}>
      <StatusResultContent />
    </Suspense>
  )
}
