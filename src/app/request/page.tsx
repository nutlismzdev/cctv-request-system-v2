'use client'

import React, { useEffect, useMemo, useState, useRef, useCallback, type ReactNode } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useTranslations, useLocale } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertCircle, ArrowLeft, ArrowRight, Camera, CheckCircle2, ChevronsUpDown, Check,
  Clock, FileBadge2, FileText, Home, Loader2, MapPin, MessageCircle, Phone, Send,
  ShieldCheck, UploadCloud, User, CreditCard, X, Pencil, Trash2,
  ScanFace, BookOpen, CheckCheck, PenLine, Lightbulb,
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

/* -------------------- Constants -------------------- */
const PREFIXES_KEYS = ['นาย', 'นาง', 'นางสาว'] as const
const CATEGORIES_KEYS = ['ขอสำเนาข้อมูลภาพ', 'ขอดูข้อมูลรูปภาพ'] as const
const INVOLVEMENT_ROLES_KEYS = ['ผู้เสียหาย', 'ญาติ', 'ผู้เกี่ยวข้อง', 'เจ้าหน้าที่รัฐ', 'ประกัน'] as const

const RE_BANGKOK = /กรุงเทพ|bangkok/i
const RE_ALLEY_PREFIX = /^(ซอย|ตรอก)\s*/i
const RE_ROAD_PREFIX = /^ถนน\s*/i

const STEPS = [
  { key: 'applicant', labelKey: 'stepper.step1' },
  { key: 'documents', labelKey: 'stepper.stepDocs' },
  { key: 'incident',  labelKey: 'stepper.step2' },
  { key: 'review',   labelKey: 'stepper.step3' },
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
  return <p className="mt-1 text-sm text-red-600 font-medium">{message}</p>
}

/* -------------------- Stepper -------------------- */
function Stepper({ current, onStepChange, t }: {
  current: number
  onStepChange?: (i: number) => void
  t: ReturnType<typeof useTranslations>
}) {
  const pct = Math.max(0, Math.min(100, (current / (STEPS.length - 1)) * 100))
  const isClickable = (i: number) => typeof onStepChange === 'function' && i <= current
  const currentLabel = t(STEPS[current].labelKey)

  return (
    <nav aria-label={t('stepper.current', { current: current + 1, total: STEPS.length, label: currentLabel })} className="w-full select-none">
      <div className="relative">
        <div className="h-[2px] sm:h-[3px] w-full bg-white/30 rounded-full">
          <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
        <div className="absolute inset-0 flex items-center justify-between">
          {STEPS.map((s, i) => {
            const status = i < current ? 'done' : i === current ? 'current' : 'upcoming'
            const base = 'rounded-full transition-all duration-200 ring-1 focus:outline-none focus:ring-2'
            const cls =
              status === 'done'    ? 'h-2.5 w-2.5 sm:h-3 sm:w-3 bg-white ring-white/70'
              : status === 'current' ? 'h-3 w-3 sm:h-3.5 sm:w-3.5 bg-white ring-blue-300 scale-110'
              : 'h-2.5 w-2.5 sm:h-3 sm:w-3 bg-white/45 ring-white/40'
            const clickable = isClickable(i)
            const stepLabel = t(s.labelKey)
            return (
              <button
                key={s.key}
                type="button"
                title={stepLabel}
                aria-label={t('stepper.current', { current: i + 1, total: STEPS.length, label: stepLabel })}
                aria-current={status === 'current' ? 'step' : undefined}
                disabled={!clickable}
                onClick={() => clickable && onStepChange?.(i)}
                className={`${base} ${cls} ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
              />
            )
          })}
        </div>
      </div>
      <div className="mt-2 text-[11px] sm:text-xs text-white/85">
        {t('stepper.current', { current: current + 1, total: STEPS.length, label: currentLabel })}
      </div>
    </nav>
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
    <div className="space-y-2">
      <Label className="text-base sm:text-lg font-medium">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button" variant="outline" role="combobox" aria-expanded={open}
            disabled={disabled} className="w-full justify-between h-12 text-base px-4"
            title={disabled ? (disabledHint ?? '') : showText || placeholder}
          >
            <div className="truncate text-left">
              {disabled ? (disabledHint ?? t('placeholders.disabled')) : (showText || <span className="text-muted-foreground">{placeholder}</span>)}
            </div>
            <div className="flex items-center gap-1">
              {allowClear && !!selected && !disabled && (
                <X className="h-5 w-5 text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); onSelect({ id: -1, name: '' }) }} />
              )}
              <ChevronsUpDown className="h-5 w-5 opacity-50" />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
          <Command shouldFilter={false}>
            <div className="flex items-center gap-2 px-2 pt-2">
              <CommandInput placeholder={t('placeholders.search')} value={query} onValueChange={setQuery} />
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
  /** เอกสารต้องเซ็น "สำเนาถูกต้อง" ก่อนแนบ */
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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="absolute inset-0 h-full w-full object-contain cursor-zoom-in"
      onClick={() => onOpen?.(src)}
      onLoad={(e) => {
        if (!onAspect) return
        const img = e.currentTarget
        const r = img.naturalWidth / img.naturalHeight
        if (r > 1.15) onAspect('landscape')
        else if (r < 0.85) onAspect('portrait')
        else onAspect('square')
      }}
    />
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
  const changeInputRef = useRef<HTMLInputElement | null>(null)
  const isImage = file && file.type.startsWith('image/')
  const isDone = Boolean(file)
  const [previewSrc, setPreviewSrc] = useState<string | null>(null)
  const [aspect, setAspect] = useState<'portrait' | 'landscape' | 'square'>('landscape')

  // ปรับความสูง container ให้พอดีรูป — รูปแนวตั้งให้สูง รูปแนวนอนให้เตี้ย
  const previewBoxClass =
    aspect === 'portrait' ? 'h-72 sm:h-80'
    : aspect === 'square' ? 'h-56 sm:h-64'
    : 'h-44 sm:h-52'

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
    <div className="group relative">
      {/* Primary file input — triggered via <label htmlFor> for reliable mobile support */}
      <input
        id={inputId}
        type="file"
        accept={config.accept}
        className="sr-only"
        onChange={handleChange}
      />

      {/* Secondary input for "change" action on filled state */}
      <input
        ref={changeInputRef}
        type="file"
        accept={config.accept}
        className="sr-only"
        onChange={handleChange}
      />

      {isDone ? (
        /* ── FILLED STATE ── */
        <div className={[
          'relative overflow-hidden rounded-2xl border-2 transition-all duration-200',
          error ? 'border-red-300 bg-red-50' : 'border-emerald-300 bg-emerald-50/40',
        ].join(' ')}>

          {/* Step badge */}
          <div className="absolute top-3 left-3 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check className="h-3.5 w-3.5" />
          </div>

          {/* Certify-required reminder badge (filled state) */}
          {config.requireCertify && (
            <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1 rounded-full bg-amber-100/95 px-2 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-200 backdrop-blur-sm shadow-sm">
              <PenLine className="h-3 w-3" />
              ต้องมีลายเซ็น
            </div>
          )}

          {isImage ? (
            /* Image preview */
            <div className={`relative ${previewBoxClass} w-full bg-gradient-to-br from-slate-100 to-slate-50 overflow-hidden transition-all duration-300`}>
              <DocPreviewImage
                file={file}
                alt={config.title}
                onOpen={setPreviewSrc}
                onAspect={setAspect}
              />
              {/* Overlay controls — always visible on mobile, hover on desktop */}
              <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-3 sm:opacity-0 sm:transition-opacity sm:duration-200 sm:group-hover:opacity-100">
                <p className="text-xs font-medium text-white truncate max-w-[60%]">{file.name}</p>
                <div className="flex gap-2 shrink-0">
                  <label
                    htmlFor={`${inputId}-change`}
                    className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-white/90 text-slate-800 shadow transition-colors hover:bg-white"
                    aria-label="เปลี่ยนรูป"
                    title="เปลี่ยนรูป"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </label>
                  <input
                    id={`${inputId}-change`}
                    type="file"
                    accept={config.accept}
                    className="sr-only"
                    onChange={handleChange}
                  />
                  <button
                    type="button"
                    onClick={() => onPick(null)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600"
                    aria-label="ลบรูป"
                    title="ลบรูป"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : file ? (
            /* Non-image (PDF) preview */
            <div className="flex items-center gap-3 p-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-600">
                <FileText className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{file.name}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {(file.size / 1024 / 1024).toFixed(1)} MB · {file.type.split('/')[1]?.toUpperCase() || 'ไฟล์'}
                </p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <label
                  htmlFor={`${inputId}-change2`}
                  className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
                  aria-label="เปลี่ยนไฟล์"
                  title="เปลี่ยนไฟล์"
                >
                  <Pencil className="h-4 w-4" />
                </label>
                <input
                  id={`${inputId}-change2`}
                  type="file"
                  accept={config.accept}
                  className="sr-only"
                  onChange={handleChange}
                />
                <button
                  type="button"
                  onClick={() => onPick(null)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-500 transition-colors hover:bg-red-100"
                  aria-label="ลบไฟล์"
                  title="ลบไฟล์"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        /* ── EMPTY STATE — label wraps entire card for native file picker ── */
        <label
          htmlFor={inputId}
          className={[
            'relative flex flex-col items-center justify-center gap-3 overflow-hidden',
            'rounded-2xl border-2 border-dashed px-4 py-8 text-center',
            'cursor-pointer transition-all duration-200 active:scale-[0.98]',
            'select-none',
            error
              ? 'border-red-300 bg-red-50 hover:border-red-400 hover:bg-red-100/50'
              : 'border-slate-300 bg-white hover:border-sky-400 hover:bg-sky-50/40',
          ].join(' ')}
          style={{ touchAction: 'manipulation' }}
        >
          {/* Step number badge */}
          <div className="absolute top-3 left-3 flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600">
            {index + 1}
          </div>

          {/* Certify-required badge */}
          {config.requireCertify && (
            <div className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 ring-1 ring-amber-200">
              <PenLine className="h-3 w-3" />
              ต้องเซ็นสำเนา
            </div>
          )}

          <div className={[
            'flex h-14 w-14 items-center justify-center rounded-2xl transition-colors duration-200',
            error ? 'bg-red-100 text-red-500' : 'bg-slate-100 text-slate-400',
          ].join(' ')}>
            {config.icon}
          </div>

          <div>
            <p className={['text-sm font-semibold', error ? 'text-red-700' : 'text-slate-700'].join(' ')}>
              {config.title}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{config.subtitle}</p>
          </div>

          <div className={[
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium',
            error ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600',
          ].join(' ')}>
            <UploadCloud className="h-3.5 w-3.5" />
            แตะเพื่อเลือกไฟล์
          </div>
        </label>
      )}

      {/* Status row under card */}
      {isDone ? (
        <div className="mt-1.5 flex items-center gap-1.5 px-1">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          <span className="text-xs font-medium text-emerald-700">{config.title} · แนบเรียบร้อย</span>
        </div>
      ) : error ? (
        <div className="mt-1.5 flex items-center gap-1.5 px-1">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
          <span className="text-xs font-medium text-red-600">{error}</span>
        </div>
      ) : null}

      {/* Image preview modal */}
      <Dialog open={!!previewSrc} onOpenChange={(open) => { if (!open) setPreviewSrc(null) }}>
        <DialogContent
          className="max-w-2xl p-2 sm:p-3"
          showCloseButton
        >
          <DialogTitle className="sr-only">{config.title}</DialogTitle>
          {previewSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt={config.title}
              className="w-full h-auto max-h-[80vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/* -------------------- GateScreen -------------------- */
const LINE_OA_ADD_FRIEND_URL = 'https://line.me/R/ti/p/@513dlddc'
const LINE_GREEN = '#06C755'

function GateCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="rounded-3xl border-0 shadow-2xl shadow-slate-200/70">
      <CardContent className="p-8">{children}</CardContent>
    </Card>
  )
}

function GateBrand() {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      <div className="relative mb-3 h-16 w-16 overflow-hidden rounded-2xl bg-white shadow-lg shadow-sky-100 ring-1 ring-slate-100">
        <Image
          src="/logo/icon-192.png"
          alt="เทศบาลนครหัวหิน"
          fill
          sizes="64px"
          className="object-contain p-2"
          priority
        />
      </div>
      <p className="text-base font-bold text-slate-900">เทศบาลนครหัวหิน</p>
      <p className="text-sm text-slate-500">ระบบยื่นคำร้องขอภาพ CCTV</p>
    </div>
  )
}

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

  const wrap = (content: React.ReactNode) => (
    <div className="min-h-dvh flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 via-white to-sky-50/60 px-4 py-12">
      <div className="w-full max-w-sm">{content}</div>
    </div>
  )

  if (gateState === 'booting') {
    return wrap(
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-200 opacity-50" />
          <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-sky-100">
            <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
          </span>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300" />
        </div>
      </div>
    )
  }

  if (gateState === 'outside-line') {
    return wrap(
      <GateCard>
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-md shadow-[#06C755]/25"
            style={{ background: LINE_GREEN }}>
            <MessageCircle className="h-8 w-8 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900">กรุณาเปิดผ่าน LINE</h1>
            <p className="text-sm leading-relaxed text-slate-500">
              ระบบยื่นคำร้องออนไลน์ต้องทำงานใน LINE เพื่อผูกคำร้องกับบัญชี LINE ของคุณ
              และรับการแจ้งเตือนผลการพิจารณาโดยอัตโนมัติ
            </p>
          </div>
          <div className="w-full rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">วิธีเปิดใช้งาน</p>
            <ol className="space-y-1.5 text-sm text-slate-600">
              <li className="flex gap-2"><span className="font-bold text-sky-600">1.</span>กดปุ่มด้านล่างเพื่อเปิดใน LINE</li>
              <li className="flex gap-2"><span className="font-bold text-sky-600">2.</span>ระบบจะนำคุณเข้าสู่แบบฟอร์มโดยอัตโนมัติ</li>
            </ol>
          </div>
          <button
            type="button"
            onClick={() => window.location.assign(liffUrl)}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 text-base font-semibold text-white shadow-md shadow-[#06C755]/30 transition-all active:scale-[0.98]"
            style={{ background: LINE_GREEN }}
          >
            <MessageCircle className="h-5 w-5" />
            เปิดผ่าน LINE
          </button>
        </div>
      </GateCard>
    )
  }

  if (gateState === 'error') {
    return wrap(
      <GateCard>
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-slate-900">เปิดระบบไม่ได้</h1>
            <p className="text-sm leading-relaxed text-slate-500">{errorMessage || 'เกิดข้อผิดพลาดในการตรวจสอบ LINE'}</p>
          </div>
          <div className="w-full rounded-2xl border border-amber-100 bg-amber-50 p-4 text-left text-sm text-amber-800">
            ลองปิดและเปิดแอป LINE ใหม่ หรือตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง
          </div>
          <Button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full rounded-2xl py-3 text-base font-semibold"
          >
            ลองใหม่อีกครั้ง
          </Button>
        </div>
      </GateCard>
    )
  }

  /* need-friend state */
  return wrap(
    <GateCard>
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-md shadow-[#06C755]/25"
          style={{ background: LINE_GREEN }}>
          <MessageCircle className="h-8 w-8 text-white" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold text-slate-900">เพิ่มเพื่อน LINE OA ก่อน</h1>
          <p className="text-sm leading-relaxed text-slate-500">
            ระบบจะส่งผลการพิจารณาคำร้องและลิงก์ดาวน์โหลดไฟล์ CCTV
            มาให้คุณผ่าน LINE OA โดยตรง
          </p>
          {profile && (
            <p className="text-xs text-slate-400">
              เข้าสู่ระบบในชื่อ <span className="font-semibold text-slate-600">{profile.displayName}</span>
            </p>
          )}
        </div>
        <div className="w-full space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-left text-sm text-slate-600">
          <p className="font-semibold text-slate-700">เหตุผลที่ต้องเพิ่มเพื่อน</p>
          <ul className="space-y-1.5">
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#06C755]" />รับแจ้งเตือนเมื่อเอกสารอนุมัติ</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#06C755]" />รับลิงก์ดาวน์โหลดไฟล์ CCTV</li>
            <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#06C755]" />สอบถามเจ้าหน้าที่ผ่านแชท</li>
          </ul>
        </div>
        <div className="w-full space-y-2.5">
          <button
            type="button"
            onClick={handleAddFriend}
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl py-3.5 text-base font-semibold text-white shadow-md shadow-[#06C755]/30 transition-all active:scale-[0.98]"
            style={{ background: LINE_GREEN }}
          >
            <MessageCircle className="h-5 w-5" />
            เพิ่มเพื่อน LINE OA
          </button>
          {isChecking ? (
            <p className="flex items-center justify-center gap-2 text-xs text-slate-500 -mt-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              กำลังรอการเพิ่มเพื่อน… กลับมาที่หน้านี้หลังกด &ldquo;เพิ่มเพื่อน&rdquo; ในแอป LINE
            </p>
          ) : (
            <p className="text-xs text-slate-500 text-center -mt-1">
              เมื่อเพิ่มเพื่อนเสร็จและกลับมาที่หน้านี้ ระบบจะพาเข้าสู่คำร้องอัตโนมัติ
            </p>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={onRetryFriendship}
            className="w-full rounded-2xl py-3 text-base font-medium"
          >
            ตรวจสอบอีกครั้ง
          </Button>
        </div>
      </div>
    </GateCard>
  )
}

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
    <div className="rounded-2xl border border-sky-100 bg-white/85 p-4 text-left shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-900">{status || 'กำลังอัปโหลดเอกสาร'}</p>
        {items.length > 0 && <span className="text-sm font-semibold text-sky-700">{totalPercent}%</span>}
      </div>
      {items.length > 0 && (
        <div className="mt-3 space-y-3">
          <Progress value={totalPercent} />
          <div className="space-y-2">
            {items.map(([key, item]) => (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="truncate font-medium text-slate-700">{item.label}</span>
                  <span className={item.status === 'error' ? 'text-red-600' : 'text-slate-500'}>{item.percent}%</span>
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
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef6ff_100%)] px-4 py-10">
      <div className="mx-auto max-w-xl">
        <Card className="border-0 shadow-2xl shadow-sky-100/80">
          <CardContent className="space-y-6 p-8 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-semibold text-slate-900">{t('title')}</h1>
              <p className="text-sm text-slate-600">{t('message')}</p>
            </div>
            <div className="rounded-2xl border border-sky-100 bg-sky-50 p-4 text-left text-sm text-sky-900">
              <ul className="mt-2 space-y-1 text-sky-800">
                <li>{t('bullet1')}</li>
                <li>{t('bullet2')}</li>
                <li>{t('bullet3')}</li>
              </ul>
            </div>
            {attachmentIssue && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left text-sm text-amber-900">
                {t('attachmentWarning')}
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/request/status" className="flex-1">
                <Button type="button" variant="outline" className="w-full">{t('checkStatus')}</Button>
              </Link>
              <Button type="button" className="flex-1" onClick={onClose} disabled={uploadActive}>{t('close')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
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
      // Fall back to HTMLImageElement for mobile browsers that reject some camera files.
    }
  }

  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('ไม่สามารถอ่านรูปภาพเพื่อบีบอัดได้'))
    }
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
      try {
        json = JSON.parse(xhr.responseText)
      } catch {
        json = null
      }

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
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl md:text-2xl font-semibold">
            <User className="h-5 w-5 text-[var(--primary)]" />{t('applicant.title')}
          </CardTitle>
          <CardDescription className="text-base">{t('applicant.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-base sm:text-lg font-medium">{t('applicant.prefix.label')} <span className="text-red-500">*</span></Label>
              <Select value={watch('prefix')} onValueChange={(v) => setValue('prefix', v as FormData['prefix'], { shouldValidate: true })}>
                <SelectTrigger aria-invalid={!!errors.prefix} className="h-12 text-base">
                  <SelectValue placeholder={t('applicant.prefix.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {PREFIXES_KEYS.map(p => <SelectItem key={p} value={p}>{t(`applicant.prefix.options.${p}`)}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldError message={errors.prefix?.message} />
            </div>
            <div className="space-y-2 sm:col-span-1 lg:col-span-1">
              <Label htmlFor="full_name" className="text-base sm:text-lg font-medium">{t('applicant.fullName.label')} <span className="text-red-500">*</span></Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input id="full_name" aria-invalid={!!errors.full_name} {...register('full_name')} className="pl-10 h-12 text-base" placeholder={t('placeholders.fullName')} />
              </div>
              <FieldError message={errors.full_name?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="age" className="text-base sm:text-lg font-medium">{t('applicant.age.label')} <span className="text-red-500">*</span></Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input id="age" type="number" min="1" max="120" aria-invalid={!!errors.age} {...register('age')} className="pl-10 h-12 text-base" placeholder={t('placeholders.age')} />
              </div>
              <FieldError message={errors.age?.message} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone_number" className="text-base sm:text-lg font-medium">{t('applicant.phone.label')} <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input id="phone_number" aria-invalid={!!errors.phone_number} {...register('phone_number')} className="pl-10 h-12 text-base" placeholder={t('placeholders.phone')} />
              </div>
              <FieldError message={errors.phone_number?.message} />
            </div>
            <div className="space-y-2 sm:col-span-1 lg:col-span-2">
              <Label htmlFor="id_or_passport_number" className="text-base sm:text-lg font-medium">{t('applicant.id.label')} <span className="text-red-500">*</span></Label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input id="id_or_passport_number" aria-invalid={!!errors.id_or_passport_number} {...register('id_or_passport_number')} className="pl-10 h-12 text-base" placeholder={t('placeholders.id')} />
              </div>
              <FieldError message={errors.id_or_passport_number?.message} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl md:text-2xl font-semibold">
            <Home className="h-5 w-5 text-[var(--primary)]" />{t('address.title')}
          </CardTitle>
          <CardDescription className="text-base">{t('address.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="house_number" className="text-base sm:text-lg font-medium">{t('address.houseNumber.label')}</Label>
              <Input id="house_number" {...register('house_number')} className="h-12 text-base" placeholder={t('placeholders.houseNumber')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="village_number" className="text-base sm:text-lg font-medium">{t('address.villageNumber.label')}</Label>
              <Input id="village_number" {...register('village_number')} className="h-12 text-base" placeholder={t('placeholders.villageNumber')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="alley" className="text-base sm:text-lg font-medium">{t('address.alley.label')}</Label>
              <Input id="alley" {...register('alley')} className="h-12 text-base" placeholder={t('placeholders.alley')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="road" className="text-base sm:text-lg font-medium">{t('address.road.label')}</Label>
              <Input id="road" {...register('road')} className="h-12 text-base" placeholder={t('placeholders.road')} />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <AsyncCombobox label={`${t('address.province.label')} *`} selected={provinceSel} fetcher={fetchProvinces}
              disabledHint={t('address.provincePlaceholder')}
              onSelect={(item) => {
                if (item.id === -1) { setProvinceSel(null); setValue('province', '', { shouldValidate: true }); setDistrictSel(null); setSubdistrictSel(null); setValue('district', '', { shouldValidate: true }); setValue('sub_district', '', { shouldValidate: true }); setValue('postal_code', '', { shouldValidate: true }); return }
                setProvinceSel(item); setValue('province', item.name, { shouldValidate: true }); setDistrictSel(null); setSubdistrictSel(null); setValue('district', '', { shouldValidate: true }); setValue('sub_district', '', { shouldValidate: true }); setValue('postal_code', '', { shouldValidate: true })
              }}
              error={errors.province?.message as string | undefined} t={t} />
            <AsyncCombobox label={`${t('address.district.label')} *`} selected={districtSel} fetcher={fetchDistricts}
              disabled={!provinceSel} disabledHint={!provinceSel ? t('address.districtPlaceholder') : undefined}
              onSelect={(item) => {
                if (item.id === -1) { setDistrictSel(null); setValue('district', '', { shouldValidate: true }); setSubdistrictSel(null); setValue('sub_district', '', { shouldValidate: true }); setValue('postal_code', '', { shouldValidate: true }); return }
                setDistrictSel(item); setValue('district', item.name, { shouldValidate: true }); setSubdistrictSel(null); setValue('sub_district', '', { shouldValidate: true }); setValue('postal_code', '', { shouldValidate: true })
              }}
              error={errors.district?.message as string | undefined} t={t} />
            <AsyncCombobox label={`${t('address.subdistrict.label')} *`} selected={subdistrictSel} fetcher={fetchSubdistricts}
              disabled={!districtSel} disabledHint={!districtSel ? t('address.districtPlaceholder') : undefined}
              onSelect={(item) => {
                if (item.id === -1) { setSubdistrictSel(null); setValue('sub_district', '', { shouldValidate: true }); setValue('postal_code', '', { shouldValidate: true }); return }
                setSubdistrictSel(item); setValue('sub_district', item.name, { shouldValidate: true })
                const zip = item.extra?.zip ? String(item.extra.zip) : ''
                if (zip) setValue('postal_code', zip, { shouldValidate: true })
              }}
              error={errors.sub_district?.message as string | undefined} t={t} />
            <div className="space-y-2">
              <Label htmlFor="postal_code" className="text-base sm:text-lg font-medium">{t('address.postalCode.label')} <span className="text-red-500">*</span></Label>
              <Input id="postal_code" inputMode="numeric" pattern="[0-9]*" aria-invalid={!!errors.postal_code} {...register('postal_code')} className="h-12 text-base" placeholder={t('placeholders.postalCode')} />
              <FieldError message={errors.postal_code?.message} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* -------------------- Step 2: Documents -------------------- */
const DOC_CARDS: DocCardConfig[] = [
  {
    id: 'police',
    title: 'สำเนาบันทึกประจำวัน',
    subtitle: 'ต้องเซ็น “สำเนาถูกต้อง” · PDF/รูปภาพ · ไม่เกิน 10MB',
    accept: '.pdf,image/*',
    icon: <BookOpen className="h-6 w-6" />,
    previewType: 'any',
    requireCertify: true,
  },
  {
    id: 'idcard',
    title: 'สำเนาบัตรประชาชน',
    subtitle: 'ต้องเซ็น “สำเนาถูกต้อง” · PDF/รูปภาพ · ไม่เกิน 10MB',
    accept: '.pdf,image/*',
    icon: <FileBadge2 className="h-6 w-6" />,
    previewType: 'any',
    requireCertify: true,
  },
  {
    id: 'selfie',
    title: 'รูปถ่ายใบหน้ายืนยันตัวตน',
    subtitle: 'ถ่ายหน้าตรง เห็นชัดเจน · รูปภาพเท่านั้น',
    accept: 'image/*',
    icon: <ScanFace className="h-6 w-6" />,
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

  return (
    <div className="space-y-6">
      <div ref={scrollAnchorRef} />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl md:text-2xl font-semibold">
            <FileText className="h-5 w-5 text-[var(--primary)]" />
            ยื่นเอกสารประกอบ
          </CardTitle>
          <CardDescription className="text-base">
            แนบเอกสารให้ครบทั้ง 3 รายการ — รองรับรูปภาพและ PDF
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* Certified-true-copy notice */}
          <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                <PenLine className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-base font-semibold text-amber-900">
                  กรุณา “รับรองสำเนาถูกต้อง” ก่อนแนบเอกสาร
                </h3>
                <p className="mt-1 text-xs sm:text-sm leading-relaxed text-amber-800">
                  สำเนา<span className="font-medium">บันทึกประจำวัน</span>และสำเนา<span className="font-medium">บัตรประชาชน</span>
                  ทุกฉบับต้องมีลายเซ็นกำกับ พร้อมข้อความ “สำเนาถูกต้อง” มิฉะนั้นเจ้าหน้าที่จะไม่รับพิจารณา
                </p>

                {/* Sample chip */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 shadow-sm">
                    <span className="text-[11px] font-mono tracking-tight text-slate-700">สำเนาถูกต้อง</span>
                    <span className="h-3 w-px bg-slate-300" />
                    <span className="text-[11px] italic text-slate-500">(ลายเซ็น)</span>
                  </div>
                  <span className="text-[11px] text-amber-700">← ตัวอย่างที่ต้องเขียน/เซ็นบนสำเนา</span>
                </div>

                {/* Step list */}
                <ul className="mt-3 space-y-1.5 text-xs sm:text-sm text-amber-900">
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>เขียนข้อความ <span className="font-semibold">“สำเนาถูกต้อง”</span> บนสำเนาทุกแผ่น</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>เซ็นชื่อกำกับให้ตรงกับชื่อในบัตรประชาชน</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>ถ่ายรูปหรือสแกนให้เห็นชัดทั้งใบ — ลายเซ็นและข้อความต้องอ่านออก</span>
                  </li>
                </ul>

                <div className="mt-3 flex items-start gap-2 rounded-lg bg-white/70 px-3 py-2 text-[11px] sm:text-xs text-amber-900">
                  <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    หากใช้สำเนาเพื่อการอื่น ให้ระบุข้อความเพิ่ม เช่น
                    <span className="font-medium"> “ใช้เพื่อขอดูภาพกล้องวงจรปิดเทศบาลนครหัวหินเท่านั้น”</span>
                    เพื่อป้องกันการนำสำเนาไปใช้ผิดวัตถุประสงค์
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Progress tracker */}
          <div className="flex items-center gap-3 rounded-2xl border bg-slate-50 px-4 py-3">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className={[
                    'h-2 rounded-full transition-all duration-300',
                    files[i] ? 'w-8 bg-emerald-500' : 'w-2 bg-slate-300',
                  ].join(' ')}
                />
              ))}
            </div>
            <span className={['text-sm font-semibold transition-colors duration-200', allDone ? 'text-emerald-700' : 'text-slate-700'].join(' ')}>
              {doneCount}/3 เอกสาร
            </span>
            {allDone && (
              <span className="ml-auto flex items-center gap-1 text-xs font-medium text-emerald-600">
                <CheckCheck className="h-4 w-4" />
                ครบแล้ว
              </span>
            )}
          </div>

          {/* All-done banner */}
          {allDone && (
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 animate-in fade-in slide-in-from-top-2 duration-300">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-800">เอกสารครบแล้ว — กด <span className="font-semibold">ถัดไป</span> เพื่อดำเนินการต่อ</p>
            </div>
          )}

          {/* Cards */}
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

          {/* Global error */}
          {docsError && !allDone && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <p className="text-sm text-red-700">{docsError}</p>
            </div>
          )}

          {/* Helper note */}
          <p className="text-xs text-slate-500 text-center">
            ข้อมูลและเอกสารทั้งหมดได้รับการเข้ารหัสและเก็บรักษาอย่างปลอดภัย
          </p>
        </CardContent>
      </Card>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="incident_date" className="text-base sm:text-lg font-medium">
            {t('incident.date.label')} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="incident_date"
            type="date"
            aria-invalid={!!errors.incident_date}
            className="h-12 text-base"
            {...register('incident_date', { setValueAs: setIncidentDateAs })}
          />
          <p className="text-sm text-slate-600 min-h-[1.25rem]" aria-live="polite">
            {datePreview
              ? t('incident.date.selected', { value: datePreview })
              : <span className="text-slate-400">{t('incident.date.placeholder')}</span>}
          </p>
          <FieldError message={errors.incident_date?.message} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="incident_time" className="text-base sm:text-lg font-medium">
            {t('incident.time.label')} <span className="text-red-500">*</span>
          </Label>
          <Input
            id="incident_time"
            type="time"
            aria-invalid={!!errors.incident_time}
            className="h-12 text-base"
            {...register('incident_time', { setValueAs: setIncidentTimeAs })}
          />
          <p className="text-sm text-slate-600 min-h-[1.25rem]" aria-live="polite">
            {timePreview
              ? t('incident.time.selected', { value: timePreview })
              : <span className="text-slate-400">{t('incident.time.placeholder')}</span>}
          </p>
          <FieldError message={errors.incident_time?.message} />
        </div>
      </div>
      <p className="text-xs text-slate-500">{t('incident.dateTimeHint')}</p>
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
    <div className="space-y-6">
      <div ref={scrollAnchorRef} />
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl md:text-2xl font-semibold">
            <Camera className="h-5 w-5 text-[var(--primary)]" />{t('incident.title')}
          </CardTitle>
          <CardDescription className="text-base">{t('incident.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ประเภทคำร้อง */}
          <div className="space-y-4">
            <Label className="text-base sm:text-lg font-medium">{t('incident.requestType.label')} <span className="text-destructive">*</span></Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {CATEGORIES_KEYS.map((category) => {
                const isSelected = watch('request_type') === category
                const isViewData = category === 'ขอดูข้อมูลรูปภาพ'
                const requestTypeKey = isViewData ? 'view' : 'copy'
                const handleSelect = () => setValue('request_type', category, { shouldValidate: true })
                return (
                  <div key={category} role="radio" aria-checked={isSelected} tabIndex={0}
                    onClick={handleSelect} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSelect()}
                    className={['group relative cursor-pointer rounded-xl p-3 sm:p-4 transition-all duration-300 border-2 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
                      isSelected ? 'border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-md ring-2 ring-primary/20' : 'border-border bg-card hover:border-primary/30 hover:bg-accent/60'].join(' ')}>
                    <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                      <div className={['relative w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 transition-all duration-200', isSelected ? 'border-primary bg-primary scale-110' : 'border-muted-foreground/40 group-hover:border-primary/50'].join(' ')}>
                        {isSelected && <div className="absolute inset-0 flex items-center justify-center"><div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary-foreground animate-in fade-in zoom-in duration-200" /></div>}
                      </div>
                    </div>
                    <div className="flex flex-col space-y-2 sm:space-y-3">
                      <div className={['w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300', isSelected ? 'bg-primary text-primary-foreground shadow-lg' : 'bg-primary/10 text-primary group-hover:bg-primary/20'].join(' ')}>
                        {isViewData ? <Camera className="h-4 w-4 sm:h-5 sm:w-5" /> : <FileText className="h-4 w-4 sm:h-5 sm:w-5" />}
                      </div>
                      <div className="space-y-1 sm:space-y-1.5">
                        <h3 className={['font-semibold text-sm sm:text-base transition-colors duration-200', isSelected ? 'text-primary' : 'text-foreground group-hover:text-primary'].join(' ')}>
                          {t(`incident.category.options.${category}`)}
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-tight line-clamp-3 sm:line-clamp-2">
                          {t(`incident.requestType.${requestTypeKey}.description`)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1 sm:gap-1.5">
                        {isViewData ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-primary/10 text-primary ring-1 ring-primary/15">
                            <Camera className="w-3 h-3" />{t('incident.requestType.view.badge')}
                          </span>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-primary/10 text-primary ring-1 ring-primary/15">
                              <FileText className="w-3 h-3" />{t('incident.requestType.copy.badge')}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-accent text-accent-foreground ring-1 ring-primary/10">
                              <ShieldCheck className="w-3 h-3" />{t('incident.requestType.copy.badgeEvidence')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-r from-primary/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  </div>
                )
              })}
            </div>
            <FieldError message={errors.request_type?.message} />
          </div>

          {/* สถานะการเกี่ยวข้อง */}
          <div className="space-y-4">
            <Label className="text-base sm:text-lg font-medium">{t('incident.involvement.label')} <span className="text-red-500">*</span></Label>
            <div className="space-y-4">
              <Select value={watch('involvement_role')} onValueChange={(v) => setValue('involvement_role', v as FormData['involvement_role'], { shouldValidate: true })}>
                <SelectTrigger aria-invalid={!!errors.involvement_role} className="h-12 text-base">
                  <SelectValue placeholder={t('incident.involvement.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {INVOLVEMENT_ROLES_KEYS.map(r => <SelectItem key={r} value={r}>{t(`incident.involvement.options.${r}`)}</SelectItem>)}
                </SelectContent>
              </Select>
              <FieldError message={errors.involvement_role?.message as string | undefined} />
              {(watch('involvement_role') === 'ญาติ' || watch('involvement_role') === 'ผู้เกี่ยวข้อง') && (
                <div className="space-y-2">
                  <Label htmlFor="involvement_explain" className="text-base font-medium">{t('incident.involvement.explainLabel')}</Label>
                  <Input id="involvement_explain" placeholder={t('incident.involvement.explainPlaceholder')} aria-invalid={!!errors.involvement_explain} {...register('involvement_explain')} className="h-12 text-base" />
                  <FieldError message={errors.involvement_explain?.message as string | undefined} />
                </div>
              )}
            </div>
          </div>

          <AsyncCombobox label={`${t('incident.category.label')} *`} selected={categorySel} fetcher={fetchCategories}
            placeholder={t('incident.category.placeholder')}
            onSelect={(item) => {
              if (item.id === -1) { setCategorySel(null); setValue('category_id', 0, { shouldValidate: true }); setSelectedCategoryName(''); return }
              setCategorySel(item); setValue('category_id', item.id, { shouldValidate: true }); setSelectedCategoryName(item.name)
            }}
            error={errors.category_id?.message as string | undefined} t={t} />

          <DateTimeIncidentFields register={register} errors={errors} watch={watch} t={t} />

          <div className="space-y-2">
            <Label htmlFor="incident_location" className="text-base sm:text-lg font-medium">{t('incident.location.label')} <span className="text-red-500">*</span></Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input id="incident_location" placeholder={t('incident.location.placeholder')} aria-invalid={!!errors.incident_location} {...register('incident_location')} className="pl-10 h-12 text-base" />
            </div>
            <FieldError message={errors.incident_location?.message} />
          </div>

          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <Label htmlFor="request_details" className="text-base sm:text-lg font-medium">{t('incident.details.label')}</Label>
              <span className="text-sm text-muted-foreground">{t('incident.details.hint')}</span>
            </div>
            <Textarea id="request_details" rows={4} className="resize-none text-base min-h-[120px]" placeholder={t('placeholders.incidentDetails')} {...register('request_details')} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* -------------------- Step 4: Review & Consent -------------------- */
function StepReviewConsent(props: {
  watch: ReturnType<typeof useForm<FormData>>['watch']
  setValue: ReturnType<typeof useForm<FormData>>['setValue']
  errors: ReturnType<typeof useForm<FormData>>['formState']['errors']
  selectedCategoryName?: string
  policeReportFile: File | null
  idCardFile: File | null
  selfieFile: File | null
  t: ReturnType<typeof useTranslations>
}) {
  const { watch, setValue, errors, selectedCategoryName, policeReportFile, idCardFile, selfieFile, t } = props

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
  const docsList = [
    policeReportFile && 'สำเนาบันทึกประจำวัน',
    idCardFile && 'สำเนาบัตรประชาชน',
    selfieFile && 'รูปถ่ายใบหน้ายืนยันตัวตน',
  ].filter(Boolean).join(', ')

  const preview = {
    name: watch('full_name') || '—',
    phone: watch('phone_number') || '—',
    category: selectedCategoryName || '—',
    type: watch('request_type') || '—',
    when: formatThaiDateTimeLong(watch('incident_date'), watch('incident_time')) || '—',
    where: watch('incident_location') || '—',
    address: buildAddress() || '—',
    involvement: role ? ((role === 'ญาติ' || role === 'ผู้เกี่ยวข้อง') && roleExplain ? `${role} (${roleExplain})` : role) : '—',
    docs: docsList || 'ไม่มี',
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl md:text-2xl font-semibold">{t('review.title')}</CardTitle>
          <CardDescription className="text-base">{t('review.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm sm:text-base">
          <div className="flex items-start gap-3">
            <User className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div><div className="text-muted-foreground">{t('review.labels.applicant')}</div><div className="font-medium">{preview.name}</div><div className="text-muted-foreground mt-1">{preview.address}</div></div>
          </div>
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div><div className="text-muted-foreground">{t('review.labels.involvement')}</div><div className="font-medium">{preview.involvement}</div></div>
          </div>
          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div><div className="text-muted-foreground">{t('review.labels.contact')}</div><div className="font-medium">{preview.phone}</div></div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div><div className="text-muted-foreground">{t('review.labels.category')}</div><div className="font-medium">{preview.category}</div></div>
          </div>
          <div className="flex items-start gap-3">
            <Camera className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div><div className="text-muted-foreground">{t('review.labels.type')}</div><div className="font-medium">{preview.type}</div></div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div><div className="text-muted-foreground">{t('review.labels.datetime')}</div><div className="font-medium">{preview.when}</div></div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div><div className="text-muted-foreground">{t('review.labels.location')}</div><div className="font-medium">{preview.where}</div></div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div><div className="text-muted-foreground">{t('review.labels.documents')}</div><div className="font-medium">{preview.docs}</div></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          <div className="flex items-start gap-3">
            <Checkbox id="consent" checked={watch('consent')} onCheckedChange={(checked) => setValue('consent', Boolean(checked), { shouldValidate: true })} />
            <div className="space-y-2">
              <Label htmlFor="consent" className="text-base sm:text-lg font-medium cursor-pointer">{t('review.consent.title')}</Label>
              <p className="text-base text-muted-foreground">{t('review.consent.summary')}</p>
              <details className="rounded-md border bg-muted/30 p-3">
                <summary className="cursor-pointer select-none text-sm font-medium text-foreground/80 hover:underline">{t('review.consent.showDetails')}</summary>
                <div className="mt-2 space-y-2 text-sm text-muted-foreground"><p>{t('review.consent.details')}</p></div>
              </details>
              <FieldError message={errors.consent?.message} />
            </div>
          </div>
        </CardContent>
      </Card>
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
    <div className="min-h-screen bg-gray-50">
      <section className="relative" aria-labelledby="hero-title">
        <div className="absolute inset-0">
          <Image src="/hero/hero.png" alt="ภาพกล้อง CCTV" fill priority className="object-cover" sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        </div>
        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <Badge className="bg-white/10 backdrop-blur text-white/80 border-white/10">{t('hero.badge')}</Badge>
              <h1 id="hero-title" className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">{t('hero.title')}</h1>
              <p className="mt-3 text-base sm:text-lg text-blue-50 max-w-3xl">{t('hero.subtitle')}</p>
              <ul className="mt-6 flex flex-wrap items-center gap-4 text-blue-50">
                <li className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />{t('hero.features.security')}</li>
                <li className="flex items-center gap-2"><Clock className="h-5 w-5" />{t('hero.features.tracking')}</li>
                <li className="flex items-center gap-2"><FileText className="h-5 w-5" />{t('hero.features.complete')}</li>
              </ul>
              <div className="mt-6 max-w-3xl">
                <Stepper current={step} onStepChange={(i) => i <= step && setStep(i)} t={t} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-7xl mx-auto px-6 lg:px-8 pt-24 pb-8">
        <div className="w-full">
          {step === 0 && <StepApplicant register={register} setValue={setValue} watch={watch} errors={errors} t={t} locale={locale} />}
          {step === 1 && <StepDocuments policeReportFile={policeReportFile} setPoliceReportFile={setPoliceReportFile} idCardFile={idCardFile} setIdCardFile={setIdCardFile} selfieFile={selfieFile} setSelfieFile={setSelfieFile} docsError={docsError} />}
          {step === 2 && <StepIncident register={register} setValue={setValue} watch={watch} errors={errors} setSelectedCategoryName={setSelectedCategoryName} t={t} locale={locale} />}
          {step === 3 && <StepReviewConsent setValue={setValue} watch={watch} errors={errors} selectedCategoryName={selectedCategoryName} policeReportFile={policeReportFile} idCardFile={idCardFile} selfieFile={selfieFile} t={t} />}
        </div>
        <div className="mt-8 pt-6 border-t">
          <div className="flex items-center justify-between gap-4">
            <Button variant="outline" className="h-12 text-base px-6" onClick={prevStep} disabled={step === 0 || isSubmitting}>
              <ArrowLeft className="h-5 w-5 mr-2" />{t('actions.back')}
            </Button>
            <div className="flex justify-center">
              <button className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">{t('actions.saveDraft')}</button>
            </div>
            {step < STEPS.length - 1 ? (
              <Button className="h-12 text-base px-6 bg-primary hover:bg-primary/90" onClick={nextStep} disabled={isSubmitting}>
                {t('actions.next')}<ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            ) : (
              <Button className="h-12 text-base px-6 bg-primary hover:bg-primary/90" disabled={isSubmitting} onClick={() => void onSubmit()}>
                {isSubmitting ? t('actions.submitting') : <span className="inline-flex items-center gap-2"><Send className="h-5 w-5" />{t('actions.submit')}</span>}
              </Button>
            )}
          </div>
        </div>
        <div className="mt-4">
          <UploadProgressPanel progress={uploadProgress} status={uploadStatus} />
        </div>
      </main>
    </div>
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
      if (f === 'involvement_explain') { const r = watch('involvement_role'); if (r !== 'ญาติ' && r !== 'ผู้เกี่ยวข้อง') return true; return Boolean(String(v ?? '').trim()) }
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
        if (el) { const rect = el.getBoundingClientRect(); const scrollTop = window.pageYOffset || document.documentElement.scrollTop; window.scrollTo({ top: scrollTop + rect.top - 12, behavior: 'smooth' }) }
      })
    }
  }, [step, previousStep])

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="relative" aria-labelledby="m-hero-title">
        <div className="absolute inset-0">
          <Image src="/hero/hero.png" alt="ภาพกล้อง CCTV" fill priority className="object-cover" sizes="100vw" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        </div>
        <div className="relative px-4 sm:px-5 pt-16 py-6 sm:py-8">
          <h1 id="m-hero-title" className="mt-3 text-xl sm:text-2xl font-bold text-white">{t('hero.mobileTitle')}</h1>
          <p className="mt-2 text-base text-blue-100">{t('hero.mobileSubtitle')}</p>
          <div className="mt-4"><Stepper current={step} onStepChange={(i) => i <= step && setStep(i)} t={t} /></div>
        </div>
      </section>

      <main className="px-4 py-6 space-y-6 pb-20">
        {step === 0 && <StepApplicant register={register} setValue={setValue} watch={watch} errors={errors} t={t} locale={locale} />}
        {step === 1 && <StepDocuments policeReportFile={policeReportFile} setPoliceReportFile={setPoliceReportFile} idCardFile={idCardFile} setIdCardFile={setIdCardFile} selfieFile={selfieFile} setSelfieFile={setSelfieFile} docsError={docsError} scrollAnchorRef={step2HeaderRef} />}
        {step === 2 && <StepIncident register={register} setValue={setValue} watch={watch} errors={errors} setSelectedCategoryName={setSelectedCategoryName} scrollAnchorRef={step2HeaderRef} t={t} locale={locale} />}
        {step === 3 && <StepReviewConsent setValue={setValue} watch={watch} errors={errors} selectedCategoryName={selectedCategoryName} policeReportFile={policeReportFile} idCardFile={idCardFile} selfieFile={selfieFile} t={t} />}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-base text-muted-foreground">{t('progress.label')}</span>
            <span className="text-base font-medium">{t('progress.percentage', { percent: score })}</span>
          </div>
          <Progress value={score} />
        </div>
      </main>

      <div className="sticky bottom-0 bg-white border-t px-4 py-3 space-y-3">
        <UploadProgressPanel progress={uploadProgress} status={uploadStatus} />
        <div className="flex items-center gap-3">
          <Button variant="outline" className="flex-1 h-14 text-lg" onClick={prevStep} disabled={step === 0 || isSubmitting}>
            <ArrowLeft className="h-5 w-5 mr-2" />{t('actions.back')}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button className="flex-1 h-14 text-lg bg-primary hover:bg-primary/90" onClick={nextStep} disabled={isSubmitting}>
              {t('actions.next')}<ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          ) : (
            <Button className="flex-1 h-14 text-lg bg-primary hover:bg-primary/90" disabled={isSubmitting} onClick={() => void onSubmit()}>
              {isSubmitting ? t('actions.submitting') : <span className="inline-flex items-center gap-2"><Send className="h-5 w-5" />{t('actions.submit')}</span>}
            </Button>
          )}
        </div>
        <div className="flex justify-center">
          <button className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">{t('actions.saveDraft')}</button>
        </div>
      </div>
    </div>
  )
}

/* -------------------- Page -------------------- */
export default function RequestPage() {
  const t = useTranslations('RequestPage')
  const locale = useLocale()
  const isDesktop = useIsDesktop()

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID || process.env.NEXT_PUBLIC_LINE_LIFF_ID || ''
  const liffRedirectUri = useMemo(() => {
    return getRequestRedirectUri()
  }, [])

  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const [gateState, setGateState] = useState<GateState>('booting')
  const [gateError, setGateError] = useState('')
  const [profile, setProfile] = useState<LiffUserProfile | null>(null)
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
      consent: false,
    },
  })

  const { setValue, getValues, trigger } = form

  // Sync file state into form (for completeness — backend reads files via FormData, not this field)
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
        if (!hasReturned) { window.sessionStorage.setItem(redirectKey, '1'); window.location.replace(`https://liff.line.me/${liffId}`); return }
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

  useEffect(() => { void initGate() }, [initGate])

  const closeWindow = useCallback(() => {
    const liff = liffRef.current
    if (liff?.isInClient()) { liff.closeWindow(); return }
    window.close()
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
    setUploadStatus('กำลังบันทึกคำร้อง...')
    try {
      const payload = { ...getValues(), category_id: Number(getValues('category_id')), language: 'th' as const }
      const res = await fetch('/api/reports', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok || !json?.success) throw new Error(json?.message || 'ไม่สามารถบันทึกคำร้องได้')
      const reportId = Number(json.data.report_id)
      const trackingToken = String(json.data.tracking_token || '')
      if (!trackingToken) throw new Error('ไม่พบ token สำหรับอัปโหลดเอกสาร')
      setDoneReportId(reportId)
      setUploadStatus('บันทึกคำร้องแล้ว กำลังบีบอัดและอัปโหลดเอกสาร...')
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
      <div className="min-h-dvh flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 via-white to-sky-50/60 px-4 py-12">
        <div className="w-full max-w-sm">
          <GateBrand />
          <Card className="rounded-3xl border-0 shadow-2xl shadow-slate-200/70">
            <CardContent className="p-8">
              <div className="flex flex-col items-center gap-6 text-center">
                <div className="relative flex h-16 w-16 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-200 opacity-60" />
                  <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-sky-100">
                    <Loader2 className="h-6 w-6 animate-spin text-sky-600" />
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-slate-900">กำลังเตรียมระบบ…</p>
                  <p className="text-sm text-slate-500">ตรวจสอบบัญชี LINE และสิทธิ์การใช้งาน</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
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
