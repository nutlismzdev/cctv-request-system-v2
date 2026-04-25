// src/app/admin/request/[id]/edit/page.tsx
'use client'

import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react'

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
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { isAuthenticated } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft, Save, FileText, RefreshCw, Upload, Trash2, Paperclip, User, Shield, Image as ImageIcon, CheckCircle2, XCircle, HardDrive, MapPin
} from 'lucide-react'
import { ServerFileBrowser } from '@/components/server-file-browser'
import { LocationPicker } from '@/components/location-picker'
import { getStatusStyle, THEME_COLORS } from '@/lib/theme-colors'
import { useUpload } from '@/lib/use-upload'
import { MediaPlaceholder } from '@/components/media-placeholder'
import { humanSize, debounce } from '@/lib/upload-utils'
import Image from 'next/image'

/* ======================= Types ======================= */
interface UploadResponse {
  success: boolean
  data?: unknown[]
  message?: string
}

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
  house_number?: string
  village_number?: string
  alley?: string
  road?: string
  sub_district?: string
  district?: string
  province?: string
  postal_code?: string

  // รายการร้องขอ/เหตุการณ์
  category_id?: number | null
  request_type: string
  request_details?: string | null
  incident_date?: string | null
  incident_time?: string | null
  incident_location?: string | null

  // การเกี่ยวข้องกับเหตุการณ์
  involvement_role?: string | null
  involvement_explain?: string | null

  // เอกสารหลักฐานประกอบ
  supporting_documents?: string | null // JSON string

  // สถานะ
  status: string
  priority: string
  status_updated_at?: string | null

  // เจ้าหน้าที่
  assigned_officer_id?: number | null

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

  // Location coordinates
  latitude?: number | null
  longitude?: number | null
  location_verified_by?: number | null
  location_verified_at?: string | null
  location_verified_officer_name?: string | null
}

interface Officer {
  officer_id: number
  prefix?: string
  full_name: string
  position?: string
}

interface Category {
  category_id: number
  category_name: string
  // API ส่งข้อมูลเป็น id และ name แต่เราจะ map ให้ตรงกับ interface
}

type AttachmentCategory = 'idcopy' | 'operation' | 'เอกสารอื่นๆ' | string

interface Attachment {
  id: number
  file_name: string
  file_type: string
  file_size: number
  uploaded_at: string
  url: string
  category?: AttachmentCategory
}

interface Media {
  id: string // API ส่งเป็น string เช่น "image_123", "video_456"
  file_name: string
  file_type: string
  file_size?: number
  width?: number
  height?: number
  uploaded_at: string
  url: string
  media_type?: 'image' | 'video'
  published?: string // API ส่งเป็น string "true"/"false"
  approval_status?: string // API ส่ง approval_status จากฐานข้อมูล
}

/* ======================= Utils ======================= */
const THAI_MONTHS_SHORT = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.']
function formatThaiDateBE(input?: string | null) {
  if (!input) return ''
  const m = input.match?.(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) {
    const d = new Date(input)
    if (isNaN(d.getTime())) return input
    return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`
  }
  const y = parseInt(m[1], 10) + 543
  const mo = parseInt(m[2], 10) - 1
  const day = parseInt(m[3], 10)
  return `${day} ${THAI_MONTHS_SHORT[mo]} ${y}`
}

// Status tone using theme colors utility
const STATUS_TONE: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  'รอดำเนินการ': getStatusStyle('รอดำเนินการ'),
  'รอยื่นเอกสาร': getStatusStyle('รอยื่นเอกสาร'),
  'รอเอกสารอนุมัติ': getStatusStyle('รอเอกสารอนุมัติ'),
  'เอกสารอนุมัติเรียบร้อย': getStatusStyle('เอกสารอนุมัติเรียบร้อย'),
  'ปฏิเสธคำร้อง': getStatusStyle('ปฏิเสธคำร้อง'),
}

// humanSize is now imported from '@/lib/upload-utils'

/* ======================= Shared UI ======================= */
function SectionCard({
  title,
  icon,
  children,
  right,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
  right?: React.ReactNode
}) {
  return (
    <div className="border border-[var(--border)] rounded-lg bg-[var(--card)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)] rounded-t-lg">
        <div className="flex items-center gap-2 text-[var(--foreground)] font-semibold">
          {icon}
          <span className="tracking-tight">{title}</span>
        </div>
        {right}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}

const L = ({ children }: { children: React.ReactNode }) => (
  <Label className="text-[13px] font-medium text-[var(--muted-foreground)]">{children}</Label>
)

/* ======================= Page ======================= */
export default function EditRequestPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [report, setReport] = useState<Report | null>(null)
  const [officers, setOfficers] = useState<Officer[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [cctvMedia, setCctvMedia] = useState<Media[]>([])
  const [activeTab, setActiveTab] = useState<'applicant'|'officer'|'docs'|'photos'>('applicant')

  // Validation state
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const validationErrorsRef = useRef(validationErrors)

  // Keep ref updated with latest validationErrors
  useEffect(() => {
    validationErrorsRef.current = validationErrors
  }, [validationErrors])

  // Upload hooks
  const docsUpload = useUpload({
    endpoint: `/api/reports/${report?.report_id}/attachments`,
    withCompression: true,
    onSuccess: (data) => {
      const response = data as UploadResponse
      const added: Attachment[] = (response.data || []).map((x: unknown) => ({ ...x as Attachment, category: (x as Attachment).category ?? 'เอกสารอื่นๆ' }))
      setAttachments(prev => [...added, ...prev])
    }
  })

  // Wrapper functions for different upload types
  const uploadDocsWithCategory = (kind: AttachmentCategory) => (files: FileList) => {
    if (!report || !files || !files.length) return
    docsUpload.upload(files, false, { category: kind })
  }

  const cctvUpload = useUpload({
    endpoint: `/api/reports/${report?.report_id}/photos`,
    withCompression: true,
    onSuccess: (data) => {
      const response = data as UploadResponse
      const added: Media[] = (response.data || []).map((x: unknown) => ({ ...x as Media, published: 'false', approval_status: 'รอตรวจสอบ' }))
      setCctvMedia(prev => [...added, ...prev])
    }
  })

// uploadProgress is now handled by cctvUpload.progress

  // Fullscreen modal state
  const [fullscreenMedia, setFullscreenMedia] = useState<Media | null>(null)
  
  // Server file browser state
  const [serverFileBrowserOpen, setServerFileBrowserOpen] = useState(false)
  const [serverFileCategory, setServerFileCategory] = useState<'idcopy' | 'operation'>('idcopy')

  /* -------- check authentication -------- */
  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/login')
      return
    }
  }, [router])

  /* -------- load initial -------- */
  useEffect(() => {
    let cancelled = false
    async function loadAll() {
      try {
        setLoading(true)
        const [rRes, oRes, cRes, aRes, pRes] = await Promise.all([
          fetch(`/api/reports/${id}`),
          fetch('/api/officers'),
          fetch('/api/categories'),
          fetch(`/api/reports/${id}/attachments`),
          fetch(`/api/reports/${id}/photos`),
        ])

        const r = await rRes.json()
        const o = await oRes.json().catch(() => ({ data: [] }))
        const c = await cRes.json().catch(() => ({ data: [] }))
        const a = await aRes.json().catch(() => ({ data: [] }))
        const p = await pRes.json().catch(() => ({ data: [] }))

        if (cancelled) return
        if (!r.success) {
          toast.error(r.message || 'ไม่พบข้อมูลคำร้อง')
          router.push('/admin/request')
          return
        }


        // Convert latitude/longitude from string (MySQL DECIMAL) to number
        const reportData = r.data as Report
        if (reportData.latitude !== null && reportData.latitude !== undefined) {
          reportData.latitude = Number(reportData.latitude)
        }
        if (reportData.longitude !== null && reportData.longitude !== undefined) {
          reportData.longitude = Number(reportData.longitude)
        }
        setReport(reportData)
        setOfficers(o.data || [])
        // Map categories จาก API (id, name) ให้ตรงกับ interface (category_id, category_name)
        setCategories((c.data || []).map((cat: { id: string; name: string }) => ({
          category_id: cat.id,
          category_name: cat.name
        })))
        setAttachments((a.data || []).map((x: Attachment) => x))
        setCctvMedia((p.data || []).map((m: Media) => m))
      } catch (e) {
        console.error(e)
        toast.error('โหลดข้อมูลไม่สำเร็จ')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadAll()
    return () => { cancelled = true }
  }, [id, router])

  /* -------- form control -------- */
  const [form, setForm] = useState<Partial<Report>>({})
  const update = useCallback((patch: Partial<Report>) => setForm(prev => ({ ...prev, ...patch })), [])

  // Debounced update for long text inputs
  const debouncedUpdate = useCallback((patch: Partial<Report>) => {
    debounce(() => update(patch), 300)()
  }, [update])

  // Validation function - stable to avoid infinite loops
  const validateField = useMemo(() => {
    return (
      fieldName: 'officer_decision' | 'internal_notes',
      value: string | null | undefined,
      additionalData?: { officer_decision?: string | null; internal_notes?: string | null }
    ) => {
      const errors = { ...validationErrorsRef.current }

      if (fieldName === 'officer_decision') {
        if (value === 'ไม่อนุญาต') {
          // ถ้าเลือก "ไม่อนุญาต" แต่ไม่ได้กรอก internal_notes
          if (!additionalData?.internal_notes || additionalData.internal_notes.trim() === '') {
            errors.internal_notes = 'กรุณาระบุรายละเอียดการปฏิบัติเมื่อเลือก "ไม่อนุญาต"'
          } else {
            delete errors.internal_notes
          }
        } else {
          // ถ้าไม่ใช่ "ไม่อนุญาต" ให้ล้าง error ของ internal_notes
          delete errors.internal_notes
        }
      }

      if (fieldName === 'internal_notes') {
        if (additionalData?.officer_decision === 'ไม่อนุญาต' && (!value || value.trim() === '')) {
          errors.internal_notes = 'กรุณาระบุรายละเอียดการปฏิบัติเมื่อเลือก "ไม่อนุญาต"'
        } else {
          delete errors.internal_notes
        }
      }

      setValidationErrors(errors)
      return Object.keys(errors).length === 0
    }
  }, []) // Empty dependency array - function is stable

  // Set form data when report loads
  useEffect(() => {
    if (report) {
      setForm(report)
      // Validate initial data to show any existing validation errors
      validateField('officer_decision', report.officer_decision, report)
      validateField('internal_notes', report.internal_notes, report)
    }
  }, [report, validateField]) // Include validateField to satisfy exhaustive-deps rule

  /* -------- save -------- */
  const saveAll = async () => {
    if (!report) return

    // Validate before saving
    const isValid = validateField('officer_decision', form.officer_decision, form) &&
                    validateField('internal_notes', form.internal_notes, form)

    if (!isValid) {
      toast.error('กรุณากรอกข้อมูลให้ครบถ้วน')
      return
    }

    try {
      setSaving(true)

      const payload = {
        ...form,
      }

      const res = await fetch(`/api/reports/${report.report_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()

      if (data.success) {
        toast.success('บันทึกข้อมูลเรียบร้อย')
        const updatedData = { ...data.data }
        // Convert latitude/longitude from string to number
        if (updatedData.latitude !== null && updatedData.latitude !== undefined) {
          updatedData.latitude = Number(updatedData.latitude)
        }
        if (updatedData.longitude !== null && updatedData.longitude !== undefined) {
          updatedData.longitude = Number(updatedData.longitude)
        }
        setReport(updatedData as Report)
        setForm(prevForm => ({ ...prevForm, ...updatedData }))
        // Clear validation errors after successful save
        setValidationErrors({})
      } else {
        toast.error(data.message || 'บันทึกไม่สำเร็จ')
      }
    } catch (e) {
      console.error(e)
      toast.error('เกิดข้อผิดพลาดระหว่างบันทึก')
    } finally {
      setSaving(false)
    }
  }

// onUploadDocs is now handled by uploadDocsWithCategory wrapper
  const deleteAttachment = async (attId: string | number) => {
    if (!report) return
    if (!confirm('ต้องการลบเอกสารนี้หรือไม่')) return
    try {
      const attachmentId = String(attId) // แปลงเป็น string เสมอ
      const res = await fetch(`/api/reports/${report.report_id}/attachments?attachmentId=${attachmentId}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setAttachments(prev => prev.filter(x => String(x.id) !== attachmentId))
        toast.success('ลบเอกสารแล้ว')
      } else toast.error(data.message || 'ลบไม่สำเร็จ')
    } catch (e) {
      console.error(e)
      toast.error('ลบไม่สำเร็จ')
    }
  }

// compressImage and validateFiles are now handled by useUpload hook from '@/lib/use-upload'
  const deleteCctvMedia = async (mediaId: string, retryCount: number = 0) => {
    if (!report) return
    if (!confirm('ต้องการลบไฟล์นี้หรือไม่ ลบแล้วจะไม่สามารถกู้คืนได้')) return

    const MAX_RETRIES = 2
    const RETRY_DELAY = 1000 // 1 second

    try {
      // แสดง loading state
      const mediaItem = cctvMedia.find(m => m.id === mediaId)
      if (!mediaItem) {
        toast.error('ไม่พบไฟล์ที่ต้องการลบ')
        return
      }

      // แสดงข้อความกำลังลบ พร้อม retry count ถ้ามี
      const retryText = retryCount > 0 ? ` (ลองใหม่ ${retryCount}/${MAX_RETRIES})` : ''
      const toastId = toast.loading(`กำลังลบไฟล์ ${mediaItem.file_name}...${retryText}`)

      // สร้าง AbortController สำหรับ timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 seconds timeout

      try {
        // เรียก API ลบไฟล์
        const res = await fetch(`/api/reports/${report.report_id}/photos?mediaId=${mediaId}`, {
          method: 'DELETE',
          headers: {
            'Cache-Control': 'no-cache',
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`)
        }

        const data = await res.json()

        if (data.success) {
          // อัปเดต state โดยลบรายการออกจาก array
          setCctvMedia(prev => prev.filter(x => String(x.id) !== String(mediaId)))

          // ปิด toast loading และแสดง success
          toast.dismiss(toastId)
          toast.success(`ลบไฟล์ ${mediaItem.file_name} เรียบร้อยแล้ว`)

          console.log(`File deleted successfully: ${mediaItem.file_name} (${mediaItem.id})`)
        } else {
          throw new Error(data.message || 'ลบไฟล์ไม่สำเร็จ')
        }
      } catch (fetchError) {
        clearTimeout(timeoutId)

        // จัดการกรณี timeout หรือ network error
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          if (retryCount < MAX_RETRIES) {
            toast.dismiss(toastId)
            console.warn(`Delete timeout, retrying... (${retryCount + 1}/${MAX_RETRIES})`)
            setTimeout(() => deleteCctvMedia(mediaId, retryCount + 1), RETRY_DELAY)
            return
          } else {
            throw new Error('การเชื่อมต่อใช้เวลานานเกินไป')
          }
        }

        // จัดการ network errors หรือ server errors
        if (fetchError instanceof Error &&
            (fetchError.message.includes('fetch') || fetchError.message.includes('network'))) {
          if (retryCount < MAX_RETRIES) {
            toast.dismiss(toastId)
            console.warn(`Network error, retrying... (${retryCount + 1}/${MAX_RETRIES})`)
            setTimeout(() => deleteCctvMedia(mediaId, retryCount + 1), RETRY_DELAY)
            return
          }
        }

        throw fetchError
      }
    } catch (e) {
      console.error('Error deleting CCTV media:', e)

      // จัดการ error types ต่างๆ
      let errorMessage = 'เกิดข้อผิดพลาดในการลบไฟล์'

      if (e instanceof Error) {
        if (e.message.includes('timeout') || e.message.includes('AbortError')) {
          errorMessage = 'การลบไฟล์ใช้เวลานานเกินไป กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'
        } else if (e.message.includes('network') || e.message.includes('fetch')) {
          errorMessage = 'เกิดปัญหาการเชื่อมต่อเครือข่าย กรุณาลองใหม่อีกครั้ง'
        } else if (e.message.includes('HTTP')) {
          errorMessage = 'เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง'
        } else {
          errorMessage = e.message
        }

        // Log detailed error for debugging
        console.error('Delete error details:', {
          message: e.message,
          stack: e.stack,
          mediaId: mediaId,
          reportId: report.report_id,
          retryCount: retryCount,
          maxRetries: MAX_RETRIES
        })
      }

      toast.error(errorMessage)
    }
  }
  const toggleCctvPublish = async (mediaId: string, next: boolean) => {
    if (!report) return
    try {
      const res = await fetch(`/api/reports/${report.report_id}/photos?mediaId=${mediaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: next }),
      })
      const data = await res.json()
      if (data.success) {
        setCctvMedia(prev => prev.map(m => m.id === mediaId ? { ...m, published: String(next), approval_status: next ? 'พร้อมใช้งาน' : 'ไม่พร้อมใช้งาน' } : m))
        toast.success(next ? 'ตั้งค่าเป็นพร้อมใช้งาน' : 'ตั้งค่าเป็นไม่พร้อมใช้งาน')
      } else toast.error(data.message || 'เปลี่ยนสถานะไม่สำเร็จ')
    } catch (e) {
      console.error(e)
      toast.error('เปลี่ยนสถานะไม่สำเร็จ')
    }
  }

  /* ======================= Render ======================= */
  if (loading || !report) {
    return (
      <div className="min-h-screen bg-white">
        <div className="border-b bg-white/90">
          <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 flex items-center gap-2">
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-24" />
            <div className="ml-auto flex gap-2">
              <Skeleton className="h-10 w-28" />
              <Skeleton className="h-10 w-28" />
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-6 space-y-3">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  const tone = STATUS_TONE[report.status] || STATUS_TONE['รอดำเนินการ']

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* ===== Top Toolbar ===== */}
      <div className="w-full border-b border-[var(--border)] bg-[var(--card)]/95 backdrop-blur supports-[backdrop-filter]:bg-[var(--card)]/80">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 flex flex-wrap items-center gap-2">
          <Button variant="outline" className="h-10" onClick={() => router.push('/admin/request')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            กลับรายการ
          </Button>

          <div className="text-[var(--foreground)] text-sm md:text-base ml-1 md:ml-2">
            <span className="font-semibold">แก้ไขคำร้อง</span> • #{report.report_id} — {`${getLocalizedPrefix(report.prefix ?? '', report.language)} ${report.full_name ?? ''}`.trim() || '-'}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              className="h-10"
              onClick={() => router.push(`/api/reports/${report.report_id}/pdf?mode=draw`)}
            >
              <FileText className="h-4 w-4 mr-2" />
              ดู PDF
            </Button>
            <Button onClick={saveAll} disabled={saving} className="h-10 bg-[var(--primary)] hover:bg-[var(--primary)]/90 text-[var(--primary-foreground)]">
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              บันทึกทั้งหมด
            </Button>
          </div>
        </div>
      </div>

      {/* ===== Summary Strip ===== */}
      <div className="border-b border-[var(--border)] bg-[var(--card)]">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--muted)]">
              <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
              <span className="text-[var(--foreground)]">สถานะ:</span>
              <span className={`${tone.text}`}>{report.status === 'เอกสารอนุมัติเรียบร้อย' ? 'อนุมัติแล้ว' : report.status}</span>
            </div>
            <div className="px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--muted)]">
              ยื่นคำร้องเมื่อ <span className="font-medium text-[var(--foreground)]">{formatThaiDateBE(report.submitted_at)}</span>
            </div>
            {report.updated_at && (
              <div className="px-2 py-1 rounded-md border border-[var(--border)] bg-[var(--muted)]">
                อัปเดตล่าสุด <span className="font-medium text-[var(--foreground)]">{formatThaiDateBE(report.updated_at)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ===== Tabs: สไตล์เรียบ ทันสมัย เหมาะงานราชการ ===== */}
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'applicant'|'officer'|'docs'|'photos')} className="w-full">
          <div className="px-1">
            {/* Mobile: Horizontal Scrollable Tabs */}
            <div className="md:hidden overflow-x-auto scrollbar-hide smooth-scroll">
              <TabsList className="inline-flex min-w-max gap-1 bg-transparent p-0 border-b border-[var(--border)] px-1">
                <TabsTrigger
                  value="applicant"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] px-3 py-2 font-medium text-[var(--muted-foreground)] whitespace-nowrap"
                >
                  <User className="h-4 w-4 mr-2" /> ข้อมูลผู้ยื่น
                </TabsTrigger>
                <TabsTrigger
                  value="officer"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] px-3 py-2 font-medium text-[var(--muted-foreground)] whitespace-nowrap"
                >
                  <Shield className="h-4 w-4 mr-2" /> เจ้าหน้าที่ดำเนินการ
                </TabsTrigger>
                <TabsTrigger
                  value="docs"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] px-3 py-2 font-medium text-[var(--muted-foreground)] whitespace-nowrap"
                >
                  <Paperclip className="h-4 w-4 mr-2" /> แนบเอกสาร
                </TabsTrigger>
                <TabsTrigger
                  value="photos"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] px-3 py-2 font-medium text-[var(--muted-foreground)] whitespace-nowrap"
                >
                  <ImageIcon className="h-4 w-4 mr-2" /> อัปโหลดภาพจาก CCTV
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Desktop: Normal Tabs */}
            <div className="hidden md:block">
              <TabsList className="w-full justify-start gap-1 bg-transparent p-0 border-b border-[var(--border)]">
                <TabsTrigger
                  value="applicant"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] px-3 py-2 font-medium text-[var(--muted-foreground)]"
                >
                  <User className="h-4 w-4 mr-2" /> ข้อมูลผู้ยื่น
                </TabsTrigger>
                <TabsTrigger
                  value="officer"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] px-3 py-2 font-medium text-[var(--muted-foreground)]"
                >
                  <Shield className="h-4 w-4 mr-2" /> เจ้าหน้าที่ดำเนินการ
                </TabsTrigger>
                <TabsTrigger
                  value="docs"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] px-3 py-2 font-medium text-[var(--muted-foreground)]"
                >
                  <Paperclip className="h-4 w-4 mr-2" /> แนบเอกสาร
                </TabsTrigger>
                <TabsTrigger
                  value="photos"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-[var(--primary)] data-[state=active]:text-[var(--primary)] px-3 py-2 font-medium text-[var(--muted-foreground)]"
                >
                  <ImageIcon className="h-4 w-4 mr-2" /> อัปโหลดภาพจาก CCTV
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          <div className="mt-4 space-y-4">
            {/* ========== TAB 1: Applicant ========== */}
            <TabsContent value="applicant" className="space-y-4">
              <SectionCard title="ข้อมูลส่วนบุคคล" icon={<User className="h-4 w-4" />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <L>คำนำหน้า</L>
                    <Input className="h-11" value={form.prefix || ''} onChange={(e) => update({ prefix: e.target.value })} />
                    {report.language === 'en' && (
                      <div className="text-sm text-muted-foreground mt-1">
                        แสดงเป็น: {getLocalizedPrefix(form.prefix || '', report.language)}
                      </div>
                    )}
                  </div>
                  <div>
                    <L>ชื่อ-นามสกุล</L>
                    <Input className="h-11" value={form.full_name || ''} onChange={(e) => update({ full_name: e.target.value })} />
                  </div>
                  <div>
                    <L>อายุ</L>
                    <Input
                      className="h-11"
                      type="number"
                      value={form.age || ''}
                      onChange={(e) => update({ age: e.target.value ? parseInt(e.target.value) : null })}
                      placeholder="ปี"
                    />
                  </div>
                  <div>
                    <L>เลขบัตรประชาชน / Passport</L>
                    <Input className="h-11" value={form.id_or_passport_number || ''} onChange={(e) => update({ id_or_passport_number: e.target.value })} />
                  </div>
                  <div>
                    <L>เบอร์ติดต่อ</L>
                    <Input className="h-11" value={form.phone_number || ''} onChange={(e) => update({ phone_number: e.target.value })} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="ที่อยู่ตามติดต่อ">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <L>บ้านเลขที่</L>
                    <Input className="h-11" value={form.house_number || ''} onChange={(e) => update({ house_number: e.target.value })} />
                  </div>
                  <div>
                    <L>หมู่ที่</L>
                    <Input className="h-11" value={form.village_number || ''} onChange={(e) => update({ village_number: e.target.value })} />
                  </div>
                  <div>
                    <L>ตรอก/ซอย</L>
                    <Input className="h-11" value={form.alley || ''} onChange={(e) => update({ alley: e.target.value })} />
                  </div>
                  <div>
                    <L>ถนน</L>
                    <Input className="h-11" value={form.road || ''} onChange={(e) => update({ road: e.target.value })} />
                  </div>
                  <div>
                    <L>ตำบล/แขวง</L>
                    <Input className="h-11" value={form.sub_district || ''} onChange={(e) => update({ sub_district: e.target.value })} />
                  </div>
                  <div>
                    <L>อำเภอ/เขต</L>
                    <Input className="h-11" value={form.district || ''} onChange={(e) => update({ district: e.target.value })} />
                  </div>
                  <div>
                    <L>จังหวัด</L>
                    <Input className="h-11" value={form.province || ''} onChange={(e) => update({ province: e.target.value })} />
                  </div>
                  <div>
                    <L>รหัสไปรษณีย์</L>
                    <Input className="h-11" value={form.postal_code || ''} onChange={(e) => update({ postal_code: e.target.value })} />
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="รายละเอียดคำร้อง / เหตุการณ์">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <L>หมวดหมู่</L>
                    <Select
                      value={String(form.category_id || '')}
                      onValueChange={(v) => update({ category_id: Number(v) })}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="เลือกหมวดหมู่" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.length === 0 ? (
                          <SelectItem value="" disabled>
                            ไม่พบข้อมูลหมวดหมู่
                          </SelectItem>
                        ) : (
                          categories.map((c, index) => (
                            <SelectItem key={`category-${c.category_id}-${index}`} value={String(c.category_id)}>
                              {c.category_name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <L>ประเภทคำร้อง</L>
                    <Input className="h-11" value={form.request_type || ''} onChange={(e) => update({ request_type: e.target.value })} />
                  </div>

                  {/* การเกี่ยวข้องกับเหตุการณ์ */}
                  <div className="md:col-span-2">
                    <L>สถานะการเกี่ยวข้อง</L>
                    <Select
                      value={form.involvement_role || ''}
                      onValueChange={(v) => update({ involvement_role: v })}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="เลือกสถานะการเกี่ยวข้อง" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ผู้เสียหาย">ผู้เสียหาย</SelectItem>
                        <SelectItem value="ญาติ">ญาติ</SelectItem>
                        <SelectItem value="ผู้เกี่ยวข้อง">ผู้เกี่ยวข้อง</SelectItem>
                        <SelectItem value="เจ้าหน้าที่รัฐ">เจ้าหน้าที่รัฐ</SelectItem>
                        <SelectItem value="ประกัน">ประกัน</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(form.involvement_role === 'ญาติ' || form.involvement_role === 'ผู้เกี่ยวข้อง') && (
                    <div className="md:col-span-2">
                      <L>ระบุความเกี่ยวข้อง</L>
                      <Input
                        className="h-11"
                        value={form.involvement_explain || ''}
                        onChange={(e) => update({ involvement_explain: e.target.value })}
                        placeholder="เช่น บิดา/มารดา/เพื่อนร่วมงาน/ผู้ดูแล ฯลฯ"
                      />
                    </div>
                  )}

                  <div>
                    <L>วันที่เกิดเหตุ</L>
                    <Input type="date" className="h-11" value={form.incident_date ?? ''} onChange={(e) => update({ incident_date: e.target.value })} />
                  </div>
                  <div>
                    <L>เวลาที่เกิดเหตุ</L>
                    <Input type="time" className="h-11" value={form.incident_time ?? ''} onChange={(e) => update({ incident_time: e.target.value })} />
                  </div>
                  <div className="md:col-span-2">
                    <L>สถานที่เกิดเหตุ</L>
                    <Input className="h-11" value={form.incident_location || ''} onChange={(e) => update({ incident_location: e.target.value })} />
                  </div>

                  <div className="md:col-span-4">
                    <L>รายละเอียดเพิ่มเติม</L>
                    <Textarea
                      className="min-h-[120px]"
                      value={form.request_details || ''}
                      onChange={(e) => debouncedUpdate({ request_details: e.target.value })}
                      placeholder="กรุณาระบุรายละเอียดเพิ่มเติมของเหตุการณ์..."
                    />
                  </div>

                  {/* เอกสารหลักฐานประกอบ - แสดงเป็น read-only */}
                  <div className="md:col-span-4">
                    <L>เอกสารหลักฐานประกอบ</L>
                    <div className="bg-gray-50 border rounded-md p-4 space-y-3">
                      {(() => {
                        try {
                          const docs = form.supporting_documents ? JSON.parse(form.supporting_documents) : null
                          if (!docs) {
                            return <div className="text-gray-500 text-sm">ไม่มีข้อมูลเอกสาร</div>
                          }
                          const docList = []
                          if (docs.id_card_copy) docList.push('สำเนาบัตรประจำตัวประชาชน/บัตรประจำตัวเจ้าหน้าที่ของรัฐ')
                          if (docs.police_report_copy) docList.push('สำเนาบันทึกการแจ้งความ')
                          if (docs.other) docList.push(`อื่นๆ: ${docs.other_details || 'ไม่ได้ระบุ'}`)

                          return docList.length > 0 ? (
                            <ul className="space-y-1">
                              {docList.map((doc, idx) => (
                                <li key={idx} className="flex items-center gap-2 text-sm">
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  {doc}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="text-gray-500 text-sm">ไม่ได้เลือกเอกสาร</div>
                          )
                        } catch {
                          return <div className="text-gray-500 text-sm">ข้อมูลเอกสารไม่ถูกต้อง</div>
                        }
                      })()}
                    </div>
                  </div>
                </div>
              </SectionCard>

              {/* ========== Section: Location Coordinates ========== */}
              <SectionCard title="พิกัดที่เกิดเหตุ" icon={<MapPin className="h-4 w-4" />}>
                <div className="space-y-4">
                  <div className="text-sm text-slate-600">
                    คลิกบนแผนที่เพื่อปักหมุดตำแหน่งที่เกิดเหตุ หรือใช้ปุ่ม &quot;ใช้ตำแหน่งปัจจุบัน&quot; เพื่อระบุพิกัดอัตโนมัติ
                  </div>
                  <LocationPicker
                    latitude={form.latitude}
                    longitude={form.longitude}
                    onLocationSelect={(lat, lng) => {
                      update({ latitude: lat, longitude: lng })
                    }}
                    height="350px"
                  />
                  {form.latitude && form.longitude && (
                    <div className="flex items-center justify-between bg-slate-50 p-3 rounded-md">
                      <div className="text-sm">
                        <span className="text-slate-500">พิกัดที่เลือก: </span>
                        <span className="font-mono font-medium">
                          {Number(form.latitude).toFixed(6)}, {Number(form.longitude).toFixed(6)}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          update({ latitude: null, longitude: null })
                        }}
                        className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        ล้างพิกัด
                      </Button>
                    </div>
                  )}
                </div>
              </SectionCard>
            </TabsContent>

            {/* ========== TAB 2: Officer (ตามที่ขอ) ========== */}
            <TabsContent value="officer">
              <SectionCard title="เจ้าหน้าที่ดำเนินการ" icon={<Shield className="h-4 w-4" />}>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <L>เลือกเจ้าหน้าที่ผู้รับผิดชอบ</L>
                    <Select
                      value={String(form.assigned_officer_id ?? '')}
                      onValueChange={(v) => update({ assigned_officer_id: Number(v) })}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="เลือกเจ้าหน้าที่" />
                      </SelectTrigger>
                      <SelectContent>
                        {officers.map(o => (
                          <SelectItem key={o.officer_id} value={String(o.officer_id)}>
                            {o.full_name}{o.position ? ` (${o.position})` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-2">
                    <L>ความคิดเห็นเจ้าหน้าที่</L>
                    <Select
                      value={form.officer_decision || ''}
                      onValueChange={(v) => {
                        update({ officer_decision: v })
                        validateField('officer_decision', v, { ...form, officer_decision: v })
                      }}
                    >
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="เลือกการพิจารณา" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="อนุญาต">อนุญาต</SelectItem>
                        <SelectItem value="ไม่อนุญาต">ไม่อนุญาต</SelectItem>
                        <SelectItem value="รอพิจารณา">รอพิจารณา</SelectItem>
                        <SelectItem value="ต้องการข้อมูลเพิ่มเติม">ต้องการข้อมูลเพิ่มเติม</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:col-span-4">
                    <L>รายละเอียดการปฏิบัติ</L>
                    <Textarea
                      className={`min-h-[120px] ${validationErrors.internal_notes ? 'border-red-500 focus:border-red-500' : ''}`}
                      placeholder=""
                      value={form.internal_notes || ''}
                      onChange={(e) => {
                        const value = e.target.value
                        update({ internal_notes: value })
                        validateField('internal_notes', value, { ...form, internal_notes: value })
                      }}
                    />
                    <p className="text-xs text-slate-500 mt-1">กรณีไม่อนุญาติ ระบุเหตุผลในช่องนี้</p>
                    {validationErrors.internal_notes && (
                      <p className="text-xs text-red-500 mt-1">{validationErrors.internal_notes}</p>
                    )}
                  </div>
                </div>
              </SectionCard>
            </TabsContent>

            {/* ========== TAB 3: Attachments (2 หมวด) ========== */}
            <TabsContent value="docs" className="space-y-4">
              {/* 1) สำเนาบัตรประชาชน / ใบบันทึกประจำวัน */}
              <SectionCard
                title="สำเนาบัตรประชาชน / สำเนาใบบันทึกประจำวัน"
                icon={<Paperclip className="h-4 w-4" />}
                right={
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setServerFileCategory('idcopy')
                        setServerFileBrowserOpen(true)
                      }}
                      className="h-9"
                    >
                      <HardDrive className="h-4 w-4 mr-2" />
                      Browse Server
                    </Button>
                    <label className="inline-flex">
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => uploadDocsWithCategory('idcopy')(e.target.files!)}
                        accept=".pdf,.png,.jpg,.jpeg,.heic"
                      />
                      <span className="inline-flex items-center px-3 py-2 rounded-md border bg-white hover:bg-slate-50 cursor-pointer h-9">
                        <Upload className="h-4 w-4 mr-2" /> เลือกไฟล์
                      </span>
                    </label>
                  </div>
                }
              >
                <label className="mt-1 block w-full rounded-lg border-2 border-dashed border-slate-300 p-6 text-center hover:bg-slate-50 cursor-pointer">
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => uploadDocsWithCategory('idcopy')(e.target.files!)}
                    accept=".pdf,.png,.jpg,.jpeg,.heic"
                  />
                  <div className="text-sm text-slate-600">
                    ลากไฟล์มาวางที่นี่ หรือ <span className="text-[var(--primary)] underline">คลิกเพื่อเลือกไฟล์</span>
                  </div>
                </label>
              </SectionCard>

              {/* 2) ภาพระหว่างปฏิบัติการ */}
              <SectionCard
                title="ภาพระหว่างปฏิบัติการ"
                icon={<ImageIcon className="h-4 w-4" />}
                right={
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setServerFileCategory('operation')
                        setServerFileBrowserOpen(true)
                      }}
                      className="h-9"
                    >
                      <HardDrive className="h-4 w-4 mr-2" />
                      Browse Server
                    </Button>
                    <label className="inline-flex">
                      <input
                        type="file"
                        multiple
                        accept="image/*,.heic"
                        className="hidden"
                        onChange={(e) => uploadDocsWithCategory('operation')(e.target.files!)}
                      />
                      <span className="inline-flex items-center px-3 py-2 rounded-md border bg-white hover:bg-slate-50 cursor-pointer h-9">
                        <Upload className="h-4 w-4 mr-2" /> อัปโหลดรูปภาพ
                      </span>
                    </label>
                  </div>
                }
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {attachments.filter(a => (a.category === 'operation') && /(png|jpg|jpeg|heic)$/i.test(a.file_name || '')).length === 0 ? (
                    <div className="col-span-full text-center text-slate-500 py-6">ยังไม่มีรูปภาพ</div>
                  ) : (
                    attachments
                      .filter(a => (a.category === 'operation') && /(png|jpg|jpeg|heic)$/i.test(a.file_name || ''))
                      .map((f) => (
                        <div key={f.id} className="relative border rounded-lg overflow-hidden bg-white group">
                          <Image
                            src={f.url}
                            alt={f.file_name}
                            width={300}
                            height={128}
                            className="w-full h-32 object-cover"
                            loading="lazy"
                          />
                          <div className="absolute inset-x-0 bottom-0 bg-black/40 text-white text-xs px-2 py-1 truncate">
                            {f.file_name}
                          </div>
                          <button
                            onClick={() => deleteAttachment(f.id)}
                            className="absolute top-2 right-2 rounded-md border bg-white/90 p-1 text-rose-600 hover:bg-rose-50"
                            aria-label="ลบรูปภาพ"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                  )}
                </div>
              </SectionCard>

              {/* ตารางสรุปเอกสารทั้งหมด */}
              <SectionCard title="เอกสารแนบทั้งหมด">
                <div className="overflow-auto">
                  <table className="w-full text-sm border border-slate-200 rounded-lg">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="text-left px-3 py-2 border-b">ไฟล์</th>
                        <th className="text-left px-3 py-2 border-b">ประเภทไฟล์</th>
                        <th className="text-left px-3 py-2 border-b">หมวด</th>
                        <th className="text-left px-3 py-2 border-b">ขนาด</th>
                        <th className="text-left px-3 py-2 border-b">อัปโหลดเมื่อ</th>
                        <th className="text-center px-3 py-2 border-b">ลบ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attachments.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="text-center text-slate-500 py-6">ยังไม่มีเอกสารแนบ</td>
                        </tr>
                      ) : (
                        attachments.map((f) => (
                          <tr key={f.id} className="hover:bg-slate-50">
                            <td className="px-3 py-2 border-b">
                              <a href={f.url} target="_blank" className="text-[var(--primary)] hover:underline">{f.file_name}</a>
                            </td>
                            <td className="px-3 py-2 border-b">{f.file_type}</td>
                            <td className="px-3 py-2 border-b">
                              <Badge variant="outline" className="bg-slate-50">
                                {f.category === 'idcopy' && 'สำเนาบัตร/บันทึกประจำวัน'}
                                {f.category === 'operation' && 'ภาพระหว่างปฏิบัติการ'}
                                {!f.category && 'ไม่ระบุ'}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 border-b">{humanSize(f.file_size)}</td>
                            <td className="px-3 py-2 border-b">{formatThaiDateBE(f.uploaded_at)}</td>
                            <td className="px-3 py-2 border-b text-center">
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                                onClick={() => deleteAttachment(f.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </TabsContent>

            {/* ========== TAB 4: CCTV (รูป/วิดีโอ + เผยแพร่) ========== */}
            <TabsContent value="photos" className="space-y-4">
              <SectionCard
                title="อัปโหลดสื่อจาก CCTV (รูปภาพ/วิดีโอ)"
                icon={<ImageIcon className="h-4 w-4" />}
                right={
                  <label className="inline-flex">
                    <input
                      type="file"
                      multiple
                      accept="image/*,video/*,.heic"
                      className="hidden"
                      onChange={(e) => cctvUpload.upload(e.target.files!)}
                    />
                    <span className="inline-flex items-center px-3 py-2 rounded-md border bg-white hover:bg-slate-50 cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" /> อัปโหลดไฟล์
                    </span>
                  </label>
                }
              >
                {/* Enhanced Upload Zone */}
                <label className="mt-1 block w-full cursor-pointer group">
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*,.heic"
                    className="hidden"
                    onChange={(e) => cctvUpload.upload(e.target.files!)}
                  />

                  <div className="relative p-8 border-2 border-dashed border-slate-300 group-hover:border-[var(--primary)] rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 group-hover:from-[var(--primary)]/5 group-hover:to-blue-50/50 transition-all duration-300">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity">
                      <svg className="w-full h-full" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                          <pattern id="upload-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                            <circle cx="10" cy="10" r="1" fill="currentColor" className="text-slate-400"/>
                          </pattern>
                        </defs>
                        <rect width="100" height="100" fill="url(#upload-pattern)" />
                      </svg>
                    </div>

                    <div className="relative z-10 text-center">
                      {/* Upload Icon */}
                      <div className="mx-auto mb-4 w-16 h-16 bg-gradient-to-br from-[var(--primary)] to-blue-600 rounded-2xl flex items-center justify-center shadow-lg group-hover:shadow-xl group-hover:scale-110 transition-all duration-300">
                        <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                      </div>

                      {/* Upload Text */}
                      <div className="space-y-2">
                        <h3 className="text-lg font-bold text-slate-800 group-hover:text-[var(--primary)] transition-colors">
                          อัปโหลดไฟล์ CCTV
                        </h3>
                        <p className="text-slate-600 group-hover:text-slate-700 transition-colors">
                          ลากไฟล์ (รูปภาพ/วิดีโอ) มาวางที่นี่ หรือ{' '}
                          <span className="font-semibold text-[var(--primary)] group-hover:underline">
                            คลิกเพื่อเลือกไฟล์
                          </span>
                        </p>
                      </div>

                      {/* File Type Indicators */}
                      <div className="mt-6 flex justify-center gap-6 text-sm">
                        <div className="flex items-center gap-2 px-3 py-1 bg-[var(--primary)]/10 text-[var(--primary)] rounded-full border border-[var(--primary)]/20">
                          <div className="w-2 h-2 bg-[var(--primary)] rounded-full"></div>
                          <span className="font-medium">รูปภาพ</span>
                        </div>
                        <div className="flex items-center gap-2 px-3 py-1 bg-red-50 text-red-700 rounded-full border border-red-200">
                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                          <span className="font-medium">วิดีโอ</span>
                        </div>
                      </div>

                      {/* Hover Animation */}
                      <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/80 backdrop-blur-sm rounded-full text-xs font-medium text-slate-600 shadow-md">
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          รองรับไฟล์ขนาดสูงสุด 500MB ต่อไฟล์ 
                        </div>
                      </div>
                    </div>
                  </div>
                </label>

                {/* Enhanced Progress Bar UI with Comprehensive Status */}
                {cctvUpload.progress.uploading && (
                  <div className="mt-6 p-6 border-2 border-[var(--primary)]/20 bg-gradient-to-r from-[var(--primary)]/5 via-blue-50/50 to-indigo-50/50 rounded-2xl shadow-lg backdrop-blur-sm">
                    {/* Header with Status */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          cctvUpload.progress.status === 'preparing' ? 'bg-yellow-500' :
                          cctvUpload.progress.status === 'uploading' ? 'bg-[var(--primary)]' :
                          cctvUpload.progress.status === 'processing' ? 'bg-purple-500' :
                          cctvUpload.progress.status === 'error' ? 'bg-red-500' :
                          'bg-[var(--success)]'
                        }`}>
                          {cctvUpload.progress.status === 'preparing' ? (
                            <svg className="h-4 w-4 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          ) : cctvUpload.progress.status === 'uploading' ? (
                            <svg className="h-4 w-4 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                          ) : cctvUpload.progress.status === 'processing' ? (
                            <svg className="h-4 w-4 text-white animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                          ) : cctvUpload.progress.status === 'error' ? (
                            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-[var(--foreground)]">
                            {cctvUpload.progress.status === 'preparing' && 'เตรียมการอัปโหลด...'}
                            {cctvUpload.progress.status === 'uploading' && `กำลังอัปโหลดไฟล์ (${cctvUpload.progress.currentFileIndex + 1}/${cctvUpload.progress.totalFiles})`}
                            {cctvUpload.progress.status === 'processing' && 'กำลังประมวลผล...'}
                            {cctvUpload.progress.status === 'error' && 'เกิดข้อผิดพลาด'}
                            {cctvUpload.progress.status === 'completed' && 'อัปโหลดเสร็จสิ้น!'}
                          </div>
                          <div className="text-xs text-[var(--muted-foreground)]">
                            {cctvUpload.progress.retryCount > 0 && `ลองใหม่ครั้งที่ ${cctvUpload.progress.retryCount} • `}
                            {cctvUpload.progress.status === 'uploading' && cctvUpload.progress.speed > 0 && `${cctvUpload.progress.speed} KB/s`}
                            {cctvUpload.progress.status === 'preparing' && 'กรุณารอสักครู่...'}
                            {cctvUpload.progress.status === 'processing' && 'เกือบเสร็จแล้ว...'}
                            {cctvUpload.progress.status === 'error' && 'โปรดลองใหม่อีกครั้ง'}
                            {cctvUpload.progress.status === 'completed' && 'ไฟล์ทั้งหมดพร้อมใช้งาน'}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-[var(--primary)]">
                          {cctvUpload.progress.progress}%
                        </div>
                        <div className="text-xs text-[var(--muted-foreground)] font-medium">
                          {cctvUpload.progress.estimatedTime > 0 && cctvUpload.progress.status === 'uploading'
                            ? `เหลือ ${cctvUpload.progress.estimatedTime}s`
                            : 'เสร็จสิ้น'
                          }
                        </div>
                      </div>
                    </div>

                    {/* Current File Info */}
                    {cctvUpload.progress.currentFile && (
                      <div className="mb-3 text-sm font-semibold text-[var(--foreground)] truncate flex items-center gap-2">
                        <svg className="h-4 w-4 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        {cctvUpload.progress.currentFile}
                      </div>
                    )}

                    {/* Progress Bar */}
                    <div className="w-full bg-slate-200 rounded-full h-4 mb-4 shadow-inner overflow-hidden">
                      <div
                        className={`h-4 rounded-full transition-all duration-700 ease-out shadow-lg relative ${
                          cctvUpload.progress.status === 'error' ? 'bg-gradient-to-r from-red-400 to-red-600' :
                          cctvUpload.progress.status === 'completed' ? 'bg-gradient-to-r from-green-400 to-green-600' :
                          'bg-gradient-to-r from-[var(--primary)] via-blue-500 to-indigo-600'
                        }`}
                        style={{ width: `${cctvUpload.progress.progress}%` }}
                      >
                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                      </div>
                    </div>

                    {/* Statistics */}
                    <div className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <svg className="h-4 w-4 text-[var(--primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-9 0V1m10 3V1m0 3l1 1v16a2 2 0 01-2 2H6a2 2 0 01-2-2V5l1-1z" />
                          </svg>
                          <span className="font-bold text-[var(--foreground)]">
                            {humanSize(cctvUpload.progress.uploadedSize)}
                          </span>
                          <span className="text-[var(--muted-foreground)]">/</span>
                          <span className="font-bold text-[var(--primary)]">
                            {humanSize(cctvUpload.progress.totalSize)}
                          </span>
                        </div>

                        {cctvUpload.progress.speed > 0 && cctvUpload.progress.status === 'uploading' && (
                          <div className="flex items-center gap-2">
                            <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                            <span className="font-medium text-green-600">
                              {cctvUpload.progress.speed} KB/s
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        {cctvUpload.progress.totalFiles > 1 && (
                          <div className="px-3 py-1 bg-[var(--accent)]/10 border border-[var(--accent)]/30 text-[var(--accent)] rounded-full text-xs font-bold">
                            {cctvUpload.progress.totalFiles} ไฟล์
                          </div>
                        )}

                        {/* File Status Indicators */}
                        <div className="flex space-x-1">
                          {Array.from({ length: Math.min(cctvUpload.progress.totalFiles, 5) }, (_, i) => (
                            <div
                              key={i}
                              className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                                i < cctvUpload.progress.currentFileIndex ? 'bg-[var(--success)]' :
                                i === cctvUpload.progress.currentFileIndex ? 'bg-[var(--primary)] animate-pulse' :
                                'bg-slate-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Failed Files Summary */}
                    {cctvUpload.progress.failedFiles.length > 0 && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="text-sm font-medium text-red-800 mb-2">
                          ไฟล์ที่ไม่สามารถอัปโหลดได้ ({cctvUpload.progress.failedFiles.length} ไฟล์):
                        </div>
                        <div className="text-xs text-red-600 max-h-20 overflow-y-auto">
                          {cctvUpload.progress.failedFiles.map((file, index) => (
                            <div key={index} className="mb-1">
                              • {file.name}: {file.reason}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ===== Beautiful Gallery Layout ===== */}
                <div className="mt-8">
                  {cctvMedia.length === 0 ? (
                    <div className="text-center text-slate-500 py-20 bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl border-2 border-dashed border-slate-300">
                      <div className="max-w-md mx-auto">
                        <div className="relative mb-6">
                          <div className="w-20 h-20 bg-[var(--primary)]/10 rounded-2xl mx-auto flex items-center justify-center">
                            <ImageIcon className="h-10 w-10 text-[var(--primary)]" />
                          </div>
                          <div className="absolute -top-2 -right-2 w-6 h-6 bg-[var(--accent)] rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-bold">+</span>
                          </div>
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2">เริ่มต้นอัปโหลดไฟล์ CCTV</h3>
                        <p className="text-slate-600 mb-6">อัปโหลดรูปภาพหรือวิดีโอเผยแพร่ให้ผู้ยื่นคำขอสำเนาภาพ</p>
                        <div className="flex justify-center gap-4 text-sm text-slate-500">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-[var(--success)] rounded-full"></div>
                            รองรับรูปภาพ
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-[var(--warning)] rounded-full"></div>
                            รองรับวิดีโอ
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Gallery Header - Responsive */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base sm:text-lg md:text-xl font-bold text-[var(--foreground)]">Gallery สื่อ CCTV</h3>
                          <p className="text-xs sm:text-sm md:text-sm text-[var(--muted-foreground)] mt-1">
                            {cctvMedia.length} ไฟล์ • {cctvMedia.filter(m => m.published === 'true' || m.approval_status === 'พร้อมใช้งาน').length} ไฟล์พร้อมใช้งาน
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs sm:text-sm self-start sm:self-auto">
                          <div className="flex items-center gap-1.5 px-2 sm:px-3 md:px-4 py-1 bg-[var(--success)]/10 text-[var(--success)] rounded-full">
                            <CheckCircle2 className="h-3 w-3 sm:h-3.5 md:h-4 sm:w-3.5 md:w-4" />
                            <span className="font-medium">
                              {cctvMedia.filter(m => m.published === 'true' || m.approval_status === 'พร้อมใช้งาน').length}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Gallery Grid - Responsive Layout */}
                      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
                        {cctvMedia.map((m, index) => {
                      const isVideo = /^video\//i.test(m.file_type) || /\.(mp4|mov|avi|m4v|webm)$/i.test(m.file_name)
                          const isPublished = m.published === 'true' || m.approval_status === 'พร้อมใช้งาน'

                      return (
                            <div
                              key={m.id}
                              className={`group relative bg-white rounded-lg sm:rounded-xl overflow-hidden shadow-sm sm:shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.01] border border-slate-200`}
                              style={{
                                animation: `fadeInUp 0.6s ease-out ${index * 100}ms forwards`
                              }}
                            >
                              {/* Media Container */}
                              <div
                                className="cursor-pointer relative overflow-hidden"
                                onClick={() => setFullscreenMedia(m)}
                              >
                          {isVideo ? (
                                  <div className="relative bg-slate-900 rounded-t-lg sm:rounded-t-xl overflow-hidden h-32 sm:h-36 lg:h-40">
                                    <video
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                      preload="metadata"
                                      controls
                                      playsInline
                                      muted
                                      poster=""
                                      controlsList="nodownload noplaybackrate"
                                      onLoadedMetadata={(e) => {
                                        // Ensure video is muted for gallery preview
                                        const video = e.target as HTMLVideoElement;
                                        video.muted = true;
                                      }}
                                      onError={(e) => {
                                        console.error('Gallery video load error:', e);
                                        // Fallback to show play button if video fails to load
                                        const video = e.target as HTMLVideoElement;
                                        video.style.display = 'none';
                                        const container = video.parentElement;
                                        if (container) {
                                          const fallback = container.querySelector('.video-fallback');
                                          if (fallback) (fallback as HTMLElement).style.display = 'flex';
                                        }
                                      }}
                                    >
                                      <source src={m.url} type={m.file_type || 'video/mp4'} />
                                    </video>
                                    {/* Video Fallback - shown when video fails to load */}
                                    <div className="video-fallback absolute inset-0" style={{ display: 'none' }}>
                                      <MediaPlaceholder
                                        type="video"
                                        className="h-full rounded-t-lg sm:rounded-t-xl"
                                        message="ไม่สามารถโหลดวิดีโอได้"
                                      />
                                    </div>

                                    {/* Video Play Button - Responsive (แสดงเฉพาะเมื่อไม่ hover และเป็น mobile) */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/30 via-transparent to-black/10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                                      <div className="bg-[var(--primary)]/80 hover:bg-[var(--primary)] text-white rounded-full p-2 sm:p-3 shadow-lg transform scale-75 group-hover:scale-90 sm:group-hover:scale-100 transition-all duration-300 backdrop-blur-sm pointer-events-auto">
                                        <svg className="h-5 w-5 sm:h-6 sm:w-6 ml-0.5 sm:ml-1" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M8 5v14l11-7z"/>
                                        </svg>
                                      </div>
                                    </div>

                                    {/* Video Badge - Responsive */}
                                    <div className="absolute top-2 left-2 sm:top-3 sm:left-3 md:top-4 md:left-4 bg-gradient-to-r from-red-500 to-pink-500 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm">
                                      <div className="flex items-center gap-1 sm:gap-1.5">
                                        <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white/80 rounded-full animate-pulse"></div>
                                        วิดีโอ
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="relative bg-slate-100 rounded-t-lg sm:rounded-t-xl overflow-hidden h-32 sm:h-36 lg:h-40">
                                    <Image
                                      src={m.url}
                                      alt={m.file_name}
                                      width={400}
                                      height={160}
                                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                                      loading="lazy"
                                    />

                                    {/* Image Zoom Indicator - Responsive */}
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none">
                                      <div className="bg-white/90 backdrop-blur-sm rounded-full p-1.5 sm:p-2 md:p-2.5 shadow-lg transform scale-75 group-hover:scale-90 sm:group-hover:scale-100 transition-all duration-300 pointer-events-auto">
                                        <svg className="h-4 w-4 sm:h-4.5 sm:w-4.5 md:h-5 md:w-5 text-slate-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                        </svg>
                                      </div>
                                    </div>

                                    {/* Image Badge - Responsive */}
                                    <div className="absolute top-2 left-2 sm:top-3 sm:left-3 md:top-4 md:left-4 bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-2 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-bold shadow-lg backdrop-blur-sm">
                                      <div className="flex items-center gap-1 sm:gap-1.5">
                                        <svg className="h-2.5 w-2.5 sm:h-3 sm:w-3" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 7v10h16V7H4zm8 2l5 4H7l5-4z"/>
                                        </svg>
                                        รูปภาพ
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Status Indicator - Responsive */}
                                <div className="absolute top-2 right-2 sm:top-3 sm:right-3 md:top-4 md:right-4">
                                  {isPublished ? (
                                    <div className="bg-[var(--success)] text-white rounded-full p-1 sm:p-1.5 md:p-2 shadow-lg">
                                      <CheckCircle2 className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                                    </div>
                                  ) : (
                                    <div className="bg-slate-500 text-white rounded-full p-1 sm:p-1.5 md:p-2 shadow-lg">
                                      <XCircle className="h-3 w-3 sm:h-3.5 sm:w-3.5 md:h-4 md:w-4" />
                                    </div>
                                  )}
                                </div>
                          </div>

                              {/* Media Info - Responsive */}
                              <div className="p-3 sm:p-4 md:p-5 bg-gradient-to-br from-white to-slate-50">
                                <div className="flex items-start justify-between gap-2 sm:gap-3 md:gap-4 mb-2 sm:mb-3 md:mb-3.5">
                                  <div className="flex-1 min-w-0">
                                    <h4 className="font-semibold text-[var(--foreground)] text-xs sm:text-sm truncate mb-1 sm:mb-1.5">
                                      {m.file_name}
                                    </h4>
                                    <div className="flex items-center gap-1 sm:gap-2 md:gap-2.5 text-xs sm:text-xs md:text-sm text-[var(--muted-foreground)]">
                                      <span>{m.file_size ? humanSize(m.file_size) : 'ไม่ระบุ'}</span>
                                      {isVideo && (
                                        <>
                                          <span>•</span>
                                          <span className="text-[var(--warning)]">วิดีโอ</span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Action Menu - Responsive */}
                                  <div className="relative">
                          <button
                                      onClick={(e) => e.stopPropagation()}
                                      className="p-1.5 sm:p-2 rounded-lg hover:bg-slate-100 transition-colors opacity-0 group-hover:opacity-100"
                          >
                                      <svg className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-slate-500" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                                      </svg>
                          </button>
                                  </div>
                                </div>

                                {/* Status Toggle - Responsive */}
                                <div className="flex justify-center">
                                  {isPublished ? (
                              <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleCctvPublish(m.id, false)
                                      }}
                                      className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg bg-[var(--success)]/10 border border-[var(--success)]/30 text-[var(--success)] hover:bg-[var(--success)]/20 transition-colors text-xs font-medium"
                                    >
                                      <CheckCircle2 className="h-3 w-3 sm:h-3.5 md:h-4 sm:w-3.5 md:w-4" />
                                      <span className="hidden sm:inline">พร้อมใช้งาน</span>
                                      <span className="sm:hidden">พร้อม</span>
                              </button>
                            ) : (
                              <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        toggleCctvPublish(m.id, true)
                                      }}
                                      className="inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 md:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg bg-slate-100 border border-slate-300 text-slate-600 hover:bg-slate-200 transition-colors text-xs font-medium"
                                    >
                                      <XCircle className="h-3 w-3 sm:h-3.5 md:h-4 sm:w-3.5 md:w-4" />
                                      <span className="hidden sm:inline">ไม่พร้อมใช้งาน</span>
                                      <span className="sm:hidden">ไม่พร้อม</span>
                              </button>
                            )}
                          </div>
                              </div>

                              {/* Delete Button Overlay - Responsive */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteCctvMedia(m.id)
                                }}
                                className="absolute top-2 right-10 sm:top-3 sm:right-12 opacity-0 group-hover:opacity-100 transition-all duration-300 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 sm:p-2 shadow-lg hover:scale-110"
                                title="ลบไฟล์"
                              >
                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                              </button>
                        </div>
                      )
                        })}
                      </div>
                    </>
                  )}
                </div>
              </SectionCard>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* ===== Sticky bottom save ===== */}
      <div className="fixed bottom-4 right-4">
        <Button onClick={saveAll} disabled={saving} className={`shadow-lg h-11 px-5 ${THEME_COLORS.primary} hover:${THEME_COLORS.primaryHover} ${THEME_COLORS.primaryForeground}`}>
          {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          บันทึกทั้งหมด
        </Button>
      </div>

      {/* ===== Server File Browser Modal ===== */}
      <ServerFileBrowser
        open={serverFileBrowserOpen}
        onOpenChange={setServerFileBrowserOpen}
        reportId={report?.report_id || 0}
        category={serverFileCategory}
        onSuccess={async () => {
          // Reload attachments after successful copy
          if (!report) return
          try {
            const aRes = await fetch(`/api/reports/${report.report_id}/attachments`)
            const a = await aRes.json().catch(() => ({ data: [] }))
            setAttachments((a.data || []).map((x: Attachment) => x))
            toast.success('โหลดเอกสารใหม่สำเร็จ')
          } catch (e) {
            console.error(e)
            toast.error('โหลดเอกสารไม่สำเร็จ')
          }
        }}
      />

      {/* ===== Clean Fullscreen Media Modal ===== */}
      {fullscreenMedia && (
        <div className="fixed inset-0 bg-black z-50 animate-fadeIn">
          {/* Close button */}
              <button
                onClick={() => setFullscreenMedia(null)}
            className="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-all duration-200 hover:scale-110"
                aria-label="ปิด"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

          {/* Media Display - Full viewport */}
          <div className="w-full h-full flex items-center justify-center p-4">
                {(/^video\//i.test(fullscreenMedia.file_type) || /\.(mp4|mov|avi|m4v|webm)$/i.test(fullscreenMedia.file_name)) ? (
                  <video
                    key={fullscreenMedia.id}
                className="max-w-full max-h-full object-contain"
                    controls
                    playsInline
                    preload="metadata"
                disablePictureInPicture
                controlsList="nodownload noplaybackrate"
                autoPlay={false}
                    onError={(e) => {
                      console.error('Video load error:', e);
                    }}
              >
                <source src={fullscreenMedia.url} type={fullscreenMedia.file_type || 'video/mp4'} />
              </video>
                ) : (
              <Image
                    src={fullscreenMedia.url}
                    alt={fullscreenMedia.file_name}
                fill
                className="object-contain"
                sizes="100vw"
                priority
              />
            )}
              </div>

          {/* Click outside to close */}
          <div
            className="absolute inset-0 -z-10"
            onClick={() => setFullscreenMedia(null)}
          />
        </div>
      )}
    </div>
  )
}
