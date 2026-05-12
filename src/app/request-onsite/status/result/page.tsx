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
  Play
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { STATUS_STYLES } from '@/lib/theme-colors'
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
    'ด่วน': 'urgent'
  }

  const statusKey = statusMap[status] || 'pending'
  return t(`status.${statusKey}`)
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
  // ตัด / นำหน้าออก แล้ว split เป็น segment
  const raw = (filePath || fallbackName || '').replace(/^\/+/, '')
  // เข้ารหัสแต่ละ segment ป้องกันอักขระพิเศษ/ช่องว่าง
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

/* ===== NEW: ดาวน์โหลดไฟล์แบบ Blob เพื่อแก้ปัญหา Android ===== */
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
    // หากดาวน์โหลดแบบ Blob ไม่ได้ (เช่น in-app browser) ให้เปิดแท็บเป็น fallback
    openInNewTab(url)
  }
}

const isLineInApp = (ua: string) =>
  /Line\//i.test(ua) || /Line\([^)]+\)/i.test(ua) || ua.includes('Line/') || /LINE/i.test(ua)

const androidIntent = (httpsUrl: string) => {
  try {
    const u = new URL(httpsUrl)
    const path = `${u.host}${u.pathname}${u.search}${u.hash}`
    return `intent://${path}#Intent;scheme=${u.protocol.replace(':','')};package=com.android.chrome;end`
  } catch { return httpsUrl }
}

const toChromeIOS = (httpsUrl: string) => {
  try {
    const u = new URL(httpsUrl)
    return `googlechrome://${u.host}${u.pathname}${u.search}${u.hash}`
  } catch { return httpsUrl }
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
}: { src: string; className?: string; poster?: string }) {
  const vref = useRef<HTMLVideoElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [hover, setHover] = useState(false)
  const [error, setError] = useState<string>('')
  const triedRef = useRef(false)
  const t = useTranslations('StatusResult')

  const showOverlay = !playing && !error
  const showControls = hover || playing

  const handleError = () => {
    // ลอง reload 1 ครั้งด้วย cache-buster เผื่อเจอเคส proxy/cache แปลก ๆ ในครั้งแรก
    if (!triedRef.current && vref.current) {
      triedRef.current = true
      try {
        const u = new URL(vref.current.src)
        u.searchParams.set('r', Date.now().toString())
        vref.current.src = u.toString()
      } catch {
        // ถ้า URL ไม่สมบูรณ์ ให้ fallback ต่อท้าย query เอง
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
            <Play className="w-7 h-7 md:w-8 md:h-8 translate-x-[1px] text-[var(--primary)]" />
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
  const external = searchParams.get('external')

  // Handle LINE browser external redirect
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
        const params = new URLSearchParams()
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
  }, [reportId, t])

  useEffect(() => {
    if (selectedReportId && selectedReportId !== parseInt(reportId || '0', 10)) {
      setReportData(null)
      setAllUserReports([])
      setCurrentPage(1)
      setIsLoading(true)
      setError('')
      router.push(`/request-onsite/status/result?id=${selectedReportId}`)
    }
  }, [selectedReportId, reportId, router])

  // Pagination
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

  const getStatusBadgeColor = (status: string) =>
    STATUS_STYLES[status]?.badge || 'bg-[var(--muted)] text-[var(--foreground)] border-[var(--border)]'

  const getLocalizedStatusText = (status: string) => getLocalizedStatus(status, t)

  if (isLoading) {
    return (
      <div className="min-h-screen grid place-items-center" aria-live="polite">
        <div className="flex items-center gap-3 text-sm text-[var(--muted-foreground)]">
          <div className="h-4 w-4 rounded-full border-2 border-[var(--border)] border-r-transparent animate-spin" />
          {t('loading')}
        </div>
      </div>
    )
  }

  if (error || !reportData) {
    return (
      <div className="min-h-screen relative">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_50%_-10%,rgba(3,54,255,0.05),transparent_60%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(rgba(148,163,184,0.15)_1px,transparent_1px)] [background-size:14px_14px] [background-position:0_0]"
        />

        <div className="relative mx-auto max-w-md px-4 pt-24 pb-10 sm:px-6 lg:px-8">
          <Card className="bg-[var(--card)] border-2 border-[var(--border)] rounded-xl shadow-sm">
            <CardContent className="text-center py-12 px-6">
              <AlertCircle className="h-12 w-12 text-[var(--destructive)] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">{t('notfound.title')}</h3>
              <p className="text-sm text-[var(--muted-foreground)] mb-4">{error || t('errors.invalidOrExpired')}</p>

              <div className="bg-[var(--muted)]/30 border border-[var(--border)] rounded-lg p-4 mb-6 text-left">
                <h4 className="text-sm font-medium text-[var(--foreground)] mb-2">{t('notfound.reasonsTitle')}</h4>
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

              <Link href="/request-onsite/status">
                <Button variant="outline" className="border-2">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {t('back')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const totalImages = reportData.images?.length || 0
  const totalVideos = reportData.videos?.length || 0
  const mediaEmpty = totalImages === 0 && totalVideos === 0

  return (
    <div className="min-h-screen relative">
      {/* BG */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_50%_-10%,rgba(3,54,255,0.05),transparent_60%)]" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 [background-image:radial-gradient(rgba(148,163,184,0.15)_1px,transparent_1px)] [background-size:14px_14px] [background-position:0_0]" />

      {/* ======== MOBILE ======== */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-5 pt-20 pb-20 lg:hidden">
        {/* Reports List (mobile) */}
        {allUserReports.length > 1 && (
          <Card className="mb-6 bg-[var(--card)] border border-[var(--border)] rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
                <FileCheck className="w-4 h-4" />
                {t('reports.all', {count: allUserReports.length})}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {currentReports.map((report) => {
                  if (!report?.report_id) return null
                  return (
                    <button
                      key={report.report_id}
                      type="button"
                      className={`w-full text-left p-3 rounded border cursor-pointer ${
                        report.report_id === parseInt(reportId || '0', 10)
                          ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                          : 'border-[var(--border)] hover:border-[var(--primary)]/50'
                      }`}
                      onClick={() => setSelectedReportId(report.report_id)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`text-xs px-2 py-0.5 ${getStatusBadgeColor(report.status || 'รอดำเนินการ')}`}>
                              {getLocalizedStatusText(report.status || 'รอดำเนินการ')}
                            </Badge>
                          </div>
                          <div className="text-xs text-[var(--muted-foreground)] space-y-0.5">
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {report.incident_date ? new Date(report.incident_date).toLocaleDateString(dateLocale) : t('na')}
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {report.incident_location || t('na')}
                            </div>
                          </div>
                        </div>
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {report.submitted_at ? new Date(report.submitted_at).toLocaleDateString(dateLocale) : t('na')}
                        </div>
                      </div>
                    </button>
                  )
                }).filter(Boolean)}
              </div>
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                tns={t}
              />
            </CardContent>
          </Card>
        )}

        {/* Utility Bar (mobile) */}
        <div className="mb-4">
          <div className="flex items-center justify-between gap-2">
          <Link href="/request-onsite/status" className="shrink-0">
              <Button
                variant="outline"
                className="h-8 px-3 border border-[var(--border)] text-[var(--foreground)] text-sm hover:bg-[var(--muted)]"
                aria-label={t('aria.back')}
              >
                <ArrowLeft className="w-3 h-3 mr-1" />
                {t('backShort')}
              </Button>
            </Link>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex flex-col items-end gap-1">
                <Badge className={`text-[10px] px-2 py-0.5 ${getStatusBadgeColor(reportData.status)} shrink-0`} title={getLocalizedStatusText(reportData.status)}>
                  {getLocalizedStatusText(reportData.status)}
                </Badge>
                {reportData.status === 'เอกสารอนุมัติเรียบร้อย' && reportData.approved_at && (
                  <span className="text-[8px] text-[var(--muted-foreground)] shrink-0">
                    {t('approvedAt', {date: new Date(reportData.approved_at).toLocaleString(dateLocale)})}
                  </span>
                )}
              </div>
            </div>
          </div>
          <h1 className="sr-only">{t('sr.pageTitle')}</h1>
        </div>

        {/* Media tabs */}
        <div className="mb-4">
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            <TabButton active={mediaTab === 'all'} onClick={() => setMediaTab('all')}>
              {t('tabs.all', {total: totalImages + totalVideos})}
            </TabButton>
            <TabButton active={mediaTab === 'images'} onClick={() => setMediaTab('images')}>
              {t('tabs.images', {count: totalImages})}
            </TabButton>
            <TabButton active={mediaTab === 'videos'} onClick={() => setMediaTab('videos')}>
              {t('tabs.videos', {count: totalVideos})}
            </TabButton>
          </div>
          {isIOS() && totalVideos > 0 && (
            <p className="text-[10px] text-[var(--muted-foreground)] mt-1">{t('ios.saveHint')}</p>
          )}
        </div>

        {/* Media Gallery */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {mediaEmpty && <EmptyMedia tns={t} />}

          {reportData.images && (mediaTab === 'all' || mediaTab === 'images') &&
            reportData.images.map((img) => {
              const url = mediaUrlFromPath(img.file_path, img.file_name)
              const filename = img.file_name || (img.file_path.split('/').pop() || 'image.jpg')
              return (
                <Card key={`m-img-${img.image_id}`} className="border rounded-lg overflow-hidden bg-white">
                  <div className="aspect-video relative bg-gray-50">
                    <Image
                      src={url}
                      alt={img.description || img.file_name || t('img.alt')}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 100vw, 50vw"
                      priority={false}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const container = target.parentElement?.parentElement
                        if (container) {
                          const errorMsg = document.createElement('div')
                          errorMsg.className = 'absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-500 text-sm'
                          errorMsg.textContent = t('img.loadError')
                          container.appendChild(errorMsg)
                        }
                      }}
                    />
                  </div>
                  <CardContent className="p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        className="h-8 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] text-sm"
                        onClick={() => fetchBlobThenShareImage(url, filename)}
                        aria-label={t('btn.downloadImage')}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        <span className="truncate">{t('btn.download')}</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] text-sm"
                        onClick={() => openInNewTab(url)}
                        aria-label={t('btn.openImage')}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        <span className="truncate">{t('btn.open')}</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

          {reportData.videos && (mediaTab === 'all' || mediaTab === 'videos') &&
            reportData.videos.map((v) => {
              const url = mediaUrlFromPath(v.file_path, v.file_name)
              const filename = (v.file_name && v.file_name.endsWith('.mp4')) ? v.file_name : `${v.file_name || v.video_id}.mp4`
              const duration =
                typeof v.duration_seconds === 'number'
                  ? `${Math.floor(v.duration_seconds / 60)}:${(v.duration_seconds % 60).toString().padStart(2, '0')}`
                  : null

              return (
                <Card key={`m-vid-${v.video_id}`} className="border rounded-lg overflow-hidden bg-white">
                  <div className="relative">
                    <SimpleVideoPlayer src={url} />
                    {duration && (
                      <div className="absolute bottom-2 right-2 rounded px-2 py-0.5 text-xs bg-black/70 text-white">
                        {duration}
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        className="h-8 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] text-sm"
                        onClick={() => fetchBlobThenDownload(url, filename)}
                        aria-label={t('btn.downloadVideo')}
                      >
                        <Download className="w-3 h-3 mr-1" />
                        <span className="truncate">{t('btn.download')}</span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-8 border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] text-sm"
                        onClick={() => openInNewTab(url)}
                        aria-label={t('btn.openVideo')}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        <span className="truncate">{t('btn.open')}</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
        </div>

        <details open className="mt-6 group rounded-lg border border-[var(--border)] bg-white">
          <summary className="cursor-pointer list-none px-3 py-2 flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--foreground)]">{t('details.title')}</span>
            <span className="text-xs text-[var(--muted-foreground)] group-open:hidden">{t('show')}</span>
            <span className="text-xs text-[var(--muted-foreground)] hidden group-open:inline">{t('hide')}</span>
          </summary>
          <div className="px-3 pb-3 space-y-3">
            <DetailField label={t('details.submittedAt')} icon={<Calendar className="w-4 h-4" />}>
              {reportData.submitted_at ? new Date(reportData.submitted_at).toLocaleString(dateLocale) : t('na')}
            </DetailField>
            <DetailField label={t('details.fullName')} icon={<User className="w-4 h-4" />}>
              {reportData.full_name || t('na')}
            </DetailField>
            <DetailField label={t('details.requestType')} icon={<FileCheck className="w-4 h-4" />}>
              {reportData.request_type || t('na')}
            </DetailField>
            <DetailField label={t('details.incidentDate')} icon={<Calendar className="w-4 h-4" />}>
              {reportData.incident_date ? new Date(reportData.incident_date).toLocaleDateString(dateLocale) : t('na')}
            </DetailField>
            <DetailField label={t('details.incidentTime')} icon={<Clock className="w-4 h-4" />}>
              {reportData.incident_time || t('na')}
            </DetailField>
            <DetailField label={t('details.incidentLocation')} icon={<MapPin className="w-4 h-4" />}>
              {reportData.incident_location || t('na')}
            </DetailField>
            <DetailField label={t('details.requestDetails')} icon={<FileText className="w-4 h-4" />}>
              {reportData.request_details || t('na')}
            </DetailField>

            {reportData.public_notes && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[var(--foreground)]">{t('details.officerNote')}</Label>
                <div className="text-sm bg-[var(--muted)] border border-[var(--border)] rounded-lg p-3">{reportData.public_notes}</div>
              </div>
            )}

            {reportData.rejection_reason && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-[var(--destructive)]">{t('details.rejectionReason')}</Label>
                <div className="text-sm bg-[var(--destructive)]/8 border border-[var(--destructive)]/20 rounded-lg p-3 text-[var(--destructive)]">
                  {reportData.rejection_reason}
                </div>
              </div>
            )}

            {reportData.pdf_url && (
              <div className="pt-2 border-t border-[var(--border)]">
                <Label className="text-sm font-medium text-[var(--foreground)] mb-2 block">{t('pdf.title')}</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="h-8 border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white text-sm"
                    onClick={() => openInNewTab(reportData.pdf_url!)}
                    aria-label={t('pdf.open')}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    <span className="truncate">{t('pdf.open')}</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white text-sm"
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
                    aria-label={t('pdf.download')}
                  >
                    <Download className="w-3 h-3 mr-1" />
                    <span className="truncate">{t('pdf.download')}</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </details>
      </div>

      {/* ======== DESKTOP ======== */}
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-16 hidden lg:block">
        {/* Reports List (desktop) */}
        {allUserReports.length > 1 && (
          <Card className="mb-6 bg-[var(--card)] border border-[var(--border)] rounded-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-[var(--foreground)] flex items-center gap-2">
                <FileCheck className="w-4 h-4" />
                {t('reports.all', {count: allUserReports.length})}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {currentReports.map((report) => {
                  if (!report?.report_id) return null
                  return (
                    <button
                      key={report.report_id}
                      type="button"
                      className={`w-full text-left p-3 rounded border cursor-pointer ${
                        report.report_id === parseInt(reportId || '0', 10)
                          ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                          : 'border-[var(--border)] hover:border-[var(--primary)]/50'
                      }`}
                      onClick={() => setSelectedReportId(report.report_id)}
                    >
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs px-2 py-0.5 ${getStatusBadgeColor(report.status || 'รอดำเนินการ')}`}>
                            {getLocalizedStatusText(report.status || 'รอดำเนินการ')}
                          </Badge>
                        </div>
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {report.submitted_at ? new Date(report.submitted_at).toLocaleDateString(dateLocale) : t('na')}
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-[var(--foreground)]">
                          <Calendar className="w-3 h-3 text-[var(--muted-foreground)]" />
                          {report.incident_date ? new Date(report.incident_date).toLocaleDateString(dateLocale) : t('na')}
                        </div>
                        <div className="flex items-start gap-2 text-sm text-[var(--muted-foreground)]">
                          <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="line-clamp-2">{report.incident_location || t('na')}</span>
                        </div>
                      </div>
                    </button>
                  )
                }).filter(Boolean)}
              </div>
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                tns={t}
              />
            </CardContent>
          </Card>
        )}

        {/* Top bar */}
        <div className="mb-6">
          <Link href="/request-onsite/status">
            <Button
              variant="outline"
              className="h-8 px-3 border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] text-sm"
            >
              <ArrowLeft className="w-3 h-3 mr-1" />
              {t('back')}
            </Button>
          </Link>
        </div>

        {/* Layout */}
        <div className="grid grid-cols-12 gap-8">
          {/* Media */}
          <section className="col-span-8 space-y-6">
            <Card className="border rounded-lg bg-[var(--card)]">
              <CardHeader className="px-4 border-b border-[var(--border)]">
                <div className="flex items-center gap-3">
                  <CardTitle className="flex items-center gap-2 text-lg text-[var(--primary)] font-medium">
                    <ImageIcon className="h-4 w-4 text-[var(--primary)]" />
                    {t('media.title')}
                  </CardTitle>

                  <div className="ml-auto flex items-center gap-2">
                    <TabButton active={mediaTab === 'all'} onClick={() => setMediaTab('all')}>
                      {t('tabs.all', {total: totalImages + totalVideos})}
                    </TabButton>
                    <TabButton active={mediaTab === 'images'} onClick={() => setMediaTab('images')}>
                      {t('tabs.images', {count: totalImages})}
                    </TabButton>
                    <TabButton active={mediaTab === 'videos'} onClick={() => setMediaTab('videos')}>
                      {t('tabs.videos', {count: totalVideos})}
                    </TabButton>
                  </div>
                </div>
                {isIOS() && totalVideos > 0 && (
                  <p className="text-xs text-[var(--muted-foreground)] mt-1">{t('ios.saveHintLong')}</p>
                )}
              </CardHeader>

              <CardContent className="px-4 py-4">
                {mediaEmpty ? (
                  <EmptyMedia tns={t} />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {reportData.images && (mediaTab === 'all' || mediaTab === 'images') &&
                      reportData.images.map((img) => {
                        const url = mediaUrlFromPath(img.file_path, img.file_name)
                        const filename = img.file_name || (img.file_path.split('/').pop() || 'image.jpg')
                        return (
                          <div key={`d-img-${img.image_id}`} className="space-y-2">
                            <div className="aspect-video relative rounded border border-[var(--border)] bg-gray-50 overflow-hidden">
                              <Image
                                src={url}
                                alt={img.description || img.file_name || t('img.alt')}
                                fill
                                className="object-cover"
                                sizes="(max-width: 1024px) 50vw, 50vw"
                              />
                            </div>

                            <div className="flex gap-2">
                              <Button
                                className="flex-1 h-8 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] text-sm"
                                onClick={() => fetchBlobThenShareImage(url, filename)}
                              >
                                <Download className="w-3 h-3 mr-1" />
                                <span className="truncate">{t('btn.download')}</span>
                              </Button>
                              <Button
                                variant="outline"
                                className="flex-1 h-8 border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] text-sm"
                                onClick={() => openInNewTab(url)}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                <span className="truncate">{t('btn.open')}</span>
                              </Button>
                            </div>
                          </div>
                        )
                      })}

                    {reportData.videos && (mediaTab === 'all' || mediaTab === 'videos') &&
                      reportData.videos.map((v) => {
                        const url = mediaUrlFromPath(v.file_path, v.file_name)
                        const filename = (v.file_name && v.file_name.endsWith('.mp4')) ? v.file_name : `${v.file_name || v.video_id}.mp4`
                        const duration =
                          typeof v.duration_seconds === 'number'
                            ? `${Math.floor(v.duration_seconds / 60)}:${(v.duration_seconds % 60).toString().padStart(2, '0')}`
                            : null

                        return (
                          <div key={`d-vid-${v.video_id}`} className="space-y-2">
                            <div className="relative rounded border border-[var(--border)] bg-black overflow-hidden">
                              <SimpleVideoPlayer src={url} />
                              {duration && (
                                <div className="absolute bottom-2 right-2 rounded px-2 py-0.5 text-xs bg-black/70 text-white">
                                  {duration}
                                </div>
                              )}
                            </div>

                            <div className="flex gap-2">
                              <Button
                                className="flex-1 h-8 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)] text-sm"
                                onClick={() => fetchBlobThenDownload(url, filename)}
                              >
                                <Download className="w-3 h-3 mr-1" />
                                <span className="truncate">{t('btn.download')}</span>
                              </Button>
                              <Button
                                variant="outline"
                                className="flex-1 h-8 border border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)] text-sm"
                                onClick={() => openInNewTab(url)}
                              >
                                <ExternalLink className="w-3 h-3 mr-1" />
                                <span className="truncate">{t('btn.open')}</span>
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Details */}
          <aside className="col-span-4 space-y-6">
            <Card className="border rounded-lg bg-white sticky top-24">
              <CardHeader className="pb-3 px-4 bg-white border-b border-gray-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text.base font-medium text-gray-900">{t('details.title')}</CardTitle>
                    <CardDescription className="text-gray-600 text-xs">
                      {t('submittedAtPrefix', {date: reportData.submitted_at ? new Date(reportData.submitted_at).toLocaleString(dateLocale) : t('na')})}
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={`text-xs px-2 py-0.5 ${getStatusBadgeColor(reportData.status)}`}>{getLocalizedStatusText(reportData.status)}</Badge>
                    {reportData.status === 'เอกสารอนุมัติเรียบร้อย' && reportData.approved_at && (
                      <span className="text-xs text-[var(--muted-foreground)]">
                        {t('approvedAt', {date: new Date(reportData.approved_at).toLocaleString(dateLocale)})}
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 py-4 space-y-3">
                <DetailField label={t('details.fullName')} icon={<User className="w-4 h-4" />}>
                  {reportData.full_name || t('na')}
                </DetailField>
                <DetailField label={t('details.requestType')} icon={<FileCheck className="w-4 h-4" />}>
                  {reportData.request_type || t('na')}
                </DetailField>
                <DetailField label={t('details.incidentDate')} icon={<Calendar className="w-4 h-4" />}>
                  {reportData.incident_date ? new Date(reportData.incident_date).toLocaleDateString(dateLocale) : t('na')}
                </DetailField>
                <DetailField label={t('details.incidentTime')} icon={<Clock className="w-4 h-4" />}>
                  {reportData.incident_time || t('na')}
                </DetailField>
                <DetailField label={t('details.incidentLocation')} icon={<MapPin className="w-4 h-4" />}>
                  {reportData.incident_location || t('na')}
                </DetailField>
                <DetailField label={t('details.requestDetails')} icon={<FileText className="w-4 h-4" />}>
                  {reportData.request_details || t('na')}
                </DetailField>

                {reportData.public_notes && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-[var(--foreground)]">{t('details.officerNote')}</Label>
                    <div className="text-sm bg-[var(--muted)] border border-[var(--border)] rounded-lg p-3">{reportData.public_notes}</div>
                  </div>
                )}

                {reportData.rejection_reason && (
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium text-[var(--destructive)]">{t('details.rejectionReason')}</Label>
                    <div className="text-sm bg-[var(--destructive)]/8 border border-[var(--destructive)]/20 rounded-lg p-3 text-[var(--destructive)]">{reportData.rejection_reason}</div>
                  </div>
                )}

                {reportData.pdf_url && (
                  <div className="pt-2 border-t border-[var(--border)]">
                    <Label className="text-sm font-medium text-[var(--foreground)] mb-2 block">{t('pdf.title')}</Label>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1 h-8 border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white text-sm"
                        onClick={() => {
                          if (reportData.pdf_url) openInNewTab(reportData.pdf_url)
                        }}
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        {t('pdf.open')}
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 h-8 border border-[var(--primary)] text-[var(--primary)] hover:bg-[var(--primary)] hover:text-white text-sm"
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
                        <Download className="w-3 h-3 mr-1" />
                        {t('pdf.download')}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </aside>
        </div>
      </div>

      {/* External Browser Modal */}
      {showExternalBrowserModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-lg shadow-xl max-w-md w.full mx-4">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-[var(--primary)]/10 rounded-full flex items-center justify-center mr-4">
                  <svg className="w-6 h-6 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9v-9m0-9v9" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{t('external.title')}</h3>
              </div>

              <p className="text-gray-600 mb-4">{t('external.desc')}</p>

              <div className="mb-4">
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border">
                  <code className="flex-1 text-xs text-gray-800 break-all">
                    {(() => {
                      const url = new URL(window.location.href)
                      url.searchParams.delete('external')
                      return url.toString()
                    })()}
                  </code>
                </div>
              </div>

              <div className="flex gap-3">
                <Button onClick={copyUrlToClipboard} className="flex-1 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-white">
                  📋 {t('external.copy')}
                </Button>
                <Button onClick={() => setShowExternalBrowserModal(false)} variant="outline" className="flex-1">
                  {t('external.close')}
                </Button>
              </div>

              <div className="mt-4 p-3 bg-[var(--primary)]/5 rounded-lg border border-[var(--primary)]/20">
                <p className="text-xs text-[var(--primary)]">{t('external.howto')}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- Pagination Controls ---------- */
function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  tns
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
        className="px-3 py-1 h-8 border-[var(--border)] text-xs"
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
                ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                : 'border-[var(--border)] hover:bg-[var(--accent)]'
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
        className="px-3 py-1 h-8 border-[var(--border)] text-xs"
      >
        {tns('pager.next')}
      </Button>
    </div>
  )
}

/* ---------- Small UI parts ---------- */
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 rounded border text-[11px] whitespace-nowrap font.medium
        focus:outline.none focus:ring-1 focus:ring-[var(--primary)]
        ${active ? 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/20' : 'border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--muted)]'}
      `}
      aria-pressed={active}
    >
      {children}
    </button>
  )
}

function EmptyMedia({ tns }: { tns: ReturnType<typeof useTranslations> }) {
  return (
    <div className="text-center py-8 col-span-full">
      <div className="w-12 h-12 bg-[var(--muted)] rounded border border-[var(--border)] flex items-center justify-center mx-auto mb-3">
        <AlertCircle className="h-6 w-6 text-[var(--muted-foreground)]" />
      </div>
      <h3 className="text-base font-medium text-[var(--foreground)] mb-1">{tns('media.emptyTitle')}</h3>
      <p className="text-xs text-[var(--muted-foreground)] max-w-md mx-auto">
        {tns('media.emptyDesc')}
      </p>
    </div>
  )
}

function DetailField({ label, children, icon }: { label: string; children: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-4 h-4 text-[var(--primary)] mt-0.5 flex-shrink-0">
        {icon}
      </div>
      <div className="flex-1 space-y-0.5">
        <Label className="text-xs font-medium text-[var(--foreground)]">{label}</Label>
        <p className="text-xs text-[var(--foreground)]">{children}</p>
      </div>
    </div>
  )
}

/* =================== Page with Suspense =================== */
function FallbackLoader() {
  const t = useTranslations('StatusResult')
  return (
    <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
        <p className="text-[var(--muted-foreground)]">{t('loadingGeneric')}</p>
      </div>
    </div>
  )
}

export default function StatusResultPage() {
  return (
    <Suspense fallback={<FallbackLoader />}>
      <StatusResultContent />
    </Suspense>
  )
}

const Label = ({
  children,
  className = '',
  ...props
}: { children: React.ReactNode; className?: string } & React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={`text-sm font-medium text-[var(--foreground)] ${className}`} {...props}>
    {children}
  </label>
)
