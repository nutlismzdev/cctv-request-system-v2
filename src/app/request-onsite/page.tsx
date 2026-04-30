// src/app/request/page.tsx
'use client'

import React, { useEffect, useMemo, useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
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
  Camera, ShieldCheck, Clock, FileText, MapPin, User, Phone, CreditCard, Send, Home, ArrowLeft, ArrowRight, CheckCircle,
  ChevronsUpDown, Check, Loader2, X
} from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import {
  Command, CommandInput, CommandList, CommandEmpty, CommandItem, CommandGroup,
} from '@/components/ui/command'
import RequestLoadingSkeleton from '@/components/request-loading-skeleton'


/* -------------------- Config -------------------- */
// const PREFIXES = ['นาย', 'นาง', 'นางสาว'] as const // Now using translations
const PREFIXES_KEYS = ['นาย', 'นาง', 'นางสาว'] as const // Keep for schema validation
// const CATEGORIES = ['ขอสำเนาข้อมูลภาพ', 'ขอดูข้อมูลรูปภาพ'] as const // Now using translations
const CATEGORIES_KEYS = ['ขอสำเนาข้อมูลภาพ', 'ขอดูข้อมูลรูปภาพ'] as const // Keep for schema validation
// const INVOLVEMENT_ROLES = ['ผู้เสียหาย', 'ญาติ', 'ผู้เกี่ยวข้อง', 'เจ้าหน้าที่รัฐ', 'ประกัน'] as const // Now using translations
const INVOLVEMENT_ROLES_KEYS = ['ผู้เสียหาย', 'ญาติ', 'ผู้เกี่ยวข้อง', 'เจ้าหน้าที่รัฐ', 'ประกัน'] as const // Keep for schema validation

// ✅ Hoisted RegExp constants (js-hoist-regexp) — avoid re-creation on every render
const RE_BANGKOK = /กรุงเทพ|bangkok/i
const RE_ALLEY_PREFIX = /^(ซอย|ตรอก)\s*/i
const RE_ROAD_PREFIX = /^ถนน\s*/i

const schemaBase = z.object({
  // ผู้ยื่นคำร้อง
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

  // การเกี่ยวข้องกับเหตุการณ์
  involvement_role: z.enum(INVOLVEMENT_ROLES_KEYS, { message: 'กรุณาเลือกสถานะการเกี่ยวข้อง' }),
  involvement_explain: z.string().optional(),

  // ที่อยู่
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

  // เหตุการณ์
  category_id: z.number().min(1, 'กรุณาเลือกหมวดหมู่เหตุการณ์'),
  request_type: z.enum(CATEGORIES_KEYS, { message: 'กรุณาเลือกประเภทคำร้อง' }),
  incident_date: z.string().min(1, 'กรุณาระบุวันที่เกิดเหตุ'),
  incident_time: z.string().min(1, 'กรุณาระบุเวลาที่เกิดเหตุ'),
  incident_location: z.string().min(1, 'กรุณาระบุสถานที่เกิดเหตุ'),
  request_details: z.string().optional(),

  // เอกสารประกอบ
  supporting_documents: z.object({
    id_card_copy: z.boolean(),
    police_report_copy: z.boolean(),
    other: z.boolean(),
    other_details: z.string().optional(),
  }).refine((docs) => {
    // ต้องเลือกเอกสารอย่างน้อย 1 รายการ
    if (!docs.id_card_copy && !docs.police_report_copy && !docs.other) {
      return false;
    }
    // ถ้าเลือก "อื่นๆ" ต้องกรอกรายละเอียด
    if (docs.other && !docs.other_details?.trim()) {
      return false;
    }
    return true;
  }, {
    message: 'กรุณาเลือกเอกสารหลักฐานประกอบอย่างน้อย 1 รายการ และกรอกรายละเอียดเอกสารอื่นๆ หากเลือก',
    path: ['supporting_documents'],
  }),

  // ยินยอม
  consent: z.boolean().refine(v => v, 'ต้องยอมรับเงื่อนไขก่อนยื่นคำร้อง'),
})
const schema = schemaBase.superRefine((data, ctx) => {
  if (data.involvement_role === 'ญาติ' || data.involvement_role === 'ผู้เกี่ยวข้อง') {
    if (!data.involvement_explain || !data.involvement_explain.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'กรุณาระบุความเกี่ยวข้อง',
        path: ['involvement_explain'],
      })
    }
  }
})
type FormData = z.infer<typeof schema>

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

/* -------------------- Small shared components -------------------- */
function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-sm text-red-600 font-medium">{message}</p>
}

//* Stepper */
const STEPS = [
  { key: 'applicant', labelKey: 'stepper.step1' },
  { key: 'incident', labelKey: 'stepper.step2' },
  { key: 'review', labelKey: 'stepper.step3' },
] as const

type StepperProps = {
  current: number
  onStepChange?: (i: number) => void
}

/**
 * Minimal Stepper — เส้นบาง + จุดเล็ก เพื่อไม่แย่งซีนฮีโร่
 * - สูงรวม ~24px เท่านั้น
 * - แสดงชื่อเฉพาะขั้นตอนปัจจุบัน (ตัวเล็ก)
 * - จุดคลิกย้อนกลับได้เฉพาะขั้นตอนที่ผ่านมา
 */
function Stepper({ current, onStepChange, t }: StepperProps & { t: ReturnType<typeof useTranslations> }) {
  const pct = Math.max(0, Math.min(100, (current / (STEPS.length - 1)) * 100))
  const isStepClickable = (index: number) => typeof onStepChange === 'function' && index <= current
  const currentLabel = t(STEPS[current].labelKey)

  return (
    <nav aria-label={t('stepper.current', { current: current + 1, total: STEPS.length, label: currentLabel })} className="w-full select-none">
      <div className="relative">
        {/* Base line */}
        <div className="h-[2px] sm:h-[3px] w-full bg-white/30 rounded-full">
          {/* progress */}
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Dots */}
        <div className="absolute inset-0 flex items-center justify-between">
          {STEPS.map((s, i) => {
            const status = i < current ? 'done' : i === current ? 'current' : 'upcoming'
            const base =
              'rounded-full transition-all duration-200 ring-1 focus:outline-none focus:ring-2'
            const cls =
              status === 'done'
                ? 'h-2.5 w-2.5 sm:h-3 sm:w-3 bg-white ring-white/70'
                : status === 'current'
                ? 'h-3 w-3 sm:h-3.5 sm:w-3.5 bg-white ring-blue-300 scale-110'
                : 'h-2.5 w-2.5 sm:h-3 sm:w-3 bg-white/45 ring-white/40'
            const clickable = isStepClickable(i)
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

      {/* Caption (current only) */}
      <div className="mt-2 text-[11px] sm:text-xs text-white/85">
        {t('stepper.current', { current: current + 1, total: STEPS.length, label: currentLabel })}
      </div>
    </nav>
  )
}

/* -------------------- Async Combobox -------------------- */
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
  const {
    label, placeholder, valueName,
    fetcher, onSelect, selected, disabled, disabledHint, error, allowClear = true, t
  } = props
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
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled}
            className="w-full justify-between h-12 text-base px-4"
            title={disabled ? (disabledHint ?? '') : showText || placeholder}
          >
            <div className="truncate text-left">
              {disabled ? (disabledHint ?? t('placeholders.disabled')) : (showText || <span className="text-muted-foreground">{placeholder}</span>)}
            </div>
            <div className="flex items-center gap-1">
              {allowClear && !!selected && !disabled && (
                <X
                  className="h-5 w-5 text-muted-foreground hover:text-foreground"
                  onClick={(e) => { e.stopPropagation(); onSelect({ id: -1, name: '' }) }}
                />
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
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="flex items-center gap-2 mb-2">
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
                    <CommandItem
                      key={item.id}
                      value={String(item.id)}
                      onSelect={() => { onSelect(item); setOpen(false) }}
                    >
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

/* -------------------- Step contents -------------------- */
// Step 1: Applicant & Address
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

  // ✅ useCallback to stabilize function references (rerender-dependencies)
  const fetchProvinces = useCallback(async (q: string): Promise<ComboItem[]> => {
    const baseUrl = `/api/geo/provinces?limit=100&lang=${locale}` // แสดงข้อมูลทั้งหมด (ประเทศไทยมี 77 จังหวัด)
    const url = q ? `${baseUrl}&q=${encodeURIComponent(q)}` : baseUrl
    const res = await fetch(url)
    const json = await res.json()
    if (!json?.success) return []
    return json.items.map((p: { id: number; name: string }) => ({ id: p.id, name: p.name }))
  }, [locale])

  const fetchDistricts = useCallback(async (q: string): Promise<ComboItem[]> => {
    if (!provinceSel?.id) return []
    const base = `/api/geo/districts?provinceId=${provinceSel.id}&limit=50&lang=${locale}` // แสดงอำเภอทั้งหมด (จังหวัดใหญ่สุดมีประมาณ 30 อำเภอ)
    const url = q ? `${base}&q=${encodeURIComponent(q)}` : base
    const res = await fetch(url)
    const json = await res.json()
    if (!json?.success) return []
    return json.items.map((d: { id: number; name: string }) => ({ id: d.id, name: d.name }))
  }, [locale, provinceSel?.id])

  const fetchSubdistricts = useCallback(async (q: string): Promise<ComboItem[]> => {
    if (!districtSel?.id) return []
    const base = `/api/geo/subdistricts?districtId=${districtSel.id}&limit=100&lang=${locale}` // แสดงตำบลทั้งหมด (อำเภอใหญ่สุดมีประมาณ 50 ตำบล)
    const url = q ? `${base}&q=${encodeURIComponent(q)}` : base
    const res = await fetch(url)
    const json = await res.json()
    if (!json?.success) return []
    return json.items.map((t: { id: number; name: string; zip_code: string }) => ({ id: t.id, name: t.name, extra: { zip: t.zip_code } }))
  }, [locale, districtSel?.id])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl md:text-2xl font-semibold">
            <User className="h-5 w-5 text-[var(--primary)]" />
            {t('applicant.title')}
          </CardTitle>
          <CardDescription className="text-base">{t('applicant.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 ">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-base sm:text-lg font-medium">{t('applicant.prefix.label')} <span className="text-red-500">*</span></Label>
              <Select
                value={watch('prefix')}
                onValueChange={(v) => setValue('prefix', v as FormData['prefix'], { shouldValidate: true })}
              >
                <SelectTrigger aria-invalid={!!errors.prefix} className="h-12 text-base">
                  <SelectValue placeholder={t('applicant.prefix.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {PREFIXES_KEYS.map(p => (
                    <SelectItem key={p} value={p}>
                      {t(`applicant.prefix.options.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.prefix?.message} />
            </div>
            <div className="space-y-2 sm:col-span-1 lg:col-span-1">
              <Label htmlFor="full_name" className="text-base sm:text-lg font-medium">{t('applicant.fullName.label')} <span className="text-red-500">*</span></Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input id="full_name" aria-invalid={!!errors.full_name}
                  {...register('full_name')} className="pl-10 h-12 text-base" placeholder={t('placeholders.fullName')} />
              </div>
              <FieldError message={errors.full_name?.message} />
            </div>
            <div className="space-y-2 sm:col-span-1 lg:col-span-1">
              <Label htmlFor="age" className="text-base sm:text-lg font-medium">{t('applicant.age.label')} <span className="text-red-500">*</span></Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input id="age" type="number" min="1" max="120" aria-invalid={!!errors.age}
                  {...register('age')} className="pl-10 h-12 text-base" placeholder={t('placeholders.age')} />
              </div>
              <FieldError message={errors.age?.message} />
            </div>
          </div>


          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone_number" className="text-base sm:text-lg font-medium">{t('applicant.phone.label')} <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input id="phone_number" aria-invalid={!!errors.phone_number}
                  {...register('phone_number')} className="pl-10 h-12 text-base" placeholder={t('placeholders.phone')} />
              </div>
              <FieldError message={errors.phone_number?.message} />
            </div>
            <div className="space-y-2 sm:col-span-1 lg:col-span-2">
              <Label htmlFor="id_or_passport_number" className="text-base sm:text-lg font-medium">{t('applicant.id.label')} <span className="text-red-500">*</span></Label>
              <div className="relative">
                <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input id="id_or_passport_number"
                  aria-invalid={!!errors.id_or_passport_number}
                  {...register('id_or_passport_number')} className="pl-10 h-12 text-base" placeholder={t('placeholders.id')} />
              </div>
              <FieldError message={errors.id_or_passport_number?.message} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl md:text-2xl font-semibold">
            <Home className="h-5 w-5 text-[var(--primary)]" />
            {t('address.title')}
          </CardTitle>
          <CardDescription className="text-base">{t('address.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 ">
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
              <Input id="road"  {...register('road')} className="h-12 text-base" placeholder={t('placeholders.road')} />
            </div>
          </div>

          {/* Autocomplete: Province / District / Subdistrict */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <AsyncCombobox
              label={`${t('address.province.label')} *`}
              selected={provinceSel}
              fetcher={fetchProvinces}
              disabledHint={t('address.provincePlaceholder')}
              onSelect={(item) => {
                if (item.id === -1) {
                  setProvinceSel(null)
                  setValue('province', '', { shouldValidate: true })
                  setDistrictSel(null); setSubdistrictSel(null)
                  setValue('district', '', { shouldValidate: true })
                  setValue('sub_district', '', { shouldValidate: true })
                  setValue('postal_code', '', { shouldValidate: true })
                  return
                }
                setProvinceSel(item)
                setValue('province', item.name, { shouldValidate: true })
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
                  setDistrictSel(null)
                  setValue('district', '', { shouldValidate: true })
                  setSubdistrictSel(null)
                  setValue('sub_district', '', { shouldValidate: true })
                  setValue('postal_code', '', { shouldValidate: true })
                  return
                }
                setDistrictSel(item)
                setValue('district', item.name, { shouldValidate: true })
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
            <div className="space-y-2">
              <Label htmlFor="postal_code" className="text-base sm:text-lg font-medium">{t('address.postalCode.label')} <span className="text-red-500">*</span></Label>
              <Input id="postal_code" inputMode="numeric" pattern="[0-9]*" aria-invalid={!!errors.postal_code}
                {...register('postal_code')} className="h-12 text-base" placeholder={t('placeholders.postalCode')} />
              <FieldError message={errors.postal_code?.message} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Step 2: Incident
function StepIncident(props: {
  register: ReturnType<typeof useForm<FormData>>['register']
  setValue: ReturnType<typeof useForm<FormData>>['setValue']
  watch: ReturnType<typeof useForm<FormData>>['watch']
  errors: ReturnType<typeof useForm<FormData>>['formState']['errors']
  setSelectedCategoryName: (name: string) => void
  scrollAnchorRef?: React.RefObject<HTMLDivElement | null> // <-- เพิ่มบรรทัดนี้
  t: ReturnType<typeof useTranslations>
  locale: string
}) {
  const { register, setValue, watch, errors, setSelectedCategoryName, scrollAnchorRef, t, locale } = props
  const [categorySel, setCategorySel] = useState<ComboItem | null>(null)

  // ✅ useCallback to stabilize function references (rerender-dependencies)
  const fetchCategories = useCallback(async (q: string): Promise<ComboItem[]> => {
    const url = q ? `/api/categories?q=${encodeURIComponent(q)}&lang=${locale}` : `/api/categories?lang=${locale}`
    const res = await fetch(url)
    const json = await res.json()
    if (!json?.success) return []
    return json.items.map((c: { id: number; name: string }) => ({ id: c.id, name: c.name }))
  }, [locale])

  return (
    <div className="space-y-6">
      {/* วาง Anchor ให้เลื่อนไปเกยหัวข้อได้ตรงเป๊ะ */}
      <div ref={scrollAnchorRef} />

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl md:text-2xl font-semibold">
            <Camera className="h-5 w-5 text-[var(--primary)]" />
            {t('incident.title')}
          </CardTitle>
          <CardDescription className="text-base">{t('incident.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 ">
          {/* ประเภทคำร้อง - card แบบทันสมัย */}
          <div className="space-y-4">
            <Label className="text-base sm:text-lg font-medium">
              {t('incident.requestType.label')} <span className="text-destructive">*</span>
            </Label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {CATEGORIES_KEYS.map((category) => {
                const isSelected = watch('request_type') === category
                const isViewData = category === 'ขอดูข้อมูลรูปภาพ'
                const requestTypeKey = isViewData ? 'view' : 'copy'
                const handleSelect = () =>
                  setValue('request_type', category, { shouldValidate: true })

                return (
                  <div
                    key={category}
                    role="radio"
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={handleSelect}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleSelect()}
                    className={[
                      'group relative cursor-pointer rounded-xl p-3 sm:p-4 transition-all duration-300',
                      'border-2 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]',
                      isSelected
                        ? 'border-primary bg-gradient-to-br from-primary/10 to-primary/5 shadow-md ring-2 ring-primary/20'
                        : 'border-border bg-card hover:border-primary/30 hover:bg-accent/60',
                    ].join(' ')}
                  >
                    <div className="absolute top-2 right-2 sm:top-3 sm:right-3">
                      <div
                        className={[
                          'relative w-4 h-4 sm:w-5 sm:h-5 rounded-full border-2 transition-all duration-200',
                          isSelected
                            ? 'border-primary bg-primary scale-110'
                            : 'border-muted-foreground/40 group-hover:border-primary/50',
                        ].join(' ')}
                      >
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-primary-foreground animate-in fade-in zoom-in duration-200" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col space-y-2 sm:space-y-3">
                      <div
                        className={[
                          'w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all duration-300',
                          isSelected
                            ? 'bg-primary text-primary-foreground shadow-lg'
                            : 'bg-primary/10 text-primary group-hover:bg-primary/20',
                        ].join(' ')}
                      >
                        {isViewData ? (
                          <Camera className="h-4 w-4 sm:h-5 sm:w-5" />
                        ) : (
                          <FileText className="h-4 w-4 sm:h-5 sm:w-5" />
                        )}
                      </div>

                      <div className="space-y-1 sm:space-y-1.5">
                        <h3
                          className={[
                            'font-semibold text-sm sm:text-base transition-colors duration-200',
                            isSelected ? 'text-primary' : 'text-foreground group-hover:text-primary',
                          ].join(' ')}
                        >
                          {t(`incident.category.options.${category}`)}
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground leading-tight line-clamp-3 sm:line-clamp-2">
                          {t(`incident.requestType.${requestTypeKey}.description`)}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-1 sm:gap-1.5">
                        {isViewData ? (
                          <>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-primary/10 text-primary ring-1 ring-primary/15">
                              <Camera className="w-3 h-3" />
                              {t('incident.requestType.view.badge')}
                            </span>

                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-primary/10 text-primary ring-1 ring-primary/15">
                              <FileText className="w-3 h-3" />
                              {t('incident.requestType.copy.badge')}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-accent text-accent-foreground ring-1 ring-primary/10">
                              <ShieldCheck className="w-3 h-3" />
                              {t('incident.requestType.copy.badgeEvidence')}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div
                      className={[
                        'pointer-events-none absolute inset-0 rounded-xl',
                        'bg-gradient-to-r from-primary/5 to-transparent opacity-0 transition-opacity duration-300',
                        'group-hover:opacity-100',
                      ].join(' ')}
                    />
                  </div>
                )
              })}
            </div>
            <FieldError message={errors.request_type?.message} />
          </div>

          {/* หมวดหมู่เหตุการณ์ */}
          {/* Involvement role */}
          <div className="space-y-4">
            <Label className="text-base sm:text-lg font-medium">
              {t('incident.involvement.label')} <span className="text-red-500">*</span>
            </Label>

            <div className="space-y-4">
              <Select
                value={watch('involvement_role')}
                onValueChange={(v) => setValue('involvement_role', v as FormData['involvement_role'], { shouldValidate: true })}
              >
                <SelectTrigger aria-invalid={!!errors.involvement_role} className="h-12 text-base">
                  <SelectValue placeholder={t('incident.involvement.placeholder')} />
                </SelectTrigger>
                <SelectContent>
                  {INVOLVEMENT_ROLES_KEYS.map(r => (
                    <SelectItem key={r} value={r}>
                      {t(`incident.involvement.options.${r}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={errors.involvement_role?.message as string | undefined} />

              {(watch('involvement_role') === 'ญาติ' || watch('involvement_role') === 'ผู้เกี่ยวข้อง') && (
                <div className="space-y-2">
                  <Label htmlFor="involvement_explain" className="text-base font-medium">{t('incident.involvement.explainLabel')}</Label>
                  <Input
                    id="involvement_explain"
                    placeholder={t('incident.involvement.explainPlaceholder')}
                    aria-invalid={!!errors.involvement_explain}
                    {...register('involvement_explain')}
                    className="h-12 text-base"
                  />
                  <FieldError message={errors.involvement_explain?.message as string | undefined} />
                </div>
              )}
            </div>
          </div>

          <AsyncCombobox
            label={`${t('incident.category.label')} *`}
            selected={categorySel}
            fetcher={fetchCategories}
            placeholder={t('incident.category.placeholder')}
            onSelect={(item) => {
              if (item.id === -1) {
                setCategorySel(null)
                setValue('category_id', 0, { shouldValidate: true })
                setSelectedCategoryName('')
                return
              }
              setCategorySel(item)
              setValue('category_id', item.id, { shouldValidate: true })
              setSelectedCategoryName(item.name)
            }}
            error={errors.category_id?.message as string | undefined}
            t={t}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="incident_date" className="text-base sm:text-lg font-medium">{t('incident.date.label')} <span className="text-red-500">*</span></Label>
              <Input id="incident_date" type="date" aria-invalid={!!errors.incident_date} className="h-12 text-base" {...register('incident_date')} />
              <FieldError message={errors.incident_date?.message} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="incident_time" className="text-base sm:text-lg font-medium">{t('incident.time.label')} <span className="text-red-500">*</span></Label>
              <Input id="incident_time" type="time" aria-invalid={!!errors.incident_time} className="h-12 text-base" {...register('incident_time')} />
              <FieldError message={errors.incident_time?.message} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="incident_location" className="text-base sm:text-lg font-medium">{t('incident.location.label')} <span className="text-red-500">*</span></Label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input id="incident_location" placeholder={t('incident.location.placeholder')}
                aria-invalid={!!errors.incident_location}
                {...register('incident_location')} className="pl-10 h-12 text-base" />
            </div>
            <FieldError message={errors.incident_location?.message} />
          </div>

          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
              <Label htmlFor="request_details" className="text-base sm:text-lg font-medium">{t('incident.details.label')}</Label>
              <span className="text-sm text-muted-foreground">{t('incident.details.hint')}</span>
            </div>
            <Textarea id="request_details" rows={4} className="resize-none text-base min-h-[120px]"
              placeholder={t('placeholders.incidentDetails')}
              {...register('request_details')} />
          </div>

          {/* เอกสารประกอบ */}
          <div className="space-y-4">
            <Label className="text-base sm:text-lg font-medium">{t('incident.documents.label')} <span className="text-red-500">*</span></Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="id_card_copy"
                  checked={watch('supporting_documents.id_card_copy')}
                  onCheckedChange={(checked) =>
                    setValue('supporting_documents.id_card_copy', Boolean(checked), { shouldValidate: true })
                  }
                />
                <Label htmlFor="id_card_copy" className="text-sm font-normal cursor-pointer">
                  {t('incident.documents.idCard')}
                </Label>
              </div>

              <div className="flex items-center space-x-3">
                <Checkbox
                  id="police_report_copy"
                  checked={watch('supporting_documents.police_report_copy')}
                  onCheckedChange={(checked) =>
                    setValue('supporting_documents.police_report_copy', Boolean(checked), { shouldValidate: true })
                  }
                />
                <Label htmlFor="police_report_copy" className="text-sm font-normal cursor-pointer">
                  {t('incident.documents.policeReport')}
                </Label>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="other_docs"
                    checked={watch('supporting_documents.other')}
                    onCheckedChange={(checked) =>
                      setValue('supporting_documents.other', Boolean(checked), { shouldValidate: true })
                    }
                  />
                  <Label htmlFor="other_docs" className="text-sm font-normal cursor-pointer">
                    {t('incident.documents.other')}
                  </Label>
                </div>

                {watch('supporting_documents.other') && (
                  <div className="ml-6 space-y-2">
                    <Label htmlFor="other_details" className="text-sm font-medium">{t('incident.documents.otherDetails')}</Label>
                    <Input
                      id="other_details"
                      placeholder={t('incident.documents.otherPlaceholder')}
                      aria-invalid={!!errors.supporting_documents?.other_details}
                      {...register('supporting_documents.other_details')}
                      className="text-base"
                    />
                    <FieldError message={errors.supporting_documents?.other_details?.message} />
                  </div>
                )}
              </div>

              <FieldError message={errors.supporting_documents?.message} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


// Step 3: Review & Consent
function StepReviewConsent(props: {
  watch: ReturnType<typeof useForm<FormData>>['watch']
  setValue: ReturnType<typeof useForm<FormData>>['setValue']
  errors: ReturnType<typeof useForm<FormData>>['formState']['errors']
  selectedCategoryName?: string
  t: ReturnType<typeof useTranslations>
}) {
  const { watch, setValue, errors, selectedCategoryName, t } = props

  // --- helpers for address formatting (no schema change) ---
  // ✅ Hoisted RegExp (js-hoist-regexp) — use module-level constants
  const isBangkok = (prov?: string) => RE_BANGKOK.test(prov ?? '')
  const normAlley = (s?: string) => {
    const v = (s ?? '').trim()
    if (!v) return ''
    if (RE_ALLEY_PREFIX.test(v)) return v
    return `ซอย ${v}`
  }
  const normRoad = (s?: string) => {
    const v = (s ?? '').trim()
    if (!v) return ''
    if (RE_ROAD_PREFIX.test(v)) return v
    return `ถนน ${v}`
  }
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

  const docs = watch('supporting_documents')
  const supportingDocsList = [
    docs?.id_card_copy && 'สำเนาบัตรประจำตัวประชาชน/บัตรประจำตัวเจ้าหน้าที่ของรัฐ',
    docs?.police_report_copy && 'สำเนาบันทึกการแจ้งความ',
    docs?.other && docs.other_details ? `อื่นๆ: ${docs.other_details}` : docs?.other ? 'อื่นๆ' : null,
  ].filter(Boolean)

  const preview = {
    name: watch('full_name') || '—',
    phone: watch('phone_number') || '—',
    category: selectedCategoryName || '—',
    type: watch('request_type') || '—',
    when: watch('incident_date') && watch('incident_time') ? `${watch('incident_date')} ${watch('incident_time')}` : '—',
    where: watch('incident_location') || '—',
    address: buildAddress() || '—',
    involvement: role ? ((role === 'ญาติ' || role === 'ผู้เกี่ยวข้อง') && roleExplain ? `${role} (${roleExplain})` : role) : '—',
    supportingDocuments: supportingDocsList.length > 0 ? supportingDocsList.join(', ') : 'ไม่มี',
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-xl md:text-2xl font-semibold">
            {t('review.title')}
          </CardTitle>
          <CardDescription className="text-base">{t('review.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm sm:text-base">
          <div className="flex items-start gap-3">
            <User className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-muted-foreground">{t('review.labels.applicant')}</div>
              <div className="font-medium">{preview.name}</div>
              <div className="text-muted-foreground mt-1">{preview.address || '—'}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-muted-foreground">{t('review.labels.involvement')}</div>
              <div className="font-medium">{preview.involvement}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-muted-foreground">{t('review.labels.contact')}</div>
              <div className="font-medium">{preview.phone}</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-muted-foreground">{t('review.labels.category')}</div>
              <div className="font-medium">{preview.category}</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Camera className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-muted-foreground">{t('review.labels.type')}</div>
              <div className="font-medium">{preview.type}</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-muted-foreground">{t('review.labels.datetime')}</div>
              <div className="font-medium">{preview.when}</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-muted-foreground">{t('review.labels.location')}</div>
              <div className="font-medium">{preview.where}</div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <FileText className="h-5 w-5 mt-0.5 text-muted-foreground" />
            <div>
              <div className="text-muted-foreground">{t('review.labels.documents')}</div>
              <div className="font-medium">{preview.supportingDocuments}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
  <CardContent className="py-6">
    <div className="flex items-start gap-3">
      <Checkbox
        id="consent"
        checked={watch('consent')}
        onCheckedChange={(checked) => setValue('consent', Boolean(checked), { shouldValidate: true })}
      />

      <div className="space-y-2">
        <Label htmlFor="consent" className="text-base sm:text-lg font-medium cursor-pointer">
          {t('review.consent.title')}
        </Label>

        {/* บทสรุปสั้น */}
        <p className="text-base text-muted-foreground">
          {t('review.consent.summary')}
        </p>

        {/* รายละเอียดแบบพับ/กาง */}
        <details className="rounded-md border bg-muted/30 p-3">
          <summary className="cursor-pointer select-none text-sm font-medium text-foreground/80 hover:underline">
            {t('review.consent.showDetails')}
          </summary>
          <div className="mt-2 space-y-2 text-sm text-muted-foreground">
            <p>
              {t('review.consent.details')}
            </p>

          </div>
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
function DesktopView(props: {
  onSubmit: (data: FormData) => Promise<void>
  form: ReturnType<typeof useForm<FormData>>
  selectedCategoryName: string
  setSelectedCategoryName: (name: string) => void
  t: ReturnType<typeof useTranslations>
  locale: string
}) {
  const { form, onSubmit, selectedCategoryName, setSelectedCategoryName, t, locale } = props
  const { register, handleSubmit, setValue, watch, trigger, formState: { errors, isSubmitting } } = form
  const [step, setStep] = useState(0)

  const stepFields = useMemo(() => [
    ['prefix', 'full_name', 'age', 'phone_number', 'id_or_passport_number',
     'sub_district', 'district', 'province', 'postal_code'] as (keyof FormData)[],
    ['involvement_role', 'involvement_explain', 'category_id', 'request_type', 'incident_date', 'incident_time', 'incident_location', 'supporting_documents'] as (keyof FormData)[],
    ['consent'] as (keyof FormData)[],
  ], [])
  // progress score not used

  const nextStep = async () => {
    const ok = await trigger(stepFields[step], { shouldFocus: true })
    if (!ok) { toast.error(t('errors.required')); return }
    setStep(s => Math.min(s + 1, STEPS.length - 1))
  }
  const prevStep = () => setStep(s => Math.max(s - 1, 0))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero — Image + Gradient overlay */}
      <section className="relative" aria-labelledby="hero-title">
        <div className="absolute inset-0">
          <Image
            src="/hero/hero.png"
            alt="ภาพกล้อง CCTV"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 sm:px-8 py-16 lg:py-20">
          <Badge className="bg-white/10 backdrop-blur text-white/80 border-white/10">{t('hero.badge')}</Badge>
          <h1 id="hero-title" className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold text-white tracking-tight">
            {t('hero.title')}
          </h1>
          <p className="mt-3 text-base sm:text-lg text-blue-50 max-w-3xl">
            {t('hero.subtitle')}
          </p>
          <ul className="mt-6 flex flex-wrap items-center gap-4 text-blue-50">
            <li className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> {t('hero.features.security')}</li>
            <li className="flex items-center gap-2"><Clock className="h-5 w-5" /> {t('hero.features.tracking')}</li>
            <li className="flex items-center gap-2"><FileText className="h-5 w-5" /> {t('hero.features.complete')}</li>
          </ul>

          {/* Minimal Stepper (ไม่มีกรอบ/พื้นหลัง) */}
          <div className="mt-6 max-w-3xl">
            <Stepper current={step} onStepChange={(i) => i <= step && setStep(i)} t={t} />
          </div>
        </div>
      </section>

      {/* Steps Content */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8 pt-24 pb-8">
        <div className="w-full">
          {step === 0 && (<StepApplicant register={register} setValue={setValue} watch={watch} errors={errors} t={t} locale={locale} />)}
          {step === 1 && (<StepIncident register={register} setValue={setValue} watch={watch} errors={errors} setSelectedCategoryName={setSelectedCategoryName} t={t} locale={locale} />)}
          {step === 2 && (<StepReviewConsent setValue={setValue} watch={watch} errors={errors} selectedCategoryName={selectedCategoryName} t={t} />)}
        </div>

        {/* Actions */}
        <div className="mt-8 pt-6 border-t">
          <div className="flex items-center justify-between gap-4">
            <Button variant="outline" className="h-12 text-base px-6" onClick={prevStep} disabled={step === 0 || isSubmitting}>
              <ArrowLeft className="h-5 w-5 mr-2" /> {t('actions.back')}
            </Button>

            <div className="flex justify-center">
              <button className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
                {t('actions.saveDraft')}
              </button>
            </div>

            {step < STEPS.length - 1 ? (
              <Button className="h-12 text-base px-6 bg-primary hover:bg-primary/90" onClick={nextStep} disabled={isSubmitting}>
                {t('actions.next')} <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            ) : (
              <Button className="h-12 text-base px-6 bg-primary hover:bg-primary/90" disabled={isSubmitting} onClick={() => void handleSubmit(onSubmit)()}>
                {isSubmitting ? t('actions.submitting') : (<span className="inline-flex items-center gap-2"><Send className="h-5 w-5" /> {t('actions.submit')}</span>)}
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

/* -------------------- Mobile Layout -------------------- */
function MobileView(props: {
  onSubmit: (data: FormData) => Promise<void>
  form: ReturnType<typeof useForm<FormData>>
  selectedCategoryName: string
  setSelectedCategoryName: (name: string) => void
  t: ReturnType<typeof useTranslations>
  locale: string
}) {
  const { form, onSubmit, selectedCategoryName, setSelectedCategoryName, t, locale } = props
  const { register, handleSubmit, setValue, watch, trigger, formState: { errors, isSubmitting } } = form
  const [step, setStep] = useState(0)
  const [previousStep, setPreviousStep] = useState(0)

  // ★ เพิ่ม anchor ref สำหรับหัวข้อ Step 2
  const step2HeaderRef = useRef<HTMLDivElement>(null)

  const stepFields = useMemo(() => [
    ['prefix', 'full_name', 'age', 'phone_number', 'id_or_passport_number',
     'sub_district', 'district', 'province', 'postal_code'] as (keyof FormData)[],
    ['involvement_role', 'involvement_explain', 'category_id', 'request_type', 'incident_date', 'incident_time', 'incident_location', 'supporting_documents'] as (keyof FormData)[],
    ['consent'] as (keyof FormData)[],
  ], [])
  const score = useMemo(() => {
    // รวมฟิลด์จากทุก step เพื่อแสดง progress ทั้งหมด
    const allFields: (keyof FormData)[] = []
    stepFields.forEach(stepField => {
      allFields.push(...stepField)
    })

    if (allFields.length === 0) return 0

    const filled = allFields.filter(f => {
      const v = watch(f)

      // ข้ามฟิลด์ที่ไม่ได้กรอกหรือเป็นค่า default
      if (v === null || v === undefined || v === '') return false

      if (f === 'supporting_documents') {
        const docs = v as FormData['supporting_documents']
        return docs && (docs.id_card_copy || docs.police_report_copy || docs.other)
      }

      // สำหรับ involvement_explain กรอกเฉพาะตอนเลือก "ญาติ" หรือ "ผู้เกี่ยวข้อง"
      if (f === 'involvement_explain') {
        const role = watch('involvement_role')
        if (role !== 'ญาติ' && role !== 'ผู้เกี่ยวข้อง') return true // ไม่นับเป็น required ถ้าไม่ได้เลือก
        return Boolean(String(v ?? '').trim())
      }

      // สำหรับฟิลด์ boolean (เช่น consent)
      if (typeof v === 'boolean') return v

      // สำหรับฟิลด์ string/number ต้องมีค่าจริงๆ
      const strValue = String(v ?? '').trim()
      return strValue.length > 0
    }).length

    return Math.round((filled / allFields.length) * 100)
  }, [watch, stepFields])

  const nextStep = async () => {
    const ok = await trigger(stepFields[step], { shouldFocus: true })
    if (!ok) { toast.error(t('errors.required')); return }
    setPreviousStep(step)
    const newStep = Math.min(step + 1, STEPS.length - 1)
    setStep(newStep)
  }
  const prevStep = () => setStep(s => Math.max(s - 1, 0))

  // ★ แก้ useEffect ให้ถูก step และเลื่อนไป anchor โดยตรง
  useEffect(() => {
    if (previousStep === 0 && step === 1) {
      // รอให้ DOM ของ Step 2 เรนเดอร์เสร็จก่อนค่อยคำนวณตำแหน่ง
      requestAnimationFrame(() => {
        const el = step2HeaderRef.current
        if (el) {
          const rect = el.getBoundingClientRect()
          const scrollTop = window.pageYOffset || document.documentElement.scrollTop
          // ชดเชยระยะเผื่อชนขอบ/แถบ sticky ด้านล่างเล็กน้อย
          const offset = 12
          window.scrollTo({ top: scrollTop + rect.top - offset, behavior: 'smooth' })
        }
      })
    }
  }, [step, previousStep])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero (mobile) */}
      <section className="relative" aria-labelledby="m-hero-title">
        <div className="absolute inset-0">
          <Image
            src="/hero/hero.png"
            alt="ภาพกล้อง CCTV"
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
        </div>
        <div className="relative px-4 sm:px-5 pt-16 py-6 sm:py-8">
        
          <h1 id="m-hero-title" className="mt-3 text-xl sm:text-2xl font-bold text-white">{t('hero.mobileTitle')}</h1>
          <p className="mt-2 text-base text-blue-100">{t('hero.mobileSubtitle')}</p>

          {/* Minimal Stepper */}
          <div className="mt-4">
            <Stepper current={step} onStepChange={(i) => i <= step && setStep(i)} t={t} />
          </div>
        </div>
      </section>

      {/* Content */}
      <main className="px-4 py-6 space-y-6 pb-20">
        {step === 0 && (<StepApplicant register={register} setValue={setValue} watch={watch} errors={errors} t={t} locale={locale} />)}
        {step === 1 && (
          <StepIncident
            register={register}
            setValue={setValue}
            watch={watch}
            errors={errors}
            setSelectedCategoryName={setSelectedCategoryName}
            scrollAnchorRef={step2HeaderRef} // ★ ส่ง ref ลงไป
            t={t}
            locale={locale}
          />
        )}
        {step === 2 && (<StepReviewConsent setValue={setValue} watch={watch} errors={errors} selectedCategoryName={selectedCategoryName} t={t} />)}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-base text-muted-foreground">{t('progress.label')}</span>
            <span className="text-base font-medium">{t('progress.percentage', { percent: score })}</span>
          </div>
          <Progress value={score} />
        </div>
      </main>

      {/* Sticky nav */}
      <div className="sticky bottom-0 bg-white border-t px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="outline" className="flex-1 h-14 text-lg" onClick={prevStep} disabled={step === 0 || isSubmitting}>
            <ArrowLeft className="h-5 w-5 mr-2" /> {t('actions.back')}
          </Button>

          {step < STEPS.length - 1 ? (
            <Button className="flex-1 h-14 text-lg bg-primary hover:bg-primary/90" onClick={nextStep} disabled={isSubmitting}>
              {t('actions.next')} <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          ) : (
            <Button className="flex-1 h-14 text-lg bg-primary hover:bg-primary/90" disabled={isSubmitting} onClick={() => void handleSubmit(onSubmit)()}>
              {isSubmitting ? t('actions.submitting') : (<span className="inline-flex items-center gap-2"><Send className="h-5 w-5" /> {t('actions.submit')}</span>)}
            </Button>
          )}
        </div>
        <div className="flex justify-center">
          <button className="text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">
            {t('actions.saveDraft')}
          </button>
        </div>
      </div>
    </div>
  )
}

/* -------------------- Success Component -------------------- */
function SuccessMessage({ reportId, t }: { reportId: string; t: ReturnType<typeof useTranslations> }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-green-800 mb-2">{t('success.title')}</h2>
            <p className="text-green-600">{t('success.reportId', { id: reportId })}</p>
            <p className="text-sm text-gray-600 mt-2">{t('success.message')}</p>
            <p className="text-xs text-gray-500 mt-1">{t('success.hint')}</p>
          </div>
          <div className="space-y-3 pt-4">
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full"
            >
              {t('actions.newRequest')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/* -------------------- Page -------------------- */
export default function RequestPage() {
  const router = useRouter()
  const t = useTranslations('RequestPage')
  const locale = useLocale()
  const isDesktop = useIsDesktop()
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [submittedReportId] = useState<string | null>(null)
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('')

  // ป้องกันการส่งคำร้องซ้ำ
  const isSubmittingRef = useRef(false)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      // ผู้ยื่นคำร้อง
      prefix: PREFIXES_KEYS[0],
      full_name: '',
      age: '',
      phone_number: '',
      id_or_passport_number: '',

      // การเกี่ยวข้อง
      involvement_role: undefined,
      involvement_explain: '',

      // ที่อยู่
      house_number: '',
      village_number: '',
      alley: '',
      road: '',
      sub_district: '',
      district: '',
      province: '',
      postal_code: '',

      // เหตุการณ์
      category_id: 0,
      request_type: CATEGORIES_KEYS[0],
      incident_date: '',
      incident_time: '',
      incident_location: '',
      request_details: '',

      // เอกสารประกอบ
      supporting_documents: {
        id_card_copy: false,
        police_report_copy: false,
        other: false,
        other_details: '',
      },

      // ยินยอม
      consent: false,
    },
  })

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const url = `/api/geo/provinces?limit=100&lang=${locale}`
        const res = await fetch(url)
        const json = await res.json()
        if (json?.success) {
          setIsInitialLoading(false)
        } else {
          throw new Error('API not available')
        }
      } catch (error) {
        console.error('Failed to load initial data:', error)
        setIsInitialLoading(false)
      }
    }
    loadInitialData()
  }, [locale])

  const onSubmit = useCallback(async (data: FormData) => {
    // ป้องกันการส่งซ้ำ
    if (isSubmittingRef.current) {
      console.warn(t('errors.submitting'))
      return
    }

    isSubmittingRef.current = true

    try {
      const submitData = {
        ...data,
        category_id: Number(data.category_id),
        language: locale
      }

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(submitData),
      })

      const result = await res.json()

      if (!res.ok) {
        if (result.errors) {
          result.errors.forEach((error: unknown) => {
            const field = (typeof error === 'object' && error && 'field' in error && typeof (error as { field?: unknown }).field === 'string') ? (error as { field: string }).field : 'field'
            const message = (typeof error === 'object' && error && 'message' in error && typeof (error as { message?: unknown }).message === 'string') ? (error as { message: string }).message : 'Unknown error'
            toast.error(`${field}: ${message}`)
          })
          return
        }
        throw new Error(result.message || `HTTP ${res.status}`)
      }

      const reportId = result.data.report_id.toString()
      const trackingToken = result.data.tracking_token as string | undefined

      if (typeof window !== 'undefined') {
        localStorage.setItem('latest_report_id', reportId)
      }

      // Reset form เมื่อส่งสำเร็จ
      form.reset({
        prefix: PREFIXES_KEYS[0],
        full_name: '',
        age: '',
        phone_number: '',
        id_or_passport_number: '',
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
        supporting_documents: {
          id_card_copy: false,
          police_report_copy: false,
          other: false,
          other_details: '',
        },
        consent: false,
      })

      // Redirect ไป success page ของ onsite flow พร้อม token เพื่อให้ QR เป็น LIFF deep link auto-link คำร้อง
      const successUrl = trackingToken
        ? `/success-onsite?id=${encodeURIComponent(reportId)}&token=${encodeURIComponent(trackingToken)}`
        : `/success-onsite?id=${encodeURIComponent(reportId)}`
      router.push(successUrl)

    } catch (error) {
      console.error('Submit error:', error)
      toast.error(t('errors.submitFailed'))
    } finally {
      // รีเซ็ต flag หลังจากเสร็จสิ้น (เผื่อกรณี error)
      setTimeout(() => {
        isSubmittingRef.current = false
      }, 2000) // หน่วงเวลา 2 วินาทีเพื่อป้องกันการส่งซ้ำ
    }
  }, [router, form, t, locale])

  if (submittedReportId) {
    return <SuccessMessage reportId={submittedReportId} t={t} />
  }

  if (isInitialLoading) {
    return <RequestLoadingSkeleton isDesktop={isDesktop} />
  }

  return isDesktop
    ? <DesktopView onSubmit={onSubmit} form={form} selectedCategoryName={selectedCategoryName} setSelectedCategoryName={setSelectedCategoryName} t={t} locale={locale} />
    : <MobileView  onSubmit={onSubmit} form={form} selectedCategoryName={selectedCategoryName} setSelectedCategoryName={setSelectedCategoryName} t={t} locale={locale} />
}
