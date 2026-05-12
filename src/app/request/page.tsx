'use client'

import React, { useEffect, useMemo, useState, useRef, useCallback, type ReactNode } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertCircle, AlertTriangle, ArrowLeft, ArrowRight, Camera, CheckCircle2, ChevronsUpDown, Check,
  Clock, FileBadge2, FileText, Home, Loader2, MapPin, MessageCircle, Phone, Send,
  ShieldCheck, UploadCloud, User, CreditCard, X, Pencil, Trash2,
  ScanFace, BookOpen, PenLine, Info, Star,
} from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandItem, CommandGroup,
} from '@/components/ui/command'
import type { LiffSDK, LiffUserProfile } from '@/types/liff.d'
import {
  formatThaiDateLong,
  formatThaiDateTimeLong,
  formatThaiTime,
  normalizeIsoDate,
  normalizeTime,
} from '@/lib/thai-datetime'
import PDPAConsentModal from '@/components/PDPAConsentModal'
import { PDPA_PRIVACY_NOTICE_VERSION } from '@/lib/pdpa'

/* -------------------- Constants -------------------- */
const PDPA_CONSENT_STORAGE_KEY = `pdpa-accepted:${PDPA_PRIVACY_NOTICE_VERSION}:/request`

// Safari/Firefox private mode + LINE in-app WKWebView อาจ throw จาก localStorage/sessionStorage
// (SecurityError, QuotaExceededError, หรือ storage ถูกปิดใช้งาน) — ต้องห่อ try-catch เสมอ
function readPdpaConsentFlag(): boolean {
  if (typeof window === 'undefined') return false
  try {
    if (window.localStorage.getItem(PDPA_CONSENT_STORAGE_KEY) === '1') return true
  } catch {}
  try {
    if (window.sessionStorage.getItem(PDPA_CONSENT_STORAGE_KEY) === '1') return true
  } catch {}
  return false
}

function writePdpaConsentFlag(): void {
  if (typeof window === 'undefined') return
  // localStorage อยู่รอดข้าม LIFF redirect บน LINE in-app browser มือถือ
  // ส่วน sessionStorage เก็บไว้เป็น fallback กรณี localStorage ถูกบล็อก
  try { window.localStorage.setItem(PDPA_CONSENT_STORAGE_KEY, '1') } catch {}
  try { window.sessionStorage.setItem(PDPA_CONSENT_STORAGE_KEY, '1') } catch {}
}

function clearPdpaConsentFlag(): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(PDPA_CONSENT_STORAGE_KEY) } catch {}
  try { window.sessionStorage.removeItem(PDPA_CONSENT_STORAGE_KEY) } catch {}
}
const PREFIXES_KEYS = ['นาย', 'นาง', 'นางสาว'] as const
const CATEGORIES_KEYS = ['ขอสำเนาข้อมูลภาพ', 'ขอดูข้อมูลรูปภาพ'] as const
const INVOLVEMENT_ROLES_KEYS = ['ผู้เสียหาย', 'ญาติ', 'ผู้เกี่ยวข้อง', 'เจ้าหน้าที่รัฐ', 'ประกัน'] as const

const RE_BANGKOK = /กรุงเทพ|bangkok/i
const RE_ALLEY_PREFIX = /^(ซอย|ตรอก)\s*/i
const RE_ROAD_PREFIX = /^ถนน\s*/i

const STEPS = [
  { key: 'applicant', labelKey: 'stepper.step1', subLabel: 'Applicant' },
  { key: 'documents', labelKey: 'stepper.stepDocs', subLabel: 'Documents' },
  { key: 'incident',  labelKey: 'stepper.step2', subLabel: 'Incident' },
  { key: 'review',   labelKey: 'stepper.step3', subLabel: 'Review' },
] as const

/* -------------------- Schema -------------------- */
const schemaBase = z.object({
  prefix: z.enum(PREFIXES_KEYS, { message: 'กรุณาเลือกคำนำหน้า' }),
  full_name: z.string().min(1, 'กรุณากรอกชื่อ-นามสกุล'),
  age: z.string()
    .min(1, 'กรุณาระบุอายุ')
    .refine(v => /^[0-9]+$/.test(v), 'อายุต้องเป็นตัวเลขเท่านั้น')
    .refine(v => parseInt(v) >= 1 && parseInt(v) <= 120, 'อายุต้องอยู่ระหว่าง 1-120 ปี'),
  phone_number: z.string()
    .min(9, 'เบอร์โทรศัพท์ไม่ถูกต้อง')
    .refine(v => /^0\d{8,9}$/.test(v.replace(/\s|-/g, '')), 'รูปแบบเบอร์ 0XXXXXXXXX หรือ 0XXXXXXXXXX'),
  id_or_passport_number: z.string()
    .min(6, 'อย่างน้อย 6 ตัวเลข')
    .refine(v => /^[0-9A-Za-z-]{6,}$/.test(v), 'ใช้ได้เฉพาะตัวเลข/ตัวอักษร/ขีดกลาง'),
  line_user_id_str: z.string().min(1, 'ไม่พบข้อมูล LINE กรุณาเข้าใหม่ผ่าน LINE'),
  involvement_role: z.enum(INVOLVEMENT_ROLES_KEYS, { message: 'กรุณาเลือกสถานะการเกี่ยวข้อง' }),
  involvement_explain: z.string().optional(),
  house_number: z.string().optional(),
  village_number: z.string().optional(),
  alley: z.string().optional(),
  road: z.string().optional(),
  sub_district: z.string().min(1, 'กรุณาระบุตำบล/แขวง'),
  district: z.string().min(1, 'กรุณาระบุอำเภอ/เขต'),
  province: z.string().min(1, 'กรุณาระบุจังหวัด'),
  postal_code: z.string()
    .min(5, 'รหัสไปรษณีย์ 5 หลัก')
    .refine(v => /^[0-9]{5}$/.test(v), 'รูปแบบรหัสไปรษณีย์ไม่ถูกต้อง'),
  category_id: z.number().min(1, 'กรุณาเลือกหมวดหมู่เหตุการณ์'),
  request_type: z.enum(CATEGORIES_KEYS, { message: 'กรุณาเลือกประเภทคำร้อง' }),
  incident_date: z.string().min(1, 'กรุณาระบุวันที่เกิดเหตุ'),
  incident_time: z.string().min(1, 'กรุณาระบุเวลาที่เกิดเหตุ'),
  incident_location: z.string().min(1, 'กรุณาระบุสถานที่เกิดเหตุ'),
  request_details: z.string().optional(),
  supporting_documents: z.object({
    id_card_copy: z.boolean(),
    police_report_copy: z.boolean(),
    other: z.boolean(),
    other_details: z.string().optional(),
  }),
  consent: z.boolean().refine(v => v, 'ต้องยอมรับเงื่อนไขก่อนยื่นคำร้อง'),
})
const schema = schemaBase.superRefine((data, ctx) => {
  if (data.involvement_role === 'ญาติ' || data.involvement_role === 'ผู้เกี่ยวข้อง') {
    if (!data.involvement_explain?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'กรุณาระบุความเกี่ยวข้อง',
        path: ['involvement_explain'],
      })
    }
  }
})
type FormData = z.infer<typeof schema>
type GateState = 'booting' | 'outside-line' | 'need-friend' | 'ready' | 'error'
type UploadKind = 'idcopy' | 'operation'
type UploadProgressItem = {
  label: string
  loaded: number
  total: number
  percent: number
  status: 'pending' | 'compressing' | 'uploading' | 'done' | 'error'
}
type UploadProgressMap = Record<string, UploadProgressItem>

/* -------------------- Hooks -------------------- */
function useIsDesktop(breakpoint = 1024) {
  const [isDesktop, setIsDesktop] = useState(false)
  useEffect(() => {
    const mm = window.matchMedia(`(min-width: ${breakpoint}px)`)
    const onChange = () => setIsDesktop(mm.matches)
    onChange()
    mm.addEventListener('change', onChange)
    return () => mm.removeEventListener('change', onChange)
  }, [breakpoint])
  return isDesktop
}
function useDebounced<T>(value: T, delay = 250) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}

/* -------------------- Shared small components -------------------- */
function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs text-[var(--destructive)] font-medium flex items-center gap-1" role="alert"><AlertCircle className="h-3 w-3" aria-hidden="true" /> {message}</p>
}

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

/* -------------------- CCTV Hero (4-step) -------------------- */
function CCTVHero({ compact = false }: { compact?: boolean }) {
  // Client-only timestamp to avoid SSR/CSR hydration mismatch
  const [stamp, setStamp] = useState<string>('')
  useEffect(() => {
    const pad = (n: number) => String(n).padStart(2, '0')
    const update = () => {
      const d = new Date()
      const iso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      setStamp(
        `${formatThaiDateLong(iso, { short: true })} · ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      )
    }
    update()
    const id = window.setInterval(update, 1000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div
      className="cctv-hero-scene relative overflow-hidden"
      style={{ height: compact ? 130 : 170 }}
    >
      {/* Faux night cityscape */}
      <svg viewBox="0 0 600 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full opacity-55" aria-hidden="true">
        <defs>
          <linearGradient id="cctvSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0a1628"/>
            <stop offset="100%" stopColor="#1a3358"/>
          </linearGradient>
          <radialGradient id="cctvLamp" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,210,140,0.7)"/>
            <stop offset="100%" stopColor="rgba(255,210,140,0)"/>
          </radialGradient>
        </defs>
        <rect width="600" height="200" fill="url(#cctvSky)"/>
        <rect x="0"   y="110" width="80"  height="90" fill="rgba(0,0,0,0.5)"/>
        <rect x="80"  y="90"  width="120" height="110" fill="rgba(0,0,0,0.6)"/>
        <rect x="200" y="100" width="60"  height="100" fill="rgba(0,0,0,0.5)"/>
        <rect x="260" y="80"  width="100" height="120" fill="rgba(0,0,0,0.65)"/>
        <rect x="360" y="120" width="80"  height="80"  fill="rgba(0,0,0,0.5)"/>
        <rect x="440" y="95"  width="160" height="105" fill="rgba(0,0,0,0.6)"/>
        <circle cx="120" cy="150" r="35" fill="url(#cctvLamp)"/>
        <circle cx="380" cy="160" r="40" fill="url(#cctvLamp)"/>
        <rect x="0" y="170" width="600" height="30" fill="rgba(20,30,50,0.7)"/>
        <path d="M0 185 L600 185" stroke="#ffd28a" strokeWidth="1" strokeDasharray="10 10" opacity="0.6"/>
      </svg>
      <div className="dark-fade" />
      <div className="scan-grid" />

      <div className="absolute top-3 right-3 px-2 py-1 rounded bg-black/50 text-white text-[10px] font-semibold font-mono" suppressHydrationWarning>
        {stamp || ' '}
      </div>

      {/* Text */}
      <div className="absolute left-4 sm:left-6 right-4 sm:right-6 bottom-4 sm:bottom-5 text-white">
        <h1 className={`m-0 font-bold tracking-tight leading-tight ${compact ? 'text-[1.25rem]' : 'text-[1.5rem] sm:text-[1.75rem]'}`}>
          ยื่นคำร้องขอภาพจากกล้อง CCTV
        </h1>
        <p className="m-0 mt-1 text-xs text-white/75">
          เทศบาลนครหัวหิน · หลังจากยื่นรอตรวจสอบข้อมูล และรอเอกสารอนุมัติ 1–2 วัน
        </p>
      </div>
    </div>
  )
}

/* -------------------- Stepper -------------------- */
function StepperDesktop({ current, onStepChange, t }: {
  current: number
  onStepChange?: (i: number) => void
  t: ReturnType<typeof useTranslations>
}) {
  const isClickable = (i: number) => typeof onStepChange === 'function' && i <= current
  return (
    <nav aria-label="step progress" className="cctv-card px-5 py-4">
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const status: 'done' | 'cur' | 'upcoming' = i < current ? 'done' : i === current ? 'cur' : 'upcoming'
          const clickable = isClickable(i)
          return (
            <React.Fragment key={s.key}>
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepChange?.(i)}
                className={`flex items-center gap-2.5 ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                aria-current={status === 'cur' ? 'step' : undefined}
              >
                <span
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0 transition-all
                    ${status === 'done' ? 'bg-[var(--success)] text-white'
                      : status === 'cur' ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                      : 'bg-[var(--card)] text-[var(--muted-foreground)] border-[2px] border-[var(--border)]'
                    }`}
                  style={
                    status === 'cur'
                      ? { boxShadow: '0 0 0 4px color-mix(in oklch, var(--primary) 18%, transparent)' }
                      : undefined
                  }
                >
                  {status === 'done' ? <Check className="h-4 w-4" aria-hidden="true" /> : i + 1}
                </span>
                <div className="text-left">
                  <div className={`text-[13px] font-semibold ${status === 'upcoming' ? 'text-[var(--muted-foreground)]' : 'text-[var(--foreground)]'}`}>
                    {t(s.labelKey)}
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--muted-foreground)]">
                    {s.subLabel}
                  </div>
                </div>
              </button>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-[2px] mx-3.5 bg-[var(--border)] relative rounded">
                  <div
                    className="absolute inset-0 bg-[var(--success)] rounded transition-all duration-300"
                    style={{ width: i < current ? '100%' : '0%' }}
                  />
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </nav>
  )
}

function StepperMobile({ current, t }: {
  current: number
  t: ReturnType<typeof useTranslations>
}) {
  const total = STEPS.length
  return (
    <div className="cctv-card px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-[var(--primary)]">
          ขั้นตอนที่ {current + 1} / {total}
        </div>
        <div className="text-xs text-[var(--muted-foreground)]">{t(STEPS[current].labelKey)}</div>
      </div>
      <div className="cctv-steps">
        {STEPS.map((_, i) => (
          <div key={i} className={'seg ' + (i < current ? 'done' : i === current ? 'cur' : '')} />
        ))}
      </div>
    </div>
  )
}

/* -------------------- AsyncCombobox -------------------- */
type ComboItem = { id: number; name: string; extra?: Record<string, unknown> }
function AsyncCombobox(props: {
  label: string
  placeholder?: string
  valueName?: string
  fetcher: (q: string) => Promise<ComboItem[]>
  onSelect: (item: ComboItem) => void
  selected?: ComboItem | null
  disabled?: boolean
  disabledHint?: string
  error?: string
  allowClear?: boolean
  t: ReturnType<typeof useTranslations>
}) {
  const { label, placeholder, valueName, fetcher, onSelect, selected, disabled, disabledHint, error, allowClear = true, t } = props
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<ComboItem[]>([])
  const q = useDebounced(query, 250)

  useEffect(() => {
    if (disabled) return
    let mounted = true
    ;(async () => {
      setLoading(true)
      try {
        const list = await fetcher(q)
        if (mounted) setItems(list)
      } catch { /* ignore */ }
      finally { if (mounted) setLoading(false) }
    })()
    return () => { mounted = false }
  }, [q, fetcher, disabled])

  const showText = selected?.name ?? valueName ?? ''

  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-semibold text-[var(--foreground)]">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button" variant="outline" role="combobox" aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between h-11 text-[15px] px-3.5 border-[1.5px] border-[var(--border)] hover:border-[var(--primary)] hover:bg-transparent rounded-lg"
            title={disabled ? (disabledHint ?? '') : showText || placeholder}
          >
            <div className="truncate text-left font-normal">
              {disabled ? (
                <span className="text-[var(--muted-foreground)]">{disabledHint ?? t('placeholders.disabled')}</span>
              ) : (
                showText || <span className="text-[var(--muted-foreground)]">{placeholder}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {allowClear && !!selected && !disabled && (
                <X className="h-4 w-4 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  onClick={(e) => { e.stopPropagation(); onSelect({ id: -1, name: '' }) }} />
              )}
              <ChevronsUpDown className="h-4 w-4 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
          <Command shouldFilter={false}>
            <div className="flex items-center gap-2 px-2 pt-2">
              <CommandInput placeholder={t('placeholders.search')} value={query} onValueChange={setQuery} />
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
            </div>
            <CommandList>
              {loading && (
                <div className="px-2 py-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <Skeleton className="h-4 w-4 rounded-full" />
                      <Skeleton className="h-4 flex-1" />
                    </div>
                  ))}
                </div>
              )}
              {!loading && items.length === 0 && <CommandEmpty>{t('placeholders.noResults')}</CommandEmpty>}
              {!loading && items.length > 0 && (
                <CommandGroup>
                  {items.map((item) => (
                    <CommandItem key={item.id} value={String(item.id)} onSelect={() => { onSelect(item); setOpen(false) }}>
                      <Check className={['mr-2 h-4 w-4', selected?.id === item.id ? 'opacity-100' : 'opacity-0'].join(' ')} />
                      <span className="truncate">{item.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <FieldError message={error} />}
    </div>
  )
}

/* -------------------- DocumentCard -------------------- */
type DocCardConfig = {
  id: string
  title: string
  subtitle: string
  accept: string
  icon: ReactNode
  previewType: 'image' | 'pdf' | 'any'
  requireCertify?: boolean
}

function DocPreviewImage({
  file,
  alt,
  onOpen,
  onAspect,
}: {
  file: File
  alt: string
  onOpen?: (src: string) => void
  onAspect?: (orientation: 'portrait' | 'landscape' | 'square') => void
}) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  if (!src) return null
  return (
    <button
      type="button"
      onClick={() => onOpen?.(src)}
      aria-label={`ขยายดู ${alt}`}
      className="absolute inset-0 h-full w-full p-0 m-0 border-0 bg-transparent cursor-zoom-in focus-visible:outline-2 focus-visible:outline-[var(--primary)] focus-visible:outline-offset-2"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className="h-full w-full object-contain"
        onLoad={(e) => {
          if (!onAspect) return
          const img = e.currentTarget
          const r = img.naturalWidth / img.naturalHeight
          if (r > 1.15) onAspect('landscape')
          else if (r < 0.85) onAspect('portrait')
          else onAspect('square')
        }}
      />
    </button>
  )
}

function DocumentCard(props: {
  config: DocCardConfig
  file: File | null
  onPick: (file: File | null) => void
  error?: string
  index: number
}) {
  const { config, file, onPick, error, index } = props
  const inputId = `doc-input-${config.id}`
  const isImage = file && file.type.startsWith('image/')
  const isDone = Boolean(file)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [aspect, setAspect] = useState<'portrait' | 'landscape' | 'square'>('landscape')
  const docNum = String(index + 1).padStart(2, '0')

  const previewBoxClass =
    aspect === 'portrait' ? 'h-64 sm:h-72'
    : aspect === 'square' ? 'h-52 sm:h-60'
    : 'h-40 sm:h-48'

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null
    if (f && f.size > 10 * 1024 * 1024) {
      toast.error('ไฟล์ขนาดเกิน 10MB กรุณาเลือกไฟล์ที่เล็กกว่า')
      e.target.value = ''
      return
    }
    onPick(f)
    e.target.value = ''
  }

  return (
    <div className={`cctv-doc-card ${isDone ? 'uploaded' : ''} ${error && !isDone ? '!border-[var(--destructive)]' : ''}`}>
      {/* Primary file input */}
      <input id={inputId} type="file" accept={config.accept} className="sr-only" onChange={handleChange} />

      {/* Card head */}
      <div className="flex items-start gap-3">
        <div
          className={`w-[42px] h-[42px] rounded-[10px] flex items-center justify-center flex-shrink-0 border ${
            isDone
              ? 'bg-[var(--success)] text-white border-[var(--success)]'
              : 'bg-[color-mix(in_oklch,var(--primary)_8%,transparent)] text-[var(--primary)] border-[color-mix(in_oklch,var(--primary)_22%,transparent)]'
          }`}
        >
          {isDone ? <Check className="h-5 w-5" aria-hidden="true" /> : <span aria-hidden="true">{config.icon}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="text-[14px] font-semibold text-[var(--foreground)] leading-snug">{config.title}</div>
            {config.requireCertify && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded tracking-[0.12em] uppercase font-mono bg-[color-mix(in_oklch,var(--primary)_8%,transparent)] text-[var(--primary)] border border-[color-mix(in_oklch,var(--primary)_22%,transparent)]">
                จำเป็น
              </span>
            )}
            {isDone && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--cctv-success-soft)] text-[var(--success)]">
                อัปโหลดแล้ว
              </span>
            )}
          </div>
          <div className="text-[12px] text-[var(--muted-foreground)] mt-0.5 leading-snug">
            {config.subtitle}
          </div>
        </div>
        <span
          className="text-[11px] font-mono text-[var(--muted-foreground)] tracking-[0.06em] shrink-0"
          aria-hidden="true"
        >
          {docNum}
        </span>
      </div>

      {/* Sign tag — compact pill, replaces verbose notice block */}
      {!isDone && (
        config.requireCertify ? (
          <div className="inline-flex items-start gap-2 text-[12.5px] text-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_6%,transparent)] border border-[color-mix(in_oklch,var(--primary)_22%,transparent)] px-3 py-2 rounded-lg leading-snug">
            <PenLine className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            <span>ต้องเซ็น <strong className="font-semibold">“สำเนาถูกต้อง”</strong> ก่อนแนบ</span>
          </div>
        ) : (
          <div className="inline-flex items-start gap-2 text-[12.5px] text-[var(--muted-foreground)] bg-[var(--muted)] border border-dashed border-[var(--border)] px-3 py-2 rounded-lg leading-snug">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden="true" />
            <span>ไม่ต้องเซ็นรับรอง</span>
          </div>
        )
      )}

      {/* Uploaded preview */}
      {isDone && file ? (
        isImage ? (
          <div className={`relative ${previewBoxClass} w-full bg-[var(--cctv-bg-muted,var(--muted))] rounded-md overflow-hidden`}>
            <DocPreviewImage file={file} alt={config.title} onOpen={setPreviewSrc} onAspect={setAspect} />
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/65 to-transparent px-2.5 py-2">
              <p className="text-[11px] font-medium text-white truncate max-w-[60%]">{file.name}</p>
              <div className="flex gap-1.5 shrink-0">
                <label htmlFor={`${inputId}-change`} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white/90 text-[var(--foreground)] shadow" aria-label="เปลี่ยนรูป" title="เปลี่ยนรูป">
                  <Pencil className="h-3 w-3" />
                </label>
                <input id={`${inputId}-change`} type="file" accept={config.accept} className="sr-only" onChange={handleChange} />
                <button type="button" onClick={() => onPick(null)} className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--destructive)] text-white shadow" aria-label="ลบรูป" title="ลบรูป">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 p-2.5 bg-[var(--card)] border border-[var(--border)] rounded-md text-xs">
            <div className="w-7 h-8 bg-gradient-to-br from-[#e8eef5] to-[#d0dae8] dark:from-[oklch(0.30_0.04_235)] dark:to-[oklch(0.24_0.04_235)] rounded-sm flex items-center justify-center font-bold text-[9px] text-[var(--primary)]">
              {file.type.split('/')[1]?.toUpperCase() || 'FILE'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{file.name}</div>
              <div className="text-[var(--muted-foreground)] text-[11px]">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </div>
            </div>
            <label htmlFor={`${inputId}-change2`} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md bg-[var(--cctv-bg-muted,var(--muted))] text-[var(--muted-foreground)]" aria-label="เปลี่ยนไฟล์" title="เปลี่ยนไฟล์">
              <Pencil className="h-3 w-3" />
            </label>
            <input id={`${inputId}-change2`} type="file" accept={config.accept} className="sr-only" onChange={handleChange} />
            <button type="button" onClick={() => onPick(null)} className="flex h-7 w-7 items-center justify-center rounded-md bg-[color-mix(in_oklch,var(--destructive)_10%,transparent)] text-[var(--destructive)]" aria-label="ลบไฟล์" title="ลบไฟล์">
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        )
      ) : (
        // Empty CTA
        <label
          htmlFor={inputId}
          className="w-full px-3 py-2.5 border-[1.5px] border-dashed border-[var(--cctv-border-strong,var(--border))] bg-[var(--cctv-bg-muted,var(--muted))] rounded-md flex items-center justify-center gap-2 text-xs font-semibold text-[var(--primary)] cursor-pointer hover:border-[var(--primary)] transition"
          style={{ touchAction: 'manipulation' }}
        >
          <UploadCloud className="h-3.5 w-3.5" aria-hidden="true" /> เลือกไฟล์ · PDF, JPG, PNG (ไม่เกิน 10&nbsp;MB)
        </label>
      )}

      {/* Image preview modal */}
      <Dialog open={!!previewSrc} onOpenChange={(open) => { if (!open) setPreviewSrc(null) }}>
        <DialogContent className="max-w-2xl p-2 sm:p-3" showCloseButton>
          <DialogTitle className="sr-only">{config.title}</DialogTitle>
          {previewSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewSrc} alt={config.title} className="w-full h-auto max-h-[80vh] object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* -------------------- GateScreen -------------------- */
const LINE_OA_ADD_FRIEND_URL = 'https://line.me/R/ti/p/@513dlddc'
const LINE_GREEN = '#06C755'

function GateScreen(props: {
  gateState: GateState
  profile: LiffUserProfile | null
  errorMessage: string
  liffUrl: string
  liff: LiffSDK | null
  onFriendDetected: () => void
  onRetryFriendship: () => void
}) {
  const { gateState, profile, errorMessage, liffUrl, liff, onFriendDetected, onRetryFriendship } = props
  const [isChecking, setIsChecking] = useState(false)

  useEffect(() => {
    if (gateState !== 'need-friend') return
    if (typeof window === 'undefined') return

    const AWAIT_KEY = 'lineoa-awaiting-friend'
    const isAwaiting = () => {
      try { return window.sessionStorage.getItem(AWAIT_KEY) === '1' } catch { return false }
    }
    const clearAwaiting = () => {
      try { window.sessionStorage.removeItem(AWAIT_KEY) } catch { /* no-op */ }
    }

    const hardNav = () => {
      clearAwaiting()
      const url = window.location.pathname + window.location.search + (window.location.search ? '&' : '?') + 'fr=' + Date.now()
      window.location.replace(url)
    }

    if (isAwaiting()) {
      hardNav()
      return
    }

    let cancelled = false

    const checkOnce = async () => {
      if (!liff) return
      try {
        const result = await Promise.race([
          liff.getFriendship(),
          new Promise<never>((_, reject) =>
            window.setTimeout(() => reject(new Error('timeout')), 2500)
          ),
        ])
        if (cancelled) return
        if (result.friendFlag) {
          setIsChecking(false)
          clearAwaiting()
          onFriendDetected()
        }
      } catch {
        /* swallow */
      }
    }

    const interval = window.setInterval(() => { void checkOnce() }, 2000)

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted || isAwaiting()) hardNav()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && isAwaiting()) hardNav()
    }
    const onFocus = () => { if (isAwaiting()) hardNav() }
    const onPointerDown = () => { if (isAwaiting()) hardNav() }

    window.addEventListener('pageshow', onPageShow)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onFocus)
    document.addEventListener('pointerdown', onPointerDown, true)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      window.removeEventListener('pageshow', onPageShow)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('pointerdown', onPointerDown, true)
    }
  }, [gateState, liff, onFriendDetected])

  const handleAddFriend = useCallback(() => {
    setIsChecking(true)
    try { window.sessionStorage.setItem('lineoa-awaiting-friend', '1') } catch { /* no-op */ }

    const inLineApp = (() => {
      try { return Boolean(liff?.isInClient && liff.isInClient()) } catch { return false }
    })()

    if (inLineApp && liff?.openWindow) {
      try {
        liff.openWindow({ url: LINE_OA_ADD_FRIEND_URL, external: false })
        return
      } catch { /* fall through */ }
    }
    window.location.href = LINE_OA_ADD_FRIEND_URL
  }, [liff])

  /* booting */
  if (gateState === 'booting') {
    return (
      <main className="cctv-line-hero min-h-dvh flex flex-col">
        <OfficialHeader />
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="flex flex-col items-center gap-4">
            <div className="relative flex h-14 w-14 items-center justify-center">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[color-mix(in_oklch,var(--primary)_25%,transparent)] opacity-50" />
              <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_oklch,var(--primary)_12%,transparent)]">
                <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" aria-hidden="true" />
              </span>
            </div>
            <div className="text-center space-y-1">
              <p className="text-base font-bold text-[var(--foreground)]">กำลังเตรียมระบบ…</p>
              <p className="text-xs text-[var(--muted-foreground)]">ตรวจสอบบัญชี LINE และสิทธิ์การใช้งาน</p>
            </div>
          </div>
        </div>
      </main>
    )
  }

  /* outside LINE app */
  if (gateState === 'outside-line') {
    return (
      <main className="cctv-line-hero min-h-dvh flex flex-col">
        <OfficialHeader />
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm cctv-card-elev p-7 text-center space-y-5">
            <div
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl shadow-md"
              style={{ background: LINE_GREEN, boxShadow: '0 8px 18px -6px rgba(6,199,85,0.45)' }}
            >
              <MessageCircle className="h-8 w-8 text-white" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--foreground)]">กรุณาเปิดผ่าน LINE</h1>
              <p className="text-sm leading-relaxed text-[var(--muted-foreground)] mt-2">
                ระบบยื่นคำร้องออนไลน์ต้องทำงานใน LINE เพื่อผูกคำร้องกับบัญชี LINE ของคุณ
                และรับการแจ้งเตือนผลการพิจารณาโดยอัตโนมัติ
              </p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--cctv-bg-muted,var(--muted))] p-3.5 text-left">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">วิธีเปิดใช้งาน</p>
              <ol className="space-y-1.5 text-sm text-[var(--foreground)]">
                <li className="flex gap-2"><span className="font-bold text-[var(--primary)]">1.</span>กดปุ่มด้านล่างเพื่อเปิดใน LINE</li>
                <li className="flex gap-2"><span className="font-bold text-[var(--primary)]">2.</span>ระบบจะนำคุณเข้าสู่แบบฟอร์มโดยอัตโนมัติ</li>
              </ol>
            </div>
            <button
              type="button"
              onClick={() => window.location.assign(liffUrl)}
              className="cctv-btn-line w-full h-13 rounded-xl py-3.5 px-4 text-base font-semibold inline-flex items-center justify-center gap-2"
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              เปิดผ่าน LINE
            </button>
          </div>
        </div>
      </main>
    )
  }

  /* error */
  if (gateState === 'error') {
    return (
      <main className="cctv-bg-dot min-h-dvh flex flex-col">
        <OfficialHeader />
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-sm cctv-card-elev p-7 text-center space-y-5">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[color-mix(in_oklch,var(--destructive)_10%,transparent)]">
              <AlertCircle className="h-8 w-8 text-[var(--destructive)]" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--foreground)]">เปิดระบบไม่ได้</h1>
              <p className="text-sm leading-relaxed text-[var(--muted-foreground)] mt-2">
                {errorMessage || 'เกิดข้อผิดพลาดในการตรวจสอบ LINE'}
              </p>
            </div>
            <div className="rounded-xl border border-[color-mix(in_oklch,var(--warning)_25%,transparent)] bg-[var(--cctv-warning-soft)] p-3.5 text-left text-sm text-[var(--foreground)]">
              ลองปิดและเปิดแอป LINE ใหม่ หรือตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง
            </div>
            <Button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full h-11 rounded-lg bg-[var(--primary)] hover:bg-[color-mix(in_oklch,var(--primary)_85%,black)] text-[var(--primary-foreground)] font-semibold"
            >
              ลองใหม่อีกครั้ง
            </Button>
          </div>
        </div>
      </main>
    )
  }

  /* need-friend */
  return (
    <main className="cctv-line-hero min-h-dvh flex flex-col">
      <OfficialHeader />
      <div className="flex-1 flex flex-col px-4 sm:px-6 pt-6 pb-8 sm:pt-10 max-w-md mx-auto w-full gap-5">
        {/* LINE OA preview card */}
        <div className="relative bg-[var(--card)] rounded-2xl p-4 sm:p-5 border-[1.5px] border-[var(--border)] shadow-[var(--cctv-shadow-card)] overflow-hidden">
          <div
            className="absolute top-0 left-4 right-4 h-[3px] rounded-b"
            style={{ background: LINE_GREEN }}
          />
          <div className="flex items-center gap-3">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center text-white"
              style={{
                background: `linear-gradient(135deg, ${LINE_GREEN}, #04A847)`,
                boxShadow: '0 8px 18px -6px rgba(6,199,85,0.45)',
              }}
            >
              <MessageCircle className="h-7 w-7" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[15px] font-bold" translate="no">เทศบาลนครหัวหิน CCTV</span>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-[var(--cctv-gold-soft)] text-[#7a5a14]">
                  <Star className="h-2 w-2 fill-current" aria-hidden="true" /> ทางการ
                </span>
              </div>
              <div className="text-[11px] text-[var(--muted-foreground)] mt-0.5">@huahin-cctv · LINE Official</div>
            </div>
          </div>
          <div className="text-[12px] text-[var(--muted-foreground)] leading-relaxed mt-3 pt-3 border-t border-dashed border-[var(--border)]">
            ช่องทางทางการสำหรับรับแจ้งสถานะคำร้อง ส่งไฟล์ภาพและวิดีโอจากกล้อง CCTV
            หลังเอกสารผ่านการอนุมัติ
          </div>
        </div>

        {/* Hero copy */}
        <div className="text-center px-1">
          <div
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full mb-3"
            style={{
              background: 'color-mix(in oklch, var(--primary) 10%, transparent)',
              color: 'var(--primary)',
            }}
          >
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            <span className="text-[11px] font-bold uppercase tracking-widest">
              ขั้นตอนที่ 1 จาก 4
            </span>
          </div>
          <h1 className="text-[1.35rem] sm:text-[1.5rem] font-bold leading-tight text-[var(--foreground)]">
            เพิ่มเพื่อน LINE OA<br />
            <span className="text-[var(--muted-foreground)] font-semibold">เพื่อเริ่มยื่นคำร้อง</span>
          </h1>
          <p className="text-sm text-[var(--muted-foreground)] leading-relaxed max-w-sm mx-auto mt-2">
            ระบบจะส่งวิดีโอภาพ CCTV ให้ท่านอัตโนมัติทาง LINE
            หลังเอกสารได้รับการอนุมัติ — โดยไม่ต้องพิมพ์ข้อความใด ๆ ในแชท
          </p>
          {profile && (
            <p className="text-xs text-[var(--muted-foreground)] mt-2">
              เข้าสู่ระบบในชื่อ <span className="font-semibold text-[var(--foreground)]">{profile.displayName}</span>
            </p>
          )}
        </div>

        {/* CTA */}
        <div className="mt-auto space-y-3">
          <button
            type="button"
            onClick={handleAddFriend}
            className="cctv-btn-line w-full h-13 rounded-xl py-3.5 text-base font-semibold inline-flex items-center justify-center gap-2"
          >
            <MessageCircle className="h-5 w-5" aria-hidden="true" />
            {isChecking ? 'กำลังเปิด LINE…' : 'เพิ่มเพื่อน LINE OA'}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          {isChecking ? (
            <p className="flex items-center justify-center gap-2 text-xs text-[var(--muted-foreground)]" role="status" aria-live="polite">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              กำลังรอการเพิ่มเพื่อน… กลับมาที่หน้านี้หลังกด “เพิ่มเพื่อน” ในแอป LINE
            </p>
          ) : (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-[var(--cctv-bg-muted,var(--muted))] text-xs text-[var(--muted-foreground)] leading-relaxed">
              <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>หลังเพิ่มเพื่อนแล้ว ระบบจะนำท่านกลับมาที่หน้ายื่นคำร้องโดยอัตโนมัติ</span>
            </div>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onRetryFriendship}
            className="w-full h-11 rounded-lg border-[1.5px] text-[var(--foreground)] font-medium"
          >
            ตรวจสอบอีกครั้ง
          </Button>
        </div>

        {/* Why we need this */}
        <details className="bg-[var(--card)] border border-[var(--border)] rounded-xl px-3.5 py-3 group">
          <summary className="text-[13px] font-semibold cursor-pointer list-none flex items-center justify-between">
            ทำไมต้องเพิ่มเพื่อน LINE OA?
            <ArrowRight className="h-3.5 w-3.5 group-open:rotate-90 transition-transform" aria-hidden="true" />
          </summary>
          <ul className="cctv-list mt-2">
            <li>เพื่อยืนยันตัวตนผู้ยื่น และผูกคำร้องกับบัญชี LINE โดยอัตโนมัติ</li>
            <li>เพื่อให้เจ้าหน้าที่ส่งไฟล์ภาพ/วิดีโอกลับให้ท่านได้ทันที</li>
            <li>เพื่อแจ้งสถานะคำร้องผ่านการแจ้งเตือน LINE</li>
          </ul>
        </details>
      </div>
    </main>
  )
}

/* -------------------- UploadProgressPanel -------------------- */
function UploadProgressPanel({
  progress,
  status,
}: {
  progress: UploadProgressMap
  status: string
}) {
  const items = Object.entries(progress)
  const totalPercent = items.length
    ? Math.round(items.reduce((sum, [, item]) => sum + item.percent, 0) / items.length)
    : 0

  if (!status && items.length === 0) return null

  return (
    <div className="cctv-card p-4" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-[var(--foreground)]">{status || 'กำลังอัปโหลดเอกสาร'}</p>
        {items.length > 0 && <span className="text-sm font-bold text-[var(--primary)] cctv-tabular">{totalPercent}%</span>}
      </div>
      {items.length > 0 && (
        <div className="mt-3 space-y-3">
          <Progress value={totalPercent} />
          <div className="space-y-2">
            {items.map(([key, item]) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-medium text-[var(--foreground)]">{item.label}</span>
                  <span className={item.status === 'error' ? 'text-[var(--destructive)]' : 'text-[var(--muted-foreground)]'}>
                    {item.percent}%
                  </span>
                </div>
                <Progress value={item.percent} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* -------------------- SuccessState -------------------- */
function SuccessState(props: {
  attachmentIssue: boolean
  uploadActive: boolean
  onClose: () => void
}) {
  const { attachmentIssue, uploadActive, onClose } = props
  const t = useTranslations('RequestPage.success')
  return (
    <main className="cctv-bg-dot min-h-screen">
      <OfficialHeader />
      <div className="mx-auto max-w-md px-4 pt-10 pb-10">
        <div className="cctv-card-elev p-7 text-center space-y-5">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[var(--cctv-success-soft)] text-[var(--success)]">
            <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[var(--foreground)]">{t('title')}</h1>
            <p className="text-sm text-[var(--muted-foreground)] mt-2 leading-relaxed">{t('message')}</p>
          </div>
          <div className="rounded-xl border border-[color-mix(in_oklch,var(--primary)_20%,transparent)] bg-[color-mix(in_oklch,var(--primary)_4%,transparent)] p-4 text-left text-sm">
            <ul className="cctv-list">
              <li>{t('bullet1')}</li>
              <li>{t('bullet2')}</li>
              <li>{t('bullet3')}</li>
            </ul>
          </div>
          {attachmentIssue && (
            <div className="cctv-notice-warn">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--warning)]" aria-hidden="true" />
              <span>{t('attachmentWarning')}</span>
            </div>
          )}
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/request/status" className="flex-1">
              <Button type="button" variant="outline" className="w-full border-[1.5px] h-11">{t('checkStatus')}</Button>
            </Link>
            <Button
              type="button"
              className="flex-1 h-11 bg-[var(--primary)] hover:bg-[color-mix(in_oklch,var(--primary)_85%,black)] text-[var(--primary-foreground)] font-semibold"
              onClick={onClose}
              disabled={uploadActive}
            >
              {t('close')}
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}

/* -------------------- LIFF helpers -------------------- */
async function ensureLiffSdk(): Promise<LiffSDK | null> {
  if (typeof window === 'undefined') return null
  if (window.liff) return window.liff
  await new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://static.line-scdn.net/liff/edge/2/sdk.js'
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('โหลด LINE LIFF SDK ไม่สำเร็จ'))
    document.head.appendChild(script)
  })
  return window.liff ?? null
}

function getRequestRedirectUri() {
  const configuredBase = process.env.NEXT_PUBLIC_BASE_URL?.trim()
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : ''
  const rawBase = configuredBase || currentOrigin
  if (!rawBase) return ''

  try {
    const url = new URL(rawBase, currentOrigin || undefined)
    url.search = ''
    url.hash = ''

    const pathname = url.pathname.replace(/\/+$/, '')
    if (!pathname || pathname === '/') {
      url.pathname = '/request'
    } else if (pathname.endsWith('/request')) {
      url.pathname = pathname
    } else {
      url.pathname = `${pathname}/request`
    }

    return url.toString()
  } catch {
    const normalizedBase = rawBase.replace(/\/+$/, '')
    return normalizedBase.endsWith('/request') ? normalizedBase : `${normalizedBase}/request`
  }
}

const MAX_IMAGE_EDGE = 1600
const IMAGE_UPLOAD_QUALITY = 0.82
const UPLOAD_RETRY_ATTEMPTS = 3

function isCompressibleImage(file: File) {
  return file.type.startsWith('image/') && !/heic|heif/i.test(file.type) && !/\.(heic|heif)$/i.test(file.name)
}

function replaceFileExtension(fileName: string, ext: string) {
  const dot = fileName.lastIndexOf('.')
  return `${dot > 0 ? fileName.slice(0, dot) : fileName}${ext}`
}

async function loadImageForCanvas(file: File): Promise<HTMLImageElement | ImageBitmap> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file)
    } catch {
      /* fall back */
    }
  }

  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('ไม่สามารถอ่านรูปภาพเพื่อบีบอัดได้')) }
    img.src = url
  })
}

async function compressImageForUpload(file: File): Promise<File> {
  if (!isCompressibleImage(file)) return file

  try {
    const source = await loadImageForCanvas(file)
    const sourceWidth = 'naturalWidth' in source ? source.naturalWidth : source.width
    const sourceHeight = 'naturalHeight' in source ? source.naturalHeight : source.height
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(sourceWidth, sourceHeight))

    if (scale === 1 && file.size <= 1.5 * 1024 * 1024) {
      if ('close' in source) source.close()
      return file
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(sourceWidth * scale))
    canvas.height = Math.max(1, Math.round(sourceHeight * scale))

    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) {
      if ('close' in source) source.close()
      return file
    }

    ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
    if ('close' in source) source.close()

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', IMAGE_UPLOAD_QUALITY)
    })
    if (!blob || blob.size >= file.size) return file

    return new File([blob], replaceFileExtension(file.name, '.jpg'), {
      type: 'image/jpeg',
      lastModified: file.lastModified,
    })
  } catch (error) {
    console.warn('Image compression skipped:', error)
    return file
  }
}

async function prepareUploadItems(
  items: Array<{ key: string; label: string; file: File; category: UploadKind }>,
  onProgress?: (progress: UploadProgressMap) => void,
) {
  const progress: UploadProgressMap = Object.fromEntries(
    items.map((item) => [
      item.key,
      { label: item.label, loaded: 0, total: item.file.size, percent: 0, status: 'compressing' as const },
    ]),
  )
  onProgress?.({ ...progress })

  const prepared = await Promise.all(items.map(async (item) => {
    const file = await compressImageForUpload(item.file)
    progress[item.key] = { ...progress[item.key], total: file.size, status: 'pending' }
    onProgress?.({ ...progress })
    return { ...item, file }
  }))

  return prepared
}

async function uploadAttachments(
  reportId: number,
  trackingToken: string,
  items: Array<{ key: string; label: string; file: File; category: UploadKind }>,
  onProgress?: (progress: UploadProgressMap) => void,
) {
  const formData = new FormData()
  for (const item of items) {
    formData.append('files', item.file)
    formData.append('categories', item.category)
  }
  formData.append('tracking_token', trackingToken)

  const totals = items.map((item) => item.file.size)
  const totalBytes = totals.reduce((sum, size) => sum + size, 0)
  const baseProgress: UploadProgressMap = Object.fromEntries(
    items.map((item) => [
      item.key,
      { label: item.label, loaded: 0, total: item.file.size, percent: 0, status: 'uploading' as const },
    ]),
  )

  return await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `/api/reports/${reportId}/attachments`)

    xhr.upload.onprogress = (event) => {
      const loaded = event.lengthComputable ? event.loaded : 0
      let remaining = Math.min(loaded, totalBytes)
      const nextProgress: UploadProgressMap = {}

      items.forEach((item, index) => {
        const itemTotal = totals[index]
        const itemLoaded = Math.max(0, Math.min(itemTotal, remaining))
        remaining -= itemLoaded
        nextProgress[item.key] = {
          ...baseProgress[item.key],
          loaded: itemLoaded,
          percent: itemTotal > 0 ? Math.round((itemLoaded / itemTotal) * 100) : 100,
          status: itemLoaded >= itemTotal ? 'done' : 'uploading',
        }
      })

      onProgress?.(nextProgress)
    }

    xhr.onload = () => {
      let json: { success?: boolean; message?: string } | null = null
      try { json = JSON.parse(xhr.responseText) } catch { json = null }

      if (xhr.status >= 200 && xhr.status < 300 && json?.success) {
        onProgress?.(Object.fromEntries(
          items.map((item) => [
            item.key,
            { ...baseProgress[item.key], loaded: item.file.size, percent: 100, status: 'done' as const },
          ]),
        ))
        resolve()
        return
      }

      reject(new Error(json?.message || 'อัปโหลดเอกสารไม่สำเร็จ'))
    }
    xhr.onerror = () => reject(new Error('เครือข่ายขัดข้องระหว่างอัปโหลดเอกสาร'))
    xhr.send(formData)
  })
}

async function uploadAttachmentsWithRetry(
  reportId: number,
  trackingToken: string,
  items: Array<{ key: string; label: string; file: File; category: UploadKind }>,
  onProgress?: (progress: UploadProgressMap) => void,
) {
  const preparedItems = await prepareUploadItems(items, onProgress)
  let lastError: unknown

  for (let attempt = 1; attempt <= UPLOAD_RETRY_ATTEMPTS; attempt++) {
    try {
      await uploadAttachments(reportId, trackingToken, preparedItems, onProgress)
      return
    } catch (error) {
      lastError = error
      if (attempt < UPLOAD_RETRY_ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 800))
      }
    }
  }

  onProgress?.(Object.fromEntries(
    preparedItems.map((item) => [
      item.key,
      { label: item.label, loaded: 0, total: item.file.size, percent: 0, status: 'error' as const },
    ]),
  ))
  throw lastError instanceof Error ? lastError : new Error('อัปโหลดเอกสารไม่สำเร็จ')
}

/* -------------------- Step 1: Applicant -------------------- */
function StepApplicant(props: {
  register: ReturnType<typeof useForm<FormData>>['register']
  setValue: ReturnType<typeof useForm<FormData>>['setValue']
  watch: ReturnType<typeof useForm<FormData>>['watch']
  errors: ReturnType<typeof useForm<FormData>>['formState']['errors']
  t: ReturnType<typeof useTranslations>
  locale: string
}) {
  const { register, setValue, watch, errors, t, locale } = props
  const [provinceSel, setProvinceSel] = useState<ComboItem | null>(null)
  const [districtSel, setDistrictSel] = useState<ComboItem | null>(null)
  const [subdistrictSel, setSubdistrictSel] = useState<ComboItem | null>(null)

  const fetchProvinces = useCallback(async (q: string): Promise<ComboItem[]> => {
    const url = q ? `/api/geo/provinces?limit=100&lang=${locale}&q=${encodeURIComponent(q)}` : `/api/geo/provinces?limit=100&lang=${locale}`
    const res = await fetch(url); const json = await res.json()
    if (!json?.success) return []
    return json.items.map((p: { id: number; name: string }) => ({ id: p.id, name: p.name }))
  }, [locale])

  const fetchDistricts = useCallback(async (q: string): Promise<ComboItem[]> => {
    if (!provinceSel?.id) return []
    const base = `/api/geo/districts?provinceId=${provinceSel.id}&limit=50&lang=${locale}`
    const url = q ? `${base}&q=${encodeURIComponent(q)}` : base
    const res = await fetch(url); const json = await res.json()
    if (!json?.success) return []
    return json.items.map((d: { id: number; name: string }) => ({ id: d.id, name: d.name }))
  }, [locale, provinceSel?.id])

  const fetchSubdistricts = useCallback(async (q: string): Promise<ComboItem[]> => {
    if (!districtSel?.id) return []
    const base = `/api/geo/subdistricts?districtId=${districtSel.id}&limit=100&lang=${locale}`
    const url = q ? `${base}&q=${encodeURIComponent(q)}` : base
    const res = await fetch(url); const json = await res.json()
    if (!json?.success) return []
    return json.items.map((s: { id: number; name: string; zip_code: string }) => ({ id: s.id, name: s.name, extra: { zip: s.zip_code } }))
  }, [locale, districtSel?.id])

  return (
    <div className="space-y-5">
      {/* Personal info card */}
      <div className="cctv-card">
        <div className="cctv-card-head">
          <span className="cctv-num">1</span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[var(--foreground)]">{t('applicant.title')}</div>
            <div className="text-xs text-[var(--muted-foreground)]">{t('applicant.description')}</div>
          </div>
        </div>
        <div className="cctv-card-body grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[13px] font-semibold">
              {t('applicant.prefix.label')} <span className="text-[var(--destructive)]">*</span>
            </Label>
            <Select value={watch('prefix')} onValueChange={(v) => setValue('prefix', v as FormData['prefix'], { shouldValidate: true })}>
              <SelectTrigger aria-invalid={!!errors.prefix} className="h-11 text-[15px] border-[1.5px]">
                <SelectValue placeholder={t('applicant.prefix.placeholder')} />
              </SelectTrigger>
              <SelectContent>
                {PREFIXES_KEYS.map(p => <SelectItem key={p} value={p}>{t(`applicant.prefix.options.${p}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <FieldError message={errors.prefix?.message} />
          </div>

          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="full_name" className="text-[13px] font-semibold">
              {t('applicant.fullName.label')} <span className="text-[var(--destructive)]">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
              <Input
                id="full_name"
                autoComplete="name"
                aria-invalid={!!errors.full_name}
                {...register('full_name')}
                className="pl-9 h-11 text-[15px] border-[1.5px] focus-visible:border-[var(--primary)] focus-visible:ring-4 focus-visible:ring-[color-mix(in_oklch,var(--primary)_25%,transparent)]"
                placeholder={t('placeholders.fullName')}
              />
            </div>
            <FieldError message={errors.full_name?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="age" className="text-[13px] font-semibold">
              {t('applicant.age.label')} <span className="text-[var(--destructive)]">*</span>
            </Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
              <Input
                id="age"
                type="number"
                min="1"
                max="120"
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={!!errors.age}
                {...register('age')}
                className="pl-9 h-11 text-[15px] border-[1.5px]"
                placeholder={t('placeholders.age')}
              />
            </div>
            <FieldError message={errors.age?.message} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone_number" className="text-[13px] font-semibold">
              {t('applicant.phone.label')} <span className="text-[var(--destructive)]">*</span>
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
              <Input
                id="phone_number"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                aria-invalid={!!errors.phone_number}
                {...register('phone_number')}
                className="pl-9 h-11 text-[15px] border-[1.5px]"
                placeholder={t('placeholders.phone')}
              />
            </div>
            <FieldError message={errors.phone_number?.message} />
          </div>

          <div className="space-y-1.5 sm:col-span-1 lg:col-span-2">
            <Label htmlFor="id_or_passport_number" className="text-[13px] font-semibold">
              {t('applicant.id.label')} <span className="text-[var(--destructive)]">*</span>
            </Label>
            <div className="relative">
              <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
              <Input
                id="id_or_passport_number"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={!!errors.id_or_passport_number}
                {...register('id_or_passport_number')}
                className="pl-9 h-11 text-[15px] border-[1.5px]"
                placeholder={t('placeholders.id')}
              />
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">ใช้สำหรับยืนยันตัวตนเท่านั้น</p>
            <FieldError message={errors.id_or_passport_number?.message} />
          </div>
        </div>
      </div>

      {/* Address card */}
      <div className="cctv-card">
        <div className="cctv-card-head">
          <span className="cctv-num" aria-hidden="true"><Home className="h-3.5 w-3.5" /></span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[var(--foreground)]">{t('address.title')}</div>
            <div className="text-xs text-[var(--muted-foreground)]">{t('address.description')}</div>
          </div>
        </div>
        <div className="cctv-card-body space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="house_number" className="text-[13px] font-semibold">{t('address.houseNumber.label')}</Label>
              <Input id="house_number" autoComplete="address-line1" {...register('house_number')} className="h-11 text-[15px] border-[1.5px]" placeholder={t('placeholders.houseNumber')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="village_number" className="text-[13px] font-semibold">{t('address.villageNumber.label')}</Label>
              <Input id="village_number" autoComplete="off" {...register('village_number')} className="h-11 text-[15px] border-[1.5px]" placeholder={t('placeholders.villageNumber')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alley" className="text-[13px] font-semibold">{t('address.alley.label')}</Label>
              <Input id="alley" autoComplete="address-line2" {...register('alley')} className="h-11 text-[15px] border-[1.5px]" placeholder={t('placeholders.alley')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="road" className="text-[13px] font-semibold">{t('address.road.label')}</Label>
              <Input id="road" autoComplete="address-line3" {...register('road')} className="h-11 text-[15px] border-[1.5px]" placeholder={t('placeholders.road')} />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <AsyncCombobox
              label={`${t('address.province.label')} *`}
              selected={provinceSel}
              fetcher={fetchProvinces}
              disabledHint={t('address.provincePlaceholder')}
              onSelect={(item) => {
                if (item.id === -1) {
                  setProvinceSel(null); setValue('province', '', { shouldValidate: true })
                  setDistrictSel(null); setSubdistrictSel(null)
                  setValue('district', '', { shouldValidate: true })
                  setValue('sub_district', '', { shouldValidate: true })
                  setValue('postal_code', '', { shouldValidate: true })
                  return
                }
                setProvinceSel(item); setValue('province', item.name, { shouldValidate: true })
                setDistrictSel(null); setSubdistrictSel(null)
                setValue('district', '', { shouldValidate: true })
                setValue('sub_district', '', { shouldValidate: true })
                setValue('postal_code', '', { shouldValidate: true })
              }}
              error={errors.province?.message as string | undefined}
              t={t}
            />
            <AsyncCombobox
              label={`${t('address.district.label')} *`}
              selected={districtSel}
              fetcher={fetchDistricts}
              disabled={!provinceSel}
              disabledHint={!provinceSel ? t('address.districtPlaceholder') : undefined}
              onSelect={(item) => {
                if (item.id === -1) {
                  setDistrictSel(null); setValue('district', '', { shouldValidate: true })
                  setSubdistrictSel(null)
                  setValue('sub_district', '', { shouldValidate: true })
                  setValue('postal_code', '', { shouldValidate: true })
                  return
                }
                setDistrictSel(item); setValue('district', item.name, { shouldValidate: true })
                setSubdistrictSel(null)
                setValue('sub_district', '', { shouldValidate: true })
                setValue('postal_code', '', { shouldValidate: true })
              }}
              error={errors.district?.message as string | undefined}
              t={t}
            />
            <AsyncCombobox
              label={`${t('address.subdistrict.label')} *`}
              selected={subdistrictSel}
              fetcher={fetchSubdistricts}
              disabled={!districtSel}
              disabledHint={!districtSel ? t('address.districtPlaceholder') : undefined}
              onSelect={(item) => {
                if (item.id === -1) {
                  setSubdistrictSel(null)
                  setValue('sub_district', '', { shouldValidate: true })
                  setValue('postal_code', '', { shouldValidate: true })
                  return
                }
                setSubdistrictSel(item)
                setValue('sub_district', item.name, { shouldValidate: true })
                const zip = item.extra?.zip ? String(item.extra.zip) : ''
                if (zip) setValue('postal_code', zip, { shouldValidate: true })
              }}
              error={errors.sub_district?.message as string | undefined}
              t={t}
            />
            <div className="space-y-1.5">
              <Label htmlFor="postal_code" className="text-[13px] font-semibold">
                {t('address.postalCode.label')} <span className="text-[var(--destructive)]">*</span>
              </Label>
              <Input
                id="postal_code"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="postal-code"
                spellCheck={false}
                aria-invalid={!!errors.postal_code}
                {...register('postal_code')}
                className="h-11 text-[15px] border-[1.5px]"
                placeholder={t('placeholders.postalCode')}
              />
              <FieldError message={errors.postal_code?.message} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------- Sign-sample preview modal --------------------
 * Modal สอนวิธีเซ็น "สำเนาถูกต้อง" — เปิดจากปุ่ม "ดูตัวอย่าง" บน notice banner ของ Step 2
 * Layout: ซ้าย = 4 ขั้นตอน + คำเตือน, ขวา = เอกสาร mockup พร้อมตราประทับ
 */
const SIGN_STEPS = [
  { n: '01', title: 'เขียนข้อความ “สำเนาถูกต้อง”', desc: 'บนสำเนาทุกแผ่น' },
  { n: '02', title: 'เซ็นชื่อกำกับ', desc: 'ใช้ลายเซ็นเดียวกับในบัตรประชาชน' },
  { n: '03', title: 'ถ่าย / สแกนให้ชัดทั้งใบ', desc: 'ลายเซ็นและข้อความต้องอ่านออก' },
  { n: '04', title: 'ระบุวัตถุประสงค์', desc: 'เช่น “ใช้เพื่อขอภาพกล้องวงจรปิด — เท่านั้น”' },
] as const

// Hoist static literals — ตาม `rendering-hoist-jsx` / pattern เดียวกับ PDPAConsentModal ในไฟล์นี้
const DOC_MOCKUP_LINE_WIDTHS = [78, 92, 64, 85, 48, 72] as const
const DOC_MOCKUP_LINE_BG = 'linear-gradient(90deg, #dde6f1, #e8eef7)'

const NOTICE_BANNER_STYLE: React.CSSProperties = {
  background: 'linear-gradient(180deg, var(--primary) 0%, color-mix(in oklch, var(--primary) 70%, #000) 100%)',
  boxShadow: '0 12px 30px -18px color-mix(in oklch, var(--primary) 45%, transparent)',
}
const NOTICE_BANNER_GLOW_STYLE: React.CSSProperties = {
  right: '-40px', top: '-40px', width: '200px', height: '200px',
  background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
}
const NOTICE_BANNER_ICON_STYLE: React.CSSProperties = {
  background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.18)',
}

const MOCKUP_PANEL_BG_STYLE: React.CSSProperties = {
  background: 'linear-gradient(180deg, #f4f8fd 0%, #e9f1fc 100%)',
}
const MOCKUP_PAPER_STYLE: React.CSSProperties = {
  aspectRatio: '1 / 1.3',
  transform: 'rotate(-1.2deg)',
  boxShadow: '0 1px 0 #fff inset, 0 18px 30px -22px rgba(0,35,102,.25), 0 4px 8px -6px rgba(0,35,102,.12)',
}
const MOCKUP_PAPER_INNER_BORDER_STYLE: React.CSSProperties = {
  inset: '8px', border: '1px dashed var(--border)',
}
const MOCKUP_STAMP_WRAP_STYLE: React.CSSProperties = { transform: 'rotate(-5deg)' }
const MOCKUP_STAMP_LABEL_STYLE: React.CSSProperties = { background: 'rgba(255,255,255,0.5)' }

function SignSampleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden border-0 max-w-[920px] w-[calc(100%-1.5rem)] sm:w-full max-h-[90dvh] flex flex-col"
        showCloseButton={false}
      >
        {/* Head */}
        <div className="flex items-start gap-4 border-b border-[var(--border)] px-6 py-5 sm:px-7">
          <div className="flex-1 min-w-0">
            <span className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--primary)] font-mono">
              <span className="block h-px w-5 bg-[var(--primary)]" aria-hidden="true" />
              ก่อนแนบเอกสาร
            </span>
            <DialogTitle className="mt-2 text-[20px] sm:text-[24px] font-semibold leading-[1.25] tracking-[-0.01em] text-[var(--foreground)]">
              เซ็น <em className="not-italic text-[var(--primary)]">“สำเนาถูกต้อง”</em> ทุกแผ่นก่อนอัปโหลด
            </DialogTitle>
            <p className="mt-1 text-[14px] text-[var(--muted-foreground)] leading-relaxed">
              ไฟล์ที่ไม่ลงนามรับรอง จะถูกตีกลับโดยอัตโนมัติ
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="ml-auto flex-none h-9 w-9 rounded-[10px] grid place-items-center bg-[var(--muted)] border border-[var(--border)] text-[var(--foreground)] hover:bg-[color-mix(in_oklch,var(--primary)_8%,var(--muted))] hover:border-[color-mix(in_oklch,var(--primary)_22%,transparent)] transition"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="grid grid-cols-1 sm:grid-cols-2 overflow-auto">
          {/* Left: Steps */}
          <div className="px-6 py-6 sm:px-7 border-b sm:border-b-0 sm:border-r border-[var(--border)]">
            <div className="flex items-start gap-2.5 rounded-[10px] border border-[#fde0a4] bg-[#fff7e6] px-3.5 py-3 text-[13px] leading-relaxed text-[#7a4c00] mb-5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-[var(--warning)]" aria-hidden="true" />
              <span>
                ปฏิบัติตามทั้ง <strong className="font-semibold">4 ขั้นตอน</strong> ก่อนแนบไฟล์ — มิเช่นนั้นเจ้าหน้าที่จะไม่รับพิจารณา
              </span>
            </div>
            <ol className="m-0 p-0 list-none flex flex-col gap-[18px]">
              {SIGN_STEPS.map((s) => (
                <li key={s.n} className="grid grid-cols-[34px_1fr] gap-3.5 items-start">
                  <span
                    className="w-[34px] h-[34px] rounded-full grid place-items-center font-mono text-[12px] font-medium text-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_8%,transparent)] border border-[color-mix(in_oklch,var(--primary)_22%,transparent)]"
                    aria-hidden="true"
                  >
                    {s.n}
                  </span>
                  <span className="block">
                    <strong className="block font-semibold text-[15px] leading-[1.35] text-[var(--foreground)]">{s.title}</strong>
                    <span className="block mt-0.5 text-[13.5px] text-[var(--muted-foreground)] leading-[1.5]">{s.desc}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>

          {/* Right: Visual mockup */}
          <div
            className="px-6 py-6 sm:px-7 flex flex-col items-center justify-center gap-3.5 min-h-[300px] sm:min-h-[380px] relative"
            style={MOCKUP_PANEL_BG_STYLE}
            aria-hidden="true"
          >
            <span className="inline-flex items-center gap-2.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--muted-foreground)] before:content-[''] before:block before:h-px before:w-5 before:bg-[var(--border)] after:content-[''] after:block after:h-px after:w-5 after:bg-[var(--border)]">
              ตัวอย่างการลงนาม
            </span>

            <div
              className="w-full max-w-[260px] bg-[#fffefa] border border-[var(--border)] rounded-md p-5 relative"
              style={MOCKUP_PAPER_STYLE}
            >
              <span
                className="absolute pointer-events-none rounded-[3px]"
                style={MOCKUP_PAPER_INNER_BORDER_STYLE}
              />
              <div className="font-mono text-[9.5px] tracking-[0.18em] text-[var(--muted-foreground)] uppercase">
                เอกสารตัวอย่าง
              </div>
              <div className="mt-3.5 flex flex-col gap-1.5">
                {DOC_MOCKUP_LINE_WIDTHS.map((w, i) => (
                  <i
                    key={i}
                    className="block h-[5px] rounded-[2px]"
                    style={{ width: `${w}%`, background: DOC_MOCKUP_LINE_BG }}
                  />
                ))}
              </div>
              <div className="absolute right-[18px] bottom-[22px]" style={MOCKUP_STAMP_WRAP_STYLE}>
                <span
                  className="block text-[13px] font-semibold text-[var(--primary)] tracking-[0.02em] px-2 py-0.5 rounded-[3px] border-[1.5px] border-[var(--primary)]"
                  style={MOCKUP_STAMP_LABEL_STYLE}
                >
                  สำเนาถูกต้อง
                </span>
                <svg width="110" height="30" viewBox="0 0 120 34" fill="none" className="block mt-1 text-[var(--primary)]">
                  <path d="M3 22 C 12 6, 22 30, 32 14 S 56 4, 70 22 S 100 28, 117 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none" />
                  <path d="M40 28 L 92 28" stroke="currentColor" strokeWidth="0.6" strokeLinecap="round" opacity="0.4" />
                </svg>
                <div className="text-center mt-0.5 text-[10px] text-[var(--muted-foreground)]">(ลายเซ็น)</div>
              </div>
            </div>

            <p className="text-center text-[13px] text-[var(--muted-foreground)] leading-[1.5] max-w-[260px]">
              ใช้ปากกาสีน้ำเงินหรือดำ — เขียน
              <strong className="text-[var(--primary)] font-semibold">“สำเนาถูกต้อง”</strong>
              กำกับด้วยลายเซ็นในที่ว่างของเอกสาร
            </p>
          </div>
        </div>

        {/* Foot */}
        <div className="flex items-center gap-3 border-t border-[var(--border)] bg-[var(--card)] px-6 py-3.5 sm:px-7">
          <span className="flex-1" />
          <Button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-[10px] text-[14px] font-semibold bg-[var(--primary)] text-[var(--primary-foreground)] hover:bg-[var(--primary)]/90"
          >
            เริ่มอัปโหลด
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* -------------------- Step 2: Documents -------------------- */
const DOC_CARDS: DocCardConfig[] = [
  {
    id: 'police',
    title: 'สำเนาบันทึกประจำวัน',
    subtitle: 'ต้องเซ็น “สำเนาถูกต้อง” · PDF/รูปภาพ · ไม่เกิน 10MB',
    accept: '.pdf,image/*',
    icon: <BookOpen className="h-5 w-5" />,
    previewType: 'any',
    requireCertify: true,
  },
  {
    id: 'idcard',
    title: 'สำเนาบัตรประชาชน',
    subtitle: 'ต้องเซ็น “สำเนาถูกต้อง” · PDF/รูปภาพ · ไม่เกิน 10MB',
    accept: '.pdf,image/*',
    icon: <FileBadge2 className="h-5 w-5" />,
    previewType: 'any',
    requireCertify: true,
  },
  {
    id: 'selfie',
    title: 'รูปถ่ายใบหน้ายืนยันตัวตน',
    subtitle: 'ถ่ายหน้าตรง เห็นชัดเจน · รูปภาพเท่านั้น',
    accept: 'image/*',
    icon: <ScanFace className="h-5 w-5" />,
    previewType: 'image',
  },
]

function StepDocuments(props: {
  policeReportFile: File | null
  setPoliceReportFile: (f: File | null) => void
  idCardFile: File | null
  setIdCardFile: (f: File | null) => void
  selfieFile: File | null
  setSelfieFile: (f: File | null) => void
  docsError: string
  scrollAnchorRef?: React.RefObject<HTMLDivElement | null>
}) {
  const { policeReportFile, setPoliceReportFile, idCardFile, setIdCardFile, selfieFile, setSelfieFile, docsError, scrollAnchorRef } = props

  const files = [policeReportFile, idCardFile, selfieFile]
  const handlers = [setPoliceReportFile, setIdCardFile, setSelfieFile]
  const doneCount = files.filter(Boolean).length
  const allDone = doneCount === 3

  const [previewOpen, setPreviewOpen] = useState(false)

  return (
    <div className="space-y-5">
      <div ref={scrollAnchorRef} />

      <div className="cctv-card">
        {/* Step header — number + title + pip progress */}
        <div className="flex items-end justify-between gap-4 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3.5 min-w-0">
            <span className="w-11 h-11 rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] grid place-items-center font-mono text-[18px] font-semibold shrink-0">
              2
            </span>
            <div className="min-w-0">
              <h2 className="m-0 text-[18px] sm:text-[22px] font-semibold leading-tight tracking-[-0.005em] text-[var(--foreground)]">
                เอกสารประกอบคำร้อง
              </h2>
              <span className="block mt-1 text-[13px] text-[var(--muted-foreground)]">
                อัปโหลดรูปภาพหรือไฟล์ PDF ของเอกสารทั้ง 3 รายการด้านล่าง
              </span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2.5 font-mono text-[13px] text-[var(--muted-foreground)] shrink-0">
            <div className="flex gap-1.5">
              {files.map((f, i) => (
                <span
                  key={i}
                  className={[
                    'block w-2.5 h-2.5 rounded-full border-[1.5px] border-[var(--primary)]',
                    f ? 'bg-[var(--primary)]' : 'bg-transparent',
                  ].join(' ')}
                />
              ))}
            </div>
            <span>{doneCount} / 3</span>
          </div>
        </div>

        <div className="cctv-card-body space-y-5">
          {/* Notice banner — navy gradient + ดูตัวอย่าง CTA */}
          <div
            className="relative overflow-hidden rounded-2xl text-white flex flex-col sm:flex-row sm:items-center gap-4 px-6 py-5 sm:px-7"
            style={NOTICE_BANNER_STYLE}
          >
            <span
              className="absolute pointer-events-none rounded-full"
              style={NOTICE_BANNER_GLOW_STYLE}
              aria-hidden="true"
            />
            <div
              className="w-12 h-12 shrink-0 rounded-xl grid place-items-center"
              style={NOTICE_BANNER_ICON_STYLE}
              aria-hidden="true"
            >
              <PenLine className="h-6 w-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[16px] sm:text-[17px] font-semibold leading-[1.35]">
                เซ็น “สำเนาถูกต้อง” ทุกแผ่นก่อนอัปโหลด
              </div>
              <div className="mt-1 text-[13px] sm:text-[13.5px] leading-[1.45] opacity-80">
                ไฟล์ที่ไม่ลงนามรับรอง จะถูกลบและคำร้องจะไม่ถูกพิจารณา
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="shrink-0 inline-flex items-center gap-2 rounded-[10px] px-4 py-2.5 text-[14px] font-semibold bg-white text-[var(--primary)] hover:-translate-y-px transition will-change-transform"
            >
              ดูตัวอย่าง
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>

          {/* Divider — รายการเอกสาร + count */}
          <div className="flex items-center gap-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted-foreground)] shrink-0">
              รายการเอกสาร
            </span>
            <span className="flex-1 h-px bg-[var(--border)]" aria-hidden="true" />
            <span className="font-mono text-[12px] text-[var(--muted-foreground)] shrink-0">
              <strong className={['font-semibold', allDone ? 'text-[var(--success)]' : 'text-[var(--primary)]'].join(' ')}>
                {doneCount}
              </strong>
              {' '}/ 3 อัปโหลดแล้ว
            </span>
          </div>

          {allDone && (
            <div className="cctv-status cctv-status-success px-3 py-2 text-sm w-full justify-start">
              <span className="dot" />
              เอกสารครบแล้ว — กด <strong className="mx-1">ถัดไป</strong> เพื่อดำเนินการต่อ
            </div>
          )}

          {/* Doc cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {DOC_CARDS.map((cfg, i) => (
              <DocumentCard
                key={cfg.id}
                config={cfg}
                file={files[i]}
                onPick={handlers[i]}
                index={i}
                error={!files[i] && docsError
                  ? i === 0 ? 'ยังไม่ได้แนบสำเนาบันทึกประจำวัน'
                  : i === 1 ? 'ยังไม่ได้แนบสำเนาบัตรประชาชน'
                  : 'ยังไม่ได้แนบรูปถ่ายใบหน้า'
                  : undefined
                }
              />
            ))}
          </div>

          {docsError && !allDone && (
            <div
              className="flex items-center gap-2 rounded-lg px-3.5 py-3 border"
              style={{
                background: 'color-mix(in oklch, var(--destructive) 8%, transparent)',
                borderColor: 'color-mix(in oklch, var(--destructive) 35%, transparent)',
                color: 'var(--destructive)',
              }}
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <p className="text-sm">{docsError}</p>
            </div>
          )}

          <p className="text-xs text-[var(--muted-foreground)] text-center flex items-center justify-center gap-1.5">
            <span className="block w-1.5 h-1.5 rounded-full bg-[var(--success)] ring-4 ring-[color-mix(in_oklch,var(--success)_18%,transparent)]" aria-hidden="true" />
            ข้อมูลและเอกสารทั้งหมดได้รับการเข้ารหัสและเก็บรักษาอย่างปลอดภัย
          </p>
        </div>
      </div>

      <SignSampleModal open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </div>
  )
}

/* -------------------- Date / Time Incident Fields -------------------- */
const setIncidentDateAs = (v: unknown) => normalizeIsoDate(typeof v === 'string' ? v : '')
const setIncidentTimeAs = (v: unknown) => normalizeTime(typeof v === 'string' ? v : '')

function DateTimeIncidentFields(props: {
  register: ReturnType<typeof useForm<FormData>>['register']
  errors: ReturnType<typeof useForm<FormData>>['formState']['errors']
  watch: ReturnType<typeof useForm<FormData>>['watch']
  t: ReturnType<typeof useTranslations>
}) {
  const { register, errors, watch, t } = props
  const datePreview = formatThaiDateLong(watch('incident_date'))
  const timePreview = formatThaiTime(watch('incident_time'))

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="incident_date" className="text-[13px] font-semibold flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {t('incident.date.label')} <span className="text-[var(--destructive)]">*</span>
          </Label>
          <Input id="incident_date" type="date" aria-invalid={!!errors.incident_date} className="h-11 text-[15px] border-[1.5px]" {...register('incident_date', { setValueAs: setIncidentDateAs })} />
          <p className="text-xs text-[var(--muted-foreground)] min-h-[1.1rem]" aria-live="polite">
            {datePreview
              ? t('incident.date.selected', { value: datePreview })
              : <span>{t('incident.date.placeholder')}</span>}
          </p>
          <FieldError message={errors.incident_date?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="incident_time" className="text-[13px] font-semibold flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {t('incident.time.label')} <span className="text-[var(--destructive)]">*</span>
          </Label>
          <Input id="incident_time" type="time" aria-invalid={!!errors.incident_time} className="h-11 text-[15px] border-[1.5px]" {...register('incident_time', { setValueAs: setIncidentTimeAs })} />
          <p className="text-xs text-[var(--muted-foreground)] min-h-[1.1rem]" aria-live="polite">
            {timePreview
              ? t('incident.time.selected', { value: timePreview })
              : <span>{t('incident.time.placeholder')}</span>}
          </p>
          <FieldError message={errors.incident_time?.message} />
        </div>
      </div>
      <p className="text-[11px] text-[var(--muted-foreground)] flex items-center gap-1">
        <Info className="h-3 w-3" aria-hidden="true" /> {t('incident.dateTimeHint')}
      </p>
    </div>
  )
}

/* -------------------- Step 3: Incident -------------------- */
function StepIncident(props: {
  register: ReturnType<typeof useForm<FormData>>['register']
  setValue: ReturnType<typeof useForm<FormData>>['setValue']
  watch: ReturnType<typeof useForm<FormData>>['watch']
  errors: ReturnType<typeof useForm<FormData>>['formState']['errors']
  setSelectedCategoryName: (name: string) => void
  scrollAnchorRef?: React.RefObject<HTMLDivElement | null>
  t: ReturnType<typeof useTranslations>
  locale: string
}) {
  const { register, setValue, watch, errors, setSelectedCategoryName, scrollAnchorRef, t, locale } = props
  const [categorySel, setCategorySel] = useState<ComboItem | null>(null)

  const fetchCategories = useCallback(async (q: string): Promise<ComboItem[]> => {
    const url = q ? `/api/categories?q=${encodeURIComponent(q)}&lang=${locale}` : `/api/categories?lang=${locale}`
    const res = await fetch(url); const json = await res.json()
    if (!json?.success) return []
    return json.items.map((c: { id: number; name: string }) => ({ id: c.id, name: c.name }))
  }, [locale])

  return (
    <div className="space-y-5">
      <div ref={scrollAnchorRef} />
      <div className="cctv-card">
        <div className="cctv-card-head">
          <span className="cctv-num">3</span>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[var(--foreground)]">{t('incident.title')}</div>
            <div className="text-xs text-[var(--muted-foreground)]">{t('incident.description')}</div>
          </div>
        </div>
        <div className="cctv-card-body space-y-5">
          {/* Request type cards */}
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold">
              {t('incident.requestType.label')} <span className="text-[var(--destructive)]">*</span>
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CATEGORIES_KEYS.map((category) => {
                const isSelected = watch('request_type') === category
                const isViewData = category === 'ขอดูข้อมูลรูปภาพ'
                const requestTypeKey = isViewData ? 'view' : 'copy'
                const handleSelect = () => setValue('request_type', category, { shouldValidate: true })
                return (
                  <div
                    key={category}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={handleSelect}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSelect()}
                    className={[
                      'group relative cursor-pointer rounded-xl p-3.5 transition-all duration-200 border-[1.5px]',
                      isSelected
                        ? 'border-[var(--primary)] bg-[color-mix(in_oklch,var(--primary)_6%,var(--card))]'
                        : 'border-[var(--border)] bg-[var(--card)] hover:border-[color-mix(in_oklch,var(--primary)_40%,var(--border))]',
                    ].join(' ')}
                    style={
                      isSelected
                        ? { boxShadow: '0 4px 12px -4px color-mix(in oklch, var(--primary) 30%, transparent)' }
                        : undefined
                    }
                  >
                    <div className="absolute top-2.5 right-2.5">
                      <div
                        className={[
                          'w-4 h-4 rounded-full border-[1.5px] transition-all flex items-center justify-center',
                          isSelected ? 'border-[var(--primary)] bg-[var(--primary)]' : 'border-[var(--cctv-border-strong,var(--border))]',
                        ].join(' ')}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary-foreground)]" />}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div
                        className={[
                          'w-10 h-10 rounded-lg flex items-center justify-center transition-all',
                          isSelected
                            ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                            : 'bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]',
                        ].join(' ')}
                      >
                        {isViewData ? <Camera className="h-5 w-5" aria-hidden="true" /> : <FileText className="h-5 w-5" aria-hidden="true" />}
                      </div>
                      <div>
                        <h3 className={['text-sm font-bold', isSelected ? 'text-[var(--primary)]' : 'text-[var(--foreground)]'].join(' ')}>
                          {t(`incident.category.options.${category}`)}
                        </h3>
                        <p className="text-xs text-[var(--muted-foreground)] mt-1 leading-snug">
                          {t(`incident.requestType.${requestTypeKey}.description`)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {isViewData ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]">
                            <Camera className="w-2.5 h-2.5" aria-hidden="true" /> {t('incident.requestType.view.badge')}
                          </span>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-[color-mix(in_oklch,var(--primary)_10%,transparent)] text-[var(--primary)]">
                              <FileText className="w-2.5 h-2.5" aria-hidden="true" /> {t('incident.requestType.copy.badge')}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded bg-[var(--cctv-bg-muted,var(--muted))] text-[var(--foreground)]">
                              <ShieldCheck className="w-2.5 h-2.5" aria-hidden="true" /> {t('incident.requestType.copy.badgeEvidence')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <FieldError message={errors.request_type?.message} />
          </div>

          {/* Involvement role — chip style */}
          <div className="space-y-2">
            <Label className="text-[13px] font-semibold">
              {t('incident.involvement.label')} <span className="text-[var(--destructive)]">*</span>
            </Label>
            <div className="flex flex-wrap gap-2">
              {INVOLVEMENT_ROLES_KEYS.map((r) => {
                const isActive = watch('involvement_role') === r
                return (
                  <button
                    key={r}
                    type="button"
                    className={`cctv-chip ${isActive ? 'active' : ''}`}
                    onClick={() => setValue('involvement_role', r as FormData['involvement_role'], { shouldValidate: true })}
                  >
                    {t(`incident.involvement.options.${r}`)}
                  </button>
                )
              })}
            </div>
            <FieldError message={errors.involvement_role?.message as string | undefined} />
            {(watch('involvement_role') === 'ญาติ' || watch('involvement_role') === 'ผู้เกี่ยวข้อง') && (
              <div className="space-y-1.5 mt-3">
                <Label htmlFor="involvement_explain" className="text-[13px] font-semibold">
                  {t('incident.involvement.explainLabel')}
                </Label>
                <Input id="involvement_explain" placeholder={t('incident.involvement.explainPlaceholder')} aria-invalid={!!errors.involvement_explain} {...register('involvement_explain')} className="h-11 text-[15px] border-[1.5px]" />
                <FieldError message={errors.involvement_explain?.message as string | undefined} />
              </div>
            )}
          </div>

          <AsyncCombobox
            label={`${t('incident.category.label')} *`}
            selected={categorySel}
            fetcher={fetchCategories}
            placeholder={t('incident.category.placeholder')}
            onSelect={(item) => {
              if (item.id === -1) {
                setCategorySel(null); setValue('category_id', 0, { shouldValidate: true })
                setSelectedCategoryName('')
                return
              }
              setCategorySel(item); setValue('category_id', item.id, { shouldValidate: true })
              setSelectedCategoryName(item.name)
            }}
            error={errors.category_id?.message as string | undefined}
            t={t}
          />

          <DateTimeIncidentFields register={register} errors={errors} watch={watch} t={t} />

          <div className="space-y-1.5">
            <Label htmlFor="incident_location" className="text-[13px] font-semibold">
              {t('incident.location.label')} <span className="text-[var(--destructive)]">*</span>
            </Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]" aria-hidden="true" />
              <Input
                id="incident_location"
                autoComplete="off"
                placeholder={t('incident.location.placeholder')}
                aria-invalid={!!errors.incident_location}
                {...register('incident_location')}
                className="pl-9 h-11 text-[15px] border-[1.5px]"
              />
            </div>
            <FieldError message={errors.incident_location?.message} />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-1">
              <Label htmlFor="request_details" className="text-[13px] font-semibold">
                {t('incident.details.label')}
              </Label>
              <span className="text-xs text-[var(--muted-foreground)]">{t('incident.details.hint')}</span>
            </div>
            <Textarea
              id="request_details"
              rows={4}
              className="resize-none text-[15px] min-h-[110px] border-[1.5px]"
              placeholder={t('placeholders.incidentDetails')}
              {...register('request_details')}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

/* -------------------- Step 4: Review & Consent -------------------- */
function StepReviewConsent(props: {
  watch: ReturnType<typeof useForm<FormData>>['watch']
  selectedCategoryName?: string
  policeReportFile: File | null
  idCardFile: File | null
  selfieFile: File | null
  t: ReturnType<typeof useTranslations>
}) {
  const { watch, selectedCategoryName, policeReportFile, idCardFile, selfieFile, t } = props

  const isBangkok = (prov?: string) => RE_BANGKOK.test(prov ?? '')
  const normAlley = (s?: string) => { const v = (s ?? '').trim(); if (!v) return ''; return RE_ALLEY_PREFIX.test(v) ? v : `ซอย ${v}` }
  const normRoad = (s?: string) => { const v = (s ?? '').trim(); if (!v) return ''; return RE_ROAD_PREFIX.test(v) ? v : `ถนน ${v}` }
  const buildAddress = () => {
    const house = (watch('house_number') ?? '').trim()
    const village = (watch('village_number') ?? '').trim()
    const alley = normAlley(watch('alley'))
    const road = normRoad(watch('road'))
    const sub = (watch('sub_district') ?? '').trim()
    const dist = (watch('district') ?? '').trim()
    const prov = (watch('province') ?? '').trim()
    const zip = (watch('postal_code') ?? '').trim()
    const parts: string[] = []
    if (house) parts.push(`บ้านเลขที่ ${house}`)
    if (village) parts.push(`หมู่ที่ ${village}`)
    if (alley) parts.push(alley)
    if (road) parts.push(road)
    if (sub) parts.push(`${isBangkok(prov) ? 'แขวง' : 'ตำบล'} ${sub}`)
    if (dist) parts.push(`${isBangkok(prov) ? 'เขต' : 'อำเภอ'} ${dist}`)
    if (prov) parts.push(`จังหวัด ${prov}`)
    if (zip) parts.push(zip)
    return parts.join(' ')
  }

  const role = watch('involvement_role')
  const roleExplain = (watch('involvement_explain') ?? '').trim()
  const attachedDocs = [
    policeReportFile && { name: 'สำเนาบันทึกประจำวัน', file: policeReportFile },
    idCardFile && { name: 'สำเนาบัตรประชาชน', file: idCardFile },
    selfieFile && { name: 'รูปถ่ายใบหน้ายืนยันตัวตน', file: selfieFile },
  ].filter(Boolean) as Array<{ name: string; file: File }>

  const preview = {
    name: watch('full_name') || '—',
    phone: watch('phone_number') || '—',
    category: selectedCategoryName || '—',
    type: watch('request_type') || '—',
    when: formatThaiDateTimeLong(watch('incident_date'), watch('incident_time')) || '—',
    where: watch('incident_location') || '—',
    address: buildAddress() || '—',
    involvement: role ? ((role === 'ญาติ' || role === 'ผู้เกี่ยวข้อง') && roleExplain ? `${role} (${roleExplain})` : role) : '—',
  }

  const rows: Array<{
    icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
    label: string
    value: React.ReactNode
    secondary?: React.ReactNode
  }> = [
    { icon: User, label: t('review.labels.applicant'), value: preview.name, secondary: preview.address },
    { icon: ShieldCheck, label: t('review.labels.involvement'), value: preview.involvement },
    { icon: Phone, label: t('review.labels.contact'), value: preview.phone },
    { icon: FileText, label: t('review.labels.category'), value: preview.category },
    { icon: Camera, label: t('review.labels.type'), value: preview.type },
    { icon: Clock, label: t('review.labels.datetime'), value: preview.when },
    { icon: MapPin, label: t('review.labels.location'), value: preview.where },
  ]

  return (
    <div className="space-y-5">
      <div className="cctv-card">
        <div className="cctv-card-head">
          <span className="cctv-num">4</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-bold text-[var(--foreground)]">{t('review.title')}</div>
            <div className="text-xs text-[var(--muted-foreground)]">{t('review.description')}</div>
          </div>
        </div>
        <div className="cctv-card-body !p-0">
          <dl className="m-0 divide-y divide-[var(--border)]">
            {rows.map(({ icon: Icon, label, value, secondary }, i) => (
              <div
                key={i}
                className="grid grid-cols-1 gap-y-1 px-4 py-3 sm:grid-cols-[minmax(160px,200px)_1fr] sm:gap-x-6 sm:px-5 sm:py-3.5 even:bg-[var(--cctv-bg-muted,var(--muted))] hover:bg-[color-mix(in_oklch,var(--primary)_5%,transparent)] transition-colors"
              >
                <dt className="flex items-center gap-2 text-[13px] font-medium text-[var(--muted-foreground)]">
                  <Icon className="h-4 w-4 flex-shrink-0 text-[var(--primary)]" aria-hidden />
                  <span>{label}</span>
                </dt>
                <dd className="m-0 min-w-0 text-sm font-semibold text-[var(--foreground)] [text-wrap:pretty] [overflow-wrap:anywhere]">
                  {value}
                  {secondary ? (
                    <div className="mt-1 text-xs font-normal text-[var(--muted-foreground)] [text-wrap:pretty] [overflow-wrap:anywhere]">
                      {secondary}
                    </div>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>

          {attachedDocs.length > 0 && (
            <div className="px-4 py-4 sm:px-5 sm:py-5 border-t border-[var(--border)]">
              <div className="rounded-lg bg-[var(--cctv-bg-muted,var(--muted))] p-3.5">
                <div className="text-xs font-bold mb-2 flex items-center gap-1.5">
                  <UploadCloud className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden="true" /> {t('review.labels.documents')} ({attachedDocs.length} ไฟล์)
                </div>
                <div className="space-y-1.5">
                  {attachedDocs.map((doc) => (
                    <div key={doc.name} className="flex items-center gap-2 text-xs [overflow-wrap:anywhere]">
                      <span className="text-[var(--success)] flex-shrink-0" aria-hidden="true"><Check className="h-3 w-3" /></span>
                      <span className="font-medium">{doc.name}</span>
                      <span className="text-[var(--muted-foreground)] flex-shrink-0">· {(doc.file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* -------------------- Step nav (sticky) -------------------- */
function StepNav({
  step,
  isSubmitting,
  onPrev,
  onNext,
  onSubmit,
  t,
  canSubmit,
}: {
  step: number
  isSubmitting: boolean
  onPrev: () => void
  onNext: () => void
  onSubmit: () => void
  t: ReturnType<typeof useTranslations>
  canSubmit: boolean
}) {
  return (
    <div className="cctv-sticky-nav flex-wrap sm:flex-nowrap">
      <div className="flex-1 min-w-0">
        <div className="font-bold text-[13px] text-[var(--foreground)]">
          {step < STEPS.length - 1
            ? `ขั้นตอนที่ ${step + 1} จาก ${STEPS.length} — ${t(STEPS[step].labelKey)}`
            : 'พร้อมส่งคำร้อง'}
        </div>
        <div className="text-xs text-[var(--muted-foreground)]">
          {step < STEPS.length - 1
            ? 'กรอกข้อมูลให้ครบถ้วนก่อนไปขั้นต่อไป'
            : canSubmit
              ? 'ตรวจสอบเรียบร้อยแล้ว'
              : 'ติ๊กยอมรับเงื่อนไขเพื่อส่งคำร้อง'}
        </div>
      </div>
      {step > 0 && (
        <Button
          type="button"
          variant="ghost"
          className="h-10 text-sm"
          onClick={onPrev}
          disabled={isSubmitting}
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1" aria-hidden="true" /> {t('actions.back')}
        </Button>
      )}
      {step < STEPS.length - 1 ? (
        <Button
          type="button"
          className="h-10 text-sm bg-[var(--primary)] hover:bg-[color-mix(in_oklch,var(--primary)_85%,black)] text-[var(--primary-foreground)] font-semibold"
          onClick={onNext}
          disabled={isSubmitting}
        >
          {t('actions.next')} <ArrowRight className="h-3.5 w-3.5 ml-1" aria-hidden="true" />
        </Button>
      ) : (
        <Button
          type="button"
          className="h-10 text-sm bg-[var(--primary)] hover:bg-[color-mix(in_oklch,var(--primary)_85%,black)] text-[var(--primary-foreground)] font-semibold"
          disabled={isSubmitting || !canSubmit}
          onClick={onSubmit}
        >
          {isSubmitting ? t('actions.submitting') : (
            <span className="inline-flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5" aria-hidden="true" /> {t('actions.submit')}
            </span>
          )}
        </Button>
      )}
    </div>
  )
}

/* -------------------- Desktop Layout -------------------- */
type ViewProps = {
  onSubmit: () => Promise<void>
  form: ReturnType<typeof useForm<FormData>>
  selectedCategoryName: string
  setSelectedCategoryName: (name: string) => void
  policeReportFile: File | null
  setPoliceReportFile: (f: File | null) => void
  idCardFile: File | null
  setIdCardFile: (f: File | null) => void
  selfieFile: File | null
  setSelfieFile: (f: File | null) => void
  docsError: string
  setDocsError: (e: string) => void
  isSubmitting: boolean
  uploadProgress: UploadProgressMap
  uploadStatus: string
  t: ReturnType<typeof useTranslations>
  locale: string
}

function DesktopView(props: ViewProps) {
  const { form, onSubmit, selectedCategoryName, setSelectedCategoryName, policeReportFile, setPoliceReportFile, idCardFile, setIdCardFile, selfieFile, setSelfieFile, docsError, setDocsError, isSubmitting, uploadProgress, uploadStatus, t, locale } = props
  const { register, setValue, watch, trigger, formState: { errors } } = form
  const [step, setStep] = useState(0)

  const stepFields = useMemo(() => [
    ['prefix', 'full_name', 'age', 'phone_number', 'id_or_passport_number', 'line_user_id_str', 'sub_district', 'district', 'province', 'postal_code'] as (keyof FormData)[],
    [] as (keyof FormData)[],
    ['involvement_role', 'involvement_explain', 'category_id', 'request_type', 'incident_date', 'incident_time', 'incident_location'] as (keyof FormData)[],
    ['consent'] as (keyof FormData)[],
  ], [])

  const nextStep = async () => {
    if (step === 1) {
      if (!policeReportFile || !idCardFile || !selfieFile) {
        setDocsError('กรุณาแนบเอกสารให้ครบทั้ง 3 รายการก่อนดำเนินการต่อ')
        toast.error('กรุณาแนบเอกสารให้ครบ')
        return
      }
      setDocsError('')
      setStep(s => s + 1)
      return
    }
    const ok = await trigger(stepFields[step], { shouldFocus: true })
    if (!ok) { toast.error(t('errors.required')); return }
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }
  const prevStep = () => setStep(s => Math.max(s - 1, 0))

  return (
    <main className="cctv-bg-dot min-h-screen">
      <OfficialHeader />
      <div className="max-w-5xl mx-auto px-6 pt-8 pb-8 space-y-5">
        <CCTVHero />
        <StepperDesktop current={step} onStepChange={(i) => i <= step && setStep(i)} t={t} />

        {step === 0 && <StepApplicant register={register} setValue={setValue} watch={watch} errors={errors} t={t} locale={locale} />}
        {step === 1 && <StepDocuments policeReportFile={policeReportFile} setPoliceReportFile={setPoliceReportFile} idCardFile={idCardFile} setIdCardFile={setIdCardFile} selfieFile={selfieFile} setSelfieFile={setSelfieFile} docsError={docsError} />}
        {step === 2 && <StepIncident register={register} setValue={setValue} watch={watch} errors={errors} setSelectedCategoryName={setSelectedCategoryName} t={t} locale={locale} />}
        {step === 3 && <StepReviewConsent watch={watch} selectedCategoryName={selectedCategoryName} policeReportFile={policeReportFile} idCardFile={idCardFile} selfieFile={selfieFile} t={t} />}

        <UploadProgressPanel progress={uploadProgress} status={uploadStatus} />

        <StepNav
          step={step}
          isSubmitting={isSubmitting}
          onPrev={prevStep}
          onNext={nextStep}
          onSubmit={() => void onSubmit()}
          t={t}
          canSubmit={Boolean(watch('consent'))}
        />
      </div>
    </main>
  )
}

/* -------------------- Mobile Layout -------------------- */
function MobileView(props: ViewProps) {
  const { form, onSubmit, selectedCategoryName, setSelectedCategoryName, policeReportFile, setPoliceReportFile, idCardFile, setIdCardFile, selfieFile, setSelfieFile, docsError, setDocsError, isSubmitting, uploadProgress, uploadStatus, t, locale } = props
  const { register, setValue, watch, trigger, formState: { errors } } = form
  const [step, setStep] = useState(0)
  const [previousStep, setPreviousStep] = useState(0)
  const step2HeaderRef = useRef<HTMLDivElement>(null)

  const stepFields = useMemo(() => [
    ['prefix', 'full_name', 'age', 'phone_number', 'id_or_passport_number', 'line_user_id_str', 'sub_district', 'district', 'province', 'postal_code'] as (keyof FormData)[],
    [] as (keyof FormData)[],
    ['involvement_role', 'involvement_explain', 'category_id', 'request_type', 'incident_date', 'incident_time', 'incident_location'] as (keyof FormData)[],
    ['consent'] as (keyof FormData)[],
  ], [])

  const score = useMemo(() => {
    const allFields: (keyof FormData)[] = [...stepFields[0], ...stepFields[2], ...stepFields[3]]
    const docScore = (policeReportFile ? 1 : 0) + (idCardFile ? 1 : 0) + (selfieFile ? 1 : 0)
    const totalItems = allFields.length + 3
    const filled = allFields.filter(f => {
      const v = watch(f)
      if (v === null || v === undefined || v === '') return false
      if (f === 'involvement_explain') {
        const r = watch('involvement_role')
        if (r !== 'ญาติ' && r !== 'ผู้เกี่ยวข้อง') return true
        return Boolean(String(v ?? '').trim())
      }
      if (typeof v === 'boolean') return v
      return String(v ?? '').trim().length > 0
    }).length
    return Math.round(((filled + docScore) / totalItems) * 100)
  }, [watch, stepFields, policeReportFile, idCardFile, selfieFile])

  const nextStep = async () => {
    if (step === 1) {
      if (!policeReportFile || !idCardFile || !selfieFile) {
        setDocsError('กรุณาแนบเอกสารให้ครบทั้ง 3 รายการก่อนดำเนินการต่อ')
        toast.error('กรุณาแนบเอกสารให้ครบ')
        return
      }
      setDocsError('')
      setPreviousStep(step); setStep(2)
      return
    }
    const ok = await trigger(stepFields[step], { shouldFocus: true })
    if (!ok) { toast.error(t('errors.required')); return }
    setPreviousStep(step)
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }
  const prevStep = () => setStep(s => Math.max(s - 1, 0))

  useEffect(() => {
    if (previousStep === 0 && step === 1) {
      requestAnimationFrame(() => {
        const el = step2HeaderRef.current
        if (el) {
          const rect = el.getBoundingClientRect()
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop
          window.scrollTo({ top: scrollTop + rect.top - 12, behavior: 'smooth' })
        }
      })
    }
  }, [step, previousStep])

  return (
    <main className="cctv-bg-dot min-h-screen">
      <OfficialHeader />
      <div className="px-4 pt-4 pb-24 space-y-4">
        <CCTVHero compact />
        <StepperMobile current={step} t={t} />

        {step === 0 && <StepApplicant register={register} setValue={setValue} watch={watch} errors={errors} t={t} locale={locale} />}
        {step === 1 && <StepDocuments policeReportFile={policeReportFile} setPoliceReportFile={setPoliceReportFile} idCardFile={idCardFile} setIdCardFile={setIdCardFile} selfieFile={selfieFile} setSelfieFile={setSelfieFile} docsError={docsError} scrollAnchorRef={step2HeaderRef} />}
        {step === 2 && <StepIncident register={register} setValue={setValue} watch={watch} errors={errors} setSelectedCategoryName={setSelectedCategoryName} scrollAnchorRef={step2HeaderRef} t={t} locale={locale} />}
        {step === 3 && <StepReviewConsent watch={watch} selectedCategoryName={selectedCategoryName} policeReportFile={policeReportFile} idCardFile={idCardFile} selfieFile={selfieFile} t={t} />}

        <div className="cctv-card p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--muted-foreground)]">{t('progress.label')}</span>
            <span className="text-xs font-bold text-[var(--primary)]">{t('progress.percentage', { percent: score })}</span>
          </div>
          <Progress value={score} />
        </div>

        <UploadProgressPanel progress={uploadProgress} status={uploadStatus} />
      </div>

      {/* Sticky bottom nav */}
      <div className="sticky bottom-0 bg-[var(--card)] border-t border-[var(--border)] px-4 py-3 z-20">
        <StepNav
          step={step}
          isSubmitting={isSubmitting}
          onPrev={prevStep}
          onNext={nextStep}
          onSubmit={() => void onSubmit()}
          t={t}
          canSubmit={Boolean(watch('consent'))}
        />
      </div>
    </main>
  )
}

/* -------------------- Page -------------------- */
export default function RequestPage() {
  const t = useTranslations('RequestPage')
  const locale = useLocale()
  const isDesktop = useIsDesktop()

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID || process.env.NEXT_PUBLIC_LINE_LIFF_ID || ''
  const liffRedirectUri = useMemo(() => getRequestRedirectUri(), [])

  const [mounted, setMounted] = useState(false)
  const [pdpaAccepted, setPdpaAccepted] = useState(false)
  useEffect(() => {
    setMounted(true)
    // hydrate PDPA consent flag — กัน modal เด้งซ้ำหลัง LIFF redirect กลับมา
    // ใช้ localStorage เป็นหลัก เพราะ sessionStorage บน LINE in-app browser (มือถือ)
    // มักถูกล้างหลัง redirect ผ่าน access.line.me → กลับมาแล้วอ่านไม่เจอ → modal เด้งซ้ำ
    // (consent ตัวจริงถูก log ลง DB ผ่าน /api/consent แล้ว; flag นี้แค่กัน UX ซ้ำ)
    if (readPdpaConsentFlag()) setPdpaAccepted(true)
  }, [])

  const [gateState, setGateState] = useState<GateState>('booting')
  const [gateError, setGateError] = useState('')
  const [profile, setProfile] = useState<LiffUserProfile | null>(null)
  const [pdpaRejected, setPdpaRejected] = useState(false)
  const [doneReportId, setDoneReportId] = useState<number | null>(null)
  const [attachmentIssue, setAttachmentIssue] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgressMap>({})
  const [uploadStatus, setUploadStatus] = useState('')
  const [selectedCategoryName, setSelectedCategoryName] = useState('')
  const [policeReportFile, setPoliceReportFile] = useState<File | null>(null)
  const [idCardFile, setIdCardFile] = useState<File | null>(null)
  const [selfieFile, setSelfieFile] = useState<File | null>(null)
  const [docsError, setDocsError] = useState('')
  const liffRef = useRef<LiffSDK | null>(null)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      prefix: PREFIXES_KEYS[0],
      full_name: '',
      age: '',
      phone_number: '',
      id_or_passport_number: '',
      line_user_id_str: '',
      involvement_role: undefined,
      involvement_explain: '',
      house_number: '',
      village_number: '',
      alley: '',
      road: '',
      sub_district: '',
      district: '',
      province: '',
      postal_code: '',
      category_id: 0,
      request_type: CATEGORIES_KEYS[0],
      incident_date: '',
      incident_time: '',
      incident_location: '',
      request_details: '',
      supporting_documents: { id_card_copy: false, police_report_copy: false, other: false, other_details: '' },
      consent: true,
    },
  })

  const { setValue, getValues, trigger } = form

  useEffect(() => {
    setValue('supporting_documents', {
      id_card_copy: Boolean(idCardFile),
      police_report_copy: Boolean(policeReportFile),
      other: Boolean(selfieFile),
      other_details: selfieFile ? 'รูปถ่ายใบหน้ายืนยันตัวตน' : '',
    })
  }, [idCardFile, policeReportFile, selfieFile, setValue])

  const initGate = useCallback(async () => {
    try {
      setGateState('booting')
      setGateError('')
      if (!liffId) throw new Error('ยังไม่ได้ตั้งค่า LIFF ID ในระบบ')
      const liff = await ensureLiffSdk()
      if (!liff) throw new Error('ไม่พบ LIFF SDK')
      liffRef.current = liff
      await liff.init({ liffId })
      if (!liff.isLoggedIn()) { liff.login({ redirectUri: liffRedirectUri }); return }
      if (!liff.isInClient()) {
        const redirectKey = `line-liff-redirect:${liffId}`
        const hasReturned = new URLSearchParams(window.location.search).has('liff.referrer')
        if (!hasReturned) {
          window.sessionStorage.setItem(redirectKey, '1')
          window.location.replace(`https://liff.line.me/${liffId}`)
          return
        }
        window.sessionStorage.removeItem(redirectKey)
      }
      window.sessionStorage.removeItem(`line-liff-redirect:${liffId}`)
      const [friendship, nextProfile] = await Promise.all([liff.getFriendship(), liff.getProfile()])
      setProfile(nextProfile)
      setValue('line_user_id_str', nextProfile.userId, { shouldValidate: true })
      if (!friendship.friendFlag) { setGateState('need-friend'); return }
      setGateState('ready')
    } catch (error) {
      setGateError(error instanceof Error ? error.message : 'ไม่สามารถตรวจสอบ LINE ได้')
      setGateState('error')
    }
  }, [liffId, liffRedirectUri, setValue])

  useEffect(() => {
    if (pdpaAccepted) void initGate()
  }, [initGate, pdpaAccepted])

  const closeWindow = useCallback(() => {
    const liff = liffRef.current
    if (liff?.isInClient()) { liff.closeWindow(); return }
    window.close()
  }, [])

  const handlePdpaAccept = useCallback(() => {
    setPdpaAccepted(true)
    setPdpaRejected(false)
    writePdpaConsentFlag()
  }, [])

  const handlePdpaReject = useCallback(() => {
    setPdpaAccepted(false)
    setPdpaRejected(true)
    clearPdpaConsentFlag()
  }, [])

  const handlePdpaReconsider = useCallback(() => {
    setPdpaRejected(false)
  }, [])

  const handleSubmit = useCallback(async () => {
    const ok = await trigger(undefined, { shouldFocus: true })
    if (!ok) { toast.error('กรุณาตรวจสอบข้อมูลก่อนส่งคำร้อง'); return }
    if (!policeReportFile || !idCardFile || !selfieFile) {
      toast.error('เอกสารประกอบยังไม่ครบ')
      return
    }
    setIsSubmitting(true)
    setAttachmentIssue(false)
    setUploadProgress({})
    setUploadStatus('กำลังบันทึกคำร้อง…')
    try {
      const payload = { ...getValues(), category_id: Number(getValues('category_id')), language: 'th' as const }
      const res = await fetch('/api/reports', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.message || 'ไม่สามารถบันทึกคำร้องได้')
      const reportId = Number(json.data.report_id)
      const trackingToken = String(json.data.tracking_token || '')
      if (!trackingToken) throw new Error('ไม่พบ token สำหรับอัปโหลดเอกสาร')
      setDoneReportId(reportId)
      setUploadStatus('บันทึกคำร้องแล้ว กำลังบีบอัดและอัปโหลดเอกสาร…')
      try {
        await uploadAttachmentsWithRetry(
          reportId,
          trackingToken,
          [
            { key: 'police_report', label: 'บันทึกประจำวัน', file: policeReportFile, category: 'idcopy' },
            { key: 'id_card', label: 'สำเนาบัตรประชาชน', file: idCardFile, category: 'idcopy' },
            { key: 'selfie', label: 'รูปถ่ายยืนยันตัวตน', file: selfieFile, category: 'operation' },
          ],
          setUploadProgress,
        )
        setUploadStatus('')
      } catch (err) {
        console.error('Attachment upload error:', err)
        setAttachmentIssue(true)
        setUploadStatus('')
      }
      toast.success(t('success.title'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('errors.submitFailed'))
      setUploadStatus('')
    } finally {
      setIsSubmitting(false)
    }
  }, [getValues, idCardFile, policeReportFile, selfieFile, t, trigger])

  if (!mounted) {
    return (
      <main className="cctv-line-hero min-h-dvh flex flex-col">
        <OfficialHeader />
        <div className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-7 w-7 animate-spin text-[var(--primary)]" aria-hidden="true" />
            <p className="text-sm text-[var(--muted-foreground)]" role="status" aria-live="polite">กำลังเตรียมระบบ…</p>
          </div>
        </div>
      </main>
    )
  }

  if (doneReportId) {
    return (
      <SuccessState
        attachmentIssue={attachmentIssue}
        uploadActive={isSubmitting}
        onClose={closeWindow}
      />
    )
  }

  if (pdpaRejected) {
    return <PdpaRejectedScreen onReconsider={handlePdpaReconsider} onClose={closeWindow} />
  }

  if (!pdpaAccepted) {
    return (
      <>
        <main className="cctv-line-hero min-h-dvh flex flex-col">
          <OfficialHeader />
          <div className="flex-1 flex items-center justify-center px-4 py-12">
            <div className="max-w-md rounded-2xl border border-[var(--border)] bg-white/85 p-5 text-center shadow-sm backdrop-blur">
              <ShieldCheck className="mx-auto h-8 w-8 text-[var(--primary)]" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">
                กรุณารับทราบประกาศการคุ้มครองข้อมูลส่วนบุคคลก่อนเริ่มใช้งาน
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted-foreground)]">
                ระบบจะแจ้งวัตถุประสงค์การใช้ข้อมูลก่อนเริ่มตรวจสอบ LINE / LIFF
              </p>
            </div>
          </div>
        </main>
        <PDPAConsentModal
          isOpen
          onAccept={handlePdpaAccept}
          onReject={handlePdpaReject}
          lineUserIdStr={null}
          pagePath="/request"
        />
      </>
    )
  }

  if (gateState !== 'ready') {
    return (
      <GateScreen
        gateState={gateState}
        profile={profile}
        errorMessage={gateError}
        liffUrl={`https://liff.line.me/${liffId}`}
        liff={liffRef.current}
        onFriendDetected={() => setGateState('ready')}
        onRetryFriendship={() => void initGate()}
      />
    )
  }

  const viewProps: ViewProps = {
    onSubmit: handleSubmit,
    form,
    selectedCategoryName,
    setSelectedCategoryName,
    policeReportFile,
    setPoliceReportFile,
    idCardFile,
    setIdCardFile,
    selfieFile,
    setSelfieFile,
    docsError,
    setDocsError,
    isSubmitting,
    uploadProgress,
    uploadStatus,
    t,
    locale,
  }

  return isDesktop ? <DesktopView {...viewProps} /> : <MobileView {...viewProps} />
}

function PdpaRejectedScreen({ onReconsider, onClose }: { onReconsider: () => void; onClose: () => void }) {
  return (
    <main className="cctv-bg-dot min-h-dvh flex flex-col">
      <OfficialHeader />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm cctv-card-elev p-7 text-center space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[var(--cctv-warning-soft)] text-[var(--warning)] ring-1 ring-[color-mix(in_oklch,var(--warning)_30%,transparent)]">
            <ShieldCheck className="h-7 w-7" aria-hidden="true" />
          </div>
          <div>
            <p className="text-lg font-bold text-[var(--foreground)]">ไม่สามารถดำเนินการต่อได้</p>
            <p className="text-sm leading-relaxed text-[var(--muted-foreground)] mt-2">
              การยินยอมตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล (PDPA)
              เป็นเงื่อนไขจำเป็นในการยื่นคำร้องขอภาพ CCTV
              หากท่านเปลี่ยนใจสามารถกลับมาให้ความยินยอมเพื่อดำเนินการต่อได้
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button
              className="h-11 rounded-lg bg-[var(--primary)] hover:bg-[color-mix(in_oklch,var(--primary)_85%,black)] text-[var(--primary-foreground)] font-semibold"
              onClick={onReconsider}
            >
              กลับไปอ่านอีกครั้ง
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-lg border-[1.5px]"
              onClick={onClose}
            >
              ปิดหน้าต่าง
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
